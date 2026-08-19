/**
 * S-4 · `RemisionVoluntaria` + `RemisionRequerimiento` a la vez (D-16) — **un envío**.
 *
 * El XSD declara los dos bloques como opcionales independientes y admite los dos juntos. F3 §3.1.1
 * los hace excluyentes: `FechaFinVeriFactu` e `Incidencia` solo para sistemas que emiten facturas
 * verificables, `RefRequerimiento` solo —y obligatorio— para los que emiten no verificables.
 *
 * ## Esta sonda puede no concluir nada, y hay que estar dispuesto a anotarlo
 *
 * `RefRequerimiento` «deberá existir en la AEAT» y no tenemos ninguna real. Un rechazo puede
 * significar dos cosas distintas:
 *
 *   a) los dos bloques son incompatibles  ← lo que se quiere medir
 *   b) esa referencia de requerimiento no existe  ← ruido
 *
 * Solo se distinguen mirando el **código** de error contra `errores.properties` (S-1). Si el
 * código no permite separarlas, el resultado es **NO CONCLUYENTE** y así se anota. No se fuerza
 * una lectura: una conclusión inventada aquí acabaría en `spec-notes.md` como si fuera un hecho.
 *
 * Va la última porque es la que menos aporta y la única que puede quedarse sin respuesta.
 *
 *   node packages/client/probes/s4-cabecera.mjs
 */

import { createSifChain } from '@verifactu-js/core';
import { parsearRespuesta, SOAP_ACTION, SOAP_CONTENT_TYPE, serializarSobreSoap } from '@verifactu-js/xml';

import { transporteNode } from '@verifactu-js/client';

import { cliente, datos, entorno, fechaDeExpedicion, guardar, sufijo } from './comun.mjs';

const { credenciales, nif, nombre } = await entorno();
const cli = cliente(credenciales);
const marca = sufijo();
const DAT = datos({ nif, nombre, instalacion: `S4-cabecera-${marca}` });

// Misma zona que el huso del registro. Si salen de zonas distintas pueden discrepar en
// un día entero, que es la trampa de Canarias. Ver fechaDeExpedicion() en comun.mjs.
const fecha = fechaDeExpedicion(new Date(), 'Europe/Madrid');

const eslabon = await createSifChain({ timeZone: 'Europe/Madrid' }).alta({
  IDEmisorFactura: nif,
  NumSerieFactura: `S4-CAB-${marca}`,
  FechaExpedicionFactura: fecha,
  TipoFactura: 'F1',
  CuotaTotal: '21.00',
  ImporteTotal: '121.00',
  previous: null,
});

// `writeCabecera` rechaza esta combinación a propósito (CABECERA_INCOHERENTE), así que la sonda
// tiene que construirla saltándose esa comprobación. Igual que en S-3: el objeto de la medición
// es precisamente lo que la librería se niega a emitir.
const cabeceraIncoherente = {
  ObligadoEmision: { NombreRazon: nombre, NIF: nif },
  RemisionVoluntaria: { Incidencia: 'N' },
  RemisionRequerimiento: { RefRequerimiento: `REQ-SONDA-${marca}`.slice(0, 18) },
};

console.log('S-4 · un envío. Cabecera con los dos bloques de circunstancias a la vez.\n');
console.log(`   RefRequerimiento inventada: ${cabeceraIncoherente.RemisionRequerimiento.RefRequerimiento}`);
console.log('   Recuerda: si el código de error no distingue exclusión de referencia inexistente,');
console.log('   el resultado es NO CONCLUYENTE.\n');

// De paso, esto comprueba que la librería sigue rechazándola. Si algún día dejara de hacerlo, la
// sonda lo dice en vez de enviar en silencio algo que creíamos imposible de construir.
try {
  serializarSobreSoap({ cabecera: cabeceraIncoherente, registros: [{ eslabon, datos: DAT }] });
  console.error('   ⚠ La librería ha dejado construir la cabecera incoherente. Eso es un fallo suyo.');
  process.exitCode = 1;
} catch (error) {
  if (error.code !== 'CABECERA_INCOHERENTE') throw error;
  console.log(`   ✔ La librería la rechaza como debe: ${error.code}. La sonda se lo salta a mano.`);
}

