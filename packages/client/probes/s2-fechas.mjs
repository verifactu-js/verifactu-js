/**
 * S-2 · formato de `FechaHoraHusoGenRegistro` (I-07, I-08, I-09) — **seis envíos**.
 *
 * Seis altas idénticas salvo por el literal de la fecha, cada una en su propia cadena y con su
 * propia serie. Las tres incógnitas que mide son las que bloquean declarar `0.1.0` estable.
 *
 * ## El control positivo va primero y puede abortar la sonda
 *
 * El caso 1 lo genera `createSifChain()` **tal cual**, sin tocarle la fecha: es el formato que la
 * librería da por bueno. Si ese no vuelve `Correcto`, los otros cinco no se envían. Cinco rechazos
 * seguidos sin control serían ilegibles — no se sabría si falla el formato de fecha o el sobre, la
 * cabecera, el certificado o el NIF — y habrían costado cinco registros contra un NIF real.
 *
 * Los otros cinco **no pueden generarse con la cadena**, porque `core` emite siempre `±hh:mm` sin
 * fracciones: eso es justamente la mitigación de I-07/I-08/I-09. Se construyen pasando el literal
 * a `canonicalizeRegistroAlta`, que no valida el formato de la fecha (`inspectFechaHoraHuso` es el
 * modo de verificación, y avisa en vez de rechazar). No se salta ninguna comprobación de la huella:
 * la cadena canónica y el digest salen de `core` como siempre.
 *
 *   node packages/client/probes/s2-fechas.mjs
 */

import {
  canonicalizeRegistroAlta,
  createSifChain,
  formatFechaHoraHusoGenRegistro,
  hashRegistroAlta,
  inspectFechaHoraHuso,
} from '@verifactu-js/core';

import {
  cabecera,
  cliente,
  datos,
  enviarCaso,
  entorno,
  esperar,
  exigirControl,
  fechaDeExpedicion,
  sufijo,
} from './comun.mjs';

const { credenciales, nif, nombre } = await entorno();
const cli = cliente(credenciales);
const marca = sufijo();
const CAB = cabecera({ nif, nombre });

/**
 * Cada caso, su propia instalación de SIF, y por tanto su propia cadena.
 *
 * Sin esto, el control queda almacenado y los cinco siguientes vuelven con **2007** («No
 * debe informarse como primer registro…»). Como solo cabe un `CodigoErrorRegistro` por
 * registro, ese 2007 taparía al 2000 —el código de huella incorrecta—, que es exactamente
 * lo que esta sonda existe para leer. Ver `datos()` en comun.mjs.
 */
const datosDe = (caso) => datos({ nif, nombre, instalacion: `S2-${caso}-${marca}` });

// Misma zona que el huso del registro. Si salen de zonas distintas pueden discrepar en
// un día entero, que es la trampa de Canarias. Ver fechaDeExpedicion() en comun.mjs.
const fechaExpedicion = fechaDeExpedicion(new Date(), 'Europe/Madrid');

/** Los seis campos que no cambian entre casos. */
function comunes(serie) {
  return {
    IDEmisorFactura: nif,
    NumSerieFactura: serie,
    FechaExpedicionFactura: fechaExpedicion,
    TipoFactura: 'F1',
    CuotaTotal: '21.00',
    ImporteTotal: '121.00',
    Huella: null,
  };
}

/** Un eslabón con el literal de fecha que se quiera medir. */
async function eslabonCon(serie, fechaHora) {
  const input = { ...comunes(serie), FechaHoraHusoGenRegistro: fechaHora };
  const { fields } = canonicalizeRegistroAlta(input);
  return { tipo: 'alta', fields, huella: await hashRegistroAlta(input), registroAnterior: null };
}

/**
 * Las variantes, cada una a partir de un literal **recién generado**.
 *
 * ## Dos trampas que esta sonda pisó en su primera ejecución
 *
 * La primera: el literal base se calculaba una vez, al principio, y las cinco variantes lo
 * reutilizaban. Entre envío y envío se espera el `TiempoEsperaEnvio` de la AEAT (60 s), así que
 * el quinto caso salía con una hora ya vieja de más de cinco minutos — por encima del margen de
 * 240 s que la AEAT admite (código 2004). No mordió de milagro: los tres casos intermedios los
 * rechazó antes la validación de formato. Ahora `base` se genera justo antes de cada envío.
 *
 * La segunda, en `offset-cero`: sustituir el offset dejando la hora de pared **cambia el
 * instante**. `17:19:06+02:00` y `17:19:06+00:00` no son el mismo momento, van dos horas
 * separados. Ese caso midió desfase de reloj y no validez de `+00:00`, que era lo que buscaba.
 * Ahora convierte el instante en vez de reescribir el sufijo.
 *
 * Las dos son la misma lección: el literal de fecha es a la vez el dato que se mide **y** algo
 * que la AEAT contrasta contra su reloj. Tocarlo sin querer cambia la pregunta.
 */
