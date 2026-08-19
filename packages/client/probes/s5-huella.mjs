/**
 * S-5 · las cuatro incógnitas que bloquean el estable (I-01…I-05) — **siete envíos**.
 *
 * ## Por qué esto es medible ahora y antes no
 *
 * Cada caso manda un literal deliberadamente dudoso, hasheado como lo haría `core`, y pregunta una
 * sola cosa: **¿la AEAT calculó la misma huella?** Antes de S-1 eso era invisible; con el código
 * **2000** («El cálculo de la huella suministrada es incorrecta») la respuesta es binaria:
 *
 *     Correcto → la AEAT hasheó ese literal tal cual. No normaliza.
 *     2000     → normalizó antes de hashear. Y el registro QUEDA ALMACENADO: hay que subsanarlo.
 *
 * Cualquier otro código no mide la huella. Se anota como no concluyente y no se interpreta.
 *
 * ## Las dos reglas que vienen de lo que costó S-2
 *
 * 1. **Cada caso genera su sello justo antes de enviar.** Con siete registros y esperas de 60 s, un
 *    literal derivado del primero saldría 360 s después — fuera de los 240 s de margen, y volvería
 *    2004 sin medir nada. Ver `docs/spec-notes.md` §22.9.
 * 2. **`NumeroInstalacion` distinta por caso.** `CodigoErrorRegistro` es `maxOccurs="1"`: un solo
 *    código por registro, y un 2007 taparía al 2000, que es lo que se busca.
 *
 * ## Qué se salta la validación de `core`
 *
 * **Los casos 1 y 3**, cada uno con su motivo, declarado en `motivoSalto`:
 *
 * - **1** — `ESPACIO_AMBIGUO_EN_BORDE`. `core` se niega a elegir en la zona gris de I-01 cuando no
 *   sabe qué huella calculará la AEAT. Es la decisión de spec-notes §1.3.1 y es correcta.
 * - **3** — `CARACTER_NO_PERMITIDO`. `core` restringe la serie a ASCII 32-126 (F3 §3.1.3.1).
 *
 * En los dos, el objeto de la medición es precisamente lo que la librería se niega a construir.
 * Arman su cadena canónica a mano y la hashean aquí, en este fichero, sin tocar la librería.
 *
 * Los otros cinco son entradas legales que `core` acepta sin más.
 *
 * ## Comprobación en seco antes de enviar nada
 *
 * Los siete casos se construyen enteros **antes** del primer envío. La primera ejecución de esta
 * sonda se estrelló en el caso 3 —el plan daba por hecho que pasaba por `core` y no era verdad—
 * después de haber gastado dos registros contra un NIF real. Un fallo de construcción es local,
 * gratis y detectable de antemano: no hay excusa para descubrirlo a mitad de camino.
 *
 * ## Reanudar
 *
 * Se pueden pasar los casos a enviar como argumentos, para no repetir los ya medidos:
 *
 *     node packages/client/probes/s5-huella.mjs unicode-nfd decimal-dos decimal-uno
 *
 * Y `--seco` construye los siete casos y para, sin enviar nada:
 *
 *     node packages/client/probes/s5-huella.mjs --seco
 *
 *   node packages/client/probes/s5-huella.mjs
 */

import {
  canonicalizeRegistroAlta,
  formatFechaHoraHusoGenRegistro,
  hashRegistroAlta,
} from '@verifactu-js/core';

import {
  cabecera,
  cliente,
  datos,
  enviarCaso,
  entorno,
  esperar,
  fechaDeExpedicion,
  sha256,
  sufijo,
} from './comun.mjs';

const ZONA = 'Europe/Madrid';

/**
 * Los dos caracteres que se miden, con escape.
 *
 * Escritos como literales serían indistinguibles de un espacio normal y de una `é` precompuesta,
 * que es justo lo contrario de lo que la sonda quiere enviar. Un carácter invisible en el fuente
 * de una sonda que cuesta registros reales no es una opción — y ya se coló uno mientras se
 * escribía esto, que es exactamente la razón de la regla.
 */
const NBSP = '\u00a0'; // el que core rechaza al borde (I-01)
const E_NFD = 'e' + '\u0301'; // «é» descompuesta: e + acento combinante (I-03)

const { credenciales, nif, nombre } = await entorno();
const cli = cliente(credenciales);
const marca = sufijo();
const CAB = cabecera({ nif, nombre });

/** Sello recién generado. Nunca derivado de otro caso: ver la regla 1 de la cabecera. */
const selloNuevo = () => formatFechaHoraHusoGenRegistro(new Date(), { timeZone: ZONA });

/** Una instalación de SIF por caso, para que un 2007 no tape al 2000. */
const datosDe = (caso, extra) => ({
  ...datos({ nif, nombre, instalacion: `S5-${caso}-${marca}` }),
  ...extra,
});

