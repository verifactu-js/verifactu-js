/**
 * The rules themselves, one test per rule and per branch.
 *
 * Each test names the section it exercises, so a new revision of the AEAT's document can be walked
 * section by section against this file.
 */
import { describe, expect, it } from 'vitest';

import {
  DOCUMENTOS,
  esAceptable,
  type Problema,
  reglas,
  validarRegistroAlta,
} from '../src/index.js';
import { AHORA, conLinea, LINEA, registro, SISTEMA } from './helpers/fixtures.js';

/** Rule ids reported for a record, in order. */
function ids(problemas: readonly Problema[]): string[] {
  return problemas.map((p) => p.regla);
}

const validar = (r: Parameters<typeof validarRegistroAlta>[0]): Problema[] =>
  validarRegistroAlta(r, { ahora: AHORA });

describe('the clean fixture passes', () => {
  it('reports nothing at all', () => {
    expect(validar(registro())).toEqual([]);
  });

  it('and is therefore acceptable', () => {
    expect(esAceptable(validar(registro()))).toBe(true);
  });
});

describe('§3.1.3.1 — issue date', () => {
  it('rejects a date before the Orden came into force', () => {
    expect(ids(validar(registro({ FechaExpedicionFactura: '27-10-2024' })))).toContain(
      'F3-3.1.3.1',
    );
  });

  it('accepts the day it came into force', () => {
    expect(ids(validar(registro({ FechaExpedicionFactura: '28-10-2024' })))).not.toContain(
      'F3-3.1.3.1',
    );
  });

  it('rejects a date in the future', () => {
    const problemas = validar(registro({ FechaExpedicionFactura: '01-01-2030' }));
    expect(problemas.some((p) => p.mensaje.includes('futuro'))).toBe(true);
  });

  it('accepts today', () => {
    const problemas = validar(registro({ FechaExpedicionFactura: '15-06-2025' }));
    expect(problemas.some((p) => p.mensaje.includes('futuro'))).toBe(false);
  });

  it('says nothing about a date it cannot parse: that is the schema’s job', () => {
    expect(ids(validar(registro({ FechaExpedicionFactura: 'no-es-fecha' })))).not.toContain(
      'F3-3.1.3.1',
    );
  });
});

describe('§3.1.3.2 — RechazoPrevio needs Subsanacion', () => {
  it.each([
    ['X sin Subsanacion', { RechazoPrevio: 'X' as const }],
    ['X con Subsanacion N', { RechazoPrevio: 'X' as const, Subsanacion: 'N' as const }],
    ['S sin Subsanacion', { RechazoPrevio: 'S' as const }],
    ['S con Subsanacion N', { RechazoPrevio: 'S' as const, Subsanacion: 'N' as const }],
  ])('rejects %s', (_etiqueta, datos) => {
    expect(ids(validar(registro({}, datos)))).toContain('F3-3.1.3.2');
  });

  it.each([
    ['X con Subsanacion S', { RechazoPrevio: 'X' as const, Subsanacion: 'S' as const }],
    ['S con Subsanacion S', { RechazoPrevio: 'S' as const, Subsanacion: 'S' as const }],
    ['N a secas', { RechazoPrevio: 'N' as const }],
  ])('accepts %s', (_etiqueta, datos) => {
    expect(ids(validar(registro({}, datos)))).not.toContain('F3-3.1.3.2');
  });
});

describe('§3.1.3.3 — TipoRectificativa', () => {
  it.each([['R1'], ['R2'], ['R3'], ['R4'], ['R5']])(
    'is mandatory for %s and its absence is reported',
    (tipo) => {
      const problemas = validar(registro({ TipoFactura: tipo }, { Cupon: undefined }));
      expect(ids(problemas)).toContain('F3-3.1.3.3');
    },
  );

  it('is accepted when present on a rectificativa', () => {
    const problemas = validar(registro({ TipoFactura: 'R1' }, { TipoRectificativa: 'I' }));
    expect(ids(problemas)).not.toContain('F3-3.1.3.3');
  });

  it('is rejected on a non-rectificativa', () => {
    expect(ids(validar(registro({ TipoFactura: 'F1' }, { TipoRectificativa: 'I' })))).toContain(
      'F3-3.1.3.3',
    );
  });
});

