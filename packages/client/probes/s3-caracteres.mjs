/**
 * S-3 · caracteres en el número de serie (I-28) — **tres envíos**.
 *
 * | # | Qué va | Qué se espera |
 * |---|---|---|
 * | 1 | Alta con `&` en `NumSerieFactura` | `Correcto` — y es a la vez el **control positivo** |
 * | 2 | Alta con `=` en `NumSerieFactura` | `Incorrecto` — control negativo de F3 §3.1.3.1 |
 * | 3 | Anulación con `=` en `NumSerieFacturaAnulada` | **la pregunta abierta de §18.4** |
 *
 * El caso 1 hace de control positivo porque el `&` es una serie **legal** que `core` acepta sin
 * más: si ese no sale `Correcto`, el problema no es el carácter y los otros dos no se envían.
 * Y además es el caso importante por sí mismo — confirma que el `&` viaja sin escapar a la huella
 * y que la AEAT calcula lo mismo.
 *
 * ## Los casos 2 y 3 se saltan la validación de `core` a propósito
 *
 * `core` rechaza el `=` en la serie, que es lo correcto (F3 §3.1.3.1) y lo que hace inforjable la
 * cadena canónica. Para medir qué hace la AEAT hay que construir esas dos cadenas a mano y
 * hashearlas aquí. **Eso vive en este fichero, marcado, y no toca la librería.**
 *
 *   node packages/client/probes/s3-caracteres.mjs
 */

import { createSifChain } from '@verifactu-js/core';

import {
  cabecera,
  cliente,
  datos,
  enviarCaso,
  entorno,
  esperar,
  exigirControl,
  fechaDeExpedicion,
  sha256,
  sufijo,
} from './comun.mjs';

const { credenciales, nif, nombre } = await entorno();
const cli = cliente(credenciales);
const marca = sufijo();
const CAB = cabecera({ nif, nombre });

/** Una instalación de SIF por caso, para que ninguno arrastre un 2007. Ver comun.mjs. */
const datosDe = (caso) => datos({ nif, nombre, instalacion: `S3-${caso}-${marca}` });

// Misma zona que el huso del registro. Si salen de zonas distintas pueden discrepar en
// un día entero, que es la trampa de Canarias. Ver fechaDeExpedicion() en comun.mjs.
const fecha = fechaDeExpedicion(new Date(), 'Europe/Madrid');

console.log('S-3 · tres envíos. El primero (serie con «&») es legal y hace de control.\n');

// ── Caso 1: «&», serie legal. Control positivo y caso importante a la vez. ────────────────────
const conAmpersand = await createSifChain({ timeZone: 'Europe/Madrid' }).alta({
  IDEmisorFactura: nif,
  NumSerieFactura: `S3-A&B-${marca}`,
  FechaExpedicionFactura: fecha,
  TipoFactura: 'F1',
  CuotaTotal: '21.00',
  ImporteTotal: '121.00',
  previous: null,
});

console.log(`   serie: ${conAmpersand.fields.NumSerieFactura}`);
console.log(`   cadena canónica: …&NumSerieFactura=${conAmpersand.fields.NumSerieFactura}&Fecha…`);

const r1 = await enviarCaso(cli, 's3', 'ampersand-legal', {
  cabecera: CAB,
  registros: [{ eslabon: conAmpersand, datos: datosDe('ampersand') }],
});

exigirControl(r1);
console.log('\n   El «&» pasa. La AEAT calcula la misma huella con el separador sin escapar.\n');

const espera = Number(r1.tiempoEsperaEnvio ?? '60');

// ─────────────────────────────────────────────────────────────────────────────────────────────
// A partir de aquí se construye a mano lo que `core` se niega a construir.
// No es un atajo: es el objeto de la medición.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Cadena canónica del alta, tal y como la define F1 §3, sin pasar por las validaciones. */
function cadenaAlta(f) {
  return [
    `IDEmisorFactura=${f.IDEmisorFactura}`,
    `NumSerieFactura=${f.NumSerieFactura}`,
    `FechaExpedicionFactura=${f.FechaExpedicionFactura}`,
    `TipoFactura=${f.TipoFactura}`,
    `CuotaTotal=${f.CuotaTotal}`,
    `ImporteTotal=${f.ImporteTotal}`,
    `Huella=${f.Huella ?? ''}`,
    `FechaHoraHusoGenRegistro=${f.FechaHoraHusoGenRegistro}`,
  ].join('&');
}

