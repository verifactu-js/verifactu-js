/**
 * La cola de envío.
 *
 * Nada de aquí toca la red: el transporte es la costura y cada caso inyecta uno. La espera
 * también se inyecta, así que la suite no duerme ni un milisegundo aunque el contrato hable de
 * minutos.
 */
import { createSifChain, type SifChain } from '@verifactu-js/core';
import type { Cabecera, DatosAlta } from '@verifactu-js/validation';
import { NS_RESPUESTA_SUMINISTRO, NS_SUMINISTRO_INFORMACION } from '@verifactu-js/xml';
import { describe, expect, it } from 'vitest';

import {
  type Cola,
  crearClientePruebas,
  crearCola,
  type EntradaCola,
  esperaTrasRespuesta,
  type PeticionHttp,
  procedeReintentar,
  type Transporte,
  VerifactuClientError,
} from '../src/index.js';

const CABECERA: Cabecera = {
  ObligadoEmision: { NombreRazon: 'EMPRESA DE PRUEBA SL', NIF: '89890001K' },
};

const DATOS: DatosAlta = {
  NombreRazonEmisor: 'EMPRESA DE PRUEBA SL',
  DescripcionOperacion: 'PRESTACION DE SERVICIOS',
  Destinatarios: [{ NombreRazon: 'CLIENTE SL', NIF: 'B72877814' }],
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
    NombreRazon: 'PRODUCTORA SL',
    NIF: 'B72877814',
    NombreSistemaInformatico: 'VERIFACTU-JS',
    IdSistemaInformatico: 'VJ',
    Version: '0.1.0',
    NumeroInstalacion: 'INST-001',
    TipoUsoPosibleSoloVerifactu: 'S',
    TipoUsoPosibleMultiOT: 'N',
    IndicadorMultiplesOT: 'N',
  },
};

/** Una entrada de la cola: datos de factura, nunca un eslabón ya firmado. */
function entrada(serie: string): EntradaCola {
  return {
    tipo: 'alta',
    factura: {
      IDEmisorFactura: '89890001K',
      NumSerieFactura: serie,
      FechaExpedicionFactura: '19-08-2026',
      TipoFactura: 'F1',
      CuotaTotal: '21.00',
      ImporteTotal: '121.00',
    },
    datos: DATOS,
  };
}