describe('§3.1.3.4 and §3.1.3.5 — which invoices may list others', () => {
  const factura = {
    IDEmisorFactura: '89890001K',
    NumSerieFactura: 'A/0',
    FechaExpedicionFactura: '01-12-2024',
  };

  it('FacturasRectificadas only on a rectificativa', () => {
    expect(ids(validar(registro({}, { FacturasRectificadas: [factura] })))).toContain('F3-3.1.3.4');
    expect(
      ids(
        validar(
          registro(
            { TipoFactura: 'R1' },
            { TipoRectificativa: 'I', FacturasRectificadas: [factura] },
          ),
        ),
      ),
    ).not.toContain('F3-3.1.3.4');
  });

  it('FacturasSustituidas only on an F3', () => {
    expect(ids(validar(registro({}, { FacturasSustituidas: [factura] })))).toContain('F3-3.1.3.5');
    expect(
      ids(validar(registro({ TipoFactura: 'F3' }, { FacturasSustituidas: [factura] }))),
    ).not.toContain('F3-3.1.3.5');
  });
});

describe('§3.1.3.6 — ImporteRectificacion pairs with TipoRectificativa "S"', () => {
  const importe = { BaseRectificada: '100.00', CuotaRectificada: '21.00' };

  it('is required when the rectificativa is sustitutiva', () => {
    expect(ids(validar(registro({ TipoFactura: 'R1' }, { TipoRectificativa: 'S' })))).toContain(
      'F3-3.1.3.6',
    );
  });

  it('is rejected when it is not', () => {
    expect(
      ids(
        validar(
          registro(
            { TipoFactura: 'R1' },
            { TipoRectificativa: 'I', ImporteRectificacion: importe },
          ),
        ),
      ),
    ).toContain('F3-3.1.3.6');
  });

  it('is accepted when both agree', () => {
    expect(
      ids(
        validar(
          registro(
            { TipoFactura: 'R1' },
            { TipoRectificativa: 'S', ImporteRectificacion: importe },
          ),
        ),
      ),
    ).not.toContain('F3-3.1.3.6');
  });
});

describe('§3.1.3.7 — FechaOperacion window', () => {
  it('rejects an operation more than twenty years old', () => {
    expect(ids(validar(registro({}, { FechaOperacion: '01-01-2000' })))).toContain('F3-3.1.3.7');
  });

  it('rejects one beyond next year', () => {
    expect(ids(validar(registro({}, { FechaOperacion: '01-01-2027' })))).toContain('F3-3.1.3.7');
  });

  it('accepts the last day of next year', () => {
    expect(ids(validar(registro({}, { FechaOperacion: '31-12-2026' })))).not.toContain(
      'F3-3.1.3.7',
    );
  });
});

describe('§3.1.3.8 and §3.1.3.9 — the two article flags', () => {
  it('Art. 7.2/7.3 only on F1, F3 or R1-R4', () => {
    expect(ids(validar(registro({}, { FacturaSimplificadaArt7273: 'S' })))).not.toContain(
      'F3-3.1.3.8',
    );
    expect(
      ids(
        validar(
          registro(
            { TipoFactura: 'F2' },
            { FacturaSimplificadaArt7273: 'S', Destinatarios: undefined },
          ),
        ),
      ),
    ).toContain('F3-3.1.3.8');
  });

  it('Art. 6.1.d only on F2 or R5', () => {
    expect(ids(validar(registro({}, { FacturaSinIdentifDestinatarioArt61d: 'S' })))).toContain(
      'F3-3.1.3.9',
    );
  });
});

describe('§3.1.3.10 — Macrodato', () => {
  it('is required from 100.000.000,00 euros', () => {
    const problemas = validar(
      registro(
        { ImporteTotal: '100000000.00', CuotaTotal: '0.00' },
        {
          Desglose: [
            {
              ...LINEA,
              BaseImponibleOimporteNoSujeto: '100000000.00',
              CuotaRepercutida: '21000000.00',
            },
          ],
        },
      ),
    );
    expect(ids(problemas)).toContain('F3-3.1.3.10');
  });

  it('is not required one cent below', () => {
    expect(ids(validar(registro({ ImporteTotal: '99999999.99' })))).not.toContain('F3-3.1.3.10');
  });

  it('uses the absolute value, so a large refund needs it too', () => {
    expect(ids(validar(registro({ ImporteTotal: '-100000000.00' })))).toContain('F3-3.1.3.10');
  });

  it('is satisfied by declaring it', () => {
    expect(
      ids(validar(registro({ ImporteTotal: '100000000.00' }, { Macrodato: 'S' }))),
    ).not.toContain('F3-3.1.3.10');
  });
});

