/**
 * `RegistroAlta` and `RegistroAnulacion`.
 *
 * Two things are being checked, and the second matters more than the first:
 *
 * 1. The documents validate against the official XSDs.
 * 2. The literals that end up in the XML still reproduce the record's own `Huella`. A document
 *    can be perfectly schema-valid and still be wrong in the only way that counts — and the AEAT
 *    would accept it, flag it "Aceptado con errores", and never reject it
 *    (docs/spec-notes.md §8.7).
 */
import { hashRegistroAlta, hashRegistroAnulacion } from '@verifactu-js/core';
import { describe, expect, it } from 'vitest';

import {
  type DetalleDesglose,
  type IDFacturaAR,
  type PersonaFisicaJuridica,
  type RegistroAlta,
  VerifactuXmlError,
  type VerifactuXmlErrorCode,
  writeRegistroAlta,
  writeRegistroAnulacion,
  XmlWriter,
} from '../src/index.js';
import {
  altaMinima,
  altaPrevia,
  anulacionMinima,
  documento,
  documentoConAlta,
  SISTEMA,
} from './helpers/documentos.js';
import { ordenDeElementos, textoDe, todosLosTextosDe } from './helpers/leer.js';
import { esperarInvalido, esperarValido } from './helpers/xsd.js';

function codigoDe(fn: () => unknown): VerifactuXmlErrorCode | 'NO_LANZO' {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(VerifactuXmlError);
    return (error as VerifactuXmlError).code;
  }
  return 'NO_LANZO';
}

/** A `PersonaFisicaJuridica` identified by something other than a Spanish NIF. */
const EXTRANJERO: PersonaFisicaJuridica = {
  NombreRazon: 'ACME GMBH',
  IDOtro: { CodigoPais: 'DE', IDType: '02', ID: 'DE123456789' },
};

// `exactOptionalPropertyTypes` is on, so `{ ...SISTEMA, NIF: undefined }` is not the same thing
// as omitting the key. Destructure it away instead.
const { NIF: _nifDelSistema, ...SISTEMA_SIN_IDENTIFICAR } = SISTEMA;

describe('RegistroAlta validates against the official XSD', () => {
  it('with only the mandatory elements', async () => {
    await esperarValido(await documentoConAlta());
  });

  it('with every optional element present — the real test of element order', async () => {
    const rectificadas: readonly IDFacturaAR[] = [
      {
        IDEmisorFactura: '89890001K',
        NumSerieFactura: '12345670/G20',
        FechaExpedicionFactura: '01-12-2023',
      },
    ];

    const registro = await altaMinima(
      { TipoFactura: 'R1' },
      {
        RefExterna: 'ERP-0001',
        Subsanacion: 'N',
        RechazoPrevio: 'N',
        TipoRectificativa: 'I',
        FacturasRectificadas: rectificadas,
        FacturasSustituidas: rectificadas,
        ImporteRectificacion: {
          BaseRectificada: '100.00',
          CuotaRectificada: '21.00',
          CuotaRecargoRectificado: '5.20',
        },
        FechaOperacion: '31-12-2023',
        FacturaSimplificadaArt7273: 'N',
        FacturaSinIdentifDestinatarioArt61d: 'N',
        Macrodato: 'N',
        EmitidaPorTerceroODestinatario: 'T',
        Tercero: EXTRANJERO,
        Destinatarios: [{ NombreRazon: 'CLIENTE SL', NIF: 'B72877814' }, EXTRANJERO],
        Cupon: 'N',
        NumRegistroAcuerdoFacturacion: 'ACUERDO-1',
        IdAcuerdoSistemaInformatico: 'ID-ACUERDO-1',
      },
    );

    await esperarValido(documento([registro]));
  });

  it('chained to a previous record', async () => {
    const registro = await altaMinima({ previous: await altaPrevia() });
    const xml = documento([registro]);

    await esperarValido(xml);
    expect(xml).toContain('<sf:RegistroAnterior>');
    expect(xml).not.toContain('<sf:PrimerRegistro>');
  });

  it('with an exempt operation instead of a qualified one', async () => {
    const registro = await altaMinima(
      {},
      {
        Desglose: [
          {
            ClaveRegimen: '01',
            OperacionExenta: 'E1',
            BaseImponibleOimporteNoSujeto: '123.45',
          },
        ],
      },
    );
    await esperarValido(documento([registro]));
  });

  it('with the twelve breakdown lines the schema allows', async () => {
    const linea: DetalleDesglose = {
      ClaveRegimen: '01',
      CalificacionOperacion: 'S1',
      TipoImpositivo: '21',
      BaseImponibleOimporteNoSujeto: '10.00',
      CuotaRepercutida: '2.10',
    };
    const registro = await altaMinima({}, { Desglose: Array.from({ length: 12 }, () => linea) });

    const xml = documento([registro]);
    await esperarValido(xml);
    expect(todosLosTextosDe(xml, 'sf:BaseImponibleOimporteNoSujeto')).toHaveLength(12);
  });

  it('with equivalence surcharge and cost-based base', async () => {
    const registro = await altaMinima(
      {},
      {
        Desglose: [
          {
            Impuesto: '01',
            ClaveRegimen: '01',
            CalificacionOperacion: 'S1',
            TipoImpositivo: '21',
            BaseImponibleOimporteNoSujeto: '100.00',
            BaseImponibleACoste: '100.00',
            CuotaRepercutida: '21.00',
            TipoRecargoEquivalencia: '5.2',
            CuotaRecargoEquivalencia: '5.20',
          },
        ],
      },
    );
    await esperarValido(documento([registro]));
  });

  it('with a producer identified by IDOtro instead of NIF', async () => {
    const registro = await altaMinima(
      {},
      {
        SistemaInformatico: {
          ...SISTEMA_SIN_IDENTIFICAR,
          IDOtro: { CodigoPais: 'DE', IDType: '02', ID: 'DE123456789' },
        },
      },
    );
    await esperarValido(documento([registro]));
  });
});

