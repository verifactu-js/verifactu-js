/**
 * Breakdown rules: AEAT «Validaciones y Errores» §3.1.3.15, plus the two totals in §16 and §17.
 *
 * ## The dates matter more than they look
 *
 * Several rules admit a tax rate only inside a window — the reduced VAT rates of 2022-2024. It is
 * tempting to assume they are dead letters, because `FechaExpedicionFactura` cannot be earlier
 * than 28-10-2024 (§3.1.3.1). They are not: the rules key on **`FechaOperacion`**, which may be up
 * to twenty years old (§3.1.3.7). An invoice issued today for a 2023 operation lands squarely
 * inside them.
 *
 * ## Sums are done in integer cents
 *
 * See `importes.ts`. A rule whose whole purpose is to catch a discrepancy of a few cents cannot be
 * evaluated with an operator that introduces its own.
 */

import {
  aCentesimas,
  aCentimos,
  aFecha,
  cuotaEsperada,
  deCentimos,
  dentroDelMargen,
  MARGEN,
  signo,
} from './importes.js';
import type { DetalleDesglose } from './modelo.js';
import { type Regla, regla } from './problemas.js';
import type { RegistroAltaValidable } from './reglas-registro.js';

/** One breakdown line, with the record it belongs to: most rules need both. */
export interface Linea {
  readonly detalle: DetalleDesglose;
  readonly registro: RegistroAltaValidable;
}

/** IVA when `Impuesto` is absent — the schema's default, stated in §3.1.3.15 over and over. */
function esIva(detalle: DetalleDesglose): boolean {
  return detalle.Impuesto === undefined || detalle.Impuesto === '01';
}

/**
 * The date the rate windows are measured against.
 *
 * «FechaOperacion (FechaExpedicionFactura de la agrupación IDFactura si no se informa
 * FechaOperacion)» — repeated verbatim in §15.1 and §15.3.
 */
function fechaEfectiva(registro: RegistroAltaValidable): number | null {
  return aFecha(registro.datos.FechaOperacion ?? registro.fields.FechaExpedicionFactura);
}

const D = (anio: number, mes: number, dia: number): number => Date.UTC(anio, mes - 1, dia);

/** A window in which a rate is admitted. Absent bounds mean "always". */
interface Ventana {
  readonly desde?: number;
  readonly hasta?: number;
}

function dentroDe(fecha: number | null, ventana: Ventana): boolean {
  if (fecha === null) return true; // Unparseable dates are another rule's problem.
  if (ventana.desde !== undefined && fecha < ventana.desde) return false;
  return !(ventana.hasta !== undefined && fecha > ventana.hasta);
}

/** `TipoImpositivo` values admitted for IVA + `S1`, in hundredths, with their windows. */
const TIPOS_IMPOSITIVOS: ReadonlyMap<number, Ventana> = new Map([
  [0, {}],
  [400, {}],
  [1000, {}],
  [2100, {}],
  [500, { desde: D(2022, 7, 1), hasta: D(2024, 9, 30) }],
  [200, { desde: D(2024, 10, 1), hasta: D(2024, 12, 31) }],
  [750, { desde: D(2024, 10, 1), hasta: D(2024, 12, 31) }],
]);

/** `TipoRecargoEquivalencia` admitted for each `TipoImpositivo`, in hundredths. */
const RECARGOS_POR_TIPO: ReadonlyMap<number, ReadonlyArray<Ventana & { valor: number }>> = new Map([
  [2100, [{ valor: 520 }, { valor: 175 }]],
  [1000, [{ valor: 140 }]],
  [750, [{ valor: 100, desde: D(2024, 10, 1), hasta: D(2024, 12, 31) }]],
  [
    500,
    [
      { valor: 50, hasta: D(2022, 12, 31) },
      { valor: 62, desde: D(2023, 1, 1), hasta: D(2024, 9, 30) },
    ],
  ],
  [400, [{ valor: 50 }]],
  [200, [{ valor: 26, desde: D(2024, 10, 1), hasta: D(2024, 12, 31) }]],
  [0, [{ valor: 0, desde: D(2023, 1, 1), hasta: D(2024, 9, 30) }]],
]);