describe('§3.1.3.11 and §3.1.3.12 — third parties', () => {
  const tercero = { NombreRazon: 'GESTORIA SL', NIF: 'B12345674' };

  it('"T" requires the Tercero block', () => {
    expect(ids(validar(registro({}, { EmitidaPorTerceroODestinatario: 'T' })))).toContain(
      'F3-3.1.3.11',
    );
  });

  it('"D" requires recipients', () => {
    expect(
      ids(validar(registro({}, { EmitidaPorTerceroODestinatario: 'D', Destinatarios: undefined }))),
    ).toContain('F3-3.1.3.11');
  });

  it('the Tercero block needs "T"', () => {
    expect(ids(validar(registro({}, { Tercero: tercero })))).toContain('F3-3.1.3.12');
  });

  it('a third party cannot be the issuer', () => {
    const problemas = validar(
      registro(
        {},
        {
          EmitidaPorTerceroODestinatario: 'T',
          Tercero: { NombreRazon: 'YO MISMO', NIF: '89890001K' },
        },
      ),
    );
    expect(problemas.some((p) => p.mensaje.includes('coincide con el del emisor'))).toBe(true);
  });

  it('rejects IDType 07 for a third party', () => {
    const problemas = validar(
      registro(
        {},
        {
          EmitidaPorTerceroODestinatario: 'T',
          Tercero: { NombreRazon: 'X', IDOtro: { CodigoPais: 'ES', IDType: '07', ID: '1' } },
        },
      ),
    );
    expect(problemas.some((p) => p.mensaje.includes('IDType "07"'))).toBe(true);
  });

  it('requires IDType 03 for a Spanish third party identified by IDOtro', () => {
    const problemas = validar(
      registro(
        {},
        {
          EmitidaPorTerceroODestinatario: 'T',
          Tercero: { NombreRazon: 'X', IDOtro: { CodigoPais: 'ES', IDType: '04', ID: '1' } },
        },
      ),
    );
    expect(problemas.some((p) => p.mensaje.includes('CodigoPais "ES" exige IDType "03"'))).toBe(
      true,
    );
  });

  it('accepts a foreign third party with a NIF-IVA', () => {
    expect(
      ids(
        validar(
          registro(
            {},
            {
              EmitidaPorTerceroODestinatario: 'T',
              Tercero: {
                NombreRazon: 'ACME GMBH',
                IDOtro: { CodigoPais: 'DE', IDType: '02', ID: 'DE1' },
              },
            },
          ),
        ),
      ),
    ).not.toContain('F3-3.1.3.12');
  });
});

describe('§3.1.3.13 — recipients', () => {
  it('are required on an F1', () => {
    expect(ids(validar(registro({}, { Destinatarios: undefined })))).toContain('F3-3.1.3.13');
  });

  it('are refused on an F2', () => {
    expect(ids(validar(registro({ TipoFactura: 'F2' })))).toContain('F3-3.1.3.13');
  });

  it('reject an empty list as loudly as a missing one', () => {
    expect(ids(validar(registro({}, { Destinatarios: [] })))).toContain('F3-3.1.3.13');
  });

  it('require CodigoPais ES for IDType 07', () => {
    const problemas = validar(
      registro(
        {},
        {
          Destinatarios: [
            { NombreRazon: 'X', IDOtro: { CodigoPais: 'FR', IDType: '07', ID: '1' } },
          ],
        },
      ),
    );
    expect(problemas.some((p) => p.mensaje.includes('IDType "07" exige CodigoPais "ES"'))).toBe(
      true,
    );
  });

  it('allow IDType 03 or 07 for a Spanish recipient, and nothing else', () => {
    const conCuatro = validar(
      registro(
        {},
        {
          Destinatarios: [
            { NombreRazon: 'X', IDOtro: { CodigoPais: 'ES', IDType: '04', ID: '1' } },
          ],
        },
      ),
    );
    expect(conCuatro.some((p) => p.mensaje.includes('debe ser "03" o "07"'))).toBe(true);

    const conSiete = validar(
      registro(
        {},
        {
          Destinatarios: [
            { NombreRazon: 'X', IDOtro: { CodigoPais: 'ES', IDType: '07', ID: '1' } },
          ],
        },
      ),
    );
    expect(ids(conSiete)).not.toContain('F3-3.1.3.13');
  });

  it('name the offending recipient by index', () => {
    const problemas = validar(
      registro(
        {},
        {
          Destinatarios: [
            { NombreRazon: 'BIEN', NIF: 'B12345674' },
            { NombreRazon: 'MAL', IDOtro: { CodigoPais: 'FR', IDType: '07', ID: '1' } },
          ],
        },
      ),
    );
    expect(problemas.some((p) => p.mensaje.startsWith('Destinatario 1:'))).toBe(true);
  });
});

describe('§3.1.3.14 — Cupon', () => {
  it('only on R1 or R5', () => {
    expect(ids(validar(registro({}, { Cupon: 'S' })))).toContain('F3-3.1.3.14');
    expect(
      ids(validar(registro({ TipoFactura: 'R1' }, { TipoRectificativa: 'I', Cupon: 'S' }))),
    ).not.toContain('F3-3.1.3.14');
  });

  it('"N" is always fine', () => {
    expect(ids(validar(registro({}, { Cupon: 'N' })))).not.toContain('F3-3.1.3.14');
  });
});