/** Una respuesta con tantas líneas como registros llevaba el lote, en su mismo orden. */
function respuesta(
  estados: readonly string[],
  estadoEnvio?: string,
  timestampAeat?: string,
): string {
  const global =
    estadoEnvio ??
    (estados.every((e) => e === 'Incorrecto')
      ? 'Incorrecto'
      : estados.every((e) => e !== 'Incorrecto')
        ? 'Correcto'
        : 'ParcialmenteCorrecto');

  const lineas = estados
    .map(
      (estado, i) =>
        '<sfR:RespuestaLinea>' +
        '<sfR:IDFactura><sf:IDEmisorFactura>89890001K</sf:IDEmisorFactura>' +
        `<sf:NumSerieFactura>A/${i + 1}</sf:NumSerieFactura>` +
        '<sf:FechaExpedicionFactura>19-08-2026</sf:FechaExpedicionFactura></sfR:IDFactura>' +
        '<sfR:Operacion><sf:TipoOperacion>Alta</sf:TipoOperacion></sfR:Operacion>' +
        `<sfR:EstadoRegistro>${estado}</sfR:EstadoRegistro>` +
        (estado === 'Correcto' ? '' : '<sfR:CodigoErrorRegistro>1130</sfR:CodigoErrorRegistro>') +
        '</sfR:RespuestaLinea>',
    )
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<sfR:RespuestaRegFactuSistemaFacturacion xmlns:sfR="${NS_RESPUESTA_SUMINISTRO}" xmlns:sf="${NS_SUMINISTRO_INFORMACION}">` +
    '<sfR:CSV>ABCD1234</sfR:CSV>' +
    (timestampAeat === undefined
      ? ''
      : '<sfR:DatosPresentacion><sf:NIFPresentador>89890001K</sf:NIFPresentador>' +
        `<sf:TimestampPresentacion>${timestampAeat}</sf:TimestampPresentacion>` +
        '</sfR:DatosPresentacion>') +
    '<sfR:Cabecera><sf:ObligadoEmision><sf:NombreRazon>EMPRESA DE PRUEBA SL</sf:NombreRazon>' +
    '<sf:NIF>89890001K</sf:NIF></sf:ObligadoEmision></sfR:Cabecera>' +
    '<sfR:TiempoEsperaEnvio>60</sfR:TiempoEsperaEnvio>' +
    `<sfR:EstadoEnvio>${global}</sfR:EstadoEnvio>` +
    lineas +
    '</sfR:RespuestaRegFactuSistemaFacturacion>'
  );
}

/** Centinela: el guion pide con esto que el transporte no conteste nada. */
const SIN_RESPUESTA = '\u0000sin-respuesta';

/** Cuántos registros llevaba un cuerpo, contando los `IDVersion` que escribe cada uno. */
function registrosEn(cuerpo: string): number {
  return cuerpo.split('<sf:IDVersion>').length - 1;
}

/** Banco de pruebas: reloj movible, espera instantánea y transporte guionizado. */
function banco(guion?: (peticion: PeticionHttp, n: number) => string) {
  const peticiones: PeticionHttp[] = [];
  const dormidas: number[] = [];
  let instante = new Date('2026-08-19T10:00:00Z');

  const transporte: Transporte = async (peticion) => {
    peticiones.push(peticion);
    const cuerpo = guion
      ? guion(peticion, peticiones.length)
      : respuesta(new Array(registrosEn(peticion.cuerpo)).fill('Correcto'));
    // `SIN_RESPUESTA` es exactamente lo que levanta `transporteNode` cuando no llega nada:
    // el guion lo pide con un centinela para no tener que exponer otra costura.
    if (cuerpo === SIN_RESPUESTA) {
      throw new VerifactuClientError({
        code: 'SIN_RESPUESTA',
        message: 'No llegó respuesta.',
        causaProbable: 'Simulado.',
        accionSugerida: 'Simulado.',
      });
    }
    return { estado: 200, cabeceras: {}, cuerpo };
  };

  const cadena: SifChain = createSifChain({ timeZone: 'Europe/Madrid', now: () => instante });

  function cola(extra: Record<string, unknown> = {}): Cola {
    return crearCola({
      cliente: crearClientePruebas({ transporte, certificado: 'representante' }),
      cadena,
      cabecera: CABECERA,
      ahora: () => instante,
      esperar: async (ms) => {
        dormidas.push(ms);
        instante = new Date(instante.getTime() + ms);
      },
      ...extra,
    });
  }

  return {
    cola,
    peticiones,
    dormidas,
    avanzar(segundos: number) {
      instante = new Date(instante.getTime() + segundos * 1000);
    },
  };
}

describe('R-4 · la espera la dicta la AEAT', () => {
  it('trata TiempoEsperaEnvio vacío como «no hay dato», nunca como cero', () => {
    expect(esperaTrasRespuesta({ TiempoEsperaEnvio: '' }, 90)).toBe(90);
  });

  it('el valor de la respuesta manda sobre el que traíamos', () => {
    expect(esperaTrasRespuesta({ TiempoEsperaEnvio: '120' }, 60)).toBe(120);
  });

  it('no se cree un valor que no sea un número: se queda con el que tenía', () => {
    expect(esperaTrasRespuesta({ TiempoEsperaEnvio: 'pronto' }, 60)).toBe(60);
  });

  it('un cero explícito SÍ se respeta: es un dato, no una ausencia', () => {
    // La distinción de R-4 es entre «vacío» y «cero», no entre «cero» y «lo demás». Nunca hemos
    // visto un cero; si llega, manda la AEAT. Ignorarlo sería inventarnos comportamiento.
    expect(esperaTrasRespuesta({ TiempoEsperaEnvio: '0' }, 60)).toBe(0);
  });

  it('descarta un valor negativo, que el XSD no puede producir', () => {
    expect(esperaTrasRespuesta({ TiempoEsperaEnvio: '-5' }, 60)).toBe(60);
  });

  it('descarta un valor fuera del máximo del esquema (9999)', () => {
    expect(esperaTrasRespuesta({ TiempoEsperaEnvio: '99999' }, 60)).toBe(60);
  });
});

describe('R-5 · reintentar es solo para la ausencia de respuesta y los 5xx', () => {
  it('reintenta cuando no llegó respuesta: el envío no se registró', () => {
    expect(procedeReintentar({ tipo: 'sin-respuesta' }).reintentar).toBe(true);
  });

  it('reintenta un 500: es del servicio, no del lote', () => {
    expect(procedeReintentar({ tipo: 'http', estado: 503 }).reintentar).toBe(true);
  });

  it('no reintenta un 4xx: reenviar lo mismo da lo mismo', () => {
    expect(procedeReintentar({ tipo: 'http', estado: 400 }).reintentar).toBe(false);
  });

  it('reintenta un código técnico de la AEAT, mismo lote sin tocar', () => {
    expect(procedeReintentar({ tipo: 'codigo', codigo: '4103' }).reintentar).toBe(true);
  });

  it('no reintenta un error de datos', () => {
    expect(procedeReintentar({ tipo: 'codigo', codigo: '1130' }).reintentar).toBe(false);
  });

  it('no reintenta nunca un 2xxx: el registro YA está almacenado', () => {
    const decision = procedeReintentar({ tipo: 'codigo', codigo: '2000' });
    expect(decision.reintentar).toBe(false);
    expect(decision.motivo).toContain('almacenado');
  });

  it('no reintenta nunca un 4141: el acceso está suspendido y se resuelve escribiendo', () => {
    const decision = procedeReintentar({ tipo: 'codigo', codigo: '4141' });
    expect(decision.reintentar).toBe(false);
  });
});

describe('R-1 · la cadena se construye al enviar, no al encolar', () => {
  it('sella con la hora del envío, no con la del encolado', async () => {
    const b = banco();
    const cola = b.cola();
    cola.encolar(entrada('A/1'));

    // Media hora en la cola: lo que le pasa a cualquiera que encole por la mañana y envíe por la
    // tarde. El sello tiene que ser el de AHORA, no el de cuando se encoló.
    b.avanzar(30 * 60);
    await cola.procesar();

    expect(b.peticiones[0]?.cuerpo).toContain('2026-08-19T12:30:00+02:00');
    expect(b.peticiones[0]?.cuerpo).not.toContain('2026-08-19T12:00:00+02:00');
  });

  it('no deja meter en la cola un eslabón ya firmado', () => {
    const cola = banco().cola();
    const conEslabon = {
      ...entrada('A/1'),
      factura: { ...entrada('A/1').factura, previous: null },
    } as unknown as EntradaCola;

    expect(() => cola.encolar(conEslabon)).toThrowError(VerifactuClientError);
  });
});

describe('R-2 · estrictamente secuencial dentro de una cadena', () => {
  it('se niega a procesar dos veces a la vez', async () => {
    const b = banco();
    const cola = b.cola();
    cola.encolar(entrada('A/1'), entrada('A/2'));

    const primera = cola.procesar();
    await expect(cola.procesar()).rejects.toThrowError(VerifactuClientError);
    await primera;
  });

  it('encadena el segundo lote sobre la huella del primero', async () => {
    const b = banco();
    const cola = b.cola({ tamanoLote: 1 });
    cola.encolar(entrada('A/1'), entrada('A/2'));

    const resultado = await cola.procesar();

    const huellaPrimero = /<sf:Huella>([0-9A-F]{64})<\/sf:Huella>/.exec(
      b.peticiones[0]?.cuerpo ?? '',
    )?.[1];
    expect(huellaPrimero).toBeDefined();
    expect(b.peticiones[1]?.cuerpo).toContain(`<sf:Huella>${huellaPrimero}</sf:Huella>`);
    expect(resultado.aceptados).toBe(2);
  });

  it('espera entre lotes lo que dijo la AEAT, y nunca antes del primer envío', async () => {
    const b = banco();
    const cola = b.cola({ tamanoLote: 1 });
    cola.encolar(entrada('A/1'), entrada('A/2'));

    await cola.procesar();

    expect(b.dormidas).toEqual([60_000]);
  });
});

describe('R-6 · un lote es un segmento contiguo, de 1 a 1000', () => {
  it('parte la cola en lotes del tamaño pedido', async () => {
    const b = banco();
    const cola = b.cola({ tamanoLote: 2 });
    cola.encolar(entrada('A/1'), entrada('A/2'), entrada('A/3'));

    const resultado = await cola.procesar();

    expect(b.peticiones).toHaveLength(2);
    expect(registrosEn(b.peticiones[0]?.cuerpo ?? '')).toBe(2);
    expect(registrosEn(b.peticiones[1]?.cuerpo ?? '')).toBe(1);
    expect(resultado.aceptados).toBe(3);
  });

  it('no deja pedir un lote de más de 1000', () => {
    expect(() => banco().cola({ tamanoLote: 1001 })).toThrowError(VerifactuClientError);
  });

  it('no deja pedir un lote vacío', () => {
    expect(() => banco().cola({ tamanoLote: 0 })).toThrowError(VerifactuClientError);
  });
});

describe('la cadena avanza solo hasta donde la AEAT almacenó', () => {
  it('para en el registro rechazado y deja el resto en la cola', async () => {
    const b = banco(() => respuesta(['Correcto', 'Incorrecto', 'Correcto']));
    const cola = b.cola({ tamanoLote: 3 });
    cola.encolar(entrada('A/1'), entrada('A/2'), entrada('A/3'));

    const resultado = await cola.procesar();

    // El tercero volvió «Correcto», pero cuelga de una huella que la AEAT no tiene almacenada:
    // darlo por bueno sería dar por buena una cadena rota.
    expect(resultado.aceptados).toBe(1);
    expect(resultado.pendientes).toBe(2);
    expect(b.peticiones).toHaveLength(1);
    expect(resultado.parada?.motivo).toBe('REGISTRO_RECHAZADO');
  });

  it('«AceptadoConErrores» hace avanzar la cadena: el registro ESTÁ almacenado', async () => {
    const b = banco(() => respuesta(['AceptadoConErrores']));
    const cola = b.cola();
    cola.encolar(entrada('A/1'));

    const resultado = await cola.procesar();

    expect(resultado.aceptados).toBe(1);
    expect(resultado.pendientes).toBe(0);
    expect(resultado.parada).toBeNull();
  });

  it('un envío rechazado entero no mueve la cadena', async () => {
    const b = banco(() => respuesta(['Incorrecto'], 'Incorrecto'));
    const cola = b.cola();
    cola.encolar(entrada('A/1'));

    const resultado = await cola.procesar();

    expect(resultado.aceptados).toBe(0);
    expect(resultado.ultimoEslabon).toBeNull();
    expect(resultado.pendientes).toBe(1);
  });
});

describe('R-5 · reintentar sin re-sellar', () => {
  it('reintenta el MISMO lote, byte a byte, cuando no llegó respuesta', async () => {
    const b = banco((_p, n) => (n === 1 ? SIN_RESPUESTA : respuesta(['Correcto'])));
    const cola = b.cola();
    cola.encolar(entrada('A/1'));

    const resultado = await cola.procesar();

    expect(b.peticiones).toHaveLength(2);
    // Idéntico: si se hubiera re-sellado, el reloj avanzó 60 s con la espera y el sello sería otro.
    expect(b.peticiones[1]?.cuerpo).toBe(b.peticiones[0]?.cuerpo);
    expect(resultado.aceptados).toBe(1);
  });

  it('no reintenta un error de datos: reenviar lo mismo daría lo mismo', async () => {
    const b = banco(() => respuesta(['Incorrecto'], 'Incorrecto'));
    const cola = b.cola();
    cola.encolar(entrada('A/1'));

    await cola.procesar();

    expect(b.peticiones).toHaveLength(1);
  });
});

describe('R-3 · el sello envejece, y cuatro esperas agotan la ventana', () => {
  it('deja de reintentar cuando el sello se saldría de los 240 s', async () => {
    const b = banco(() => SIN_RESPUESTA);
    const cola = b.cola({ reintentos: 20 });
    cola.encolar(entrada('A/1'));

    const resultado = await cola.procesar();

    // 60 s de espera contra 240 s de margen: el primer envío y cuatro reintentos. El sexto
    // llevaría 300 s de antigüedad y volvería 2004, que la AEAT ACEPTA y almacena con error.
    expect(b.peticiones).toHaveLength(5);
    expect(resultado.parada?.motivo).toBe('SELLO_CADUCADO');
    expect(resultado.parada?.explicacion).toContain('2004');
    expect(resultado.pendientes).toBe(1);
  });

  it('informa de lo que costó el envío y de la antigüedad del sello que llegó', async () => {
    const b = banco((_p, n) => (n === 1 ? SIN_RESPUESTA : respuesta(['Correcto'])));
    const cola = b.cola();
    cola.encolar(entrada('A/1'));

    const resultado = await cola.procesar();

    // Un solo envío llegó a producir respuesta, y costó dos intentos. El sello que la AEAT vio
    // llevaba ya 60 s encima: es el dato que dice cuánta ventana de los 240 s queda gastada.
    expect(resultado.envios).toHaveLength(1);
    expect(resultado.envios[0]?.intentos).toBe(2);
    expect(resultado.envios[0]?.antiguedadSelloSegundos).toBe(60);
  });
});

describe('R-3 · el reloj de la máquina se comprueba con lo que devuelve la AEAT', () => {
  it('avisa cuando el reloj local se sale del margen medido', async () => {
    // La AEAT dice que son las 10:00:00Z; aquí el reloj marca 10:00:00Z + nada, pero su sello
    // dice 09:52, así que vamos 8 minutos adelantados respecto a ella.
    const b = banco(() => respuesta(['Correcto'], undefined, '2026-08-19T09:52:00Z'));
    const cola = b.cola();
    cola.encolar(entrada('A/1'));

    const resultado = await cola.procesar();

    expect(resultado.envios[0]?.desfaseReloj?.dentroDelMargen).toBe(false);
    expect(resultado.envios[0]?.desfaseReloj?.segundos).toBe(480);
    expect(resultado.avisos.join(' ')).toContain('2004');
  });

  it('no avisa de nada cuando el reloj cuadra', async () => {
    const b = banco(() => respuesta(['Correcto'], undefined, '2026-08-19T10:00:00Z'));
    const cola = b.cola();
    cola.encolar(entrada('A/1'));

    const resultado = await cola.procesar();

    expect(resultado.envios[0]?.desfaseReloj?.dentroDelMargen).toBe(true);
    expect(resultado.avisos).toEqual([]);
  });

  it('no se inventa un desfase cuando la respuesta no trae la hora de la AEAT', async () => {
    const b = banco();
    const cola = b.cola();
    cola.encolar(entrada('A/1'));

    const resultado = await cola.procesar();

    expect(resultado.envios[0]?.desfaseReloj).toBeUndefined();
    expect(resultado.avisos).toEqual([]);
  });
});