// Se emite el documento correcto y se le inyecta el bloque que falta, en la posición que manda
// el XSD: RemisionVoluntaria antes que RemisionRequerimiento, ambos tras ObligadoEmision.
const documentoValido = serializarSobreSoap({
  cabecera: {
    ObligadoEmision: cabeceraIncoherente.ObligadoEmision,
    RemisionVoluntaria: cabeceraIncoherente.RemisionVoluntaria,
  },
  registros: [{ eslabon, datos: DAT }],
});

const conLosDos = documentoValido.replace(
  '</sfLR:Cabecera>',
  `<sf:RemisionRequerimiento><sf:RefRequerimiento>${cabeceraIncoherente.RemisionRequerimiento.RefRequerimiento}</sf:RefRequerimiento></sf:RemisionRequerimiento></sfLR:Cabecera>`,
);

if (conLosDos === documentoValido) throw new Error('No se ha podido inyectar RemisionRequerimiento.');

// `cliente.enviar()` serializa por su cuenta, y aquí el documento ya está construido y manipulado.
// Así que este único caso va por el transporte directamente, a la misma URL de preproducción.
const enviar = transporteNode(credenciales);
let resultado;
let error;

try {
  const http = await enviar({
    url: cli.url,
    metodo: 'POST',
    cabeceras: { 'Content-Type': SOAP_CONTENT_TYPE, SOAPAction: SOAP_ACTION },
    cuerpo: conLosDos,
    timeoutMs: 60_000,
  });

  const respuesta = parsearRespuesta(http.cuerpo);
  resultado = {
    peticion: conLosDos,
    cuerpoRespuesta: http.cuerpo,
    estadoHttp: http.estado,
    duracionMs: 0,
    respuesta,
  };
} catch (e) {
  error = e;
}

const base = await guardar('s4', 'dos-bloques', { peticion: conLosDos, resultado, error });

console.log(`\n${'='.repeat(78)}`);
if (resultado === undefined) {
  console.log(`S-4 · sin respuesta legible: ${error?.message}`);
} else {
  const linea = resultado.respuesta.RespuestaLinea[0];
  console.log(`HTTP ${resultado.estadoHttp} · envío ${resultado.respuesta.EstadoEnvio}`);
  console.log(`registro ${linea?.EstadoRegistro ?? '—'} · código ${linea?.CodigoErrorRegistro ?? '—'}`);
  console.log(`«${linea?.DescripcionErrorRegistro ?? ''}»`);
  console.log(
    '\nS-1 ya nos dio los códigos que desempatan esto, así que la sonda SÍ puede concluir:\n\n' +
      '  4126 → «RefRequerimiento solo debe informarse en… la contestación a requerimientos»\n' +
      '  4127 → «la remisión voluntaria solo debe informarse en sistemas VERIFACTU»\n' +
      '         Cualquiera de los dos: D-16 CONFIRMADA, los bloques son excluyentes y gana F3\n' +
      '         sobre el XSD. Y 4126 dice algo que no sabíamos: la exclusión va por ENDPOINT,\n' +
      '         no solo por cabecera.\n\n' +
      '  4122 → «el valor del campo RefRequerimiento es incorrecto»\n' +
      '  4133 → «el valor del campo RefRequerimiento no es alfanumérico»\n' +
      '  4125 → «Si el envío es por requerimiento el campo RefRequerimiento es obligatorio»\n' +
      '         Cualquiera de estos: NO CONCLUYENTE. Ha rechazado la referencia inventada\n' +
      '         antes de mirar la combinación de bloques. D-16 sigue abierta.\n\n' +
      '  cualquier otro código → NO CONCLUYENTE. No lo fuerces: una conclusión inventada aquí\n' +
      '         acabaría en spec-notes.md como si fuera un hecho.',
  );
}
console.log(`guardado en ${base}.{request,response}.xml`);
console.log('='.repeat(78));
