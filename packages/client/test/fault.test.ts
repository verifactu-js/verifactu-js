/**
 * SOAP Faults: el otro camino por el que llega un error de la AEAT.
 *
 * Un error de cabecera **no** viene como respuesta de negocio con su `CodigoErrorRegistro`. Viene
 * como SOAP Fault, con el código embebido en el `faultstring`. Lo descubrió la sonda S-4 el
 * 19/08/2026, que preguntaba otra cosa: mandó una cabecera con `RemisionVoluntaria` y
 * `RemisionRequerimiento` a la vez y la respuesta llegó por aquí, no por `RespuestaLinea`.
 *
 * Hasta entonces el código quedaba dentro de una frase y `explicarCodigo()` no lo veía nunca. Estos
 * tests fijan que los dos caminos den **la misma explicación**, que es lo único razonable: quien
 * integra no debería tener que saber por cuál de los dos llegó.
 */
import { createSifChain } from '@verifactu-js/core';
import type { Cabecera, DatosAlta } from '@verifactu-js/validation';
import { parsearRespuesta, type Remision, VerifactuXmlError } from '@verifactu-js/xml';
import { describe, expect, it } from 'vitest';

import {
  type Cliente,
  crearClientePruebas,
  explicarCodigo,
  type PeticionHttp,
  type RespuestaHttp,
  VerifactuClientError,
} from '../src/index.js';

/**
 * El fault que devolvió la AEAT en la sonda S-4, palabra por palabra.
 *
 * El texto sale de `docs/probe-results/s4-dos-bloques.json`. Se conserva literal —con la coma de
 * «facturación» y todo— porque el valor de un fixture medido está en que sea el mensaje real y no
 * una aproximación nuestra.
 */
const FAULT_S4 = `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
<env:Body>
<env:Fault>
<faultcode>env:Client</faultcode>
<faultstring>Codigo[4126].Error en la cabecera: el campo RefRequerimiento solo debe informarse en sistemas en remisiones al endpoint del servicio a usar para la contestación a requerimientos de registros de facturación.</faultstring>
</env:Fault>
</env:Body>
</env:Envelope>`;

/**
 * El mismo código, pero por el camino de negocio.
 *
 * **Este fixture es sintético, no medido.** Un 4126 real llega siempre por fault, porque es un
 * error de cabecera y tumba el envío entero. Se construye a mano justamente para poder comprobar
 * lo único que importa aquí: que `explicarCodigo()` no distingue por dónde llegó el código.
 */
const LINEA_4126 = `<?xml version="1.0" encoding="UTF-8"?>
<RespuestaRegFactuSistemaFacturacion xmlns="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaSuministro.xsd" xmlns:sf="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">
<Cabecera><sf:ObligadoEmision><sf:NombreRazon>X</sf:NombreRazon><sf:NIF>89890001K</sf:NIF></sf:ObligadoEmision></Cabecera>
<EstadoEnvio>Incorrecto</EstadoEnvio>
<RespuestaLinea>
<IDFactura><sf:IDEmisorFactura>89890001K</sf:IDEmisorFactura><sf:NumSerieFactura>A-1</sf:NumSerieFactura><sf:FechaExpedicionFactura>19-08-2026</sf:FechaExpedicionFactura></IDFactura>
<Operacion><sf:TipoOperacion>Alta</sf:TipoOperacion></Operacion>
<EstadoRegistro>Incorrecto</EstadoRegistro>
<CodigoErrorRegistro>4126</CodigoErrorRegistro>
</RespuestaLinea>
</RespuestaRegFactuSistemaFacturacion>`;

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
    NombreRazon: 'EMPRESA DE PRUEBA SL',
    NIF: '89890001K',
    NombreSistemaInformatico: 'VERIFACTU-JS',
    IdSistemaInformatico: 'VJ',
    Version: '0.1.0',
    NumeroInstalacion: 'TEST',
    TipoUsoPosibleSoloVerifactu: 'S',
    TipoUsoPosibleMultiOT: 'N',
    IndicadorMultiplesOT: 'N',
  },
};

/**
 * Un lote válido.
 *
 * Tiene que serlo: el cliente valida antes de abrir el socket, así que un lote vacío nunca
 * llegaría a ver la respuesta que estos tests quieren probar.
 */