const VARIANTES = [
  ['fraccion', (base) => base.replace(/(\d{2}:\d{2}:\d{2})/, '$1.123'), 'I-07 · fracción de segundo'],
  ['huso-z', (base) => `${new Date(base).toISOString().replace(/\.\d{3}Z$/, 'Z')}`, 'I-08 · «Z» en vez de +00:00'],
  ['offset-segundos', (base) => `${base}:00`, 'I-09 · offset con segundos'],
  ['offset-sin-dos-puntos', (base) => base.replace(/([+-]\d{2}):(\d{2})$/, '$1$2'), 'I-09 · offset sin dos puntos'],
  // Mismo INSTANTE, escrito con offset cero. No es lo mismo que cambiarle el sufijo a la hora.
  ['offset-cero', (base) => `${new Date(base).toISOString().slice(0, 19)}+00:00`, 'I-08 · +00:00 explícito'],
];

console.log('S-2 · seis envíos. El primero es el control positivo.\n');

// ── Caso 1: control. Generado por la librería, sin tocar nada. ────────────────────────────────
const control = await createSifChain({ timeZone: 'Europe/Madrid' }).alta({
  ...comunes(`S2-CTL-${marca}`),
  previous: null,
});

console.log(`   control: FechaHoraHusoGenRegistro = ${control.fields.FechaHoraHusoGenRegistro}`);

const rControl = await enviarCaso(cli, 's2', 'control', {
  cabecera: CAB,
  registros: [{ eslabon: control, datos: datosDe('control') }],
});

exigirControl(rControl);
console.log('\n   Control correcto. Las cinco variantes son ahora interpretables.\n');

// ── Casos 2-6: variantes del literal. ─────────────────────────────────────────────────────────
const hallazgos = [
  { caso: 'control', literal: control.fields.FechaHoraHusoGenRegistro, ...rControl, resultado: undefined },
];

for (const [nombreCaso, transformar, etiqueta] of VARIANTES) {
  await esperar(Number(rControl.tiempoEsperaEnvio ?? '60'), 'TiempoEsperaEnvio de la AEAT');

  // Recién generado, no el del control: entre caso y caso pasa un minuto, y el margen de la AEAT
  // son 240 s. Reutilizar el de hace cinco minutos mediría el reloj en vez del formato.
  const baseFecha = formatFechaHoraHusoGenRegistro(new Date(), { timeZone: 'Europe/Madrid' });
  const literal = transformar(baseFecha);
  const inspeccion = inspectFechaHoraHuso(literal);
  console.log(`\n   ${etiqueta}`);
  console.log(`   literal: ${literal}  ·  avisos de core: ${inspeccion.warnings.join(', ') || 'ninguno'}`);

  const eslabon = await eslabonCon(`S2-${nombreCaso.toUpperCase()}-${marca}`, literal);

  try {
    const r = await enviarCaso(cli, 's2', nombreCaso, {
      cabecera: CAB,
      registros: [{ eslabon, datos: datosDe(nombreCaso) }],
    });
    hallazgos.push({ caso: nombreCaso, literal, ...r, resultado: undefined });
  } catch (error) {
    hallazgos.push({ caso: nombreCaso, literal, error: error.message });
  }
}

console.log(`\n${'='.repeat(78)}`);
console.table(
  hallazgos.map((h) => ({
    caso: h.caso,
    literal: h.literal,
    envio: h.estadoEnvio ?? '—',
    registro: h.estadoRegistro ?? '—',
    codigo: h.codigoError ?? '—',
    categoria: h.categoria ?? '—',
  })),
);
console.log(
  '\nCómo se lee esto — POR CÓDIGO, que S-1 ya nos dio la tabla:\n' +
    '  Correcto      → la AEAT calculó la misma huella sobre ese literal. Formato válido.\n' +
    '  código 2000   → «El cálculo de la huella suministrada es incorrecta». ORÁCULO LITERAL:\n' +
    '                  admitió el literal pero hasheó otra cosa, es decir NORMALIZÓ la fecha\n' +
    '                  antes de hashear. Es el fallo silencioso que este proyecto existe para\n' +
    '                  evitar, y ya no hay que inferirlo del estado.\n' +
    '  código 1244   → «FechaHoraHusoGenRegistro tiene un formato incorrecto». Lo rechaza por\n' +
    '                  forma, sin llegar a la huella.\n' +
    '  código 1268   → «La longitud del campo FechaHoraHusoGenRegistro no cumple». Lo paró por\n' +
    '                  tamaño: distinto de 1244, y muy probable en los casos de offset.\n' +
    '  código 2007   → no mide nada de esto: significa que la AEAT no separa las cadenas por\n' +
    '                  NumeroInstalacion. Ese caso queda SIN MEDIR. Dilo, no lo interpretes.\n' +
    '  código 4102   → lo paró el XSD, antes de las validaciones de negocio.\n\n' +
    'S-2 hecha. PARA AQUÍ: estas tres incógnitas son las que bloquean el estable.\n' +
    'Todo está en docs/probe-results/s2-*.{request,response}.xml.',
);
console.log('='.repeat(78));