/** Cadena canónica del alta (F1 §3), para el único caso que no puede pasar por `core`. */
const cadenaAlta = (f) =>
  [
    `IDEmisorFactura=${f.IDEmisorFactura}`,
    `NumSerieFactura=${f.NumSerieFactura}`,
    `FechaExpedicionFactura=${f.FechaExpedicionFactura}`,
    `TipoFactura=${f.TipoFactura}`,
    `CuotaTotal=${f.CuotaTotal}`,
    `ImporteTotal=${f.ImporteTotal}`,
    `Huella=${f.Huella ?? ''}`,
    `FechaHoraHusoGenRegistro=${f.FechaHoraHusoGenRegistro}`,
  ].join('&');

/**
 * Los siete casos.
 *
 * `importes` solo se toca donde el importe es el objeto de la medición, y entonces el desglose se
 * ajusta para que cuadre: si `ImporteTotal` no cuadra con la suma del desglose, la AEAT contesta
 * 1210 —aritmética— y no llega a mirar la huella. Sería un caso perdido por un descuido nuestro.
 */
const CASOS = [
  {
    id: 'nbsp-final',
    incognita: 'I-01',
    etiqueta: 'NBSP (U+00A0) al final de NumSerieFactura',
    serie: `S5-NBSP-${marca}${NBSP}`,
    saltaCore: true,
    motivoSalto: 'ESPACIO_AMBIGUO_EN_BORDE: core se niega a elegir en la zona gris de I-01',
    lectura: {
      correcto: 'La AEAT no recorta más allá de U+0020, igual que String.trim(). I-01 medida.',
      dosMil:
        'La AEAT recorta con semántica Unicode y nosotros no. I-01 medida, y core hace bien en negarse.',
    },
  },
  {
    id: 'espacios-dobles',
    incognita: 'I-02',
    etiqueta: 'dos espacios interiores en NumSerieFactura',
    serie: `S5-A  B-${marca}`,
    lectura: {
      correcto: 'Los espacios interiores se conservan. I-02 CERRADA.',
      dosMil:
        'La AEAT los colapsa al recalcular. I-02 cerrada, y core tiene que colapsarlos también.',
    },
  },
  {
    // **Se salta `core`, y el plan decía que no.** Fue un error: `core` restringe
    // `NumSerieFactura` a ASCII 32-126 (`CARACTER_NO_PERMITIDO`, F3 §3.1.3.1), así que cualquier
    // carácter combinante lo rechaza antes de hashear. La primera ejecución de S-5 se estrelló
    // aquí, después de gastar dos registros.
    //
    // Y al arreglarlo cambia lo que este caso mide. `NumSerieFactura` es el **único** campo de
    // texto libre que entra en la huella del alta —los demás son NIF, fecha, enum, decimal o
    // hex—, así que si la AEAT también restringe la serie a ASCII, entonces **ningún carácter
    // que la normalización Unicode pueda tocar entra jamás en una huella**, e I-03 pasa a ser
    // inalcanzable por construcción igual que I-01.
    //
    // La pregunta primaria pasa a ser: ¿la AEAT admite no-ASCII en la serie? La de normalización
    // solo existe si la respuesta es que sí.
    id: 'unicode-nfd',
    incognita: 'I-03',
    etiqueta: 'e + acento combinante (NFD) en NumSerieFactura',
    serie: `S5-CAF${E_NFD}-${marca}`,
    saltaCore: true,
    motivoSalto: 'CARACTER_NO_PERMITIDO: core restringe la serie a ASCII 32-126',
    lectura: {
      correcto:
        'La AEAT ADMITE no-ASCII en la serie y no normaliza Unicode. Dos consecuencias: I-03 ' +
        'cerrada, y core es MÁS ESTRICTO que la AEAT — estaría rechazando series legales con Ñ ' +
        'o acentos, que en España no es un caso raro. Hay que decidir si se afloja.',
      dosMil:
        'La AEAT admite no-ASCII pero normaliza a NFC. I-03 cerrada, y core tendría que ' +
        'normalizar antes de hashear.',
    },
  },
  {
    // El par de I-04 va junto y en este orden. `121.10` es la forma que emite core, así que hace
    // de **control positivo**: si ese fallara, el problema no serían los decimales sino algo del
    // sobre, y el caso siguiente no diría nada. Con los dos, la lectura es completa:
    //
    //   ambos Correcto          → la AEAT hashea el literal. F1 tolera las dos escrituras porque
    //                             las trata como cadenas distintas, no porque normalice.
    //   121.10 ok · 121.1 → 2000 → normaliza a dos decimales antes de hashear.
    //   121.10 → 2000           → para: el problema no es I-04.
    id: 'decimal-dos',
    incognita: 'I-04',
    etiqueta: 'ImporteTotal con dos decimales (121.10) — control positivo del par',
    importes: { CuotaTotal: '21.00', ImporteTotal: '121.10' },
    lectura: {
      correcto: 'La forma que emite core cuadra. Sirve de control para el caso siguiente.',
      dosMil:
        'PARA. Si la forma canónica no cuadra, el problema no son los decimales y el caso 121.1 ' +
        'no medirá nada. Avisa antes de seguir.',
    },
  },
  {
    id: 'decimal-uno',
    incognita: 'I-04',
    etiqueta: 'ImporteTotal con un decimal (121.1) — el mismo importe, otra escritura',
    importes: { CuotaTotal: '21.00', ImporteTotal: '121.1' },
    lectura: {
      correcto:
        'La AEAT hashea el importe tal y como se escribe. I-04 CERRADA: la tolerancia de F1 sale ' +
        'de aceptar las dos escrituras como cadenas distintas, no de normalizarlas.',
      dosMil:
        'La AEAT normaliza los decimales antes de hashear. I-04 CERRADA en el otro sentido: hay ' +
        'que fijar la forma canónica en core y rechazar las demás.',
    },
  },
  {
    id: 'signo-mas',
    incognita: 'I-05',
    etiqueta: 'ImporteTotal con + explícito (+121.00)',
    importes: { CuotaTotal: '21.00', ImporteTotal: '+121.00' },
    lectura: {
      correcto: 'El + explícito viaja y entra en la huella tal cual. I-05, mitad medida.',
      dosMil: 'La AEAT quita el signo al recalcular. I-05, mitad medida.',
    },
  },
  {
    id: 'importe-negativo',
    incognita: 'I-05',
    etiqueta: 'rectificativa por diferencias con importes negativos',
    importes: { CuotaTotal: '-21.00', ImporteTotal: '-121.00' },
    rectificativa: true,
    lectura: {
      correcto: 'El signo negativo entra en la huella tal cual. I-05 CERRADA.',
      dosMil: 'La AEAT recalcula el negativo de otra forma. I-05 cerrada; hay que ver cómo.',
    },
  },
];