/** `ClaveRegimen` values admitted when `Impuesto` is IPSI (F3 §15.6). */
const CLAVES_IPSI: ReadonlySet<string> = new Set(['01', '08', '11', '18', '19', '20']);

/** From this date the IPSI `ClaveRegimen` breach stops being a warning and becomes a rejection. */
const IPSI_RECHAZA_DESDE = D(2027, 1, 1);

/** Régimen keys that switch off the two total checks (F3 §16 and §17). */
const CLAVES_SIN_CUADRE: ReadonlySet<string> = new Set(['03', '05', '06', '08', '09']);

/** Ceiling for a simplified invoice, in cents (F3 §15.8). */
const TECHO_SIMPLIFICADA = 300_000;

/** Rules evaluated once per `DetalleDesglose`. */
export const REGLAS_LINEA: readonly Regla<Linea>[] = [
  regla({
    seccion: '15.1',
    campo: 'TipoImpositivo',
    cita: 'Si Impuesto = “01” (IVA) o no se cumplimenta (considerándose “01” - IVA) y CalificacionOperacion = “S1”: Solo se permiten TipoImpositivo = 0; 2; 4; 5; 7,5; 10 y 21. Si FechaOperacion (FechaExpedicionFactura de la agrupación IDFactura si no se informa FechaOperacion) ≥ 1 de julio de 2022 y ≤ 30 de septiembre de 2024 se admitirá TipoImpositivo = 5. […] ≥ 1 de octubre de 2024 y ≤ 31 de diciembre de 2024 se admitirá el TipoImpositivo = 2 […] y 7,5.',
    comprobar: ({ detalle, registro }) => {
      if (!esIva(detalle) || detalle.CalificacionOperacion !== 'S1') return undefined;
      if (detalle.TipoImpositivo === undefined) return undefined;

      const tipo = aCentesimas(detalle.TipoImpositivo);
      if (tipo === null) return `TipoImpositivo "${detalle.TipoImpositivo}" no es un porcentaje.`;

      const ventana = TIPOS_IMPOSITIVOS.get(tipo);
      if (ventana === undefined) {
        return `TipoImpositivo ${detalle.TipoImpositivo} no está entre los admitidos para IVA con CalificacionOperacion "S1" (0, 2, 4, 5, 7.5, 10, 21).`;
      }
      // TODO(verify) — reading: the base list is the universe of rates and the dated clauses are
      // what admits 5, 2 and 7,5 *within* their windows. Otherwise those clauses say nothing.
      return dentroDe(fechaEfectiva(registro), ventana)
        ? undefined
        : `TipoImpositivo ${detalle.TipoImpositivo} solo se admite dentro de su ventana temporal, y la fecha de la operación queda fuera.`;
    },
  }),

  regla({
    seccion: '15.2',
    campo: 'BaseImponibleACoste',
    cita: 'El campo BaseImponibleACoste solo puede estar cumplimentado si la ClaveRegimen es = “06” o Impuesto = “02” (IPSI) o Impuesto = “05” (Otros).',
    comprobar: ({ detalle }) => {
      if (detalle.BaseImponibleACoste === undefined) return undefined;
      const admitido =
        detalle.ClaveRegimen === '06' || detalle.Impuesto === '02' || detalle.Impuesto === '05';
      return admitido
        ? undefined
        : 'BaseImponibleACoste exige ClaveRegimen "06" o Impuesto "02"/"05".';
    },
  }),

  regla({
    seccion: '15.3',
    campo: 'TipoRecargoEquivalencia',
    cita: 'Si Impuesto = “01” (IVA) o no se cumplimenta y CalificacionOperacion = “S1”: Solo se permiten TipoRecargoEquivalencia = 0; 0,26; 0,5; 0,62; 1; 1,4; 1,75; 5,2. Si TipoImpositivo es 21 sólo se admitirán TipoRecargoEquivalencia = 5,2 ó 1,75. Si TipoImpositivo es 10 sólo se admitirá 1,4. Si TipoImpositivo es 7,5 sólo se admitirá 1 […]. Si TipoImpositivo es 4 sólo se admitirá 0,5. Si TipoImpositivo es 2 sólo se admitirá 0,26 […].',
    comprobar: ({ detalle, registro }) => {
      if (!esIva(detalle) || detalle.CalificacionOperacion !== 'S1') return undefined;
      if (detalle.TipoRecargoEquivalencia === undefined) return undefined;

      const recargo = aCentesimas(detalle.TipoRecargoEquivalencia);
      const tipo = aCentesimas(detalle.TipoImpositivo);
      if (recargo === null) {
        return `TipoRecargoEquivalencia "${detalle.TipoRecargoEquivalencia}" no es un porcentaje.`;
      }
      if (tipo === null) return undefined;

      const admitidos = RECARGOS_POR_TIPO.get(tipo);
      if (admitidos === undefined) return undefined;

      const fecha = fechaEfectiva(registro);
      const encaja = admitidos.some((a) => a.valor === recargo && dentroDe(fecha, a));
      return encaja
        ? undefined
        : `TipoRecargoEquivalencia ${detalle.TipoRecargoEquivalencia} no se admite con TipoImpositivo ${detalle.TipoImpositivo}.`;
    },
  }),

  regla({
    seccion: '15.4',
    campo: 'CalificacionOperacion',
    cita: 'Si CalificacionOperacion es “S2”, TipoFactura solo puede ser “F1”, “F3”, “R1”, “R2”, “R3” y “R4”. Cuando CalificacionOperacion sea “S2”: TipoImpositivo = 0. CuotaRepercutida = 0. Si CalificacionOperacion es = “N1/N2” e Impuesto = ”01” (IVA) o no se cumplimenta, no se puede informar ninguno de estos campos: TipoImpositivo, CuotaRepercutida, TipoRecargoEquivalencia, CuotaRecargoEquivalencia.',
    comprobar: ({ detalle, registro }) => {
      const problemas: string[] = [];
      const { CalificacionOperacion: calificacion } = detalle;

      if (calificacion === 'S2') {
        const tipoFactura = registro.fields.TipoFactura;
        if (!['F1', 'F3', 'R1', 'R2', 'R3', 'R4'].includes(tipoFactura)) {
          return `CalificacionOperacion "S2" no cabe con TipoFactura ${tipoFactura}.`;
        }
        if (aCentesimas(detalle.TipoImpositivo) !== 0) {
          problemas.push('CalificacionOperacion "S2" exige TipoImpositivo = 0, informado.');
        }
        if (aCentimos(detalle.CuotaRepercutida) !== 0) {
          problemas.push('CalificacionOperacion "S2" exige CuotaRepercutida = 0, informada.');
        }
      }

      if ((calificacion === 'N1' || calificacion === 'N2') && esIva(detalle)) {
        const prohibidos = [
          ['TipoImpositivo', detalle.TipoImpositivo],
          ['CuotaRepercutida', detalle.CuotaRepercutida],
          ['TipoRecargoEquivalencia', detalle.TipoRecargoEquivalencia],
          ['CuotaRecargoEquivalencia', detalle.CuotaRecargoEquivalencia],
        ] as const;

        for (const [nombre, valor] of prohibidos) {
          if (valor !== undefined) {
            problemas.push(`CalificacionOperacion "${calificacion}" no admite ${nombre}.`);
          }
        }
      }

      return problemas.length > 0 ? problemas : undefined;
    },
  }),

  regla({
    seccion: '15.6',
    campo: 'ClaveRegimen',
    cita: 'Solo podrá incluirse este campo si Impuesto = “01” (IVA), “02” (IPSI), “03” (IGIC) o no se cumplimenta. Si Impuesto = “01” (IVA) o no se cumplimenta, el valor de ClaveRegimen deberá estar cumplimentado y contenido en lista L8A.',
    comprobar: ({ detalle }) => {
      if (detalle.ClaveRegimen !== undefined && detalle.Impuesto === '05') {
        return 'ClaveRegimen no cabe con Impuesto "05" (Otros).';
      }
      return esIva(detalle) && detalle.ClaveRegimen === undefined
        ? 'ClaveRegimen es obligatorio cuando el impuesto es IVA.'
        : undefined;
    },
  }),

  regla({
    seccion: '15.6',
    campo: 'ClaveRegimen',
    severidad: 'aviso',
    cita: 'Si Impuesto = “02” (IPSI), el valor de ClaveRegimen deberá estar cumplimentado y deberá contener cualquiera de estas claves: 01, 08, 11, 18, 19, 20. En caso contrario se devolverá un aviso de error, sin generar rechazo y marcándose como “Aceptada como errores”, hasta el 31/12/2026 y se procederá a rechazar el registro a partir de 01/01/2027.',
    comprobar: ({ detalle, registro }) => {
      if (detalle.Impuesto !== '02') return undefined;
      if (detalle.ClaveRegimen !== undefined && CLAVES_IPSI.has(detalle.ClaveRegimen)) {
        return undefined;
      }

      const fecha = fechaEfectiva(registro);
      const rechaza = fecha !== null && fecha >= IPSI_RECHAZA_DESDE;
      return (
        `Con Impuesto "02" (IPSI) la ClaveRegimen debe ser 01, 08, 11, 18, 19 o 20. ` +
        (rechaza
          ? 'Desde el 01-01-2027 esto rechaza el registro.'
          : 'Hasta el 31-12-2026 es solo un aviso: el registro se acepta con errores.')
      );
    },
  }),

  regla({
    seccion: '15.7',
    campo: 'CuotaRepercutida',
    cita: 'Solo podrá ser distinta de cero (positivo o negativo) si CalificacionOperacion es “S1”. Si CalificacionOperacion es “S1” […] TipoImpositivo: campo obligatorio. CuotaRepercutida: campo obligatorio y deberá validarse (excepto si TipoRectificativa = “I” o TipoFactura “R2”, “R3”) que: CuotaRepercutida y BaseImponibleOimporteNoSujeto deben tener el mismo signo. [CuotaRepercutida] = ([BaseImponibleOimporteNoSujeto] * TipoImpositivo) / 100 +/- 10,00 euros.',
    comprobar: ({ detalle, registro }) => {
      const cuota = aCentimos(detalle.CuotaRepercutida);

      if (detalle.CalificacionOperacion !== 'S1') {
        return cuota !== null && cuota !== 0
          ? 'CuotaRepercutida solo puede ser distinta de cero con CalificacionOperacion "S1".'
          : undefined;
      }

      const problemas: string[] = [];
      if (detalle.TipoImpositivo === undefined) {
        problemas.push('Con CalificacionOperacion "S1" el TipoImpositivo es obligatorio.');
      }
      if (detalle.CuotaRepercutida === undefined) {
        problemas.push('Con CalificacionOperacion "S1" la CuotaRepercutida es obligatoria.');
        return problemas;
      }

      // The AEAT exempts these from the arithmetic: a corrective "por diferencias" carries the
      // delta, not the invoice, so base and cuota need not be related by the rate.
      const exento =
        registro.datos.TipoRectificativa === 'I' ||
        registro.fields.TipoFactura === 'R2' ||
        registro.fields.TipoFactura === 'R3';
      if (exento) return problemas.length > 0 ? problemas : undefined;

      const usaCoste = detalle.BaseImponibleACoste !== undefined;
      const base = aCentimos(
        usaCoste ? detalle.BaseImponibleACoste : detalle.BaseImponibleOimporteNoSujeto,
      );
      const tipo = aCentesimas(detalle.TipoImpositivo);
      const nombreBase = usaCoste ? 'BaseImponibleACoste' : 'BaseImponibleOimporteNoSujeto';

      if (base === null || tipo === null || cuota === null) {
        return problemas.length > 0 ? problemas : undefined;
      }

      if (signo(cuota) !== 0 && signo(base) !== 0 && signo(cuota) !== signo(base)) {
        problemas.push(`CuotaRepercutida y ${nombreBase} deben tener el mismo signo.`);
      }

      const esperada = cuotaEsperada(base, tipo);
      if (!dentroDelMargen(cuota, esperada)) {
        problemas.push(
          `CuotaRepercutida ${deCentimos(cuota)} se aparta de ${nombreBase} × ${detalle.TipoImpositivo}% = ${deCentimos(esperada)} en más de ${deCentimos(MARGEN)} €.`,
        );
      }

      return problemas.length > 0 ? problemas : undefined;
    },
  }),
];