describe('RegistroAnulacion validates against the official XSD', () => {
  it('with only the mandatory elements', async () => {
    await esperarValido(documento([await anulacionMinima()]));
  });

  it('with every optional element present', async () => {
    const registro = await anulacionMinima(
      {},
      {
        RefExterna: 'ERP-0002',
        SinRegistroPrevio: 'N',
        RechazoPrevio: 'N',
        GeneradoPor: 'T',
        Generador: EXTRANJERO,
      },
    );
    await esperarValido(documento([registro]));
  });

  it('chained to a previous record', async () => {
    const registro = await anulacionMinima({ previous: await altaPrevia() });
    const xml = documento([registro]);

    await esperarValido(xml);
    expect(xml).toContain('<sf:RegistroAnterior>');
  });

  it('uses the Anulada suffixes, which are different element names', async () => {
    const xml = documento([await anulacionMinima()]);

    expect(xml).toContain('<sf:IDEmisorFacturaAnulada>');
    expect(xml).toContain('<sf:NumSerieFacturaAnulada>');
    expect(xml).toContain('<sf:FechaExpedicionFacturaAnulada>');
    expect(xml).not.toContain('<sf:NumSerieFactura>');
  });

  it('rejects the alta-only X value for RechazoPrevio (D-13)', async () => {
    // `RechazoPrevioAnulacionType` enumerates only S and N. The type forbids it too; this checks
    // that the schema agrees, because the two live under the same element name.
    const registro = await anulacionMinima({}, { RechazoPrevio: 'X' as unknown as 'S' });
    const errores = await esperarInvalido(documento([registro]));
    expect(errores.join(' ')).toContain('RechazoPrevio');
  });
});