console.log('S-5 · siete envíos. Cada uno mide una incógnita de huella distinta.\n');
console.log('Lectura: Correcto = la AEAT hasheó ese literal tal cual · 2000 = normalizó antes.');
console.log('Cualquier otro código NO mide la huella y se anota como no concluyente.\n');

/** Enseña los invisibles, que si no el log miente por omisión. */
const legible = (texto) =>
  texto
    .replaceAll(NBSP, '<NBSP>')
    .replaceAll('\u0301', '<U+0301>')
    .replaceAll('  ', '<SP><SP>');

/** Construye el eslabón de un caso con el sello que se le pase. Sin efectos: no envía nada. */
async function construir(caso, sello) {
  const negativo = caso.rectificativa === true;

  const entrada = {
    IDEmisorFactura: nif,
    NumSerieFactura: caso.serie ?? `S5-${caso.id.toUpperCase()}-${marca}`,
    FechaExpedicionFactura: fechaDeExpedicion(new Date(), ZONA),
    TipoFactura: negativo ? 'R1' : 'F1',
    CuotaTotal: caso.importes?.CuotaTotal ?? '21.00',
    ImporteTotal: caso.importes?.ImporteTotal ?? '121.00',
    Huella: null,
    FechaHoraHusoGenRegistro: sello,
  };

  if (caso.saltaCore === true) {
    // Lo que `core` se niega a construir, que es justo el objeto de la medición. El motivo va
    // declarado en el caso, para que nadie tenga que deducirlo del código.
    return {
      entrada,
      eslabon: {
        tipo: 'alta',
        fields: entrada,
        huella: sha256(cadenaAlta(entrada)),
        registroAnterior: null,
      },
    };
  }

  const { fields } = canonicalizeRegistroAlta(entrada);
  return {
    entrada,
    eslabon: {
      tipo: 'alta',
      fields,
      huella: await hashRegistroAlta(entrada),
      registroAnterior: null,
    },
  };
}

// ── Comprobación en seco: los siete casos, antes de enviar ninguno ────────────────────────────
//
// Un fallo de construcción es local y gratis. Descubrirlo a mitad de la tanda cuesta registros
// contra un NIF real, y ya pasó una vez.
const selloDePrueba = selloNuevo();
const rotos = [];

for (const caso of CASOS) {
  try {
    await construir(caso, selloDePrueba);
  } catch (error) {
    rotos.push(`  ${caso.id} (${caso.incognita}): ${error.code ?? ''} ${error.message}`);
  }
}

