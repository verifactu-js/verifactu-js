/**
 * Fixtures built with the real serialisers.
 *
 * Nothing here hand-writes XML. The records come from `createSifChain()` in `@verifactu-js/core`,
 * so the literals in the document are the ones that were hashed — which is the property most of
 * these tests exist to check.
 *
 * Fragments are composed by writing *into* a shared writer, never by concatenating strings. That
 * is also how the real batch serialiser will work, and it is why `XmlWriter` deliberately has no
 * raw-append: a fragment spliced in as text is a fragment nobody escaped.
 */
import {
  type AltaRequest,
  type AnulacionRequest,
  createSifChain,
  type EslabonAltaCanonico,
} from '@verifactu-js/core';

import {
  type Cabecera,
  type RegistroAlta,
  type RegistroAnulacion,
  type RegistroFactura,
  type SistemaInformatico,
  serializarRemision,
} from '../../src/index.js';

/**
 * A chain with a frozen clock, so every fixture is byte-identical between runs.
 *
 * `Europe/Madrid` in January is `+01:00`, so the instant below serialises as
 * `2024-01-01T19:20:30+01:00`.
 */
export function cadena(instante = '2024-01-01T18:20:30Z'): ReturnType<typeof createSifChain> {
  return createSifChain({ timeZone: 'Europe/Madrid', now: () => new Date(instante) });
}

/** A `SistemaInformatico` block that satisfies the schema. */
export const SISTEMA: SistemaInformatico = {
  NombreRazon: 'PRODUCTORA SL',
  NIF: 'B72877814',
  NombreSistemaInformatico: 'VERIFACTU-JS',
  IdSistemaInformatico: 'VJ',
  Version: '0.1.0',
  NumeroInstalacion: 'INST-001',
  TipoUsoPosibleSoloVerifactu: 'S',
  TipoUsoPosibleMultiOT: 'N',
  IndicadorMultiplesOT: 'N',
};

const ALTA_POR_DEFECTO: Omit<AltaRequest, 'previous'> = {
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345678/G33',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
};

const ANULACION_POR_DEFECTO: Omit<AnulacionRequest, 'previous'> = {
  IDEmisorFacturaAnulada: '89890001K',
  NumSerieFacturaAnulada: '12345679/G34',
  FechaExpedicionFacturaAnulada: '01-01-2024',
};

/** A `RegistroAlta` with only the mandatory elements. */
export async function altaMinima(
  overrides: Partial<AltaRequest> = {},
  datos: Partial<RegistroAlta['datos']> = {},
): Promise<RegistroAlta> {
  const eslabon = await cadena().alta({
    ...ALTA_POR_DEFECTO,
    previous: null,
    ...overrides,
  });

  return {
    eslabon,
    datos: {
      NombreRazonEmisor: 'EMPRESA DE PRUEBA SL',
      DescripcionOperacion: 'PRESTACION DE SERVICIOS',
      Desglose: [
        {
          ClaveRegimen: '01',
          CalificacionOperacion: 'S1',
          TipoImpositivo: '21',
          BaseImponibleOimporteNoSujeto: '111.10',
          CuotaRepercutida: '12.35',
        },
      ],
      SistemaInformatico: SISTEMA,
      ...datos,
    },
  };
}

/** A `RegistroAnulacion` with only the mandatory elements. */
export async function anulacionMinima(
  overrides: Partial<AnulacionRequest> = {},
  datos: Partial<RegistroAnulacion['datos']> = {},
): Promise<RegistroAnulacion> {
  const eslabon = await cadena('2024-01-01T18:20:40Z').anulacion({
    ...ANULACION_POR_DEFECTO,
    previous: null,
    ...overrides,
  });

  return { eslabon, datos: { SistemaInformatico: SISTEMA, ...datos } };
}

/** Builds the link a chained record points back to. Always an alta, so its fields are concrete. */
export async function altaPrevia(): Promise<EslabonAltaCanonico> {
  return cadena('2024-01-01T18:00:00Z').alta({
    ...ALTA_POR_DEFECTO,
    NumSerieFactura: '12345677/G32',
    previous: null,
  });
}

/** The header every fixture uses. Its NIF is the one the fixture records are issued under. */
export const CABECERA: Cabecera = {
  ObligadoEmision: { NombreRazon: 'EMPRESA DE PRUEBA SL', NIF: '89890001K' },
};

/** Serialises a batch with the default header. */
export function documento(
  registros: readonly RegistroFactura[],
  cabecera: Cabecera = CABECERA,
): string {
  return serializarRemision({ cabecera, registros });
}

/** Serialises one alta as a whole submission. */
export async function documentoConAlta(
  overrides: Partial<AltaRequest> = {},
  datos: Partial<RegistroAlta['datos']> = {},
): Promise<string> {
  return documento([await altaMinima(overrides, datos)]);
}