describe('the literals in the XML still reproduce the Huella', () => {
  /** Reads the eight hashed fields back out of the document and recomputes the digest. */
  async function huellaRecalculadaAlta(xml: string): Promise<string> {
    const primerRegistro = xml.includes('<sf:PrimerRegistro>');
    return hashRegistroAlta({
      IDEmisorFactura: textoDe(xml, 'sf:IDEmisorFactura'),
      NumSerieFactura: textoDe(xml, 'sf:NumSerieFactura'),
      FechaExpedicionFactura: textoDe(xml, 'sf:FechaExpedicionFactura'),
      TipoFactura: textoDe(xml, 'sf:TipoFactura'),
      CuotaTotal: textoDe(xml, 'sf:CuotaTotal'),
      ImporteTotal: textoDe(xml, 'sf:ImporteTotal'),
      // The first `sf:Huella` in document order is the previous record's, inside
      // `RegistroAnterior`; the record's own is the last element of all.
      Huella: primerRegistro ? null : textoDe(xml, 'sf:Huella'),
      FechaHoraHusoGenRegistro: textoDe(xml, 'sf:FechaHoraHusoGenRegistro'),
    });
  }

  it('for a first record', async () => {
    const registro = await altaMinima();
    const xml = documento([registro]);

    expect(await huellaRecalculadaAlta(xml)).toBe(registro.eslabon.huella);
    expect(textoDe(xml, 'sf:TipoHuella')).toBe('01');
  });

  it('for a chained record', async () => {
    const registro = await altaMinima({ previous: await altaPrevia() });
    const xml = documento([registro]);

    expect(await huellaRecalculadaAlta(xml)).toBe(registro.eslabon.huella);
  });

  it('for an anulación', async () => {
    const registro = await anulacionMinima();
    const xml = documento([registro]);

    const recalculada = await hashRegistroAnulacion({
      IDEmisorFacturaAnulada: textoDe(xml, 'sf:IDEmisorFacturaAnulada'),
      NumSerieFacturaAnulada: textoDe(xml, 'sf:NumSerieFacturaAnulada'),
      FechaExpedicionFacturaAnulada: textoDe(xml, 'sf:FechaExpedicionFacturaAnulada'),
      Huella: null,
      FechaHoraHusoGenRegistro: textoDe(xml, 'sf:FechaHoraHusoGenRegistro'),
    });

    expect(recalculada).toBe(registro.eslabon.huella);
  });

  it('survives a series containing "&", which the XML has to escape', async () => {
    // `&` is legal in a series (docs/spec-notes.md §18) and enters the hash unescaped, but the
    // XML must carry it as `&amp;`. If escaping and hashing ever disagreed, this is where it
    // would show.
    const registro = await altaMinima({ NumSerieFactura: 'A&B/2024' });
    const xml = documento([registro]);

    expect(xml).toContain('<sf:NumSerieFactura>A&amp;B/2024</sf:NumSerieFactura>');
    expect(textoDe(xml, 'sf:NumSerieFactura')).toBe('A&B/2024');
    expect(await huellaRecalculadaAlta(xml)).toBe(registro.eslabon.huella);
    await esperarValido(xml);
  });

  it('writes the eslabón huella, not a recomputed one', async () => {
    const registro = await altaMinima();
    const xml = documento([registro]);
    const huellas = todosLosTextosDe(xml, 'sf:Huella');

    expect(huellas).toEqual([registro.eslabon.huella]);
  });
});

describe('the chaining block cannot contradict what was hashed', () => {
  it('a first record writes PrimerRegistro', async () => {
    const xml = await documentoConAlta();
    expect(xml).toContain(
      '<sf:Encadenamiento><sf:PrimerRegistro>S</sf:PrimerRegistro></sf:Encadenamiento>',
    );
  });

  it('a chained record writes the previous digest, taken from the hashed field', async () => {
    const anterior = await altaPrevia();
    const registro = await altaMinima({ previous: anterior });
    const xml = documento([registro]);

    expect(todosLosTextosDe(xml, 'sf:Huella')).toEqual([anterior.huella, registro.eslabon.huella]);
    expect(registro.eslabon.fields.Huella).toBe(anterior.huella);
  });

  it('rejects a record hashed as first that declares a predecessor', async () => {
    const registro = await altaMinima();
    const anterior = await altaPrevia();
    const manipulado: RegistroAlta = {
      ...registro,
      eslabon: {
        ...registro.eslabon,
        registroAnterior: {
          IDEmisorFactura: anterior.fields.IDEmisorFactura,
          NumSerieFactura: anterior.fields.NumSerieFactura,
          FechaExpedicionFactura: anterior.fields.FechaExpedicionFactura,
          Huella: anterior.huella,
        },
      },
    };

    expect(codigoDe(() => writeRegistroAlta(new XmlWriter(), manipulado))).toBe(
      'ENCADENAMIENTO_INCOHERENTE',
    );
  });

  it('rejects a record hashed with a predecessor that does not identify it', async () => {
    const registro = await altaMinima({ previous: await altaPrevia() });
    const manipulado: RegistroAlta = {
      ...registro,
      eslabon: { ...registro.eslabon, registroAnterior: null },
    };

    expect(codigoDe(() => writeRegistroAlta(new XmlWriter(), manipulado))).toBe(
      'ENCADENAMIENTO_INCOHERENTE',
    );
  });

  it('rejects a predecessor whose digest is not the one that was hashed', async () => {
    const registro = await altaMinima({ previous: await altaPrevia() });
    const anterior = registro.eslabon.registroAnterior;
    if (anterior === null) expect.unreachable('the fixture is chained');

    const manipulado: RegistroAlta = {
      ...registro,
      eslabon: {
        ...registro.eslabon,
        registroAnterior: { ...anterior, Huella: 'F'.repeat(64) },
      },
    };

    try {
      writeRegistroAlta(new XmlWriter(), manipulado);
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as VerifactuXmlError;
      expect(e.code).toBe('ENCADENAMIENTO_INCOHERENTE');
      // The message must name both digests: the whole difficulty is telling them apart.
      expect(e.message).toContain(anterior.Huella);
      expect(e.message).toContain('F'.repeat(64));
      expect(e.causaProbable).toContain('lo acepta y lo marca con errores');
      expect(e.referencia).toContain('§4');
    }
  });

  it('applies the same rule to an anulación', async () => {
    const registro = await anulacionMinima({ previous: await altaPrevia() });
    const manipulado = {
      ...registro,
      eslabon: { ...registro.eslabon, registroAnterior: null },
    };

    expect(codigoDe(() => writeRegistroAnulacion(new XmlWriter(), manipulado))).toBe(
      'ENCADENAMIENTO_INCOHERENTE',
    );
  });
});

