/**
 * Minimal valid documents, built with the real `XmlWriter`.
 *
 * Scaffolding for the namespace tests: just enough of a `RegFactuSistemaFacturacion` to be
 * schema-valid, built with the writer under test rather than hand-written string literals.
 *
 * Fragments are composed by writing *into* a shared writer, never by concatenating strings.
 * That is also how the real serialiser will work, and it is why `XmlWriter` deliberately has no
 * raw-append: a fragment spliced in as text is a fragment nobody escaped.
 */
import { NS_SUMINISTRO_INFORMACION, NS_SUMINISTRO_LR, PREFIX, XmlWriter } from '../../src/index.js';

/** Writes a fragment into the document being built. */
export type Fragmento = (writer: XmlWriter) => void;

/** Fields of a minimal, schema-valid `RegistroAlta`. */
export interface AltaMinima {
  readonly IDEmisorFactura: string;
  readonly NumSerieFactura: string;
  readonly FechaExpedicionFactura: string;
  readonly TipoFactura: string;
  readonly CuotaTotal: string;
  readonly ImporteTotal: string;
  readonly FechaHoraHusoGenRegistro: string;
  readonly Huella: string;
}

const POR_DEFECTO: AltaMinima = {
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345678/G33',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
  Huella: '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
};

/** A minimal `RegistroAlta`, in the element order the schema requires. */
export function registroAltaMinimo(overrides: Partial<AltaMinima> = {}): Fragmento {
  const f: AltaMinima = { ...POR_DEFECTO, ...overrides };
  const sf = PREFIX.sf;

  return (w) => {
    w.open(`${sf}:RegistroAlta`);
    w.element(`${sf}:IDVersion`, '1.0');

    w.open(`${sf}:IDFactura`);
    w.element(`${sf}:IDEmisorFactura`, f.IDEmisorFactura);
    w.element(`${sf}:NumSerieFactura`, f.NumSerieFactura);
    w.element(`${sf}:FechaExpedicionFactura`, f.FechaExpedicionFactura);
    w.close();

    w.element(`${sf}:NombreRazonEmisor`, 'EMPRESA DE PRUEBA SL');
    w.element(`${sf}:TipoFactura`, f.TipoFactura);
    w.element(`${sf}:DescripcionOperacion`, 'PRESTACION DE SERVICIOS');

    w.open(`${sf}:Desglose`);
    w.open(`${sf}:DetalleDesglose`);
    w.element(`${sf}:CalificacionOperacion`, 'S1');
    w.element(`${sf}:TipoImpositivo`, '21');
    w.element(`${sf}:BaseImponibleOimporteNoSujeto`, '111.10');
    w.element(`${sf}:CuotaRepercutida`, '12.35');
    w.close();
    w.close();

    w.element(`${sf}:CuotaTotal`, f.CuotaTotal);
    w.element(`${sf}:ImporteTotal`, f.ImporteTotal);

    w.open(`${sf}:Encadenamiento`);
    w.element(`${sf}:PrimerRegistro`, 'S');
    w.close();

    w.open(`${sf}:SistemaInformatico`);
    w.element(`${sf}:NombreRazon`, 'PRODUCTORA SL');
    w.element(`${sf}:NIF`, 'B72877814');
    w.element(`${sf}:NombreSistemaInformatico`, 'VERIFACTU-JS');
    w.element(`${sf}:IdSistemaInformatico`, 'VJ');
    w.element(`${sf}:Version`, '0.1.0');
    w.element(`${sf}:NumeroInstalacion`, 'INST-001');
    w.element(`${sf}:TipoUsoPosibleSoloVerifactu`, 'S');
    w.element(`${sf}:TipoUsoPosibleMultiOT`, 'N');
    w.element(`${sf}:IndicadorMultiplesOT`, 'N');
    w.close();

    w.element(`${sf}:FechaHoraHusoGenRegistro`, f.FechaHoraHusoGenRegistro);
    w.element(`${sf}:TipoHuella`, '01');
    w.element(`${sf}:Huella`, f.Huella);
    w.close();
  };
}

/** A minimal `RegistroAnulacion`. */
export function registroAnulacionMinimo(
  overrides: Partial<{ NumSerieFacturaAnulada: string; Huella: string }> = {},
): Fragmento {
  const sf = PREFIX.sf;
  const numSerie = overrides.NumSerieFacturaAnulada ?? '12345679/G34';
  const huella =
    overrides.Huella ?? 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97';

  return (w) => {
    w.open(`${sf}:RegistroAnulacion`);
    w.element(`${sf}:IDVersion`, '1.0');

    w.open(`${sf}:IDFactura`);
    w.element(`${sf}:IDEmisorFacturaAnulada`, '89890001K');
    w.element(`${sf}:NumSerieFacturaAnulada`, numSerie);
    w.element(`${sf}:FechaExpedicionFacturaAnulada`, '01-01-2024');
    w.close();

    w.open(`${sf}:Encadenamiento`);
    w.element(`${sf}:PrimerRegistro`, 'S');
    w.close();

    w.open(`${sf}:SistemaInformatico`);
    w.element(`${sf}:NombreRazon`, 'PRODUCTORA SL');
    w.element(`${sf}:NIF`, 'B72877814');
    w.element(`${sf}:NombreSistemaInformatico`, 'VERIFACTU-JS');
    w.element(`${sf}:IdSistemaInformatico`, 'VJ');
    w.element(`${sf}:Version`, '0.1.0');
    w.element(`${sf}:NumeroInstalacion`, 'INST-001');
    w.element(`${sf}:TipoUsoPosibleSoloVerifactu`, 'S');
    w.element(`${sf}:TipoUsoPosibleMultiOT`, 'N');
    w.element(`${sf}:IndicadorMultiplesOT`, 'N');
    w.close();

    w.element(`${sf}:FechaHoraHusoGenRegistro`, '2024-01-01T19:20:40+01:00');
    w.element(`${sf}:TipoHuella`, '01');
    w.element(`${sf}:Huella`, huella);
    w.close();
  };
}

/** Wraps record fragments in a `RegFactuSistemaFacturacion` with its `Cabecera`. */
export function remision(registros: readonly Fragmento[]): string {
  const { sfLR, sf } = PREFIX;
  const w = new XmlWriter();

  w.declaration();
  w.open(`${sfLR}:RegFactuSistemaFacturacion`, [
    { name: `xmlns:${sfLR}`, value: NS_SUMINISTRO_LR },
    { name: `xmlns:${sf}`, value: NS_SUMINISTRO_INFORMACION },
  ]);

  w.open(`${sfLR}:Cabecera`);
  w.open(`${sf}:ObligadoEmision`);
  w.element(`${sf}:NombreRazon`, 'EMPRESA DE PRUEBA SL');
  w.element(`${sf}:NIF`, '89890001K');
  w.close();
  w.close();

  for (const registro of registros) {
    w.open(`${sfLR}:RegistroFactura`);
    registro(w);
    w.close();
  }

  w.close();
  return w.toString();
}