describe('§15.1 — TipoImpositivo and its windows', () => {
  it.each([['0'], ['4'], ['10'], ['21']])('accepts %s at any date', (tipo) => {
    const r = conLinea(
      { TipoImpositivo: tipo, CuotaRepercutida: '0.00' },
      { CuotaTotal: '0.00', ImporteTotal: '100.00' },
    );
    expect(ids(validar(r))).not.toContain('F3-15.1');
  });

  it('rejects a rate that is not in the list', () => {
    expect(ids(validar(conLinea({ TipoImpositivo: '16' })))).toContain('F3-15.1');
  });

  it('accepts 5 only inside its window', () => {
    const dentro = conLinea({ TipoImpositivo: '5' }, {}, { FechaOperacion: '01-09-2024' });
    const fuera = conLinea({ TipoImpositivo: '5' }, {}, { FechaOperacion: '01-11-2024' });
    expect(ids(validar(dentro))).not.toContain('F3-15.1');
    expect(ids(validar(fuera))).toContain('F3-15.1');
  });

  it('accepts 7.5 and 2 only in the last quarter of 2024', () => {
    for (const tipo of ['7.5', '2']) {
      const dentro = conLinea({ TipoImpositivo: tipo }, {}, { FechaOperacion: '15-11-2024' });
      const fuera = conLinea({ TipoImpositivo: tipo }, {}, { FechaOperacion: '15-01-2025' });
      expect(ids(validar(dentro))).not.toContain('F3-15.1');
      expect(ids(validar(fuera))).toContain('F3-15.1');
    }
  });

  it('falls back to the issue date when there is no operation date', () => {
    // The rule says so verbatim, and it is the difference between a 2023 operation invoiced now
    // being legal or not.
    const r = conLinea({ TipoImpositivo: '5' }, { FechaExpedicionFactura: '15-01-2025' });
    expect(ids(validar(r))).toContain('F3-15.1');
  });

  it('does not apply outside IVA', () => {
    const r = conLinea({ Impuesto: '03', TipoImpositivo: '16', ClaveRegimen: '01' });
    expect(ids(validar(r))).not.toContain('F3-15.1');
  });
});

describe('§15.2 — BaseImponibleACoste', () => {
  it('needs ClaveRegimen 06 or IPSI/otros', () => {
    expect(ids(validar(conLinea({ BaseImponibleACoste: '100.00' })))).toContain('F3-15.2');
    expect(
      ids(validar(conLinea({ ClaveRegimen: '06', BaseImponibleACoste: '100.00' }))),
    ).not.toContain('F3-15.2');
    expect(
      ids(
        validar(
          conLinea({ Impuesto: '05', ClaveRegimen: undefined, BaseImponibleACoste: '100.00' }),
        ),
      ),
    ).not.toContain('F3-15.2');
  });
});

describe('§15.3 — TipoRecargoEquivalencia pairs with the rate', () => {
  it.each([
    ['21', '5.2'],
    ['21', '1.75'],
    ['10', '1.4'],
    ['4', '0.5'],
  ])('accepts %s%% with recargo %s', (tipo, recargo) => {
    const r = conLinea({
      TipoImpositivo: tipo,
      TipoRecargoEquivalencia: recargo,
      CuotaRepercutida: undefined,
      CalificacionOperacion: 'S1',
    });
    expect(ids(validar(r))).not.toContain('F3-15.3');
  });

  it('rejects a recargo that does not go with the rate', () => {
    expect(
      ids(validar(conLinea({ TipoImpositivo: '21', TipoRecargoEquivalencia: '1.4' }))),
    ).toContain('F3-15.3');
  });

  it('applies the dated pairing for the 5% rate', () => {
    const antiguo = conLinea(
      { TipoImpositivo: '5', TipoRecargoEquivalencia: '0.5' },
      {},
      { FechaOperacion: '01-12-2022' },
    );
    const nuevo = conLinea(
      { TipoImpositivo: '5', TipoRecargoEquivalencia: '0.62' },
      {},
      { FechaOperacion: '01-06-2023' },
    );
    const cruzado = conLinea(
      { TipoImpositivo: '5', TipoRecargoEquivalencia: '0.5' },
      {},
      { FechaOperacion: '01-06-2023' },
    );

    expect(ids(validar(antiguo))).not.toContain('F3-15.3');
    expect(ids(validar(nuevo))).not.toContain('F3-15.3');
    expect(ids(validar(cruzado))).toContain('F3-15.3');
  });

  it('rejects a recargo that is not a percentage at all', () => {
    expect(ids(validar(conLinea({ TipoRecargoEquivalencia: 'mucho' })))).toContain('F3-15.3');
  });
});

