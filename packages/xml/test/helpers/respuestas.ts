/**
 * Response fixtures, built with the real `XmlWriter` and validated against
 * `RespuestaSuministro.xsd` by the tests that use them.
 *
 * Hand-writing these as string literals would be the easy option and the wrong one: the point of
 * a response fixture is to have the **namespaces** right, and those are exactly what a hand-typed
 * literal gets wrong. Within a single `RespuestaLinea`, `IDFactura` is in the RespuestaSuministro
 * namespace and `IDEmisorFactura` inside it is in SuministroInformacion.
 */
import {
  NS_RESPUESTA_SUMINISTRO,
  NS_SOAP_ENVELOPE,
  NS_SUMINISTRO_INFORMACION,
  XmlWriter,
} from '../../src/index.js';

const sfR = 'sfR';
const sf = 'sf';

/** One line of the response. */
export interface LineaFixture {
  readonly IDEmisorFactura?: string;
  readonly NumSerieFactura?: string;
  readonly FechaExpedicionFactura?: string;
  readonly TipoOperacion?: string;
  readonly Subsanacion?: string;
  readonly RechazoPrevio?: string;
  readonly SinRegistroPrevio?: string;
  readonly RefExterna?: string;
  readonly EstadoRegistro?: string;
  readonly CodigoErrorRegistro?: string;
  readonly DescripcionErrorRegistro?: string;
  readonly duplicado?: {
    readonly IdPeticionRegistroDuplicado: string;
    readonly EstadoRegistroDuplicado: string;
    readonly CodigoErrorRegistro?: string;
    readonly DescripcionErrorRegistro?: string;
  };
}

/** Everything the response can carry. */
export interface RespuestaFixture {
  readonly CSV?: string;
  readonly presentacion?: { NIFPresentador: string; TimestampPresentacion: string };
  readonly NombreRazon?: string;
  readonly NIF?: string;
  readonly TiempoEsperaEnvio?: string;
  readonly EstadoEnvio?: string;
  readonly lineas?: readonly LineaFixture[];
}

function escribirLinea(w: XmlWriter, linea: LineaFixture): void {
  w.open(`${sfR}:RespuestaLinea`);

  w.open(`${sfR}:IDFactura`);
  w.element(`${sf}:IDEmisorFactura`, linea.IDEmisorFactura ?? '89890001K');
  w.element(`${sf}:NumSerieFactura`, linea.NumSerieFactura ?? '12345678/G33');
  w.element(`${sf}:FechaExpedicionFactura`, linea.FechaExpedicionFactura ?? '01-01-2024');
  w.close();

  w.open(`${sfR}:Operacion`);
  w.element(`${sf}:TipoOperacion`, linea.TipoOperacion ?? 'Alta');
  w.optional(`${sf}:Subsanacion`, linea.Subsanacion);
  w.optional(`${sf}:RechazoPrevio`, linea.RechazoPrevio);
  w.optional(`${sf}:SinRegistroPrevio`, linea.SinRegistroPrevio);
  w.close();

  w.optional(`${sfR}:RefExterna`, linea.RefExterna);
  w.element(`${sfR}:EstadoRegistro`, linea.EstadoRegistro ?? 'Correcto');
  w.optional(`${sfR}:CodigoErrorRegistro`, linea.CodigoErrorRegistro);
  w.optional(`${sfR}:DescripcionErrorRegistro`, linea.DescripcionErrorRegistro);

  if (linea.duplicado !== undefined) {
    w.open(`${sfR}:RegistroDuplicado`);
    w.element(`${sf}:IdPeticionRegistroDuplicado`, linea.duplicado.IdPeticionRegistroDuplicado);
    w.element(`${sf}:EstadoRegistroDuplicado`, linea.duplicado.EstadoRegistroDuplicado);
    w.optional(`${sf}:CodigoErrorRegistro`, linea.duplicado.CodigoErrorRegistro);
    w.optional(`${sf}:DescripcionErrorRegistro`, linea.duplicado.DescripcionErrorRegistro);
    w.close();
  }

  w.close();
}

/** Builds a schema-valid `RespuestaRegFactuSistemaFacturacion`. */
export function respuesta(fixture: RespuestaFixture = {}): string {
  const w = new XmlWriter();

  w.declaration();
  w.open(`${sfR}:RespuestaRegFactuSistemaFacturacion`, [
    { name: `xmlns:${sfR}`, value: NS_RESPUESTA_SUMINISTRO },
    { name: `xmlns:${sf}`, value: NS_SUMINISTRO_INFORMACION },
  ]);

  w.optional(`${sfR}:CSV`, fixture.CSV);

  if (fixture.presentacion !== undefined) {
    w.open(`${sfR}:DatosPresentacion`);
    w.element(`${sf}:NIFPresentador`, fixture.presentacion.NIFPresentador);
    w.element(`${sf}:TimestampPresentacion`, fixture.presentacion.TimestampPresentacion);
    w.close();
  }

  w.open(`${sfR}:Cabecera`);
  w.open(`${sf}:ObligadoEmision`);
  w.element(`${sf}:NombreRazon`, fixture.NombreRazon ?? 'EMPRESA DE PRUEBA SL');
  w.element(`${sf}:NIF`, fixture.NIF ?? '89890001K');
  w.close();
  w.close();

  w.element(`${sfR}:TiempoEsperaEnvio`, fixture.TiempoEsperaEnvio ?? '60');
  w.element(`${sfR}:EstadoEnvio`, fixture.EstadoEnvio ?? 'Correcto');

  for (const linea of fixture.lineas ?? [{}]) escribirLinea(w, linea);

  w.close();
  return w.toString();
}

/** Wraps any body document in a SOAP envelope, the way the service replies. */
export function enSobre(cuerpo: string): string {
  const sinDeclaracion = cuerpo.replace(/^<\?xml[^?]*\?>/, '');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<env:Envelope xmlns:env="${NS_SOAP_ENVELOPE}"><env:Body>` +
    sinDeclaracion +
    '</env:Body></env:Envelope>'
  );
}

/** A SOAP 1.1 fault, as a stack returns one. */
export function fault(faultcode: string, faultstring: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${NS_SOAP_ENVELOPE}"><soapenv:Body><soapenv:Fault>` +
    `<faultcode>${faultcode}</faultcode><faultstring>${faultstring}</faultstring>` +
    '</soapenv:Fault></soapenv:Body></soapenv:Envelope>'
  );
}
