/**
 * `doctor`: si esta máquina puede facturar bien.
 *
 * Lo que de verdad comprueba es el reloj, y por eso existe. El margen de la AEAT son 240 s
 * medidos, y pasarse **no rechaza** el registro: lo acepta, lo almacena y lo marca con error.
 * Un reloj desincronizado produce facturas defectuosas en silencio, todas.
 */
import { describe, expect, it } from 'vitest';

import { ejecutar } from '../src/index.js';
import { entornoFalso } from './ayuda.js';

describe('doctor', () => {
  it('devuelve 0 y no envía nada cuando todo está en orden', async () => {
    const io = entornoFalso({});

    const codigo = await ejecutar(['doctor'], io.entorno);

    expect(codigo).toBe(0);
    expect(io.salida()).toContain('reloj');
    // Una sola petición, sin cuerpo y sin certificado: comprobar la hora no cuesta un registro.
    expect(io.pedidas).toHaveLength(1);
    expect(io.pedidas[0]).toContain('aeat.es');
  });

  it('falla cuando el reloj se sale del margen medido, y dice el código que provocaría', async () => {
    const io = entornoFalso(
      {},
      // La AEAT dice que son las 10:00; aquí son las 10:08. Ocho minutos contra 240 s de margen.
      { ahora: () => new Date('2026-08-19T10:08:00Z') },
    );

    const codigo = await ejecutar(['doctor'], io.entorno);

    expect(codigo).toBe(1);
    expect(io.salida()).toContain('480');
    expect(io.salida()).toContain('2004');
  });

  it('no da el reloj por bueno cuando no ha podido comprobarlo', async () => {
    const io = entornoFalso(
      {},
      { respuesta: () => Promise.reject(new Error('getaddrinfo ENOTFOUND')) },
    );

    const codigo = await ejecutar(['doctor'], io.entorno);

    expect(codigo).toBe(1);
    // «No se sabe» no es «está bien», y decirlo así es la mitad del valor de este comando.
    expect(io.salida()).toContain('no se sabe');
  });

  it('tampoco lo da por bueno si la respuesta no trae la cabecera Date', async () => {
    const io = entornoFalso({}, { respuesta: () => Promise.resolve({ estado: 200, fecha: null }) });

    const codigo = await ejecutar(['doctor'], io.entorno);

    expect(codigo).toBe(1);
    expect(io.salida()).toContain('no se sabe');
  });

  it('avisa de que el servicio contesta algo raro, sin confundirlo con el reloj', async () => {
    const io = entornoFalso(
      {},
      { respuesta: () => Promise.resolve({ estado: 503, fecha: '2026-08-19T10:00:00Z' }) },
    );

    const codigo = await ejecutar(['doctor'], io.entorno);

    expect(codigo).toBe(1);
    expect(io.salida()).toContain('503');
  });

  it('falla con una versión de Node que el paquete no soporta', async () => {
    const io = entornoFalso({}, { versionNode: 'v18.19.0' });

    const codigo = await ejecutar(['doctor'], io.entorno);

    expect(codigo).toBe(1);
    expect(io.salida()).toContain('20');
  });

  it('no adivina la versión de Node cuando no puede interpretarla', async () => {
    const io = entornoFalso({}, { versionNode: 'desconocida' });

    const codigo = await ejecutar(['doctor'], io.entorno);

    expect(codigo).toBe(1);
    expect(io.salida()).toContain('no se sabe');
  });

  it('no da el reloj por bueno si la cabecera Date no es una fecha', async () => {
    const io = entornoFalso(
      {},
      { respuesta: () => Promise.resolve({ estado: 200, fecha: 'la hora de comer' }) },
    );

    const codigo = await ejecutar(['doctor'], io.entorno);

    expect(codigo).toBe(1);
    expect(io.salida()).toContain('no se sabe');
  });

  it('da el reloj por bueno con un desfase pequeño, y dice el signo', async () => {
    const io = entornoFalso({}, { ahora: () => new Date('2026-08-19T10:00:30Z') });

    const codigo = await ejecutar(['doctor'], io.entorno);

    expect(codigo).toBe(0);
    expect(io.salida()).toContain('+30 s');
  });

  it('con --json también informa de que algo va mal', async () => {
    const io = entornoFalso({}, { ahora: () => new Date('2026-08-19T10:08:00Z') });

    const codigo = await ejecutar(['doctor', '--json'], io.entorno);

    expect(codigo).toBe(1);
    const informe = JSON.parse(io.salida());
    expect(informe.ok).toBe(false);
    expect(
      informe.comprobaciones.find((c: { nombre: string }) => c.nombre === 'reloj').estado,
    ).toBe('fallo');
  });

  it('con --json escribe algo que otro programa puede leer', async () => {
    const io = entornoFalso({});

    const codigo = await ejecutar(['doctor', '--json'], io.entorno);

    expect(codigo).toBe(0);
    const informe = JSON.parse(io.salida());
    expect(informe.ok).toBe(true);
    expect(informe.comprobaciones.map((c: { nombre: string }) => c.nombre)).toContain('reloj');
  });
});

describe('la ayuda y los comandos que no existen', () => {
  it('sin argumentos enseña la ayuda y no falla', async () => {
    const io = entornoFalso({});

    const codigo = await ejecutar([], io.entorno);

    expect(codigo).toBe(0);
    expect(io.salida()).toContain('verifactu-js verify');
  });

  it('--help hace lo mismo', async () => {
    const io = entornoFalso({});

    expect(await ejecutar(['--help'], io.entorno)).toBe(0);
    expect(io.salida()).toContain('doctor');
  });

  it('un comando que no existe devuelve 2 y sugiere los que hay', async () => {
    const io = entornoFalso({});

    const codigo = await ejecutar(['enviar'], io.entorno);

    expect(codigo).toBe(2);
    expect(io.errores()).toContain('doctor');
  });
});

describe('cuando escribir falla', () => {
  it('no sale con 0 si se cierra la tubería a media escritura', async () => {
    // `node … | head -1` cierra la lectura y `process.stdout.write` lanza EPIPE. Salir con 0 ahí
    // haría que un script diera por buena una comprobación que no llegó a imprimirse.
    const errores: string[] = [];
    const entorno = {
      ...entornoFalso({}).entorno,
      escribir: () => {
        throw new Error('EPIPE: broken pipe');
      },
      escribirError: (linea: string) => errores.push(linea),
    };

    const codigo = await ejecutar(['doctor'], entorno);

    expect(codigo).toBe(2);
    expect(errores.join(' ')).toContain('inesperado');
  });

  it('sigue devolviendo 2 aunque tampoco se pueda escribir el error', async () => {
    const entorno = {
      ...entornoFalso({}).entorno,
      escribir: () => {
        throw new Error('EPIPE: broken pipe');
      },
      escribirError: () => {
        throw new Error('EPIPE: broken pipe');
      },
    };

    expect(await ejecutar(['doctor'], entorno)).toBe(2);
  });
});