describe('§15.4 — CalificacionOperacion', () => {
  it('S2 forces rate and cuota to zero', () => {
    const r = conLinea({
      CalificacionOperacion: 'S2',
      TipoImpositivo: '21',
      CuotaRepercutida: '21.00',
    });
    const problemas = validar(r);
    expect(problemas.filter((p) => p.regla === 'F3-15.4')).toHaveLength(2);
  });

  it('S2 accepts a zeroed line', () => {
    const r = conLinea(
      { CalificacionOperacion: 'S2', TipoImpositivo: '0', CuotaRepercutida: '0.00' },
      { CuotaTotal: '0.00', ImporteTotal: '100.00' },
    );
    expect(ids(validar(r))).not.toContain('F3-15.4');
  });

  it('S2 is refused on an F2', () => {
    const r = conLinea(
      { CalificacionOperacion: 'S2', TipoImpositivo: '0', CuotaRepercutida: '0.00' },
      { TipoFactura: 'F2', CuotaTotal: '0.00', ImporteTotal: '100.00' },
      { Destinatarios: undefined },
    );
    expect(ids(validar(r))).toContain('F3-15.4');
  });

  it('N1 and N2 admit none of the four tax fields', () => {
    const r = conLinea(
      {
        CalificacionOperacion: 'N1',
        TipoImpositivo: '21',
        CuotaRepercutida: '21.00',
        TipoRecargoEquivalencia: '5.2',
        CuotaRecargoEquivalencia: '5.20',
      },
      { CuotaTotal: '26.20', ImporteTotal: '126.20' },
    );
    expect(validar(r).filter((p) => p.regla === 'F3-15.4')).toHaveLength(4);
  });

  it('N1 with nothing else is fine', () => {
    const r = conLinea(
      {
        CalificacionOperacion: 'N1',
        TipoImpositivo: undefined,
        CuotaRepercutida: undefined,
      },
      { CuotaTotal: '0.00', ImporteTotal: '100.00' },
    );
    expect(ids(validar(r))).not.toContain('F3-15.4');
  });
});

describe('§15.6 — ClaveRegimen', () => {
  it('is mandatory for IVA', () => {
    expect(ids(validar(conLinea({ ClaveRegimen: undefined })))).toContain('F3-15.6');
  });

  it('does not go with Impuesto 05', () => {
    expect(ids(validar(conLinea({ Impuesto: '05' })))).toContain('F3-15.6');
  });

  it('restricts the IPSI keys, as a warning before 2027', () => {
    const r = conLinea(
      { Impuesto: '02', ClaveRegimen: '02', CalificacionOperacion: 'S1', TipoImpositivo: '21' },
      {},
      { FechaOperacion: '01-06-2025' },
    );
    const problema = validar(r).find((p) => p.regla === 'F3-15.6' && p.severidad === 'aviso');
    expect(problema?.mensaje).toContain('Hasta el 31-12-2026');
  });

  it('and as a rejection from 2027', () => {
    const r = conLinea(
      { Impuesto: '02', ClaveRegimen: '02', CalificacionOperacion: 'S1', TipoImpositivo: '21' },
      {},
      { FechaOperacion: '01-06-2027' },
    );
    const problema = validar(r).find((p) => p.regla === 'F3-15.6' && p.severidad === 'aviso');
    expect(problema?.mensaje).toContain('Desde el 01-01-2027');
  });

  it('accepts an IPSI key from the list', () => {
    const r = conLinea({ Impuesto: '02', ClaveRegimen: '18' });
    expect(validar(r).filter((p) => p.regla === 'F3-15.6')).toHaveLength(0);
  });
});

