/**
 * 3. Un envío real a preproducción, con la cola.
 *
 *     export VERIFACTU_P12=/ruta/certificado.p12
 *     export VERIFACTU_P12_PASS=...        # nunca como argumento: acabaría en el historial
 *     export VERIFACTU_NIF=...             # el real, del titular del certificado
 *     export VERIFACTU_NOMBRE=...
 *
 *     node 03-envio-preproduccion.mjs --enviar
 *
 * ESTE ES EL ÚNICO EJEMPLO QUE SALE A LA RED, y hay que pedírselo con `--enviar`. Manda **un
 * registro**, con tu NIF real, contra el entorno de pruebas de la AEAT. No es gratis: cuenta
 * dentro de tu cadena de pruebas y el RD 1007/2023 prohíbe expresamente las pruebas masivas.
 *
 * A producción no se puede apuntar. `crearClientePruebas` es lo único que hay, a propósito.
 */

import {
  cargarP12,
  crearClientePruebas,
  crearCola,
  explicarCodigo,
  transporteNode,
} from '@verifactu-js/client';
import { createSifChain } from '@verifactu-js/core';

const FALTAN = ['VERIFACTU_P12', 'VERIFACTU_P12_PASS', 'VERIFACTU_NIF', 'VERIFACTU_NOMBRE'].filter(
  (v) => !process.env[v],
);

if (FALTAN.length > 0) {
  console.error(`Faltan variables de entorno: ${FALTAN.join(', ')}`);
  console.error('Están explicadas en la cabecera de este fichero.');
  process.exit(2);
}

if (!process.argv.includes('--enviar')) {
  console.log('Esto envía UN registro real a preproducción con tu NIF. Si es lo que quieres:');
  console.log('\n  node 03-envio-preproduccion.mjs --enviar\n');
  process.exit(0);
}

const nif = process.env.VERIFACTU_NIF;
const nombre = process.env.VERIFACTU_NOMBRE;

const credenciales = await cargarP12(process.env.VERIFACTU_P12, process.env.VERIFACTU_P12_PASS);
const cliente = crearClientePruebas({
  transporte: transporteNode(credenciales),
  certificado: 'representante',
});

// La cola llama a la cadena por ti, en el momento del envío. Eso NO es un detalle de comodidad:
// FechaHoraHusoGenRegistro entra en la huella, así que un registro sellado al encolarlo envejece
// mientras espera, y re-sellarlo para ponerlo al día invalida toda la cadena que cuelgue detrás.
const cola = crearCola({
  cliente,
  cadena: createSifChain({ timeZone: 'Atlantic/Canary' }),
  cabecera: { ObligadoEmision: { NombreRazon: nombre, NIF: nif } },
  ultimoEslabon: null, // si continuases una cadena, aquí iría el último eslabón guardado
});

const hoy = new Date();
const fecha = [
  String(hoy.getDate()).padStart(2, '0'),
  String(hoy.getMonth() + 1).padStart(2, '0'),
  hoy.getFullYear(),
].join('-');

cola.encolar({
  tipo: 'alta',
  // Se encolan DATOS de factura, nunca un eslabón ya firmado. La cola rechaza lo segundo.
  factura: {
    IDEmisorFactura: nif,
    NumSerieFactura: `EJEMPLO-${Date.now()}`,
    FechaExpedicionFactura: fecha,
    TipoFactura: 'F1',
    CuotaTotal: '21.00',
    ImporteTotal: '121.00',
  },
  datos: {
    NombreRazonEmisor: nombre,
    DescripcionOperacion: 'EJEMPLO DEL TOOLKIT',
    Destinatarios: [{ NombreRazon: 'CLIENTE DE PRUEBA SL', NIF: 'B72877814' }],
    Desglose: [
      {
        ClaveRegimen: '01',
        CalificacionOperacion: 'S1',
        TipoImpositivo: '21',
        BaseImponibleOimporteNoSujeto: '100.00',
        CuotaRepercutida: '21.00',
      },
    ],
    SistemaInformatico: {
      NombreRazon: nombre,
      NIF: nif,
      NombreSistemaInformatico: 'VERIFACTU-JS',
      IdSistemaInformatico: 'VJ',
      Version: '0.1.0',
      // Una instalación distinta es una cadena distinta para la AEAT: separa por obligado + SIF.
      NumeroInstalacion: 'EJEMPLO-01',
      TipoUsoPosibleSoloVerifactu: 'S',
      TipoUsoPosibleMultiOT: 'N',
      IndicadorMultiplesOT: 'N',
    },
  },
});

console.log(`Enviando 1 registro a ${cliente.url}\n`);

const resultado = await cola.procesar();
const respuesta = resultado.envios[0]?.resultado.respuesta;

console.log(`EstadoEnvio        ${respuesta?.EstadoEnvio}`);
console.log(`CSV                ${respuesta?.CSV ?? '(ninguno)'}`);
console.log(`TiempoEsperaEnvio  ${respuesta?.TiempoEsperaEnvio} s`);
console.log(`Aceptados          ${resultado.aceptados}`);

for (const linea of respuesta?.RespuestaLinea ?? []) {
  console.log(`\n  ${linea.IDFactura.NumSerieFactura} -> ${linea.EstadoRegistro}`);
  if (linea.CodigoErrorRegistro !== undefined) {
    const e = explicarCodigo(linea.CodigoErrorRegistro);
    console.log(`  ${linea.CodigoErrorRegistro}  ${e?.texto ?? linea.DescripcionErrorRegistro}`);
    // Lo que de verdad hay que ramificar no es el código: es si el registro quedó ALMACENADO.
    console.log(`  ¿almacenado? ${e?.almacenado === true ? 'SÍ' : 'no'} — ${e?.accion ?? ''}`);
  }
}

// La AEAT devuelve su propia hora en cada respuesta aceptada, así que comprobar el reloj no
// cuesta ni un registro extra. La cola ya lo ha hecho por ti.
for (const aviso of resultado.avisos) console.log(`\nAVISO  ${aviso}`);

if (resultado.parada !== null) {
  console.log(`\nPARADA  ${resultado.parada.motivo}\n${resultado.parada.explicacion}`);
}

console.log('\nGuarda esto, que es lo que continúa la cadena:');
console.log(`  huella del último aceptado: ${resultado.ultimoEslabon?.huella ?? '(ninguno)'}`);
