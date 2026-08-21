#!/usr/bin/env node
/**
 * Closes I-10: which URL encoding does the AEAT cotejo service actually expect?
 *
 * The AEAT's reference snippet uses `java.net.URLEncoder.encode(param, "UTF-8")`, which is
 * `application/x-www-form-urlencoded` — a space becomes `+`. JavaScript's `encodeURIComponent`
 * implements RFC 3986 — a space becomes `%20`. The two disagree on ` ! ' ( ) ~`, and
 * `numserie` admits ASCII 32-126, so those are real values.
 *
 * The oracle: with `formato=json` the service echoes back the `numserie` it decoded. Send a
 * known encoding, read what came out the other side, and the ambiguity is settled.
 *
 *   ?numserie=A+B  ->  echo "A B"  means form-urlencoded decoding (Java-style)
 *                  ->  echo "A+B"  means RFC 3986 decoding (encodeURIComponent-style)
 *
 * ## Deliberately small
 *
 * This hits a live AEAT service. Error 3002 is «Se ha excedido el número máximo de intentos
 * permitidos por día, el acceso ha sido bloqueado», and the preproduction portal reserves
 * itself for occasional testing, not sweeps. Hence a handful of requests, spaced out, against
 * the *preproduction* host. Do not turn this into a fuzzer.
 *
 * Needs no certificate: the cotejo service is public.
 *
 * Usage:  node scripts/probe-qr-encoding.mjs
 */

const BASE = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR';

/** NIF used throughout the AEAT's own documentation. */
const NIF = '89890001K';
const FECHA = '01-09-2024';
const IMPORTE = '241.40';

/** Pause between requests, to stay well clear of any rate limit. */
const DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Each case sends a raw, already-encoded `numserie` and records what the service echoes.
 * `intent` is the literal value we are trying to transmit.
 */
const CASES = [
  {
    id: 'space-as-%20',
    intent: 'A B',
    encoded: 'A%20B',
    question: 'RFC 3986 (encodeURIComponent) para un espacio',
  },
  {
    id: 'space-as-plus',
    intent: 'A B',
    encoded: 'A+B',
    question: 'form-urlencoded (URLEncoder de Java) para un espacio',
  },
  {
    id: 'literal-plus',
    intent: 'A+B',
    encoded: 'A%2BB',
    question: 'un "+" literal, escapado; ambas codificaciones coinciden aqui',
  },
  {
    id: 'tilde-raw',
    intent: 'A~B',
    encoded: 'A~B',
    question: '"~" sin escapar (encodeURIComponent lo deja tal cual)',
  },
  {
    id: 'tilde-escaped',
    intent: 'A~B',
    encoded: 'A%7EB',
    question: '"~" escapado (URLEncoder de Java lo escapa)',
  },
  {
    id: 'parens-raw',
    intent: "A(B)'C",
    encoded: "A(B)'C",
    question: "\"( ) '\" sin escapar (encodeURIComponent los deja)",
  },
];

async function probe({ id, intent, encoded, question }) {
  const url = `${BASE}?nif=${NIF}&numserie=${encoded}&fecha=${FECHA}&importe=${IMPORTE}&formato=json`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'verifactu-js probe (I-10)' },
    });
    const text = await response.text();

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* the service answers HTML on some errors */
    }

    const echoed = json?.respuesta?.numserie ?? null;
    return {
      id,
      question,
      status: response.status,
      intent,
      sent: encoded,
      echoed,
      matchesIntent: echoed === null ? null : echoed === intent,
      apiStatus: json?.status ?? null,
      mensaje: json?.mensaje ?? null,
      codigoError: json?.codigo_error ?? null,
      raw: json ? null : text.slice(0, 200),
    };
  } catch (error) {
    return { id, question, error: error.message };
  }
}

const results = [];
console.log(`Sonda de codificacion del QR contra ${BASE}`);
console.log(`${CASES.length} peticiones, ${DELAY_MS}ms entre cada una.\n`);

for (const [index, testCase] of CASES.entries()) {
  const result = await probe(testCase);
  results.push(result);

  console.log(`[${index + 1}/${CASES.length}] ${result.id}`);
  console.log(`      pregunta : ${result.question}`);
  if (result.error) {
    console.log(`      ERROR    : ${result.error}`);
  } else {
    console.log(`      enviado  : numserie=${result.sent}`);
    console.log(`      intencion: ${JSON.stringify(result.intent)}`);
    console.log(`      devuelto : ${JSON.stringify(result.echoed)}`);
    console.log(
      `      coincide : ${result.matchesIntent === null ? '(sin eco)' : result.matchesIntent}`,
    );
    if (result.codigoError) console.log(`      codigo   : ${result.codigoError}`);
    if (result.mensaje) console.log(`      mensaje  : ${result.mensaje}`);
    if (result.raw) console.log(`      cuerpo   : ${result.raw.replace(/\s+/g, ' ')}`);
  }
  console.log('');

  if (index < CASES.length - 1) await sleep(DELAY_MS);
}

console.log('--- VEREDICTO ---');
const plus = results.find((r) => r.id === 'space-as-plus');
const pct20 = results.find((r) => r.id === 'space-as-%20');

if (plus?.echoed == null && pct20?.echoed == null) {
  console.log('Sin eco de numserie: el servicio no ha devuelto JSON con respuesta.numserie.');
  console.log('No se puede concluir. I-10 sigue abierta.');
} else {
  console.log(`  "A%20B" -> ${JSON.stringify(pct20?.echoed)}`);
  console.log(`  "A+B"   -> ${JSON.stringify(plus?.echoed)}`);
  if (plus?.echoed === 'A B') {
    console.log('\n  => Decodifica form-urlencoded: "+" se convierte en espacio.');
    // Ojo con el paso de mas. Que el servicio decodifique form-urlencoded NO significa que haya
    // que codificar como Java: `encodeURIComponent` escapa el "+" a "%2B", asi que ya es seguro.
    // El unico camino roto es concatenar el valor sin codificar. La conclusion contraria estuvo
    // impresa aqui una temporada, y contradecia lo que dice el README sobre esta misma medicion.
    console.log('     PERO encodeURIComponent SIGUE SIENDO CORRECTO: escapa "+" a "%2B".');
    console.log('     Lo que rompe no es la funcion, es concatenar sin codificar:');
    console.log('       `...?numserie=${serie}`                       una serie "A+B" llega "A B"');
    console.log('       `...?numserie=${encodeURIComponent(serie)}`   correcto');
  } else if (plus?.echoed === 'A+B') {
    console.log('\n  => Decodifica RFC 3986: "+" se conserva literal.');
    console.log('     encodeURIComponent es correcto; un espacio DEBE ir como %20.');
  } else {
    console.log('\n  => Resultado ambiguo. Revisar la salida completa.');
  }
}

console.log(`\nJSON completo:\n${JSON.stringify(results, null, 2)}`);
