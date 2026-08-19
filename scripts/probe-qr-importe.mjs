#!/usr/bin/env node
/**
 * Cierra I-11: qué formato de `importe` admite de verdad la URL del QR.
 *
 * F2 dice «máximo 12 dígitos en la parte entera, y 2 dígitos en la parte decimal», pero sus
 * propios ejemplos usan `241.4` (un decimal) y `241.40` (dos). No consta si los dos decimales son
 * obligatorios, ni cómo se representa un importe negativo — que existe: una rectificativa por
 * diferencias lo lleva.
 *
 * El oráculo es el mismo que cerró I-10, y aquí es aún mejor porque hay dos salidas distinguibles:
 *
 *   - Con `formato=json` el servicio **devuelve el `importe` que ha decodificado**. Si el eco no
 *     coincide con lo enviado, es que ha normalizado, y eso hay que saberlo.
 *   - Si el formato no le vale, contesta con el código **2005** («El importe tiene un formato
 *     incorrecto») o **2006** («excede el número máximo de caracteres»), documentados en F2 §10.
 *
 * Así que cada caso cae en uno de tres sitios: aceptado tal cual, aceptado y reescrito, o
 * rechazado con código. Los tres son respuestas, no silencios.
 *
 * ## Deliberadamente pequeña
 *
 * Esto golpea un servicio vivo de la AEAT. El error 3002 es «Se ha excedido el número máximo de
 * intentos permitidos por día, el acceso ha sido bloqueado», y el portal de preproducción se
 * reserva para pruebas ocasionales, no para barridos. De ahí seis peticiones espaciadas contra el
 * host de **preproducción**. No lo conviertas en un fuzzer.
 *
 * No necesita certificado: el servicio de cotejo es público. Y no usa tu NIF: va con el
 * `89890001K` que la propia AEAT usa en toda su documentación, así que la salida se puede pegar
 * en spec-notes sin filtrar nada.
 *
 * Uso:  node scripts/probe-qr-importe.mjs
 */

const BASE = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR';

/** El NIF que la AEAT usa en sus propios ejemplos. No es el de nadie. */
const NIF = '89890001K';
const FECHA = '01-09-2024';
const NUMSERIE = '12345678-G33';

/** Pausa entre peticiones, para no acercarse ni de lejos a ningún límite. */
const DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cada caso manda un `importe` ya codificado y apunta qué devuelve.
 *
 * `enviado` es el literal que viaja en la URL; `lectura` dice qué significa cada desenlace, y se
 * escribe ANTES de lanzar nada para no interpretar a posteriori lo que salga.
 */
const CASOS = [
  {
    id: 'dos-decimales',
    enviado: '241.40',
    pregunta: 'CONTROL POSITIVO: dos decimales, la forma que usa el ejemplo canónico de F2',
    lectura: {
      aceptado: 'Como debía. Si este falla, el resto de la tanda no se puede leer.',
      rechazado: 'La sonda está mal construida: este caso no puede fallar. Para y revísala.',
    },
  },
  {
    id: 'un-decimal',
    enviado: '241.4',
    pregunta: '¿Son obligatorios los dos decimales? F2 usa esta forma en un ejemplo y la otra en otro',
    lectura: {
      aceptado: 'Un decimal vale. Los dos decimales NO son obligatorios en la URL del QR.',
      rechazado: 'Los dos decimales SON obligatorios, y el propio ejemplo de F2 sería inválido.',
    },
  },
  {
    id: 'sin-decimales',
    enviado: '241',
    pregunta: '¿Y ninguno? Es lo que sale de un importe entero sin formatear',
    lectura: {
      aceptado: 'La parte decimal es opcional del todo.',
      rechazado: 'Hace falta parte decimal, aunque no sean necesariamente dos dígitos.',
    },
  },
  {
    id: 'negativo',
    enviado: '-241.40',
    pregunta: 'LA OTRA MITAD DE I-11: cómo viaja un importe negativo, el de una rectificativa',
    lectura: {
      aceptado: 'El signo menos viaja en la URL del QR tal cual.',
      rechazado:
        'La URL del QR NO admite negativos. Habría que decidir qué se pone en el QR de una ' +
        'rectificativa por diferencias, y eso es una laguna de la especificación, no nuestra.',
    },
  },
  {
    id: 'tres-decimales',
    enviado: '241.400',
    pregunta: '¿Se cumple de verdad el «máximo 2 decimales» que dice F2?',
    lectura: {
      aceptado: 'El máximo de 2 decimales no se valida. Conviene no confiarse igualmente.',
      rechazado: 'El máximo de 2 decimales se valida, como dice F2.',
    },
  },
  {
    id: 'coma-decimal',
    enviado: '241%2C40',
    pregunta: 'La coma española, que es el error que más se va a cometer al construir la URL',
    lectura: {
      aceptado:
        'ACEPTA la coma. Sería un problema serio: dos escrituras del mismo importe, y quien ' +
        'formatee con locale español no se enteraría de nada.',
      rechazado: 'Rechaza la coma. El separador es el punto y punto. Es lo esperable y lo sano.',
    },
  },
];