describe('cardinality the schema declares but a caller can still get wrong', () => {
  it('rejects an empty Desglose instead of writing an empty container', async () => {
    const registro = await altaMinima({}, { Desglose: [] });
    expect(codigoDe(() => writeRegistroAlta(new XmlWriter(), registro))).toBe(
      'CARDINALIDAD_INVALIDA',
    );
  });

  it('rejects a thirteenth breakdown line', async () => {
    const linea: DetalleDesglose = { BaseImponibleOimporteNoSujeto: '1.00' };
    const registro = await altaMinima({}, { Desglose: Array.from({ length: 13 }, () => linea) });

    expect(codigoDe(() => writeRegistroAlta(new XmlWriter(), registro))).toBe(
      'CARDINALIDAD_INVALIDA',
    );
  });

  it('rejects an empty Destinatarios', async () => {
    const registro = await altaMinima({}, { Destinatarios: [] });
    expect(codigoDe(() => writeRegistroAlta(new XmlWriter(), registro))).toBe(
      'CARDINALIDAD_INVALIDA',
    );
  });

  it('rejects a 1001st rectified invoice', async () => {
    const factura: IDFacturaAR = {
      IDEmisorFactura: '89890001K',
      NumSerieFactura: 'A-1',
      FechaExpedicionFactura: '01-12-2023',
    };
    const registro = await altaMinima(
      {},
      { FacturasRectificadas: Array.from({ length: 1001 }, () => factura) },
    );

    expect(codigoDe(() => writeRegistroAlta(new XmlWriter(), registro))).toBe(
      'CARDINALIDAD_INVALIDA',
    );
  });

  it('explains that an empty list should be omitted, not passed empty', async () => {
    const registro = await altaMinima({}, { Desglose: [] });
    try {
      writeRegistroAlta(new XmlWriter(), registro);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuXmlError).accionSugerida).toContain('Omite');
    }
  });

  it('accepts the boundary: exactly one and exactly 1000', async () => {
    const factura: IDFacturaAR = {
      IDEmisorFactura: '89890001K',
      NumSerieFactura: 'A-1',
      FechaExpedicionFactura: '01-12-2023',
    };
    const registro = await altaMinima(
      { TipoFactura: 'R1' },
      {
        TipoRectificativa: 'I',
        FacturasRectificadas: Array.from({ length: 1000 }, () => factura),
      },
    );

    const w = new XmlWriter();
    w.open('sf:RegistroFactura');
    expect(() => writeRegistroAlta(w, registro)).not.toThrow();
  });
});

