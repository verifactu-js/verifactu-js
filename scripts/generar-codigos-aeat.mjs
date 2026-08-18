#!/usr/bin/env node
/**
 * Generates `packages/client/src/codigos-aeat.ts` from `docs/reference/AEAT_errores.properties`.
 *
 *   node scripts/generar-codigos-aeat.mjs           regenera el fichero
 *   node scripts/generar-codigos-aeat.mjs --check   falla si no coincide con la fuente
 *
 * ## Por qué se genera en vez de escribirse
 *
 * Son 247 mensajes en castellano con acentos, y el valor del mapa está en que el texto sea
 * **literalmente** el de la AEAT: es lo que el usuario va a buscar en Google cuando le rechacen
 * una factura, y lo que hay que poder citar sin matices. Transcribirlos a mano garantiza erratas,
 * y una errata en un mensaje de error es indistinguible de un mensaje distinto.
 *
 * El texto oficial y la categoría se generan; la **acción sugerida** no. Esa es nuestra y vive
 * escrita a mano en `errores-aeat.ts`. La separación es deliberada: en el fichero generado no hay
 * ni una palabra nuestra, así que se puede diffear contra el original sin tener que separar lo
 * que dice la AEAT de lo que opinamos nosotros.
 *
 * La categoría sale de las cabeceras `********* … *********` del propio fichero, que es lo único
 * que dice si un código tumba el envío entero, tumba un registro, o deja pasar el registro. No se
 * infiere del primer dígito: eso funcionaría hoy y sería una suposición.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { decodificarProperties, parsearProperties } from './properties.mjs';

const FUENTE = 'docs/reference/AEAT_errores.properties';
const DESTINO = 'packages/client/src/codigos-aeat.ts';
const check = process.argv.includes('--check');

/** Qué le pasa al envío según la sección en la que la AEAT haya puesto el código. */
const CATEGORIAS = [
  [/rechazo del env[íi]o completo/i, 'envio'],
  [/rechazo de la factura/i, 'registro'],
  [/aceptaci[óo]n del registro/i, 'aceptado'],
];

const bytes = readFileSync(FUENTE);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const { texto, escapes, reparadas } = decodificarProperties(bytes);
const secciones = parsearProperties(texto);

/** @type {Map<string, { texto: string, categoria: string }>} */
const codigos = new Map();

for (const seccion of secciones) {
  const encontrada = CATEGORIAS.find(([patron]) => patron.test(seccion.titulo));
  if (encontrada === undefined) {
    console.error(
      `[codigos] Sección no reconocida en ${FUENTE}:\n  «${seccion.titulo}»\n\n` +
        'La AEAT ha cambiado los encabezados o ha añadido una sección. La categoría de un código\n' +
        'decide si el registro quedó almacenado o no, así que adivinarla no es una opción:\n' +
        'revisa el fichero y añade el patrón en CATEGORIAS.',
    );
    process.exit(1);
  }

  for (const { codigo, texto: mensaje } of seccion.entradas) {
    const previo = codigos.get(codigo);
    if (previo !== undefined && (previo.texto !== mensaje || previo.categoria !== encontrada[1])) {
      console.error(`[codigos] El código ${codigo} aparece dos veces con contenido distinto.`);
      process.exit(1);
    }
    codigos.set(codigo, { texto: mensaje, categoria: encontrada[1] });
  }
}

