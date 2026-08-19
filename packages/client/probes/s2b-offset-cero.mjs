/**
 * S-2b · `+00:00` explícito (I-08, la mitad que queda) — **un envío**.
 *
 * ## Por qué hay que repetirlo
 *
 * El caso `offset-cero` de S-2 estaba mal construido y midió otra cosa. Llevaba dos defectos
 * independientes, y cualquiera de los dos bastaba para estropearlo:
 *
 * 1. Sustituía el sufijo dejando la hora de pared: `17:19:06+02:00` → `17:19:06+00:00`. Eso no
 *    cambia la forma de escribir un instante, **cambia el instante**: dos horas al futuro.
 * 2. Reutilizaba el literal del control, generado cinco minutos antes. Solo eso ya se sale del
 *    margen de la AEAT.
 *
 * Volvió `2004` («debe ser la fecha actual del sistema de la AEAT, admitiéndose un margen de error
 * de: 240 segundos»), que mide **desfase de reloj**, no validez de `+00:00`. La pregunta sigue
 * abierta, y es la que de verdad importa: **Canarias en invierno**, donde el offset es exactamente
 * cero y es lo que `formatFechaHoraHusoGenRegistro` emite allí.
 *
 * ## Qué se envía
 *
 * Un alta, con el instante **de ahora mismo** escrito con offset cero:
 *
 *     2026-08-18T15:19:06+00:00
 *
 * Nada más cambia. `NumeroInstalacion` nueva, para que no arrastre un 2007.
 *
 * ## Cómo se lee
 *
 * | Respuesta | Lectura |
 * |---|---|
 * | `Correcto` | **I-08 cerrada.** `+00:00` vale, y la AEAT hashea el literal tal cual |
 * | `2000` | Normalizó antes de hashear. Contradiría lo medido con `Z`: para y avisa |
 * | `1244` | La AEAT exige `Z` para huso cero. Sorprendente, pero medido |
 * | `2004` | El reloj de esta máquina va desfasado. **No mide nada.** Sincroniza y repite |
 * | `2007` | La AEAT no separa cadenas por `NumeroInstalacion`. Queda sin medir |
 * | `4xxx` | Sobre, cabecera o certificado. No mide el formato |
 *
 *   node packages/client/probes/s2b-offset-cero.mjs
 */

import { canonicalizeRegistroAlta, hashRegistroAlta } from '@verifactu-js/core';
import { request } from 'undici';

import { desfaseDeReloj, MARGEN_RELOJ_AEAT_SEGUNDOS } from '@verifactu-js/client';

import {
  cabecera,
  cliente,
  datos,
  enviarCaso,
  entorno,
  fechaDeExpedicion,
  sufijo,
} from './comun.mjs';

/** Fichero público de la AEAT. Solo se usa por la cabecera `Date`: no descarga nada útil aquí. */
const RELOJ =
  'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties';

const { credenciales, nif, nombre } = await entorno();
const cli = cliente(credenciales);
const marca = sufijo();

console.log('S-2b · un envío. El mismo instante que ahora, escrito con offset cero.\n');

// ── Comprobación de reloj, con cero registros ─────────────────────────────────────────────────
//
// Esto es exactamente lo que gastó el caso de S-2: el reloj, no el formato. Se puede comprobar
// antes y gratis, porque cualquier respuesta HTTP de la AEAT trae cabecera `Date`. No es el mismo
// servidor que atiende el SOAP, así que no es una prueba concluyente — pero un desfase de minutos
// se ve aquí igual, y detectarlo cuesta cero registros en vez de uno.
let horaAeat;
try {
  const { headers } = await request(RELOJ, { method: 'HEAD', headersTimeout: 15_000 });
  horaAeat = Array.isArray(headers.date) ? headers.date[0] : headers.date;
} catch (error) {
  console.error(`   No se ha podido leer la hora de la AEAT: ${error.message}`);
}