if (rotos.length > 0) {
  console.error(
    `\nLa comprobación en seco ha fallado en ${rotos.length} caso(s), sin enviar nada:\n` +
      `${rotos.join('\n')}\n\n` +
      'Si el caso debe saltarse la validación de core, márcalo con saltaCore y di por qué en\n' +
      'motivoSalto. Si no, el literal está mal construido. Arréglalo antes de gastar un registro.',
  );
  process.exitCode = 1;
  throw new Error('S-5 no arranca: hay casos que no se pueden construir.');
}

console.log(`Comprobación en seco: los ${CASOS.length} casos se construyen. Cero envíos hasta aquí.`);

const argumentos = process.argv.slice(2);

// `--seco` para aquí. Existe porque la comprobación en seco es lo único de esta sonda que se
// puede ejercitar sin gastar registros, y sin una forma de pararla habría que llegar hasta el
// envío para saber si funciona — que es exactamente lo que se quiere evitar.
if (argumentos.includes('--seco')) {
  console.log('\n--seco: se para aquí. No se ha enviado nada y no se va a enviar nada.');
  process.exit(0);
}

// ── Envío ─────────────────────────────────────────────────────────────────────────────────────
const soloEstos = argumentos.filter((a) => !a.startsWith('--'));
const aEnviar = soloEstos.length === 0 ? CASOS : CASOS.filter((c) => soloEstos.includes(c.id));

if (soloEstos.length > 0) {
  const desconocidos = soloEstos.filter((id) => !CASOS.some((c) => c.id === id));
  if (desconocidos.length > 0) throw new Error(`Casos desconocidos: ${desconocidos.join(', ')}`);
  console.log(`Reanudando: solo ${aEnviar.length} de ${CASOS.length} casos.`);
}

console.log(`\nVan ${aEnviar.length} envíos.`);

const hallazgos = [];
let espera = 0;

for (const caso of aEnviar) {
  if (espera > 0) await esperar(espera, 'TiempoEsperaEnvio de la AEAT');

  // Sello nuevo para el envío de verdad: el de la comprobación en seco ya está viejo.
  const sello = selloNuevo();
  const { entrada, eslabon } = await construir(caso, sello);
  const negativo = caso.rectificativa === true;

  console.log(`\n── ${caso.incognita} · ${caso.etiqueta}`);
  console.log(`   serie:   ${legible(entrada.NumSerieFactura)}`);
  console.log(`   importe: ${entrada.ImporteTotal}   sello: ${sello}`);
  if (caso.saltaCore === true) console.log(`   (se salta core — ${caso.motivoSalto})`);
  console.log(`   huella:  ${eslabon.huella}`);

  const extra = {
    Desglose: [
      {
        ClaveRegimen: '01',
        CalificacionOperacion: 'S1',
        TipoImpositivo: '21',
        BaseImponibleOimporteNoSujeto: negativo ? '-100.00' : '100.00',
        CuotaRepercutida: negativo ? '-21.00' : '21.00',
      },
    ],
    ...(negativo
      ? {
          TipoRectificativa: 'I',
          FacturasRectificadas: [
            {
              IDEmisorFactura: nif,
              NumSerieFactura: `S5-ORIGINAL-${marca}`,
              FechaExpedicionFactura: entrada.FechaExpedicionFactura,
            },
          ],
        }
      : {}),
  };

  let r;
  try {
    r = await enviarCaso(cli, 's5', caso.id, {
      cabecera: CAB,
      registros: [{ eslabon, datos: datosDe(caso.id, extra) }],
    });
    espera = Number(r.tiempoEsperaEnvio ?? '60');
  } catch (error) {
    r = { error: error.message };
    espera = 60;
  }

  hallazgos.push({ caso, ...r });
}

// ── Lectura ───────────────────────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(78)}`);
console.table(
  hallazgos.map((h) => ({
    incognita: h.caso.incognita,
    caso: h.caso.id,
    envio: h.estadoEnvio ?? '—',
    registro: h.estadoRegistro ?? '—',
    codigo: h.codigoError ?? '—',
  })),
);

for (const h of hallazgos) {
  const codigo = h.codigoError ?? null;
  let lectura;
  if (h.error !== undefined) lectura = `sin respuesta legible: ${h.error}`;
  else if (codigo === null && h.estadoRegistro === 'Correcto') lectura = h.caso.lectura.correcto;
  else if (codigo === '2000') lectura = h.caso.lectura.dosMil;
  else lectura = `NO CONCLUYENTE: el código ${codigo} no mide la huella. No lo interpretes, dilo.`;

  console.log(`\n${h.caso.incognita} · ${h.caso.id}\n  ${lectura}`);
}

console.log(
  `\n${'='.repeat(78)}\n` +
    'Todo el crudo está en docs/probe-results/s5-*.{request,response}.xml.\n' +
    'Recuerda que un 2000 deja el registro ALMACENADO con error: hay que subsanarlo.',
);
console.log('='.repeat(78));
