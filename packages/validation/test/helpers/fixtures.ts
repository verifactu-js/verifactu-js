/**
 * A record that passes every rule, so each test can break exactly one thing.
 */
import type { RegistroAltaHashInput } from '@verifactu-js/core';
import type {
  DatosAlta,
  DetalleDesglose,
  RegistroAltaValidable,
  SistemaInformatico,
} from '../../src/index.js';

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

export const LINEA: DetalleDesglose = {
  ClaveRegimen: '01',
  CalificacionOperacion: 'S1',
  TipoImpositivo: '21',
  BaseImponibleOimporteNoSujeto: '100.00',
  CuotaRepercutida: '21.00',
};

const FIELDS: RegistroAltaHashInput = {
  IDEmisorFactura: '89890001K',
  NumSerieFactura: 'A/1',
  FechaExpedicionFactura: '15-01-2025',
  TipoFactura: 'F1',
  CuotaTotal: '21.00',
  ImporteTotal: '121.00',
  Huella: null,
  FechaHoraHusoGenRegistro: '2025-01-15T10:00:00+01:00',
};

const DATOS: DatosAlta = {
  NombreRazonEmisor: 'EMPRESA DE PRUEBA SL',
  DescripcionOperacion: 'PRESTACION DE SERVICIOS',
  Destinatarios: [{ NombreRazon: 'CLIENTE SL', NIF: 'B72877814' }],
  Desglose: [LINEA],
  SistemaInformatico: SISTEMA,
};

/**
 * Overrides where `undefined` means "remove this field", not "set it to undefined".
 *
 * `exactOptionalPropertyTypes` is on, so the two are different things and a present-but-undefined
 * key would not typecheck. Tests want to say "this record has no Destinatarios", so the merge
 * below drops those keys instead of assigning them.
 */
type Overrides<T> = { readonly [K in keyof T]?: T[K] | undefined };

function fusionar<T extends object>(base: T, overrides: Overrides<T>): T {
  const resultado = { ...base } as Record<string, unknown>;
  for (const [clave, valor] of Object.entries(overrides)) {
    if (valor === undefined) delete resultado[clave];
    else resultado[clave] = valor;
  }
  return resultado as T;
}

/** The clean record, with the given overrides applied. */
export function registro(
  fields: Overrides<RegistroAltaHashInput> = {},
  datos: Overrides<DatosAlta> = {},
): RegistroAltaValidable {
  return { fields: fusionar(FIELDS, fields), datos: fusionar(DATOS, datos) };
}

/** The clean record with a single breakdown line replaced. */
export function conLinea(
  linea: Overrides<DetalleDesglose>,
  fields: Overrides<RegistroAltaHashInput> = {},
  datos: Overrides<DatosAlta> = {},
): RegistroAltaValidable {
  return registro(fields, { ...datos, Desglose: [fusionar(LINEA, linea)] });
}

/** A fixed clock, so the date rules are deterministic. */
export const AHORA = new Date('2025-06-15T12:00:00Z');