const ordenados = [...codigos.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'));
const porCategoria = (c) => ordenados.filter(([, v]) => v.categoria === c).length;

/**
 * Renders a JS string literal the way Biome would write it.
 *
 * Biome elige las comillas que menos escapes obliguen a poner, y en empate usa las configuradas
 * (simples). Varios mensajes de la AEAT llevan comillas simples dentro —«Si Impuesto es '01'
 * (IVA)…»— y uno lleva de los dos tipos, el 1287. Reproducir la regla aquí es lo que evita que el
 * formateador y `--check` se peleen para siempre.
 */
const literal = (texto) => {
  const simples = (texto.match(/'/g) ?? []).length;
  const dobles = (texto.match(/"/g) ?? []).length;
  const comilla = simples > dobles ? '"' : "'";
  const escapado = texto
    .replace(/\\/g, '\\\\')
    .replaceAll(comilla, `\\${comilla}`);
  return `${comilla}${escapado}${comilla}`;
};

/**
 * Emits one property the way Biome would, so `lint` y `--check` no se peleen.
 *
 * Biome envuelve a 100 columnas, y con estos mensajes hay decenas que se pasan. Reproducir aquí
 * esa única regla sale más barato que invocar al formateador desde el generador, y evita la
 * alternativa fea: excluir el fichero del formateador y perder el linter con él.
 */
const propiedad = (nombre, valor) => {
  const unaLinea = `    ${nombre}: ${valor},`;
  return unaLinea.length <= 100 ? unaLinea : `    ${nombre}:\n      ${valor},`;
};

const cuerpo = `// Generado por scripts/generar-codigos-aeat.mjs. No editar a mano.
// Fuente: ${FUENTE}
// SHA-256: ${sha256}
//
// Las acciones sugeridas NO están aquí: son nuestras y viven en errores-aeat.ts. En este fichero
// no hay ni una palabra que no venga de la AEAT.

/**
 * What the AEAT does with the submission when it answers with a given code.
 *
 * Taken from the three section headers of \`errores.properties\`, not inferred from the number.
 * It is the single most important thing to know about a rejection, because it answers the only
 * question that matters next: **¿quedó el registro almacenado?**
 */
export type CategoriaError =
  /** Rechazo del envío completo: no se ha registrado ninguna factura del lote. */
  | 'envio'
  /** Rechazo de esta factura (o de la petición entera si el error está en la cabecera). */
  | 'registro'
  /** El registro **sí** ha quedado almacenado, con errores que deben subsanarse después. */
  | 'aceptado';

/** One row of the AEAT's error table, verbatim. */
export interface CodigoAeat {
  /** El código tal y como viaja en \`CodigoErrorRegistro\`. */
  readonly codigo: string;
  /** El mensaje oficial, palabra por palabra. \`%s\` es un hueco que la AEAT rellena. */
  readonly texto: string;
  /** Qué pasó con el envío. */
  readonly categoria: CategoriaError;
}

/** Provenance of this table, so a discrepancy can be traced instead of argued. */
export const FUENTE_CODIGOS = {
  fichero: '${FUENTE}',
  url: 'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties',
  sha256: '${sha256}',
  descargado: '2026-08-18',
  entorno: 'preproducción',
  codigos: ${ordenados.length},
} as const;

/**
 * The AEAT's error table: ${ordenados.length} codes.
 *
 * ${porCategoria('envio')} de envío, ${porCategoria('registro')} de registro y ${porCategoria('aceptado')} de aceptado-con-errores.
 */
export const CODIGOS_AEAT: Readonly<Record<string, CodigoAeat>> = {
${ordenados
  .map(
    ([codigo, v]) =>
      // Siempre en varias líneas, nunca en una. Biome —como Prettier— respeta el salto que hay
      // tras la llave de apertura y no vuelve a juntar el objeto, así que esta forma es estable
      // frente al formateador. La compacta no lo sería: se colapsaría o se expandiría según la
      // longitud del mensaje, y `--check` fallaría en cuanto la AEAT alargara una frase.
      `  '${codigo}': {\n` +
      `${propiedad('codigo', literal(codigo))}\n` +
      `${propiedad('texto', literal(v.texto))}\n` +
      `${propiedad('categoria', literal(v.categoria))}\n` +
      '  },',
  )
  .join('\n')}
};
`;

if (check) {
  let actual;
  try {
    actual = readFileSync(DESTINO, 'utf8');
  } catch {
    console.error(`[codigos] Falta ${DESTINO}. Ejecuta: node scripts/generar-codigos-aeat.mjs`);
    process.exit(1);
  }
  if (actual.replace(/\r\n/g, '\n') !== cuerpo) {
    console.error(
      `[codigos] ${DESTINO} no coincide con ${FUENTE}.\n\n` +
        'O se ha editado a mano el fichero generado, o ha cambiado la tabla de la AEAT. Si es lo\n' +
        'segundo, el manifiesto también habrá fallado y hay códigos nuevos que revisar antes de\n' +
        'regenerar: un código nuevo sin acción sugerida sale con la genérica de su categoría.\n\n' +
        'Regenera con: node scripts/generar-codigos-aeat.mjs',
    );
    process.exit(1);
  }
  console.log(`[codigos] ${ordenados.length} códigos verificados contra ${FUENTE}.`);
  process.exit(0);
}

writeFileSync(DESTINO, cuerpo, 'utf8');
console.log(
  `[codigos] ${DESTINO}: ${ordenados.length} códigos ` +
    `(${porCategoria('envio')} envío, ${porCategoria('registro')} registro, ${porCategoria('aceptado')} aceptado). ` +
    `Escapes uXXXX resueltos: ${escapes}. Secuencias doble-codificadas reparadas: ${reparadas}.`,
);