async function sondear({ id, enviado, pregunta, lectura }) {
  const url = `${BASE}?nif=${NIF}&numserie=${NUMSERIE}&fecha=${FECHA}&importe=${enviado}&formato=json`;

  try {
    const respuesta = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'verifactu-js probe (I-11)' },
    });
    const texto = await respuesta.text();

    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      /* el servicio contesta HTML en algunos errores */
    }

    const eco = json?.respuesta?.importe ?? null;
    const codigo = json?.codigo_error ?? null;

    return {
      id,
      pregunta,
      lectura,
      estadoHttp: respuesta.status,
      enviado,
      // El literal que se pretendía transmitir, ya sin escapar, para poder comparar con el eco.
      intencion: decodeURIComponent(enviado),
      eco,
      codigo,
      mensaje: json?.mensaje ?? null,
      crudo: json ? null : texto.slice(0, 200),
    };
  } catch (error) {
    return { id, pregunta, lectura, error: error.message };
  }
}

/** Tres desenlaces posibles, y ninguno es «no ha contestado». */
function desenlace(r) {
  if (r.error !== undefined) return 'sin-respuesta';
  // 2005 y 2006 son los dos códigos de formato de importe de F2 §10.
  if (r.codigo !== null && /\b200[56]\b/.test(String(r.codigo))) return 'rechazado';
  if (r.eco === null) return 'sin-eco';
  return r.eco === r.intencion ? 'aceptado' : 'normalizado';
}

const resultados = [];
console.log(`Sonda del formato de importe del QR contra ${BASE}`);
console.log(`${CASOS.length} peticiones, ${DELAY_MS} ms entre cada una. Sin certificado.\n`);

for (const [i, caso] of CASOS.entries()) {
  const r = await sondear(caso);
  resultados.push(r);

  console.log(`[${i + 1}/${CASOS.length}] ${r.id}`);
  console.log(`      pregunta : ${r.pregunta}`);
  if (r.error) {
    console.log(`      ERROR    : ${r.error}`);
  } else {
    console.log(`      enviado  : importe=${r.enviado}`);
    console.log(`      intencion: ${JSON.stringify(r.intencion)}`);
    console.log(`      devuelto : ${JSON.stringify(r.eco)}`);
    if (r.codigo) console.log(`      codigo   : ${r.codigo}`);
    if (r.mensaje) console.log(`      mensaje  : ${r.mensaje}`);
    if (r.crudo) console.log(`      cuerpo   : ${r.crudo.replace(/\s+/g, ' ')}`);
    console.log(`      desenlace: ${desenlace(r)}`);
  }
  console.log('');

  if (i < CASOS.length - 1) await sleep(DELAY_MS);
}

console.log('--- LECTURA ---\n');

const control = resultados.find((r) => r.id === 'dos-decimales');
if (desenlace(control) !== 'aceptado') {
  console.log('EL CONTROL POSITIVO NO HA PASADO.');
  console.log('«241.40» es la forma del ejemplo canónico de F2 y tenía que salir aceptada.');
  console.log('Nada de esta tanda se puede leer. No interpretes el resto: arregla la sonda.');
  process.exit(1);
}

for (const r of resultados) {
  const d = desenlace(r);
  const texto =
    d === 'aceptado'
      ? r.lectura.aceptado
      : d === 'rechazado'
        ? r.lectura.rechazado
        : d === 'normalizado'
          ? `El servicio ha REESCRITO el importe: enviado ${JSON.stringify(r.intencion)}, ` +
            `devuelto ${JSON.stringify(r.eco)}. Lo admite pero no lo conserva.`
          : `NO CONCLUYENTE: desenlace «${d}». No lo interpretes, dilo.`;

  console.log(`  ${r.id.padEnd(16)} ${d.padEnd(12)} ${texto}`);
}

console.log(
  '\nRecuerda el otro filo, que ya salió de I-10: un "+" sin escapar en la URL se decodifica\n' +
    'como ESPACIO. Un importe con signo explícito construido a mano llegaría partido.',
);