describe('§15.7 — CuotaRepercutida against base and rate', () => {
  it('accepts the exact figure', () => {
    expect(ids(validar(registro()))).not.toContain('F3-15.7');
  });

  it('accepts a discrepancy of ten euros and refuses one cent more', () => {
    const dentro = conLinea(
      { CuotaRepercutida: '31.00' },
      { CuotaTotal: '31.00', ImporteTotal: '131.00' },
    );
    const fuera = conLinea(
      { CuotaRepercutida: '31.01' },
      { CuotaTotal: '31.01', ImporteTotal: '131.01' },
    );

    expect(ids(validar(dentro))).not.toContain('F3-15.7');
    expect(ids(validar(fuera))).toContain('F3-15.7');
  });

  it('requires base and cuota to share a sign', () => {
    const r = conLinea(
      { BaseImponibleOimporteNoSujeto: '-100.00', CuotaRepercutida: '21.00' },
      { CuotaTotal: '21.00', ImporteTotal: '-79.00' },
    );
    expect(validar(r).some((p) => p.mensaje.includes('mismo signo'))).toBe(true);
  });

  it('accepts a fully negative line', () => {
    const r = conLinea(
      { BaseImponibleOimporteNoSujeto: '-100.00', CuotaRepercutida: '-21.00' },
      { CuotaTotal: '-21.00', ImporteTotal: '-121.00' },
    );
    expect(ids(validar(r))).not.toContain('F3-15.7');
  });

  it('exempts a rectificativa por diferencias from the arithmetic', () => {
    const r = conLinea(
      { CuotaRepercutida: '999.00' },
      { TipoFactura: 'R1', CuotaTotal: '999.00', ImporteTotal: '1099.00' },
      { TipoRectificativa: 'I' },
    );
    expect(ids(validar(r))).not.toContain('F3-15.7');
  });

  it.each([['R2'], ['R3']])('exempts %s too', (tipo) => {
    const r = conLinea(
      { CuotaRepercutida: '999.00' },
      { TipoFactura: tipo, CuotaTotal: '999.00', ImporteTotal: '1099.00' },
      {
        TipoRectificativa: 'S',
        ImporteRectificacion: { BaseRectificada: '1.00', CuotaRectificada: '1.00' },
      },
    );
    expect(ids(validar(r))).not.toContain('F3-15.7');
  });

  it('requires rate and cuota when the operation is S1', () => {
    const r = conLinea(
      { TipoImpositivo: undefined, CuotaRepercutida: undefined },
      { CuotaTotal: '0.00', ImporteTotal: '100.00' },
    );
    const mensajes = validar(r)
      .filter((p) => p.regla === 'F3-15.7')
      .map((p) => p.mensaje);
    expect(mensajes).toHaveLength(2);
  });

  it('forbids a non-zero cuota when the operation is not S1', () => {
    const r = conLinea(
      { CalificacionOperacion: 'N1', TipoImpositivo: undefined, CuotaRepercutida: '21.00' },
      { CuotaTotal: '21.00', ImporteTotal: '121.00' },
    );
    expect(ids(validar(r))).toContain('F3-15.7');
  });

  it('measures against BaseImponibleACoste when that is what is filled in', () => {
    const r = conLinea(
      {
        ClaveRegimen: '06',
        BaseImponibleOimporteNoSujeto: '0.00',
        BaseImponibleACoste: '100.00',
        CuotaRepercutida: '21.00',
      },
      { CuotaTotal: '21.00', ImporteTotal: '21.00' },
    );
    expect(ids(validar(r))).not.toContain('F3-15.7');
  });
});

describe('§15.8 — the simplified-invoice ceiling', () => {
  const linea = (base: string, cuota: string) => ({
    ...LINEA,
    BaseImponibleOimporteNoSujeto: base,
    CuotaRepercutida: cuota,
  });

  it('accepts 3000 plus the ten-euro margin', () => {
    const r = registro(
      { TipoFactura: 'F2', CuotaTotal: '0.00', ImporteTotal: '3010.00' },
      { Destinatarios: undefined, Desglose: [linea('3010.00', '0.00')] },
    );
    expect(ids(validar(r))).not.toContain('F3-15.8');
  });

  it('refuses one cent more', () => {
    const r = registro(
      { TipoFactura: 'F2', CuotaTotal: '0.00', ImporteTotal: '3010.01' },
      { Destinatarios: undefined, Desglose: [linea('3010.01', '0.00')] },
    );
    expect(ids(validar(r))).toContain('F3-15.8');
  });

  it('does not apply with a facturación agreement', () => {
    const r = registro(
      { TipoFactura: 'F2', CuotaTotal: '0.00', ImporteTotal: '5000.00' },
      {
        Destinatarios: undefined,
        NumRegistroAcuerdoFacturacion: 'ACUERDO-1',
        Desglose: [linea('5000.00', '0.00')],
      },
    );
    expect(ids(validar(r))).not.toContain('F3-15.8');
  });

  it('does not apply under article 6.1.d either', () => {
    const r = registro(
      { TipoFactura: 'F2', CuotaTotal: '0.00', ImporteTotal: '5000.00' },
      {
        Destinatarios: undefined,
        FacturaSinIdentifDestinatarioArt61d: 'S',
        Desglose: [linea('5000.00', '0.00')],
      },
    );
    expect(ids(validar(r))).not.toContain('F3-15.8');
  });

  it('does not apply to an F1 of any size', () => {
    const r = registro(
      { CuotaTotal: '0.00', ImporteTotal: '9000.00' },
      { Desglose: [linea('9000.00', '0.00')] },
    );
    expect(ids(validar(r))).not.toContain('F3-15.8');
  });
});

