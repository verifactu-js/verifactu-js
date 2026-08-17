/**
 * Parsing `RespuestaRegFactuSistemaFacturacion`.
 *
 * Every fixture is validated against the official `RespuestaSuministro.xsd` before being parsed,
 * so a mistake in the fixture's namespaces fails as a schema error rather than quietly teaching
 * the parser the wrong shape.
 */
import { describe, expect, it } from 'vitest';

import {
  NS_SOAP_ENVELOPE as NS_SOAP,
  parsearRespuesta,
  VerifactuXmlError,
  type VerifactuXmlErrorCode,
} from '../src/index.js';
import { enSobre, fault, respuesta } from './helpers/respuestas.js';
import { esperarValido } from './helpers/xsd.js';

const XSD = 'RespuestaSuministro.xsd' as const;

function codigoDe(fn: () => unknown): VerifactuXmlErrorCode | 'NO_LANZO' {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(VerifactuXmlError);
    return (error as VerifactuXmlError).code;
  }
  return 'NO_LANZO';
}

describe('the fixtures really are what the AEAT declares', () => {
  it('a minimal response validates against RespuestaSuministro.xsd', async () => {
    await esperarValido(respuesta(), XSD);
  });

  it('a full response validates too', async () => {
    await esperarValido(
      respuesta({
        CSV: 'ABCD1234EFGH',
        presentacion: {
          NIFPresentador: '89890001K',
          TimestampPresentacion: '2024-01-01T19:20:35+01:00',
        },
        TiempoEsperaEnvio: '60',
        EstadoEnvio: 'ParcialmenteCorrecto',
        lineas: [
          { EstadoRegistro: 'Correcto' },
          {
            EstadoRegistro: 'AceptadoConErrores',
            RefExterna: 'ERP-1',
            CodigoErrorRegistro: '3001',
            DescripcionErrorRegistro: 'La huella no coincide con el cálculo de la AEAT',
            Subsanacion: 'N',
            RechazoPrevio: 'N',
          },
          {
            TipoOperacion: 'Anulacion',
            EstadoRegistro: 'Incorrecto',
            SinRegistroPrevio: 'N',
            duplicado: {
              IdPeticionRegistroDuplicado: 'PET-0001',
              EstadoRegistroDuplicado: 'Correcta',
              CodigoErrorRegistro: '3002',
              DescripcionErrorRegistro: 'Registro duplicado',
            },
          },
        ],
      }),
      XSD,
    );
  });
});