describe('a party must be identified', () => {
  // The type already makes this unrepresentable — `PersonaFisicaJuridica` is a union, not two
  // optional keys. The runtime check is for JavaScript callers, and for the day someone builds
  // one of these out of parsed JSON.
  const SIN_IDENTIFICAR = SISTEMA_SIN_IDENTIFICAR as unknown as typeof SISTEMA;

  it('rejects a producer with neither NIF nor IDOtro', async () => {
    const registro = await altaMinima({}, { SistemaInformatico: SIN_IDENTIFICAR });

    expect(codigoDe(() => writeRegistroAlta(new XmlWriter(), registro))).toBe(
      'CARDINALIDAD_INVALIDA',
    );
  });

  it('says which of the two to use, and warns about the ES/01 case', async () => {
    const registro = await altaMinima({}, { SistemaInformatico: SIN_IDENTIFICAR });
    try {
      writeRegistroAlta(new XmlWriter(), registro);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuXmlError).accionSugerida).toContain('CodigoPais=ES');
    }
  });

  it('omits CodigoPais when it is not given', async () => {
    const registro = await altaMinima(
      {},
      { Destinatarios: [{ NombreRazon: 'SIN CENSAR', IDOtro: { IDType: '07', ID: 'X-1' } }] },
    );
    const xml = documento([registro]);

    expect(xml).toContain('<sf:IDOtro><sf:IDType>07</sf:IDType><sf:ID>X-1</sf:ID></sf:IDOtro>');
    await esperarValido(xml);
  });
});

describe('amounts outside the hash are guarded too', () => {
  it('rejects a number in a breakdown line', async () => {
    // `core` already refuses a numeric CuotaTotal. Desglose amounts never pass through `core`,
    // so without this guard `String(12.5)` would reach the document unchallenged.
    const registro = await altaMinima(
      {},
      {
        Desglose: [
          {
            CalificacionOperacion: 'S1',
            BaseImponibleOimporteNoSujeto: 12.5 as unknown as string,
          },
        ],
      },
    );

    expect(codigoDe(() => writeRegistroAlta(new XmlWriter(), registro))).toBe(
      'VALOR_NO_SERIALIZADO',
    );
  });

  it('names the element and explains the 131.40 case', async () => {
    const registro = await altaMinima(
      {},
      {
        Desglose: [
          {
            CalificacionOperacion: 'S1',
            BaseImponibleOimporteNoSujeto: 131.4 as unknown as string,
          },
        ],
      },
    );

    try {
      writeRegistroAlta(new XmlWriter(), registro);
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as VerifactuXmlError;
      expect(e.message).toContain('BaseImponibleOimporteNoSujeto');
      expect(e.message).toContain('131.4');
      expect(e.causaProbable).toContain('Aceptado con errores');
    }
  });
});

describe('values the caller does not get to choose', () => {
  it('fixes TipoHuella at 01 and IDVersion at 1.0', async () => {
    const xml = await documentoConAlta();
    expect(textoDe(xml, 'sf:TipoHuella')).toBe('01');
    expect(textoDe(xml, 'sf:IDVersion')).toBe('1.0');
  });

  it('offers no way to override them', async () => {
    const registro = await altaMinima();
    const conIntento: RegistroAlta = {
      ...registro,
      datos: {
        ...registro.datos,
        // @ts-expect-error — TipoHuella is not part of DatosAlta, on purpose.
        TipoHuella: '02',
      },
    };

    const xml = documento([conIntento]);
    expect(textoDe(xml, 'sf:TipoHuella')).toBe('01');
  });
});

describe('element order follows the schema sequence', () => {
  it('emits the alta elements in the order SuministroInformacion.xsd declares', async () => {
    const registro = await altaMinima(
      { previous: await altaPrevia() },
      { RefExterna: 'X', Macrodato: 'N', NumRegistroAcuerdoFacturacion: 'A-1' },
    );
    const orden = ordenDeElementos(documento([registro]));

    const desde = orden.indexOf('sf:RegistroAlta');
    expect(orden.slice(desde, desde + 8)).toEqual([
      'sf:RegistroAlta',
      'sf:IDVersion',
      'sf:IDFactura',
      'sf:IDEmisorFactura',
      'sf:NumSerieFactura',
      'sf:FechaExpedicionFactura',
      'sf:RefExterna',
      'sf:NombreRazonEmisor',
    ]);

    // …and the tail, where the record's own digest has to come last of all.
    expect(orden.slice(-4)).toEqual([
      'sf:FechaHoraHusoGenRegistro',
      'sf:NumRegistroAcuerdoFacturacion',
      'sf:TipoHuella',
      'sf:Huella',
    ]);
  });

  it('emits no whitespace between elements', async () => {
    expect(await documentoConAlta()).not.toMatch(/>\s+</);
  });
});