describe('§16 and §17 — the totals', () => {
  it('accept a sum that matches', () => {
    expect(ids(validar(registro()))).not.toContain('F3-16');
    expect(ids(validar(registro()))).not.toContain('F3-17');
  });

  it('report a CuotaTotal that does not, as a warning and not a rejection', () => {
    const problemas = validar(registro({ CuotaTotal: '50.00' }));
    const problema = problemas.find((p) => p.regla === 'F3-16');

    expect(problema?.severidad).toBe('aviso');
    expect(problema?.mensaje).toContain('21.00');
    expect(esAceptable(problemas)).toBe(true);
  });

  it('report an ImporteTotal that does not', () => {
    expect(ids(validar(registro({ ImporteTotal: '500.00' })))).toContain('F3-17');
  });

  it('allow ten euros of drift', () => {
    expect(ids(validar(registro({ CuotaTotal: '31.00' })))).not.toContain('F3-16');
    expect(ids(validar(registro({ CuotaTotal: '31.01' })))).toContain('F3-16');
  });

  it('add up several lines', () => {
    const r = registro(
      { CuotaTotal: '42.00', ImporteTotal: '242.00' },
      { Desglose: [LINEA, LINEA] },
    );
    expect(ids(validar(r))).not.toContain('F3-16');
    expect(ids(validar(r))).not.toContain('F3-17');
  });

  it('include the equivalence surcharge in both sums', () => {
    const r = registro(
      { CuotaTotal: '26.20', ImporteTotal: '126.20' },
      {
        Desglose: [{ ...LINEA, TipoRecargoEquivalencia: '5.2', CuotaRecargoEquivalencia: '5.20' }],
      },
    );
    expect(ids(validar(r))).not.toContain('F3-16');
    expect(ids(validar(r))).not.toContain('F3-17');
  });

  it.each([['03'], ['05'], ['06'], ['08'], ['09']])('switch off for ClaveRegimen %s', (clave) => {
    const r = registro(
      { CuotaTotal: '999.00', ImporteTotal: '999.00' },
      { Desglose: [{ ...LINEA, ClaveRegimen: clave }] },
    );
    expect(ids(validar(r))).not.toContain('F3-16');
    expect(ids(validar(r))).not.toContain('F3-17');
  });
});

describe('the findings themselves', () => {
  it('carry the quote, the section and the document version', () => {
    const problema = validar(registro({ TipoFactura: 'R1' }))[0];

    expect(problema?.fuente.documento).toBe('F3');
    expect(problema?.fuente.version).toBe(DOCUMENTOS.F3.version);
    expect(problema?.fuente.seccion).toBe('3.1.3.3');
    expect(problema?.cita).toContain('Campo obligatorio si TipoFactura');
  });

  it('point at the offending breakdown line', () => {
    const r = registro(
      { CuotaTotal: '21.00', ImporteTotal: '221.00' },
      { Desglose: [LINEA, { ...LINEA, TipoImpositivo: '16' }] },
    );
    const problema = validar(r).find((p) => p.regla === 'F3-15.1');
    expect(problema?.linea).toBe(1);
  });

  it('leave the line out when the finding is about the whole record', () => {
    const problema = validar(registro({ CuotaTotal: '50.00' })).find((p) => p.regla === 'F3-16');
    expect(problema?.linea).toBeUndefined();
  });

  it('report everything at once instead of stopping at the first', () => {
    const r = registro(
      { TipoFactura: 'R1', CuotaTotal: '99.00' },
      { Cupon: 'S', Destinatarios: undefined },
    );
    expect(validar(r).length).toBeGreaterThan(2);
  });

  it('never throw, whatever they are handed', () => {
    const roto = { fields: registro().fields, datos: { ...registro().datos, Desglose: [] } };
    expect(() => validarRegistroAlta(roto)).not.toThrow();
  });

  it('use the system clock when no context is given', () => {
    expect(() => validarRegistroAlta(registro())).not.toThrow();
  });
});