/** Sums over the whole breakdown. */
export const REGLAS_TOTALES: readonly Regla<RegistroAltaValidable>[] = [
  regla({
    seccion: '15.8',
    campo: 'Desglose',
    cita: 'Cuando TipoFactura sea “F2”, se validará que Ʃ (BaseImponibleOimporteNoSujeto + CuotaRepercutida) de todas las líneas de detalle no sea superior a 3.000,00 euros. Se admitirá un error de + 10,00 euros. Esta validación no se aplicará cuando exista acuerdo de facturación […] Esta validación tampoco se aplicará cuando el campo FacturaSinIdentifDestinatarioArticulo61d = “S”.',
    comprobar: ({ fields, datos }) => {
      if (fields.TipoFactura !== 'F2') return undefined;
      if (datos.NumRegistroAcuerdoFacturacion !== undefined) return undefined;
      if (datos.FacturaSinIdentifDestinatarioArt61d === 'S') return undefined;

      let total = 0;
      for (const detalle of datos.Desglose) {
        total += aCentimos(detalle.BaseImponibleOimporteNoSujeto) ?? 0;
        total += aCentimos(detalle.CuotaRepercutida) ?? 0;
      }

      return total > TECHO_SIMPLIFICADA + MARGEN
        ? `Una factura simplificada no puede superar 3000.00 €, y el desglose suma ${deCentimos(total)} €.`
        : undefined;
    },
  }),

  regla({
    seccion: '16',
    campo: 'CuotaTotal',
    severidad: 'aviso',
    cita: 'Se validará que sea igual a Ʃ (CuotaRepercutida + CuotaRecargoEquivalencia) de todas las líneas de detalle de desglose. En caso contrario se devolverá un aviso de error (no generará rechazo), admitiéndose un margen de error de +/- 10,00 euros. Esta validación no se aplicará cuando ClaveRegimen sea “03”, “05”, “06”, “08” o “09”.',
    comprobar: ({ fields, datos }) => {
      if (
        datos.Desglose.some(
          (d) => d.ClaveRegimen !== undefined && CLAVES_SIN_CUADRE.has(d.ClaveRegimen),
        )
      ) {
        return undefined;
      }

      const declarada = aCentimos(fields.CuotaTotal);
      if (declarada === null) return undefined;

      let suma = 0;
      for (const detalle of datos.Desglose) {
        suma += aCentimos(detalle.CuotaRepercutida) ?? 0;
        suma += aCentimos(detalle.CuotaRecargoEquivalencia) ?? 0;
      }

      return dentroDelMargen(declarada, suma)
        ? undefined
        : `CuotaTotal ${fields.CuotaTotal} no cuadra con la suma del desglose, ${deCentimos(suma)} €.`;
    },
  }),

  regla({
    seccion: '17',
    campo: 'ImporteTotal',
    severidad: 'aviso',
    cita: 'Se validará que sea igual a Ʃ (BaseImponibleOimporteNoSujeto + CuotaRepercutida + CuotaRecargoEquivalencia) de todas las líneas de detalle de desglose. En caso contrario se devolverá un aviso de error (no generará rechazo), admitiéndose un margen de error de +/- 10,00 euros. Esta validación no se aplicará cuando ClaveRegimen sea “03”, “05”, “06”, “08” o “09”.',
    comprobar: ({ fields, datos }) => {
      if (
        datos.Desglose.some(
          (d) => d.ClaveRegimen !== undefined && CLAVES_SIN_CUADRE.has(d.ClaveRegimen),
        )
      ) {
        return undefined;
      }

      const declarado = aCentimos(fields.ImporteTotal);
      if (declarado === null) return undefined;

      let suma = 0;
      for (const detalle of datos.Desglose) {
        suma += aCentimos(detalle.BaseImponibleOimporteNoSujeto) ?? 0;
        suma += aCentimos(detalle.CuotaRepercutida) ?? 0;
        suma += aCentimos(detalle.CuotaRecargoEquivalencia) ?? 0;
      }

      return dentroDelMargen(declarado, suma)
        ? undefined
        : `ImporteTotal ${fields.ImporteTotal} no cuadra con la suma del desglose, ${deCentimos(suma)} €.`;
    },
  }),
];
