/**
 * The measured constants and the clock check.
 *
 * Los números de `medido.ts` no vienen de ningún documento: vienen de haber enviado registros
 * reales. Estos tests los fijan para que un cambio de valor tenga que ser deliberado y venga con
 * su medición, en vez de colarse en un refactor.
 */
import { describe, expect, it } from 'vitest';

import {
  desfaseDeReloj,
  MARGEN_RELOJ_AEAT_SEGUNDOS,
  TIEMPO_ESPERA_ENVIO_INICIAL_SEGUNDOS,
} from '../src/index.js';

/** El `TimestampPresentacion` real de la respuesta de S-2, caso `huso-z`. */
const RELOJ_AEAT = '2026-08-18T17:21:06+02:00';

describe('las constantes medidas', () => {
  it('mantiene el margen de reloj en los 240 s que dijo la AEAT', () => {
    // Interpolado por ella misma en el texto del código 2004. No está publicado en ninguna parte.
    expect(MARGEN_RELOJ_AEAT_SEGUNDOS).toBe(240);
  });

  it('mantiene el TiempoEsperaEnvio inicial en los 60 s observados', () => {
    expect(TIEMPO_ESPERA_ENVIO_INICIAL_SEGUNDOS).toBe(60);
  });
});

describe('desfaseDeReloj', () => {
  it('no avisa cuando el reloj va bien', () => {
    const r = desfaseDeReloj(RELOJ_AEAT, new Date('2026-08-18T15:21:09Z'));

    expect(r.segundos).toBe(3);
    expect(r.dentroDelMargen).toBe(true);
    expect(r.aviso).toBeNull();
  });

  it('acepta un Date igual que una cadena', () => {
    const r = desfaseDeReloj(new Date('2026-08-18T15:21:06Z'), new Date('2026-08-18T15:21:06Z'));

    expect(r.segundos).toBe(0);
    expect(r.dentroDelMargen).toBe(true);
  });

  it('aguanta justo hasta el margen y avisa justo después', () => {
    const base = Date.parse(RELOJ_AEAT);

    expect(desfaseDeReloj(RELOJ_AEAT, new Date(base + 240_000)).dentroDelMargen).toBe(true);
    expect(desfaseDeReloj(RELOJ_AEAT, new Date(base + 241_000)).dentroDelMargen).toBe(false);
    // Y en el otro sentido: atrasarse cuenta igual.
    expect(desfaseDeReloj(RELOJ_AEAT, new Date(base - 241_000)).dentroDelMargen).toBe(false);
  });

  it('reproduce el caso que gastó un registro en S-2', () => {
    // El literal enviado fue 2026-08-18T17:19:06+00:00 mientras la AEAT marcaba ~15:24 UTC:
    // dos horas en el futuro. Volvió 2004.
    const r = desfaseDeReloj('2026-08-18T15:24:07Z', new Date('2026-08-18T17:19:06Z'));

    expect(r.segundos).toBe(6899);
    expect(r.dentroDelMargen).toBe(false);
    expect(r.aviso).toContain('adelantado');
    expect(r.aviso).toContain('2004');
  });

  it('distingue adelantado de atrasado, porque el signo importa', () => {
    const base = Date.parse(RELOJ_AEAT);

    expect(desfaseDeReloj(RELOJ_AEAT, new Date(base + 600_000)).aviso).toContain('adelantado');
    expect(desfaseDeReloj(RELOJ_AEAT, new Date(base - 600_000)).aviso).toContain('atrasado');
  });

  it('dice que no lo sabe cuando la hora de la AEAT no se puede leer', () => {
    // Callarse aquí sería decir «el reloj está bien» sin haberlo comprobado.
    const r = desfaseDeReloj('esto no es una fecha');

    expect(r.dentroDelMargen).toBe(false);
    expect(Number.isNaN(r.segundos)).toBe(true);
    expect(r.aviso).toContain('sin comprobar');
  });

  it('admite un margen distinto, porque el que manda es el de la respuesta', () => {
    const base = Date.parse(RELOJ_AEAT);
    const r = desfaseDeReloj(RELOJ_AEAT, new Date(base + 300_000), 600);

    expect(r.margenSegundos).toBe(600);
    expect(r.dentroDelMargen).toBe(true);
  });
});