async function remision(): Promise<Remision> {
  const eslabon = await createSifChain({
    timeZone: 'Europe/Madrid',
    now: () => new Date('2025-01-15T09:00:00Z'),
  }).alta({
    IDEmisorFactura: '89890001K',
    NumSerieFactura: 'A/1',
    FechaExpedicionFactura: '15-01-2025',
    TipoFactura: 'F1',
    CuotaTotal: '21.00',
    ImporteTotal: '121.00',
    previous: null,
  });

  return { cabecera: CABECERA, registros: [{ eslabon, datos: DATOS }] };
}

function clienteQueDevuelve(cuerpo: string, estado = 500): Cliente {
  const transporte = async (_peticion: PeticionHttp): Promise<RespuestaHttp> => ({
    estado,
    cabeceras: { 'content-type': 'text/xml' },
    cuerpo,
  });

  return crearClientePruebas({ transporte, certificado: 'representante' });
}

describe('un SOAP Fault trae el código de la AEAT dentro del faultstring', () => {
  it('lo extrae al parsear, en vez de dejarlo dentro de una frase', () => {
    try {
      parsearRespuesta(FAULT_S4);
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(VerifactuXmlError);
      expect((error as VerifactuXmlError).codigoAeat).toBe('4126');
      // Y el mensaje sigue entero: el código es un extra, no un recorte.
      expect((error as Error).message).toContain('RefRequerimiento');
    }
  });

  it('no se inventa un código cuando el fault no trae ninguno', () => {
    const sinCodigo = FAULT_S4.replace(/Codigo\[4126\]\./, '');

    try {
      parsearRespuesta(sinCodigo);
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect((error as VerifactuXmlError).codigoAeat).toBeUndefined();
      expect((error as Error).message).toContain('RefRequerimiento');
    }
  });

  it('sigue siendo un fault aunque el faultstring no diga nada útil', () => {
    const vacio = FAULT_S4.replace(
      /<faultstring>[^<]*<\/faultstring>/,
      '<faultstring></faultstring>',
    );

    try {
      parsearRespuesta(vacio);
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect((error as VerifactuXmlError).code).toBe('RESPUESTA_INESPERADA');
      expect((error as VerifactuXmlError).codigoAeat).toBeUndefined();
    }
  });
});

describe('el cliente lo propaga hasta arriba', () => {
  it('deja el código en codigoAeat, no solo en la prosa del mensaje', async () => {
    try {
      await clienteQueDevuelve(FAULT_S4).enviar(await remision());
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(VerifactuClientError);
      expect((error as VerifactuClientError).codigoAeat).toBe('4126');
    }
  });

  it('la acción sugerida remite a explicarCodigo cuando hay código', async () => {
    try {
      await clienteQueDevuelve(FAULT_S4).enviar(await remision());
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect((error as VerifactuClientError).accionSugerida).toContain('explicarCodigo');
      expect((error as VerifactuClientError).accionSugerida).toContain('4126');
    }
  });

  it('no pierde el consejo del certificado cuando el 401 no trae código', async () => {
    const html = '<html><body>No autorizado</body></html>';

    try {
      await clienteQueDevuelve(html, 401).enviar(await remision());
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect((error as VerifactuClientError).codigoAeat).toBeUndefined();
      expect((error as VerifactuClientError).accionSugerida).toContain('certificado');
    }
  });
});

describe('los dos caminos dan la misma explicación', () => {
  it('fault y RespuestaLinea con el mismo código son indistinguibles para explicarCodigo', async () => {
    let porFault: string | undefined;
    try {
      await clienteQueDevuelve(FAULT_S4).enviar(await remision());
    } catch (error) {
      porFault = (error as VerifactuClientError).codigoAeat;
    }

    const porLinea = parsearRespuesta(LINEA_4126).RespuestaLinea[0]?.CodigoErrorRegistro;

    expect(porFault).toBe('4126');
    expect(porLinea).toBe('4126');
    // Lo que importa no es que los códigos coincidan, sino que la explicación sea el mismo objeto.
    expect(explicarCodigo(porFault)).toEqual(explicarCodigo(porLinea));
  });

  it('y esa explicación es la de 4126, que es la que confirma D-16', () => {
    const e = explicarCodigo('4126');

    expect(e?.categoria).toBe('envio');
    expect(e?.almacenado).toBe(false);
    expect(e?.texto).toContain('RefRequerimiento');
    // La exclusión va por endpoint, no por cabecera. Es lo que midió S-4.
    expect(e?.accion).toContain('endpoint');
  });
});
