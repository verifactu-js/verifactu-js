/**
 * The minimal client.
 *
 * Nothing here touches the network: the transport is the seam, so every case injects one. The two
 * exceptions are at the bottom, and they only reach a closed port on localhost.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSifChain } from '@verifactu-js/core';
import type { Cabecera, DatosAlta } from '@verifactu-js/validation';
import {
  NS_RESPUESTA_SUMINISTRO,
  NS_SUMINISTRO_INFORMACION,
  type Remision,
} from '@verifactu-js/xml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type Cliente,
  cargarP12,
  cargarPem,
  crearClientePruebas,
  diagnosticarError,
  normalizarCabeceras,
  type PeticionHttp,
  type RespuestaHttp,
  type Transporte,
  transporteNode,
  VerifactuClientError,
  type VerifactuClientErrorCode,
} from '../src/index.js';

/**
 * Builds a PEM block without spelling its header out as a literal in this file.
 *
 * Nada de lo que sale de aquí es una clave: los cuerpos son «AAA», «BBB» y «CCC». Pero un escáner
 * de secretos no puede saberlo, y una cabecera de clave privada escrita tal cual dispara la regla
 * `private-key` de gitleaks y la nuestra de `.gitleaks.toml`, que bloquea el commit.
 *
 * La otra salida era una excepción en `.gitleaks.toml` para este fichero, y sale peor por dos
 * motivos. Uno: abriría un agujero justo donde alguien pegaría una clave de verdad para depurar
 * un handshake. Y dos: solo arreglaría NUESTRO escáner — el repositorio es público y la
 * protección de secretos de GitHub tiene su propio conjunto de reglas que no configuramos.
 *
 * Componerla no oculta nada. El fichero que se escribe en disco lleva la cabecera entera, que es
 * justo lo que `cargarPem` lee para detectar una clave cifrada sin contraseña.
 */
function pem(tipo: string, cuerpo: string): string {
  return `-----BEGIN ${tipo}-----\n${cuerpo}\n-----END ${tipo}-----\n`;
}

const CABECERA: Cabecera = {
  ObligadoEmision: { NombreRazon: 'EMPRESA DE PRUEBA SL', NIF: '89890001K' },
};

const DATOS: DatosAlta = {
  NombreRazonEmisor: 'EMPRESA DE PRUEBA SL',
  DescripcionOperacion: 'PRESTACION DE SERVICIOS',
  Destinatarios: [{ NombreRazon: 'CLIENTE SL', NIF: 'B72877814' }],
  Desglose: [
    {
      ClaveRegimen: '01',
      CalificacionOperacion: 'S1',
      TipoImpositivo: '21',
      BaseImponibleOimporteNoSujeto: '100.00',
      CuotaRepercutida: '21.00',
    },
  ],
  SistemaInformatico: {
    NombreRazon: 'PRODUCTORA SL',
    NIF: 'B72877814',
    NombreSistemaInformatico: 'VERIFACTU-JS',
    IdSistemaInformatico: 'VJ',
    Version: '0.1.0',
    NumeroInstalacion: 'INST-001',
    TipoUsoPosibleSoloVerifactu: 'S',
    TipoUsoPosibleMultiOT: 'N',
    IndicadorMultiplesOT: 'N',
  },
};

async function remision(overrides: { IDEmisorFactura?: string } = {}): Promise<Remision> {
  const eslabon = await createSifChain({
    timeZone: 'Europe/Madrid',
    now: () => new Date('2025-01-15T09:00:00Z'),
  }).alta({
    IDEmisorFactura: overrides.IDEmisorFactura ?? '89890001K',
    NumSerieFactura: 'A/1',
    FechaExpedicionFactura: '15-01-2025',
    TipoFactura: 'F1',
    CuotaTotal: '21.00',
    ImporteTotal: '121.00',
    previous: null,
  });

  return { cabecera: CABECERA, registros: [{ eslabon, datos: DATOS }] };
}