if (horaAeat === undefined) {
  console.error(
    '\n   El host no ha devuelto cabecera Date, así que el reloj queda sin comprobar.\n' +
      '   Sincroniza el sistema a mano antes de seguir: si va desfasado, este envío volverá\n' +
      '   con 2004 y no habrá medido nada.',
  );
} else {
  const desfase = desfaseDeReloj(horaAeat);
  console.log(`   Reloj de la AEAT: ${horaAeat}`);
  console.log(
    `   Desfase local: ${desfase.segundos} s (margen ${MARGEN_RELOJ_AEAT_SEGUNDOS} s) · ` +
      `${desfase.dentroDelMargen ? 'OK' : 'FUERA DE MARGEN'}`,
  );

  if (!desfase.dentroDelMargen) {
    console.error(`\n   ${desfase.aviso}`);
    throw new Error(
      'Se para aquí, sin enviar. Con el reloj así, la respuesta sería 2004 y no diría nada\n' +
        'sobre +00:00 — que es lo único que esta sonda quiere medir. Y el registro quedaría\n' +
        'almacenado con error, que hay que subsanar uno a uno.',
    );
  }
}

// ── El literal: el instante de ahora, con offset cero ─────────────────────────────────────────
//
// `toISOString()` da el instante en UTC; se le quita la fracción y la `Z`, y se escribe `+00:00`.
// Es el mismo momento, en la forma que genera la librería en Atlantic/Canary en invierno.
const literal = `${new Date().toISOString().slice(0, 19)}+00:00`;

// Misma zona que el huso del registro. Si salen de zonas distintas pueden discrepar en
// un día entero, que es la trampa de Canarias. Ver fechaDeExpedicion() en comun.mjs.
const fecha = fechaDeExpedicion(new Date(), 'UTC');

const entrada = {
  IDEmisorFactura: nif,
  NumSerieFactura: `S2B-CERO-${marca}`,
  FechaExpedicionFactura: fecha,
  TipoFactura: 'F1',
  CuotaTotal: '21.00',
  ImporteTotal: '121.00',
  Huella: null,
  FechaHoraHusoGenRegistro: literal,
};

const { fields } = canonicalizeRegistroAlta(entrada);
const eslabon = {
  tipo: 'alta',
  fields,
  huella: await hashRegistroAlta(entrada),
  registroAnterior: null,
};

console.log(`\n   literal: ${literal}`);
console.log(`   huella:  ${eslabon.huella}`);

let r;
try {
  r = await enviarCaso(cli, 's2b', 'offset-cero', {
    cabecera: cabecera({ nif, nombre }),
    registros: [
      { eslabon, datos: datos({ nif, nombre, instalacion: `S2B-cero-${marca}` }) },
    ],
  });
} catch (error) {
  r = { error: error.message };
}

// ── Lectura ───────────────────────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(78)}`);

const codigo = r.codigoError ?? null;
const lecturas = {
  null: 'I-08 CERRADA. «+00:00» explícito vale, y la AEAT hashea el literal tal cual.\n' +
    'Canarias en invierno queda cubierto y no hay nada que cambiar en core.',
  2000: 'ATENCIÓN. La AEAT normalizó antes de hashear, lo que CONTRADICE lo medido con «Z».\n' +
    'No sigas con S-3: esto merece mirarse antes, porque una de las dos medidas está mal leída.',
  1244: 'La AEAT RECHAZA «+00:00» y exige «Z» para huso cero. Es lo contrario de lo que\n' +
    'core genera hoy en Atlantic/Canary en invierno, así que habría que cambiarlo.',
  2004: 'NO MIDE NADA. El reloj de esta máquina va desfasado respecto al de la AEAT.\n' +
    'Sincronízalo y repite: el registro ha quedado almacenado con error y hay que subsanarlo.',
  2007: 'NO MIDE NADA. La AEAT no separa las cadenas por NumeroInstalacion.\n' +
    'Hay que aislar los casos de otra forma antes de repetir.',
};

if (r.error !== undefined) {
  console.log(`S-2b sin respuesta legible: ${r.error}`);
} else {
  console.log(`envío ${r.estadoEnvio} · registro ${r.estadoRegistro} · código ${codigo ?? '—'}`);
  if (r.descripcionError) console.log(`«${r.descripcionError}»`);
  console.log(`\n${lecturas[String(codigo)] ?? 'Código no previsto. NO CONCLUYENTE: no lo fuerces, dímelo.'}`);

  // De paso, el reloj de la AEAT medido en el servicio de verdad y no en el host estático.
  const sello = r.resultado?.respuesta?.DatosPresentacion?.TimestampPresentacion;
  if (sello !== undefined) {
    const d = desfaseDeReloj(sello);
    console.log(`\nTimestampPresentacion: ${sello} · desfase real ${d.segundos} s`);
  }
}
console.log('='.repeat(78));