describe('reading a response', () => {
  it('reads the overall state and the echoed header', () => {
    const leida = parsearRespuesta(respuesta({ EstadoEnvio: 'Correcto' }));

    expect(leida.EstadoEnvio).toBe('Correcto');
    expect(leida.ObligadoEmision).toEqual({
      NombreRazon: 'EMPRESA DE PRUEBA SL',
      NIF: '89890001K',
    });
  });

  it('reads CSV, DatosPresentacion and TiempoEsperaEnvio', () => {
    const leida = parsearRespuesta(
      respuesta({
        CSV: 'ABCD1234EFGH',
        presentacion: {
          NIFPresentador: '89890001K',
          TimestampPresentacion: '2024-01-01T19:20:35+01:00',
        },
        TiempoEsperaEnvio: '60',
      }),
    );

    expect(leida.CSV).toBe('ABCD1234EFGH');
    expect(leida.DatosPresentacion?.TimestampPresentacion).toBe('2024-01-01T19:20:35+01:00');
    expect(leida.TiempoEsperaEnvio).toBe('60');
  });

  it('keeps TiempoEsperaEnvio a string, and an empty one means "no dato" (D-11)', () => {
    // The schema types it as string with pattern \d{0,4}, so the empty value is legal. Turning
    // that into 0 would tell the caller to send again immediately.
    const leida = parsearRespuesta(respuesta({ TiempoEsperaEnvio: '' }));
    expect(leida.TiempoEsperaEnvio).toBeUndefined();

    expect(parsearRespuesta(respuesta({ TiempoEsperaEnvio: '9999' })).TiempoEsperaEnvio).toBe(
      '9999',
    );
  });

  it('reads each line with its operation and state', () => {
    const leida = parsearRespuesta(
      respuesta({
        lineas: [
          { NumSerieFactura: 'A/1', EstadoRegistro: 'Correcto' },
          { NumSerieFactura: 'A/2', TipoOperacion: 'Anulacion', EstadoRegistro: 'Incorrecto' },
        ],
      }),
    );

    expect(leida.RespuestaLinea).toHaveLength(2);
    expect(leida.RespuestaLinea[0]?.IDFactura.NumSerieFactura).toBe('A/1');
    expect(leida.RespuestaLinea[0]?.Operacion.TipoOperacion).toBe('Alta');
    expect(leida.RespuestaLinea[1]?.Operacion.TipoOperacion).toBe('Anulacion');
    expect(leida.RespuestaLinea[1]?.EstadoRegistro).toBe('Incorrecto');
  });

  it('keeps CodigoErrorRegistro as the literal received (D-9)', () => {
    // The schema says `integer` with no facets — not «alfanumérico(5)». Parsing to a number would
    // throw away any padding the AEAT chose to send.
    const leida = parsearRespuesta(
      respuesta({ lineas: [{ CodigoErrorRegistro: '3001', EstadoRegistro: 'Incorrecto' }] }),
    );

    expect(leida.RespuestaLinea[0]?.CodigoErrorRegistro).toBe('3001');
    expect(typeof leida.RespuestaLinea[0]?.CodigoErrorRegistro).toBe('string');
  });

  it('reads the duplicate block, feminine values and all (D-12)', () => {
    const leida = parsearRespuesta(
      respuesta({
        lineas: [
          {
            EstadoRegistro: 'Incorrecto',
            duplicado: {
              IdPeticionRegistroDuplicado: 'PET-0001',
              EstadoRegistroDuplicado: 'AceptadaConErrores',
              CodigoErrorRegistro: '3002',
              DescripcionErrorRegistro: 'Ya registrada',
            },
          },
        ],
      }),
    );

    const duplicado = leida.RespuestaLinea[0]?.RegistroDuplicado;
    expect(duplicado?.EstadoRegistroDuplicado).toBe('AceptadaConErrores');
    expect(duplicado?.IdPeticionRegistroDuplicado).toBe('PET-0001');
    // `EstadoRegistro` is masculine and has `Incorrecto`; this one is feminine and has `Anulada`.
    expect(leida.RespuestaLinea[0]?.EstadoRegistro).toBe('Incorrecto');
  });

  it('omits optional fields instead of inventing empty strings', () => {
    const leida = parsearRespuesta(respuesta());
    const linea = leida.RespuestaLinea[0];

    expect(leida.CSV).toBeUndefined();
    expect(leida.DatosPresentacion).toBeUndefined();
    expect(linea?.RefExterna).toBeUndefined();
    expect(linea?.CodigoErrorRegistro).toBeUndefined();
    expect(linea?.RegistroDuplicado).toBeUndefined();
    expect(linea?.Operacion.Subsanacion).toBeUndefined();
  });

  it('accepts a response with no lines at all', () => {
    const leida = parsearRespuesta(respuesta({ lineas: [], EstadoEnvio: 'Incorrecto' }));
    expect(leida.RespuestaLinea).toEqual([]);
  });

  it('does not depend on the prefixes the AEAT chooses', () => {
    // Matching is by namespace URI. A service that renamed `sfR` to `ns2` would break a
    // prefix-matching parser and nothing here.
    const conOtrosPrefijos = respuesta()
      .replace(/sfR:/g, 'ns2:')
      .replace(/xmlns:sfR=/g, 'xmlns:ns2=')
      .replace(/sf:/g, 'ns3:')
      .replace(/xmlns:sf=/g, 'xmlns:ns3=')
      .replace(/xmlns:ns3R=/g, 'xmlns:ns2=');

    expect(parsearRespuesta(conOtrosPrefijos).EstadoEnvio).toBe('Correcto');
  });
});