/** A schema-shaped answer, built with the same namespaces the AEAT uses. */
function respuestaCorrecta(estadoEnvio = 'Correcto'): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<sfR:RespuestaRegFactuSistemaFacturacion xmlns:sfR="${NS_RESPUESTA_SUMINISTRO}" xmlns:sf="${NS_SUMINISTRO_INFORMACION}">` +
    '<sfR:CSV>ABCD1234</sfR:CSV>' +
    '<sfR:Cabecera><sf:ObligadoEmision><sf:NombreRazon>EMPRESA DE PRUEBA SL</sf:NombreRazon>' +
    '<sf:NIF>89890001K</sf:NIF></sf:ObligadoEmision></sfR:Cabecera>' +
    '<sfR:TiempoEsperaEnvio>60</sfR:TiempoEsperaEnvio>' +
    `<sfR:EstadoEnvio>${estadoEnvio}</sfR:EstadoEnvio>` +
    '<sfR:RespuestaLinea>' +
    '<sfR:IDFactura><sf:IDEmisorFactura>89890001K</sf:IDEmisorFactura>' +
    '<sf:NumSerieFactura>A/1</sf:NumSerieFactura>' +
    '<sf:FechaExpedicionFactura>15-01-2025</sf:FechaExpedicionFactura></sfR:IDFactura>' +
    '<sfR:Operacion><sf:TipoOperacion>Alta</sf:TipoOperacion></sfR:Operacion>' +
    '<sfR:EstadoRegistro>Correcto</sfR:EstadoRegistro>' +
    '</sfR:RespuestaLinea>' +
    '</sfR:RespuestaRegFactuSistemaFacturacion>'
  );
}

/** A transport that records what it was asked to send and replies with a canned answer. */
function transporteFalso(respuesta: Partial<RespuestaHttp> = {}): {
  transporte: Transporte;
  peticiones: PeticionHttp[];
} {
  const peticiones: PeticionHttp[] = [];
  const transporte: Transporte = async (peticion) => {
    peticiones.push(peticion);
    return {
      estado: respuesta.estado ?? 200,
      cabeceras: respuesta.cabeceras ?? {},
      cuerpo: respuesta.cuerpo ?? respuestaCorrecta(),
    };
  };
  return { transporte, peticiones };
}

function codigoDe(error: unknown): VerifactuClientErrorCode | 'NO_ES_DEL_CLIENTE' {
  return error instanceof VerifactuClientError ? error.code : 'NO_ES_DEL_CLIENTE';
}

describe('where it points', () => {
  it('goes to preproduction, never anywhere else', () => {
    const { transporte } = transporteFalso();
    const cliente = crearClientePruebas({ transporte, certificado: 'representante' });

    expect(cliente.url).toBe(
      'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    );
    expect(cliente.url).not.toContain('www1.agenciatributaria');
  });

  it('uses the seal host when the certificate is a seal', () => {
    const { transporte } = transporteFalso();
    const cliente = crearClientePruebas({ transporte, certificado: 'sello' });

    expect(cliente.url).toContain('prewww10.aeat.es');
  });

  it('can answer a requirement, which is a different path', () => {
    const { transporte } = transporteFalso();
    const cliente = crearClientePruebas({
      transporte,
      certificado: 'representante',
      servicio: 'requerimiento',
    });

    expect(cliente.url).toContain('RequerimientoSOAP');
  });

  it('offers no way at all to reach production', () => {
    // Not a formality: nothing has ever been sent to the AEAT, TiempoEsperaEnvio is not
    // implemented, and a submission to production is a real filing that cannot be taken back.
    const modulo = crearClientePruebas({
      transporte: transporteFalso().transporte,
      certificado: 'representante',
    });
    expect(Object.keys(modulo)).toEqual(['url', 'enviar']);
  });
});

describe('what it sends', () => {
  it('posts the SOAP envelope with the headers the binding requires', async () => {
    const { transporte, peticiones } = transporteFalso();
    const cliente = crearClientePruebas({ transporte, certificado: 'representante' });

    await cliente.enviar(await remision());

    expect(peticiones).toHaveLength(1);
    const peticion = peticiones[0];
    expect(peticion?.metodo).toBe('POST');
    expect(peticion?.cabeceras['Content-Type']).toBe('text/xml; charset=utf-8');
    expect(peticion?.cabeceras.SOAPAction).toBe('""');
    expect(peticion?.cuerpo).toContain('<soapenv:Envelope');
    expect(peticion?.cuerpo).toContain('<sfLR:RegFactuSistemaFacturacion');
  });

  it('defaults to a 60 second timeout', async () => {
    const { transporte, peticiones } = transporteFalso();
    await crearClientePruebas({ transporte, certificado: 'representante' }).enviar(
      await remision(),
    );

    expect(peticiones[0]?.timeoutMs).toBe(60_000);
  });

  it('honours a timeout that is asked for', async () => {
    const { transporte, peticiones } = transporteFalso();
    await crearClientePruebas({
      transporte,
      certificado: 'representante',
      timeoutMs: 5_000,
    }).enviar(await remision());

    expect(peticiones[0]?.timeoutMs).toBe(5_000);
  });

  it('validates the batch before opening a socket', async () => {
    // The issuer does not match the header, which `xml` rejects. The transport must never run:
    // a malformed batch should not become a request the AEAT has to answer.
    const { transporte, peticiones } = transporteFalso();
    const cliente = crearClientePruebas({ transporte, certificado: 'representante' });

    await expect(cliente.enviar(await remision({ IDEmisorFactura: 'B72877814' }))).rejects.toThrow(
      /EMISOR_DISTINTO_DEL_OBLIGADO|obligado/,
    );
    expect(peticiones).toHaveLength(0);
  });
});

describe('what it gives back', () => {
  it('parses the answer', async () => {
    const { transporte } = transporteFalso();
    const resultado = await crearClientePruebas({
      transporte,
      certificado: 'representante',
    }).enviar(await remision());

    expect(resultado.respuesta.EstadoEnvio).toBe('Correcto');
    expect(resultado.respuesta.CSV).toBe('ABCD1234');
    expect(resultado.respuesta.TiempoEsperaEnvio).toBe('60');
    expect(resultado.respuesta.RespuestaLinea[0]?.EstadoRegistro).toBe('Correcto');
  });

  it('keeps the envelope that was sent, because a submission is a filing', async () => {
    const { transporte } = transporteFalso();
    const resultado = await crearClientePruebas({
      transporte,
      certificado: 'representante',
    }).enviar(await remision());

    expect(resultado.peticion).toContain('<soapenv:Envelope');
    expect(resultado.cuerpoRespuesta).toContain('RespuestaRegFactuSistemaFacturacion');
    expect(resultado.estadoHttp).toBe(200);
    expect(resultado.duracionMs).toBeGreaterThanOrEqual(0);
  });

  it('does not treat a non-2xx as fatal on its own: a Fault comes with a 500', async () => {
    // The body is the diagnosis. Short-circuiting on the status would throw it away.
    const { transporte } = transporteFalso({
      estado: 500,
      cuerpo: respuestaCorrecta('Incorrecto'),
    });
    const resultado = await crearClientePruebas({
      transporte,
      certificado: 'representante',
    }).enviar(await remision());

    expect(resultado.estadoHttp).toBe(500);
    expect(resultado.respuesta.EstadoEnvio).toBe('Incorrecto');
  });

  it('reports a body that is not a VERI*FACTU response', async () => {
    const { transporte } = transporteFalso({ estado: 200, cuerpo: '<html>Error</html>x' });

    try {
      await crearClientePruebas({ transporte, certificado: 'representante' }).enviar(
        await remision(),
      );
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as VerifactuClientError;
      expect(e.code).toBe('RESPUESTA_HTTP_INESPERADA');
      expect(e.estado).toBe(200);
      expect(e.accionSugerida).toContain('Guarda el cuerpo entero');
    }
  });

  it('blames the certificate on a 401 or a 403, which is what it usually is', async () => {
    for (const estado of [401, 403]) {
      const { transporte } = transporteFalso({ estado, cuerpo: 'Forbidden' });
      try {
        await crearClientePruebas({ transporte, certificado: 'representante' }).enviar(
          await remision(),
        );
        expect.unreachable('should have thrown');
      } catch (error) {
        expect((error as VerifactuClientError).accionSugerida).toContain('certificado');
      }
    }
  });
});

describe('loading credentials', () => {
  let dir = '';

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'verifactu-cred-'));
    await writeFile(join(dir, 'cert.p12'), Buffer.from([0x30, 0x82, 0x00, 0x01]));
    await writeFile(join(dir, 'cert.pem'), pem('CERTIFICATE', 'AAA'));
    await writeFile(join(dir, 'clave.pem'), pem('PRIVATE KEY', 'BBB'));
    await writeFile(join(dir, 'clave-cifrada.pem'), pem('ENCRYPTED PRIVATE KEY', 'CCC'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads a .p12 without parsing it', async () => {
    // Node's TLS takes PKCS#12 directly, so there is nothing to parse and no dependency for it.
    const credenciales = await cargarP12(join(dir, 'cert.p12'), 'secreto');

    expect(credenciales.tipo).toBe('p12');
    if (credenciales.tipo !== 'p12') expect.unreachable('narrowing');
    expect(credenciales.pfx).toBeInstanceOf(Uint8Array);
    expect(credenciales.passphrase).toBe('secreto');
  });

  it('refuses an empty passphrase instead of failing later in the handshake', async () => {
    try {
      await cargarP12(join(dir, 'cert.p12'), '');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(codigoDe(error)).toBe('CREDENCIALES_INVALIDAS');
      expect((error as VerifactuClientError).causaProbable).toContain('variable de entorno');
    }
  });

  it('reads a PEM pair', async () => {
    const credenciales = await cargarPem(join(dir, 'cert.pem'), join(dir, 'clave.pem'));

    expect(credenciales.tipo).toBe('pem');
    if (credenciales.tipo !== 'pem') expect.unreachable('narrowing');
    expect(credenciales.passphrase).toBeUndefined();
  });

  it('accepts a passphrase for an encrypted key', async () => {
    const credenciales = await cargarPem(
      join(dir, 'cert.pem'),
      join(dir, 'clave-cifrada.pem'),
      'secreto',
    );

    expect(credenciales.tipo).toBe('pem');
    if (credenciales.tipo !== 'pem') expect.unreachable('narrowing');
    expect(credenciales.passphrase).toBe('secreto');
  });

  it('detects an encrypted key with no passphrase, instead of letting OpenSSL do it', async () => {
    try {
      await cargarPem(join(dir, 'cert.pem'), join(dir, 'clave-cifrada.pem'));
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(codigoDe(error)).toBe('CREDENCIALES_INVALIDAS');
      expect((error as VerifactuClientError).message).toContain('cifrada');
    }
  });

  it.each([
    ['un .p12 que no existe', () => cargarP12(join(dir, 'no-existe.p12'), 'x')],
    ['un PEM que no existe', () => cargarPem(join(dir, 'no-existe.pem'), join(dir, 'clave.pem'))],
    ['una clave que no existe', () => cargarPem(join(dir, 'cert.pem'), join(dir, 'no-existe.pem'))],
  ])('explains %s', async (_etiqueta, cargar) => {
    try {
      await cargar();
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(codigoDe(error)).toBe('CREDENCIALES_INVALIDAS');
      expect((error as VerifactuClientError).accionSugerida).toContain('repositorio');
    }
  });
});

describe('the Node transport', () => {
  // Only reaches a closed port on localhost: no external network, no certificate needed for the
  // failure path, and the diagnosis is what is being tested.
  it('turns a refused connection into SIN_RESPUESTA with something readable', async () => {
    const transporte = transporteNode({
      tipo: 'pem',
      cert: pem('CERTIFICATE', 'AAA'),
      key: pem('PRIVATE KEY', 'BBB'),
    });

    try {
      await transporte({
        url: 'https://127.0.0.1:1/nada',
        metodo: 'POST',
        cabeceras: {},
        cuerpo: '<a/>',
        timeoutMs: 2_000,
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as VerifactuClientError;
      expect(e.code).toBe('SIN_RESPUESTA');
      expect(e.accionSugerida).toContain('no se ha registrado');
      expect(e.causaProbable.length).toBeGreaterThan(0);
    }
  }, 20_000);

  it('returns status, headers and body from a real HTTP exchange', async () => {
    // Over plain HTTP on localhost: the TLS options are simply unused, and everything else —
    // the header map, reading the body, the status — is exercised for real. The certificate half
    // can only be tested against a real endpoint, which is what the preproduction probes are for.
    const { createServer } = await import('node:http');
    const servidor = createServer((peticion, respuesta) => {
      let cuerpo = '';
      peticion.on('data', (trozo) => {
        cuerpo += trozo;
      });
      peticion.on('end', () => {
        respuesta.writeHead(202, { 'content-type': 'text/xml', 'x-eco': cuerpo.length.toString() });
        respuesta.end('<ok/>');
      });
    });

    await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver));
    const puerto = (servidor.address() as { port: number }).port;

    try {
      const transporte = transporteNode({
        tipo: 'pem',
        cert: pem('CERTIFICATE', 'AAA'),
        key: pem('PRIVATE KEY', 'BBB'),
      });

      const respuesta = await transporte({
        url: `http://127.0.0.1:${puerto}/ws`,
        metodo: 'POST',
        cabeceras: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
        cuerpo: '<envio/>',
        timeoutMs: 5_000,
      });

      expect(respuesta.estado).toBe(202);
      expect(respuesta.cuerpo).toBe('<ok/>');
      expect(respuesta.cabeceras['content-type']).toBe('text/xml');
      expect(respuesta.cabeceras['x-eco']).toBe('8');
    } finally {
      await new Promise<void>((resolver) => servidor.close(() => resolver()));
    }
  }, 20_000);

  it('reports an error it does not recognise without pretending to diagnose it', async () => {
    const transporte = transporteNode({
      tipo: 'pem',
      cert: 'x',
      key: 'y',
    });

    try {
      await transporte({
        url: 'no-es-una-url',
        metodo: 'POST',
        cabeceras: {},
        cuerpo: '<a/>',
        timeoutMs: 1_000,
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as VerifactuClientError;
      expect(e.code).toBe('SIN_RESPUESTA');
      expect(e.causaProbable).not.toBe('');
    }
  });

  it('accepts a PEM whose key is encrypted', () => {
    expect(typeof transporteNode({ tipo: 'pem', cert: 'x', key: 'y', passphrase: 'secreto' })).toBe(
      'function',
    );
  });

  it('builds a transport for a .p12 without reading the file twice', () => {
    const transporte = transporteNode({
      tipo: 'p12',
      pfx: new Uint8Array([0x30, 0x82]),
      passphrase: 'x',
    });

    expect(typeof transporte).toBe('function');
  });
});

