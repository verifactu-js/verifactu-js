/**
 * Runtime smoke test: runs the *built* bundle against the official AEAT vectors.
 *
 * Plain ESM with no test framework and no imports beyond the package itself, so the same file
 * runs unchanged on Node, Bun and Deno. That is the point: `@verifactu-js/core` claims to be
 * isomorphic, and this is what backs the claim.
 *
 *   node runtime-smoke.mjs
 *   bun  runtime-smoke.mjs
 *   deno run --allow-read runtime-smoke.mjs
 */
import {
  createSifChain,
  hashRegistroAlta,
  hashRegistroAnulacion,
  verifyChain,
} from './dist/index.js';

const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`  ok    ${name}`);
  } else {
    console.log(`  FAIL  ${name}\n        esperado: ${expected}\n        obtenido: ${actual}`);
    failures.push(name);
  }
}

const V1 = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60';
const V2 = 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97';
const V3 = '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68';

const runtime =
  typeof Deno !== 'undefined'
    ? `Deno ${Deno.version.deno}`
    : typeof Bun !== 'undefined'
      ? `Bun ${Bun.version}`
      : `Node ${globalThis.process?.version ?? '?'}`;

console.log(`@verifactu-js/core — smoke test en ${runtime}`);

check(
  'vector oficial V1 (alta, primer registro)',
  await hashRegistroAlta({
    IDEmisorFactura: '89890001K',
    NumSerieFactura: '12345678/G33',
    FechaExpedicionFactura: '01-01-2024',
    TipoFactura: 'F1',
    CuotaTotal: '12.35',
    ImporteTotal: '123.45',
    Huella: null,
    FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
  }),
  V1,
);

check(
  'vector oficial V2 (alta, encadenada)',
  await hashRegistroAlta({
    IDEmisorFactura: '89890001K',
    NumSerieFactura: '12345679/G34',
    FechaExpedicionFactura: '01-01-2024',
    TipoFactura: 'F1',
    CuotaTotal: '12.35',
    ImporteTotal: '123.45',
    Huella: V1,
    FechaHoraHusoGenRegistro: '2024-01-01T19:20:35+01:00',
  }),
  V2,
);

check(
  'vector oficial V3 (anulacion)',
  await hashRegistroAnulacion({
    IDEmisorFacturaAnulada: '89890001K',
    NumSerieFacturaAnulada: '12345679/G34',
    FechaExpedicionFacturaAnulada: '01-01-2024',
    Huella: V2,
    FechaHoraHusoGenRegistro: '2024-01-01T19:20:40+01:00',
  }),
  V3,
);

// Web Crypto, Intl with longOffset, and the chain, end to end.
const instants = [
  new Date('2024-01-01T18:20:30Z'),
  new Date('2024-01-01T18:20:35Z'),
  new Date('2024-01-01T18:20:40Z'),
];
let tick = 0;
const chain = createSifChain({ timeZone: 'Europe/Madrid', now: () => instants[tick++] });

const alta1 = await chain.alta({
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345678/G33',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
  previous: null,
});
const alta2 = await chain.alta({
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345679/G34',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
  previous: alta1,
});
const anul = await chain.anulacion({
  IDEmisorFacturaAnulada: '89890001K',
  NumSerieFacturaAnulada: '12345679/G34',
  FechaExpedicionFacturaAnulada: '01-01-2024',
  previous: alta2,
});

check('cadena generada: huella 1', alta1.huella, V1);
check('cadena generada: huella 2', alta2.huella, V2);
check('cadena generada: huella 3', anul.huella, V3);
check('verifyChain acepta la cadena', (await verifyChain([alta1, alta2, anul])).ok, true);

// The Canary Islands trap: the offset must come from the instant and the IANA zone.
const canary = createSifChain({
  timeZone: 'Atlantic/Canary',
  now: () => new Date('2024-01-15T12:00:00Z'),
});
const invierno = await canary.alta({
  IDEmisorFactura: '89890001K',
  NumSerieFactura: 'C/1',
  FechaExpedicionFactura: '15-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '0.00',
  ImporteTotal: '0.00',
  previous: null,
});
check(
  'Atlantic/Canary en enero -> +00:00',
  invierno.fields.FechaHoraHusoGenRegistro,
  '2024-01-15T12:00:00+00:00',
);

const canaryVerano = createSifChain({
  timeZone: 'Atlantic/Canary',
  now: () => new Date('2024-07-15T12:00:00Z'),
});
const verano = await canaryVerano.alta({
  IDEmisorFactura: '89890001K',
  NumSerieFactura: 'C/2',
  FechaExpedicionFactura: '15-07-2024',
  TipoFactura: 'F1',
  CuotaTotal: '0.00',
  ImporteTotal: '0.00',
  previous: null,
});
check(
  'Atlantic/Canary en julio -> +01:00',
  verano.fields.FechaHoraHusoGenRegistro,
  '2024-07-15T13:00:00+01:00',
);

if (failures.length > 0) {
  console.log(`\n${failures.length} comprobacion(es) fallidas en ${runtime}`);
  if (typeof Deno !== 'undefined') Deno.exit(1);
  else if (typeof process !== 'undefined') process.exit(1);
  else throw new Error('smoke test failed');
} else {
  console.log(`\nTodo correcto en ${runtime}`);
}