describe('the SOAP envelope around it', () => {
  it('reads a response wrapped in an envelope', () => {
    expect(parsearRespuesta(enSobre(respuesta())).EstadoEnvio).toBe('Correcto');
  });

  it('rejects an envelope with no Body', () => {
    expect(codigoDe(() => parsearRespuesta(`<e:Envelope xmlns:e="${NS_SOAP}"/>`))).toBe(
      'RESPUESTA_INESPERADA',
    );
  });

  it('still reports a Fault that carries neither code nor reason', () => {
    // Rare, but a Fault with an empty body would otherwise read as "la raíz es Envelope".
    const vacio = `<e:Envelope xmlns:e="${NS_SOAP}"><e:Body><e:Fault/></e:Body></e:Envelope>`;
    try {
      parsearRespuesta(vacio);
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as VerifactuXmlError;
      expect(e.message).toContain('SOAP Fault');
      expect(e.message).toContain('(sin faultcode)');
      expect(e.message).toContain('(sin faultstring)');
    }
  });

  it('reports a SOAP Fault as a fault, with its code and reason', () => {
    // The single most likely thing to come back when something is wrong. "Falta EstadoEnvio"
    // would be a terrible way to find out.
    try {
      parsearRespuesta(fault('soapenv:Client', 'Certificado no valido para este servicio'));
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as VerifactuXmlError;
      expect(e.code).toBe('RESPUESTA_INESPERADA');
      expect(e.message).toContain('SOAP Fault');
      expect(e.message).toContain('soapenv:Client');
      expect(e.message).toContain('Certificado no valido');
      expect(e.accionSugerida).toContain('Reintentar');
    }
  });
});

describe('what it refuses to read', () => {
  it('rejects a document that is not XML', () => {
    expect(codigoDe(() => parsearRespuesta('<html><body>502</body></html>x'))).toBe(
      'XML_MAL_FORMADO',
    );
  });

  it('rejects a different root element', () => {
    expect(codigoDe(() => parsearRespuesta('<otro/>'))).toBe('RESPUESTA_INESPERADA');
  });

  it('rejects an envelope whose body is not this response', () => {
    expect(codigoDe(() => parsearRespuesta(enSobre('<otro/>')))).toBe('RESPUESTA_INESPERADA');
  });

  it('rejects a response with no header', () => {
    const sinCabecera = respuesta().replace(/<sfR:Cabecera>.*<\/sfR:Cabecera>/, '');
    expect(codigoDe(() => parsearRespuesta(sinCabecera))).toBe('RESPUESTA_INESPERADA');
  });

  it('names the element that is missing', () => {
    const sinEstado = respuesta().replace('<sfR:EstadoEnvio>Correcto</sfR:EstadoEnvio>', '');
    try {
      parsearRespuesta(sinEstado);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuXmlError).message).toContain('EstadoEnvio');
    }
  });

  it('rejects a line missing IDFactura', () => {
    const roto = respuesta().replace(/<sfR:IDFactura>.*?<\/sfR:IDFactura>/, '');
    expect(codigoDe(() => parsearRespuesta(roto))).toBe('RESPUESTA_INESPERADA');
  });

  it('rejects a line missing a required grandchild', () => {
    const roto = respuesta().replace('<sf:NumSerieFactura>12345678/G33</sf:NumSerieFactura>', '');
    expect(codigoDe(() => parsearRespuesta(roto))).toBe('RESPUESTA_INESPERADA');
  });

  it('rejects a duplicate block missing its identifier', () => {
    const conDuplicado = respuesta({
      lineas: [
        {
          EstadoRegistro: 'Incorrecto',
          duplicado: {
            IdPeticionRegistroDuplicado: 'PET-1',
            EstadoRegistroDuplicado: 'Correcta',
          },
        },
      ],
    });
    const roto = conDuplicado.replace(
      '<sf:IdPeticionRegistroDuplicado>PET-1</sf:IdPeticionRegistroDuplicado>',
      '',
    );

    expect(codigoDe(() => parsearRespuesta(roto))).toBe('RESPUESTA_INESPERADA');
  });

  it('rejects a DatosPresentacion missing its timestamp', () => {
    const roto = respuesta({
      presentacion: { NIFPresentador: '89890001K', TimestampPresentacion: '2024-01-01T00:00:00Z' },
    }).replace('<sf:TimestampPresentacion>2024-01-01T00:00:00Z</sf:TimestampPresentacion>', '');

    expect(codigoDe(() => parsearRespuesta(roto))).toBe('RESPUESTA_INESPERADA');
  });
});