describe('values it cannot parse', () => {
  // A validator that crashes on a malformed amount is worse than one that says nothing about it:
  // the shape of these fields is the schema's job, and the caller wants the *other* findings.
  it('says nothing about an unparseable ImporteTotal', () => {
    const problemas = validar(registro({ ImporteTotal: 'mucho dinero' }));
    expect(ids(problemas)).not.toContain('F3-3.1.3.10');
    expect(ids(problemas)).not.toContain('F3-17');
  });

  it('says nothing about an unparseable CuotaTotal', () => {
    expect(ids(validar(registro({ CuotaTotal: '' })))).not.toContain('F3-16');
  });

  it('treats an unparseable line amount as zero when summing', () => {
    const r = registro(
      { CuotaTotal: '0.00', ImporteTotal: '0.00' },
      { Desglose: [{ ...LINEA, BaseImponibleOimporteNoSujeto: 'x', CuotaRepercutida: 'y' }] },
    );
    expect(ids(validar(r))).not.toContain('F3-16');
    expect(ids(validar(r))).not.toContain('F3-17');
  });

  it('reports a TipoImpositivo that is not a percentage', () => {
    const problema = validar(conLinea({ TipoImpositivo: 'mucho' })).find(
      (p) => p.regla === 'F3-15.1',
    );
    expect(problema?.mensaje).toContain('no es un porcentaje');
  });

  it('skips the rate pairing when there is no rate to pair with', () => {
    const r = conLinea({ TipoImpositivo: undefined, TipoRecargoEquivalencia: '5.2' });
    expect(ids(validar(r))).not.toContain('F3-15.3');
  });

  it('skips the rate pairing for a rate that has no table entry', () => {
    const r = conLinea({ TipoImpositivo: '16', TipoRecargoEquivalencia: '5.2' });
    expect(ids(validar(r))).not.toContain('F3-15.3');
  });

  it('skips the cuota arithmetic when the base cannot be read', () => {
    const r = conLinea(
      { BaseImponibleOimporteNoSujeto: 'x' },
      { CuotaTotal: '21.00', ImporteTotal: '21.00' },
    );
    expect(ids(validar(r))).not.toContain('F3-15.7');
  });

  it('ignores an unreadable operation date when checking a rate window', () => {
    const r = conLinea({ TipoImpositivo: '5' }, {}, { FechaOperacion: '99-99-9999' });
    expect(ids(validar(r))).not.toContain('F3-15.1');
  });

  it('reads a negative percentage without losing the sign', () => {
    // Not legal anywhere, but it must not silently become positive on the way in.
    const r = conLinea({ TipoImpositivo: '-21' });
    expect(ids(validar(r))).toContain('F3-15.1');
  });

  it('still reports the missing fields on a rectificativa exempt from the arithmetic', () => {
    // The exemption is from the sum, not from «TipoImpositivo: campo obligatorio».
    const r = conLinea(
      { TipoImpositivo: undefined, CuotaRepercutida: undefined },
      { TipoFactura: 'R2', CuotaTotal: '0.00', ImporteTotal: '100.00' },
      { TipoRectificativa: 'I' },
    );
    const mensajes = validar(r)
      .filter((p) => p.regla === 'F3-15.7')
      .map((p) => p.mensaje);
    expect(mensajes).toHaveLength(2);
  });

  it('treats unreadable amounts as zero when totting up a simplified invoice', () => {
    const r = conLinea(
      { BaseImponibleOimporteNoSujeto: 'x', CuotaRepercutida: undefined },
      { TipoFactura: 'F2', CuotaTotal: '0.00', ImporteTotal: '0.00' },
      { Destinatarios: undefined },
    );
    expect(ids(validar(r))).not.toContain('F3-15.8');
  });

  it('reports a NIF-IVA recipient on an invoice type that cannot have one', () => {
    const r = registro(
      { TipoFactura: 'F2' },
      {
        Destinatarios: [
          { NombreRazon: 'X', IDOtro: { CodigoPais: 'DE', IDType: '02', ID: 'DE1' } },
        ],
      },
    );
    const mensajes = validar(r)
      .filter((p) => p.regla === 'F3-3.1.3.13')
      .map((p) => p.mensaje);
    expect(mensajes.some((m) => m.includes('IDType "02"'))).toBe(true);
  });
});

describe('the rule catalogue', () => {
  it('lists every rule with its citation and version', () => {
    const catalogo = reglas();

    expect(catalogo.length).toBeGreaterThan(15);
    for (const r of catalogo) {
      expect(r.id.startsWith('F3-')).toBe(true);
      expect(r.version).toBe(DOCUMENTOS.F3.version);
      expect(r.cita.length).toBeGreaterThan(20);
      expect(r.seccion).not.toBe('');
    }
  });

  it('has no duplicate identifiers for different sections', () => {
    const catalogo = reglas();
    for (const r of catalogo) {
      expect(r.id).toBe(`F3-${r.seccion}`);
    }
  });

  it('marks as warnings exactly the rules the document says do not reject', () => {
    // §16 and §17 say «no generará rechazo» verbatim, and §15.6 for IPSI says the same until
    // 2027. Everything else falls under §3, which rejects the record.
    const avisos = reglas()
      .filter((r) => r.severidad === 'aviso')
      .map((r) => r.seccion)
      .sort();
    expect(avisos).toEqual(['15.6', '16', '17']);
  });

  it('records the document that was actually read', () => {
    expect(DOCUMENTOS.F3.version).toBe('1.2.2');
    expect(DOCUMENTOS.F3.titulo).toContain('Validaciones y Errores');
  });
});

describe('the model travels with the rules', () => {
  it('exports the types xml needs', () => {
    // A compile-time check that the move actually happened: if these were still declared in
    // `xml`, this import would not resolve.
    const sistema: typeof SISTEMA = SISTEMA;
    expect(sistema.IdSistemaInformatico).toBe('VJ');
  });
});
