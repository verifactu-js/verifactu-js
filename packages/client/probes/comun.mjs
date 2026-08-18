/**
 * Shared plumbing for the preproduction probes.
 *
 * Read `docs/sondas-fase-3.md` before running anything here. The short version:
 * **preproduction only, ten records total, one variable per probe, stop at the first surprise.**
 *
 * Nothing in this file talks to production. `crearClientePruebas` is the only factory that
 * exists, and it has no environment parameter.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cargarP12,
  cargarPem,
  crearClientePruebas,
  explicarCodigo,
  transporteNode,
} from '@verifactu-js/client';

export const RAIZ = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
export const RESULTADOS = join(RAIZ, 'docs', 'probe-results');

/**
 * Credentials and NIF, from the environment.
 *
 * From the environment and not from arguments on purpose: a passphrase passed on the command line
 * ends up in the shell history and in the process list.
 *
 *   VERIFACTU_P12         ruta al .p12
 *   VERIFACTU_P12_PASS    su contraseña
 *   VERIFACTU_PEM / VERIFACTU_PEM_KEY   alternativa a los dos anteriores
 *   VERIFACTU_NIF         NIF real del titular del certificado
 *   VERIFACTU_NOMBRE      nombre o razón social de ese titular
 */
export async function entorno() {
  const { VERIFACTU_P12, VERIFACTU_P12_PASS, VERIFACTU_PEM, VERIFACTU_PEM_KEY } = process.env;
  const nif = process.env['VERIFACTU_NIF'];
  const nombre = process.env['VERIFACTU_NOMBRE'];

  if (!nif || !nombre) {
    throw new Error(
      'Faltan VERIFACTU_NIF y VERIFACTU_NOMBRE.\n' +
        'Tienen que ser el NIF y el nombre REALES del titular del certificado: F4 §4.1 obliga a ' +
        'validar todos los NIF contra la Base de Datos Centralizada de la AEAT, así que el NIF ' +
        'de ejemplo de la documentación no sirve.',
    );
  }

  let credenciales;
  if (VERIFACTU_P12) credenciales = await cargarP12(VERIFACTU_P12, VERIFACTU_P12_PASS ?? '');
  else if (VERIFACTU_PEM && VERIFACTU_PEM_KEY)
    credenciales = await cargarPem(VERIFACTU_PEM, VERIFACTU_PEM_KEY);
  else throw new Error('Define VERIFACTU_P12 (+ VERIFACTU_P12_PASS) o VERIFACTU_PEM + VERIFACTU_PEM_KEY.');

  return { credenciales, nif, nombre };
}

/** A client aimed at preproduction. There is no other kind. */
export function cliente(credenciales) {
  return crearClientePruebas({
    transporte: transporteNode(credenciales),
    certificado: 'representante',
  });
}

/**
 * Suffix that makes every series unique per run.
 *
 * Without it, a retry after a network failure would re-send a series the AEAT already stored and
 * come back as `RegistroDuplicado`, which would look like a finding and would not be one.
 */
export function sufijo() {
  return new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
}

/** The header, with the real obligated party. */
export function cabecera({ nif, nombre }) {
  return { ObligadoEmision: { NombreRazon: nombre, NIF: nif } };
}

/**
 * A minimal, valid `DatosAlta` for a probe.
 *
 * ## `instalacion` no es cosmética: es lo que mantiene los casos independientes
 *
 * Cada caso se envía como `PrimerRegistro`, en su propia cadena. Pero la tabla de S-1 trae el
 * código **2007** — «No debe informarse como primer registro, existen facturas emitidas con el
 * obligado emisión y el sistema informático actual» —, así que en cuanto el primer caso queda
 * almacenado, cualquier otro que vuelva a declararse primero de cadena con el **mismo** sistema
 * informático lo dispara.
 *
 * Y `CodigoErrorRegistro` es `maxOccurs="1"` en `RespuestaSuministro.xsd`: **un código por
 * registro**. Un 2007 podría por tanto tapar al 2000 («El cálculo de la huella suministrada es
 * incorrecta»), que es justo el oráculo que S-2 necesita leer. Se habrían gastado cinco registros
 * contra un NIF real para no medir nada.
 *
 * La salida no es un truco: es lo que el diccionario de datos de la AEAT dice que
 * `NumeroInstalacion` significa — «Deberá distinguirlo de otros posibles SIF utilizados […] de
 * otras posibles instalaciones de SIF pasadas, presentes o futuras […] incluso aunque en dichas
 * instalaciones se emplee el mismo SIF de un productor». Cada caso es una instalación distinta,
 * luego cada uno empieza legítimamente su propia cadena.
 *
 * De paso mejora el experimento: antes el control iba «en limpio» y las cinco variantes no, que
 * era una variable de confusión. Ahora los seis parten del mismo estado.
 *
 * Si aun así saliera 2007, la lectura sigue siendo limpia: significaría que la AEAT no distingue
 * las cadenas por `NumeroInstalacion`, y el propio código lo diría.
 *
 * @param instalacion - Sufijo único del caso. Va dentro de `NumeroInstalacion` (alfanumérico,
 *   máximo 100), junto con la marca temporal de la ejecución.
 */
export function datos({ nif, nombre, instalacion = 'UNICA' }) {
  return {
    NombreRazonEmisor: nombre,
    DescripcionOperacion: 'SONDA DE INTEGRACION VERIFACTU-JS',
    Destinatarios: [{ NombreRazon: 'CLIENTE DE PRUEBA', NIF: 'B72877814' }],
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
      NombreRazon: nombre,
      NIF: nif,
      NombreSistemaInformatico: 'VERIFACTU-JS',
      IdSistemaInformatico: 'VJ',
      Version: '0.1.0',
      NumeroInstalacion: `SONDA-${instalacion}`,
      TipoUsoPosibleSoloVerifactu: 'S',
      TipoUsoPosibleMultiOT: 'N',
      IndicadorMultiplesOT: 'N',
    },
  };
}

