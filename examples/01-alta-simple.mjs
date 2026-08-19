/**
 * 1. Un alta, de principio a fin.
 *
 *     node 01-alta-simple.mjs
 *
 * Enseña lo único que de verdad hay que entender de VERI*FACTU: **qué cadena exacta se hashea**.
 * Todo lo demás —el XML, el SOAP, el QR— es consecuencia de eso.
 *
 * No envía nada a la AEAT y no necesita certificado.
 */

import { buildRegistroAltaHashInput, createSifChain } from '@verifactu-js/core';
import { buildQrUrl } from '@verifactu-js/qr';

// La zona horaria es obligatoria y no tiene valor por defecto. No es un capricho: el huso que se
// escribe en el registro es el que usa el sistema EN ESE INSTANTE, y en Canarias no es el mismo
// que en la Península en ningún momento del año.
const cadena = createSifChain({ timeZone: 'Atlantic/Canary' });

// `previous: null` es lo que declara que este es el primer registro de la cadena. A partir de
// aquí, cada registro recibe el anterior y nadie tiene que llevar contadores.
const registro = await cadena.alta({
  IDEmisorFactura: '89890001K',
  NumSerieFactura: 'A/1',
  FechaExpedicionFactura: '19-08-2026',
  TipoFactura: 'F1',
  CuotaTotal: '21.00',
  ImporteTotal: '121.00',
  previous: null,
});

console.log('La cadena que se hashea, campo a campo:\n');
console.log(buildRegistroAltaHashInput(registro.fields));

console.log('\nY su SHA-256 en mayúsculas, que es la huella:\n');
console.log(registro.huella);

// ── Lo que hay que tener grabado ───────────────────────────────────────────────────────────────
//
// Nada de esa cadena va escapado. Ni el `&` que separa los campos, ni los caracteres raros de la
// serie. Está medido contra el servicio real: una serie con `&` vuelve `Correcto` y la AEAT
// calcula exactamente la misma huella.
//
// Y los importes entran TAL Y COMO SE ESCRIBAN. «121.00», «121.0» y «+121.00» son el mismo dinero
// y tres huellas distintas, las tres válidas. Por eso la librería obliga a pasar el importe ya
// serializado: para que sea imposible escribirlo de una forma en el XML y de otra en la huella.

const url = buildQrUrl(
  {
    nif: registro.fields.IDEmisorFactura,
    numserie: registro.fields.NumSerieFactura,
    fecha: registro.fields.FechaExpedicionFactura,
    importe: registro.fields.ImporteTotal,
  },
  { entorno: 'pruebas', modo: 'verificable' },
);

console.log('\nLa URL que va dentro del QR de la factura:\n');
console.log(url);

// Fíjate en que la huella NO está en el QR. A diferencia de TicketBAI, el código QR de VERI*FACTU
// no la lleva, así que un error de cálculo no se detecta al escanear: solo sale a la luz en una
// inspección, o cuando el receptor coteja y le dice «Factura no encontrada».
console.log('\nLa huella no viaja en el QR. Nadie te va a avisar si está mal.');
