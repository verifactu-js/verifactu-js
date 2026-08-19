/**
 * `verify`: coger una cadena que ya existe y decir si las huellas cuadran.
 *
 * Nada aquí toca el disco ni la red: el entorno es la costura y cada caso inyecta el suyo.
 */
import { createSifChain, type Eslabon } from '@verifactu-js/core';
import { describe, expect, it } from 'vitest';

import { ejecutar } from '../src/index.js';
import { entornoFalso } from './ayuda.js';

/** Tres altas encadenadas, como las guardaría cualquier sistema. */
async function tresEslabones(): Promise<Eslabon[]> {
  const cadena = createSifChain({
    timeZone: 'Europe/Madrid',
    now: () => new Date('2026-08-19T10:00:00Z'),
  });

  const eslabones: Eslabon[] = [];
  let previo: Eslabon | null = null;
  for (const serie of ['A/1', 'A/2', 'A/3']) {
    const eslabon: Eslabon = await cadena.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: serie,
      FechaExpedicionFactura: '19-08-2026',
      TipoFactura: 'F1',
      CuotaTotal: '21.00',
      ImporteTotal: '121.00',
      previous: previo,
    });
    eslabones.push(eslabon);
    previo = eslabon;
  }
  return eslabones;
}

describe('verify', () => {
  it('devuelve 0 cuando la cadena está entera', async () => {
    const io = entornoFalso({ 'cadena.json': JSON.stringify(await tresEslabones()) });

    const codigo = await ejecutar(['verify', 'cadena.json'], io.entorno);

    expect(codigo).toBe(0);
    expect(io.salida()).toContain('3 registros');
  });

  it('devuelve 1 y señala el registro exacto cuando alguien tocó un importe', async () => {
    const eslabones = await tresEslabones();
    // Se cambia el importe del segundo registro sin recalcular su huella, que es exactamente lo
    // que hace quien manipula una base de datos a mano.
    const manipulada = eslabones.map((e, i) =>
      i === 1 ? { ...e, fields: { ...e.fields, ImporteTotal: '999.00' } } : e,
    );
    const io = entornoFalso({ 'cadena.json': JSON.stringify(manipulada) });

    const codigo = await ejecutar(['verify', 'cadena.json'], io.entorno);

    expect(codigo).toBe(1);
    expect(io.salida()).toContain('HUELLA_NO_COINCIDE');
    expect(io.salida()).toContain('1');
  });

  it('devuelve 2 cuando no se dice qué fichero verificar', async () => {
    const io = entornoFalso({});

    const codigo = await ejecutar(['verify'], io.entorno);

    expect(codigo).toBe(2);
    expect(io.errores()).toContain('fichero');
  });

  it('explica que el fichero no existe en vez de reventar', async () => {
    const io = entornoFalso({});

    const codigo = await ejecutar(['verify', 'no-esta.json'], io.entorno);

    expect(codigo).toBe(2);
    expect(io.errores()).toContain('no-esta.json');
  });

  it('explica que el JSON no es una lista de registros', async () => {
    const io = entornoFalso({ 'cadena.json': '{"registros": []}' });

    const codigo = await ejecutar(['verify', 'cadena.json'], io.entorno);

    expect(codigo).toBe(2);
    expect(io.errores()).toContain('lista');
  });

  it('explica que el fichero no es JSON, sin tragarse el error', async () => {
    const io = entornoFalso({ 'cadena.json': 'esto no es json' });

    const codigo = await ejecutar(['verify', 'cadena.json'], io.entorno);

    expect(codigo).toBe(2);
    expect(io.errores()).toContain('JSON');
  });

  it('dice que la cadena está vacía en vez de darla por buena', async () => {
    const io = entornoFalso({ 'cadena.json': '[]' });

    const codigo = await ejecutar(['verify', 'cadena.json'], io.entorno);

    expect(codigo).toBe(1);
    expect(io.salida()).toContain('CADENA_VACIA');
  });

  it('dice qué trae el fichero cuando no es ni un objeto', async () => {
    const io = entornoFalso({ 'cadena.json': '42' });

    const codigo = await ejecutar(['verify', 'cadena.json'], io.entorno);

    expect(codigo).toBe(2);
    expect(io.errores()).toContain('un number');
  });

  it('con --json también informa de una cadena rota', async () => {
    const io = entornoFalso({ 'cadena.json': '[]' });

    const codigo = await ejecutar(['verify', 'cadena.json', '--json'], io.entorno);

    expect(codigo).toBe(1);
    expect(JSON.parse(io.salida()).ok).toBe(false);
  });

  it('con --json escribe algo que otro programa puede leer', async () => {
    const io = entornoFalso({ 'cadena.json': JSON.stringify(await tresEslabones()) });

    const codigo = await ejecutar(['verify', 'cadena.json', '--json'], io.entorno);

    expect(codigo).toBe(0);
    expect(JSON.parse(io.salida())).toMatchObject({ ok: true, registros: 3, incidencias: [] });
  });
});
