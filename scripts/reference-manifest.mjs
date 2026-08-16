#!/usr/bin/env node
/**
 * Generates (and verifies) `docs/reference/MANIFEST.md`.
 *
 * The reference folder redistributes documents published by the AEAT, the BOE and the W3C. Both
 * the AEAT and the BOE authorise redistribution, but the AEAT's terms forbid
 * "la desnaturalización del contenido de la información". A SHA-256 per file is how a third
 * party checks, without trusting us, that these are the originals byte for byte.
 *
 *   node scripts/reference-manifest.mjs           regenerate MANIFEST.md
 *   node scripts/reference-manifest.mjs --check   fail if any hash drifted
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'docs/reference';
const MANIFEST = join(DIR, 'MANIFEST.md');
const check = process.argv.includes('--check');

const sources = JSON.parse(readFileSync(join(DIR, 'sources.json'), 'utf8'));

const IGNORE = new Set(['MANIFEST.md', 'INDEX.md', 'sources.json']);

const files = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && !IGNORE.has(e.name))
  .map((e) => e.name)
  .sort((a, b) => a.localeCompare(b, 'en'));

const missing = files.filter((f) => !sources.files[f]);
if (missing.length > 0) {
  console.error(`[manifest] Ficheros sin origen declarado en sources.json:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

const orphans = Object.keys(sources.files).filter((f) => !files.includes(f));
if (orphans.length > 0) {
  console.error(`[manifest] sources.json declara ficheros que no existen:\n  ${orphans.join('\n  ')}`);
  process.exit(1);
}

const rows = files.map((name) => {
  const bytes = readFileSync(join(DIR, name));
  return {
    name,
    size: statSync(join(DIR, name)).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...sources.files[name],
  };
});

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const body = `# MANIFEST — procedencia y verificación

<!-- Generado por scripts/reference-manifest.mjs. No editar a mano. -->

Esta carpeta redistribuye documentación oficial **sin modificar**. La tabla permite comprobarlo
sin tener que fiarse de nosotros:

\`\`\`bash
node scripts/reference-manifest.mjs --check    # verifica que los SHA-256 siguen coincidiendo
sha256sum docs/reference/AEAT_huella_hash.pdf  # o a mano, contra la tabla
\`\`\`

Descargados el **${sources.downloadedAt}**. Ninguno se ha alterado: si un fichero cambia, el
hash deja de coincidir y el CI falla.

## Condiciones de reutilización

**AEAT** — [Utilización de la información contenida en la web](https://sede.agenciatributaria.gob.es/Sede/condiciones-uso-sede-electronica/aviso-legal/utilizacion-informacion-contenida-web-aeat.html),
consultado el ${sources.downloadedAt}:

> La información «es susceptible de reutilización, quedando autorizada su reproducción total o
> parcial, modificación, distribución y comunicación, para usos comerciales y no comerciales».

Con tres condiciones, que esta carpeta cumple:

| Condición de la AEAT | Cómo se cumple |
|---|---|
| «Queda prohibida en cualquier circunstancia la desnaturalización del contenido de la información» | Los ficheros son los originales, sin modificar. El SHA-256 lo demuestra |
| «Es obligatorio citar la fuente de los documentos objeto de la reutilización» | Columna «Origen» de la tabla, y cita por afirmación en \`docs/spec-notes.md\` |
| «Es obligatorio mencionar la fecha de la última actualización, cuando esté disponible» | Columnas «Versión» y «Fecha doc.» |

**BOE** — [Aviso legal](https://www.boe.es/informacion/aviso_legal/index.php). La reutilización
se permite para fines comerciales y no comerciales. Además, el artículo 13 del texto refundido de
la Ley de Propiedad Intelectual (RDL 1/1996) establece que **las disposiciones legales y
reglamentarias no son objeto de propiedad intelectual**, por lo que los textos normativos de esta
carpeta no están protegidos por derechos de autor.

**W3C** — \`xmldsig-core-schema.xsd\` se redistribuye bajo la
[W3C Document Notice](https://www.w3.org/copyright/document-license/). Está aquí porque
\`SuministroInformacion.xsd\` lo importa desde una URL remota y el validador XSD que usamos en los
tests no tiene acceso a red.

## Ficheros

| Fichero | Documento | Versión | Fecha doc. | Tamaño | SHA-256 |
|---|---|---|---|---|---|
${rows
  .map(
    (r) =>
      `| \`${r.name}\` | ${r.title} | ${r.version ?? '—'} | ${r.documentDate ?? '—'} | ${kb(r.size)} | \`${r.sha256}\` |`,
  )
  .join('\n')}

## Origen

| Fichero | Publica | URL de descarga |
|---|---|---|
${rows.map((r) => `| \`${r.name}\` | ${r.publisher} | ${r.url} |`).join('\n')}

${rows
  .filter((r) => r.note)
  .map((r) => `> **\`${r.name}\`** — ${r.note}`)
  .join('\n>\n')}

## Nota sobre los XSD y el WSDL

Se descargan de rutas que contienen \`tikeV1.0\`, pero los \`targetNamespace\` declarados dentro
usan \`tike\` (sin versión) y el host \`www2.agenciatributaria.gob.es\`. Copiar la URL de descarga
como namespace produce XML que la AEAT rechaza. Ver \`docs/spec-notes.md\` §8.3.

## Derivados

\`extracted/\` contiene texto plano extraído de los PDF para poder buscar en ellos. Son
**derivados**, no originales: para citar, usa siempre el PDF.
`;

if (check) {
  let current;
  try {
    current = readFileSync(MANIFEST, 'utf8');
  } catch {
    console.error('[manifest] MANIFEST.md no existe. Ejecuta: node scripts/reference-manifest.mjs');
    process.exit(1);
  }
  if (current.trim() !== body.trim()) {
    console.error(
      '[manifest] MANIFEST.md está desactualizado o algún fichero de docs/reference ha cambiado.\n' +
        'Si el cambio es intencionado, regenera con: node scripts/reference-manifest.mjs\n' +
        'Si no lo es, alguien ha alterado documentación oficial que debe permanecer intacta.',
    );
    process.exit(1);
  }
  console.log(`[manifest] ${rows.length} ficheros verificados.`);
  process.exit(0);
}

writeFileSync(MANIFEST, body, 'utf8');
console.log(`[manifest] MANIFEST.md generado con ${rows.length} ficheros.`);