/** SHA-256 in the form the specification requires: uppercase hex, 64 characters. */
export function sha256(texto) {
  return createHash('sha256').update(texto, 'utf8').digest('hex').toUpperCase();
}

/**
 * Pulls out the fields that decide what a probe measured.
 *
 * Incluye la explicación del código sacada del mapa del propio cliente, que a su vez viene de la
 * tabla que descargó S-1. Va en el `.json` guardado y no solo en pantalla: dentro de seis meses,
 * `2007` no le dirá nada a nadie, y estos ficheros tienen que poder releerse sin la tabla al lado.
 *
 * `almacenado` es el dato que de verdad importa de un rechazo — dice si la factura consta en la
 * AEAT o no —, y es lo primero que hay que mirar antes de decidir si un caso se puede repetir.
 */
export function resumen(resultado) {
  const linea = resultado.respuesta.RespuestaLinea[0];
  const codigoError = linea?.CodigoErrorRegistro ?? null;
  const explicacion = explicarCodigo(codigoError);

  return {
    estadoHttp: resultado.estadoHttp,
    estadoEnvio: resultado.respuesta.EstadoEnvio,
    estadoRegistro: linea?.EstadoRegistro ?? null,
    // The code, not just the status: with `errores.properties` in hand this is what turns a
    // rejection into a sentence.
    codigoError,
    descripcionError: linea?.DescripcionErrorRegistro ?? null,
    categoria: explicacion?.categoria ?? null,
    almacenado: explicacion?.almacenado ?? null,
    textoOficial: explicacion?.texto ?? null,
    accion: explicacion?.accion ?? null,
    csv: resultado.respuesta.CSV ?? null,
    tiempoEsperaEnvio: resultado.respuesta.TiempoEsperaEnvio ?? null,
    duracionMs: resultado.duracionMs,
  };
}

/**
 * Writes request and response **raw**, next to the summary.
 *
 * Every submission is expensive — a real record under a real NIF against an AEAT system — so
 * nothing is thrown away. A probe that surprises has to be re-readable without re-sending.
 */
export async function guardar(sonda, caso, { peticion, resultado, error }) {
  await mkdir(RESULTADOS, { recursive: true });
  const base = join(RESULTADOS, `${sonda}-${caso}`);

  await writeFile(`${base}.request.xml`, peticion ?? '(no se llegó a construir)', 'utf8');
  await writeFile(
    `${base}.response.xml`,
    resultado?.cuerpoRespuesta ?? '(no hubo respuesta)',
    'utf8',
  );
  await writeFile(
    `${base}.json`,
    `${JSON.stringify(
      {
        sonda,
        caso,
        cuando: new Date().toISOString(),
        ...(resultado === undefined ? {} : resumen(resultado)),
        ...(error === undefined
          ? {}
          : { error: { code: error.code, message: error.message, causaProbable: error.causaProbable } }),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return base;
}

/** Waits what the AEAT asked to wait, in seconds. */
export async function esperar(segundos, motivo) {
  if (segundos <= 0) return;
  console.log(`   … esperando ${segundos} s (${motivo})`);
  await new Promise((resolver) => setTimeout(resolver, segundos * 1000));
}

/** Sends one case, records everything, and never lets an error go unwritten. */
export async function enviarCaso(cli, sonda, caso, remision) {
  process.stdout.write(`\n[${sonda}/${caso}] → ${cli.url}\n`);

  try {
    const resultado = await cli.enviar(remision);
    const base = await guardar(sonda, caso, { peticion: resultado.peticion, resultado });
    const r = resumen(resultado);

    console.log(
      `   HTTP ${r.estadoHttp} · envío ${r.estadoEnvio} · registro ${r.estadoRegistro}` +
        (r.codigoError === null ? '' : ` · código ${r.codigoError}`),
    );
    if (r.descripcionError !== null) console.log(`   «${r.descripcionError}»`);
    if (r.categoria !== null) {
      console.log(`   categoría ${r.categoria} · ¿almacenado? ${r.almacenado ? 'SÍ' : 'no'}`);
    }
    console.log(`   guardado en ${base}.{request,response}.xml`);

    return { ...r, resultado };
  } catch (error) {
    await guardar(sonda, caso, { peticion: error.peticion, error });
    console.error(`   ERROR ${error.code ?? ''}: ${error.message}`);
    if (error.causaProbable) console.error(`   ${error.causaProbable}`);
    throw error;
  }
}

/**
 * Aborts the run if the positive control did not come back clean.
 *
 * Without this, five rejections in a row would be unreadable: the format under test and the
 * envelope itself would be confounded. If the control fails, the problem is somewhere else and
 * sending the variants would only add noise — and cost records against a real NIF.
 */
export function exigirControl(r) {
  if (r.estadoEnvio === 'Correcto' && r.estadoRegistro === 'Correcto') return;

  throw new Error(
    'El control positivo NO ha salido Correcto.\n' +
      `   envío ${r.estadoEnvio} · registro ${r.estadoRegistro} · código ${r.codigoError}\n` +
      `   «${r.descripcionError}»\n\n` +
      'Se para aquí. Este caso usa el formato que la librería genera por defecto, así que si\n' +
      'falla el problema no es la variable que la sonda quería medir: es el sobre, la cabecera,\n' +
      'el certificado o el NIF. Mándame los ficheros de docs/probe-results/ y lo miramos.',
  );
}
