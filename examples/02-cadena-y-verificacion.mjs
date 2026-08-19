/**
 * 2. Una cadena de tres, y qué pasa cuando alguien la toca.
 *
 *     node 02-cadena-y-verificacion.mjs
 *
 * Es la razón de ser del proyecto. Una huella mal calculada **no produce rechazo**: la AEAT
 * acepta el registro, lo almacena y lo marca como «Aceptado con errores». Tu sistema parece
 * funcionar. Esto es lo que lo mira de verdad.
 *
 * No envía nada a la AEAT y no necesita certificado.
 */

import { createSifChain, verifyChain } from '@verifactu-js/core';

const cadena = createSifChain({ timeZone: 'Atlantic/Canary' });

// Cada registro recibe el anterior. Eso es todo el encadenado: no hay estado global, ni tablas
// obligatorias, ni contadores. Dónde guardes cada eslabón es cosa tuya.
const eslabones = [];
let previo = null;
for (const [i, serie] of ['A/1', 'A/2', 'A/3'].entries()) {
  previo = await cadena.alta({
    IDEmisorFactura: '89890001K',
    NumSerieFactura: serie,
    FechaExpedicionFactura: '19-08-2026',
    TipoFactura: 'F1',
    CuotaTotal: '21.00',
    ImporteTotal: `${100 + i}.00`,
    previous: previo,
  });
  eslabones.push(previo);
}

console.log('Tres registros encadenados:\n');
for (const [i, e] of eslabones.entries()) {
  console.log(`  ${i}  ${e.fields.NumSerieFactura}  ${e.huella.slice(0, 16)}…`);
}

const intacta = await verifyChain(eslabones);
console.log(`\nverifyChain sobre la cadena intacta: ${intacta.ok ? 'ÍNTEGRA' : 'ROTA'}`);

// ── Ahora alguien entra en la base de datos y cambia un importe ────────────────────────────────
//
// Sin recalcular nada, que es exactamente lo que haría: cambiar el número y salir. En el XML esto
// no se ve, la AEAT no lo rechaza y el QR tampoco lo delata.

const manipulada = eslabones.map((e, i) =>
  i === 1 ? { ...e, fields: { ...e.fields, ImporteTotal: '999.00' } } : e,
);

const resultado = await verifyChain(manipulada);

console.log(`\nDespués de tocar el importe del registro 1: ${resultado.ok ? 'ÍNTEGRA' : 'ROTA'}`);
console.log(`Se rompe en el registro ${resultado.brokenAt}.\n`);

for (const incidencia of resultado.issues) {
  console.log(`  registro ${incidencia.index} · ${incidencia.code}`);
  console.log(`    ${incidencia.message}`);
  if (incidencia.esperado !== undefined) console.log(`    esperado    ${incidencia.esperado}`);
  if (incidencia.encontrado !== undefined) console.log(`    encontrado  ${incidencia.encontrado}`);
}

console.log(
  '\nY no se arregla recalculando esa huella: la de cada registro es un campo del siguiente,\n' +
    'así que recalcular una invalida todas las que cuelgan detrás. Lo que hay que averiguar\n' +
    'es qué se alteró.',
);

console.log('\nLo mismo, desde la línea de comandos y sobre un fichero JSON:');
console.log('  npx @verifactu-js/cli verify cadena.json');