describe('diagnosticarError', () => {
  // This table is what someone debugging a real certificate at 2am will read. It deserves tests
  // of its own rather than being covered by accident through a failing socket.
  it.each([
    ['ENOTFOUND', 'DNS'],
    ['ECONNREFUSED', 'rechaza la conexión'],
    ['ETIMEDOUT', 'expirado'],
    ['UND_ERR_HEADERS_TIMEOUT', 'cabeceras dentro del plazo'],
    ['UND_ERR_BODY_TIMEOUT', 'a mitad del cuerpo'],
    ['ERR_OSSL_PEM_NO_START_LINE', 'OpenSSL'],
    ['CERT_HAS_EXPIRED', 'cadena de confianza'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'handshake TLS'],
  ])('explains %s', (codigo, esperado) => {
    const error = Object.assign(new Error('fallo'), { code: codigo });
    const texto = diagnosticarError(error);

    expect(texto).toContain(esperado);
    expect(texto).toContain(codigo);
  });

  it('mentions the seal host, because it is a different endpoint', () => {
    const error = Object.assign(new Error('x'), { code: 'ERR_TLS_HANDSHAKE' });
    expect(diagnosticarError(error)).toContain('prewww10');
  });

  it('recognises the marker in the message when there is no code', () => {
    expect(diagnosticarError(new Error('error:0909006C:ERR_OSSL_PEM_NO_START_LINE'))).toContain(
      'OpenSSL',
    );
  });

  it('passes through anything it does not recognise, without inventing a cause', () => {
    expect(diagnosticarError(new Error('algo raro'))).toBe('algo raro');
  });

  it('survives being handed something that is not an Error', () => {
    expect(diagnosticarError('vaya')).toBe('vaya');
    expect(diagnosticarError(undefined)).toBe('undefined');
  });
});

describe('normalizarCabeceras', () => {
  it('joins a repeated header and keeps a single one', () => {
    expect(normalizarCabeceras({ a: 'uno', b: ['x', 'y'] })).toEqual({ a: 'uno', b: 'x, y' });
  });

  it('drops an absent header instead of writing an empty string', () => {
    // An absent header and a header whose value is empty are different things, and a caller
    // testing for presence would be misled by the second.
    expect(normalizarCabeceras({ a: undefined, b: '' })).toEqual({ b: '' });
  });
});

describe('the client is a plain object, not a class', () => {
  it('can be replaced wholesale in a test', async () => {
    // The whole surface is `url` and `enviar`, so a caller can stub it without a mocking library.
    const falso: Cliente = {
      url: 'https://ejemplo.invalido',
      enviar: async () => {
        throw new Error('no debería llamarse');
      },
    };
    expect(falso.url).toBe('https://ejemplo.invalido');
  });
});