/** Cadena canónica de la anulación (F1 §3, cinco campos con sufijo `Anulada`). */
function cadenaAnulacion(f) {
  return [
    `IDEmisorFacturaAnulada=${f.IDEmisorFacturaAnulada}`,
    `NumSerieFacturaAnulada=${f.NumSerieFacturaAnulada}`,
    `FechaExpedicionFacturaAnulada=${f.FechaExpedicionFacturaAnulada}`,
    `Huella=${f.Huella ?? ''}`,
    `FechaHoraHusoGenRegistro=${f.FechaHoraHusoGenRegistro}`,
  ].join('&');
}

const fechaHora = conAmpersand.fields.FechaHoraHusoGenRegistro;

// ── Caso 2: «=» en el alta. Control negativo: F3 §3.1.3.1 lo prohíbe. ─────────────────────────
await esperar(espera, 'TiempoEsperaEnvio de la AEAT');

const camposIgual = {
  IDEmisorFactura: nif,
  NumSerieFactura: `S3-A=B-${marca}`,
  FechaExpedicionFactura: fecha,
  TipoFactura: 'F1',
  CuotaTotal: '21.00',
  ImporteTotal: '121.00',
  Huella: null,
  FechaHoraHusoGenRegistro: fechaHora,
};

console.log(`\n   caso 2 · serie con «=»: ${camposIgual.NumSerieFactura}`);

let r2;
try {
  r2 = await enviarCaso(cli, 's3', 'igual-en-alta', {
    cabecera: CAB,
    registros: [
      {
        eslabon: {
          tipo: 'alta',
          fields: camposIgual,
          huella: sha256(cadenaAlta(camposIgual)),
          registroAnterior: null,
        },
        datos: datosDe('igual-alta'),
      },
    ],
  });
} catch (error) {
  r2 = { error: error.message };
}

// ── Caso 3: «=» en la anulación. La pregunta abierta. ─────────────────────────────────────────
await esperar(espera, 'TiempoEsperaEnvio de la AEAT');

const camposAnulacion = {
  IDEmisorFacturaAnulada: nif,
  NumSerieFacturaAnulada: `S3-ANU-A=B-${marca}`,
  FechaExpedicionFacturaAnulada: fecha,
  Huella: null,
  FechaHoraHusoGenRegistro: fechaHora,
};

console.log(`\n   caso 3 · anulación con «=»: ${camposAnulacion.NumSerieFacturaAnulada}`);
console.log('   va con SinRegistroPrevio="S": anula una factura que nunca existió.');

let r3;
try {
  r3 = await enviarCaso(cli, 's3', 'igual-en-anulacion', {
    cabecera: CAB,
    registros: [
      {
        eslabon: {
          tipo: 'anulacion',
          fields: camposAnulacion,
          huella: sha256(cadenaAnulacion(camposAnulacion)),
          registroAnterior: null,
        },
        datos: {
          SinRegistroPrevio: 'S',
          SistemaInformatico: datosDe('igual-anulacion').SistemaInformatico,
        },
      },
    ],
  });
} catch (error) {
  r3 = { error: error.message };
}

console.log(`\n${'='.repeat(78)}`);
console.table([
  { caso: '1 · & en alta (legal)', envio: r1.estadoEnvio, registro: r1.estadoRegistro, codigo: r1.codigoError ?? '—' },
  { caso: '2 · = en alta', envio: r2.estadoEnvio ?? '—', registro: r2.estadoRegistro ?? '—', codigo: r2.codigoError ?? '—' },
  { caso: '3 · = en anulación', envio: r3.estadoEnvio ?? '—', registro: r3.estadoRegistro ?? '—', codigo: r3.codigoError ?? '—' },
]);
console.log(
  '\nCómo se lee — S-1 nos dio los dos códigos que importan aquí:\n' +
    '  1130 → «El campo NumSerieFactura contiene caracteres no permitidos». Solo del alta.\n' +
    '  1287 → «El valor del campo %s contiene carácteres no validos (<, >, \", \', =)».\n' +
    '         GENÉRICO, y la AEAT sustituye %s por el nombre del campo infractor.\n' +
    '         Ese %s es literalmente la respuesta a §18.4.\n\n' +
    '  1 Correcto                → el «&» es inocuo y va sin escapar a la huella. Confirmado.\n' +
    '                              Nótese que la lista de 1287 NO incluye el «&».\n' +
    '  2 con 1130 o 1287         → F3 §3.1.3.1 está implementada, no solo escrita.\n' +
    '  3 con 1287 y %s = NumSerieFacturaAnulada → cierra §18.4: la restricción alcanza a la\n' +
    '                              anulación, y justifica lo que ya hace core.\n' +
    '  3 Correcto / con errores  → la restricción NO alcanza a la anulación. Entonces core es\n' +
    '                              más estricto que la AEAT ahí, y hay que decidir si se afloja.\n',
);
console.log('='.repeat(78));
