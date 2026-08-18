/**
 * Constants measured against the live service, with their provenance.
 *
 * Nada de este fichero está publicado por la AEAT. Todo sale de enviar registros reales contra
 * preproducción y leer lo que contestó, y por eso cada valor lleva pegado cuándo y dónde se midió:
 * un número sin procedencia es indistinguible de un número inventado, y estos gobiernan decisiones
 * que cuestan registros.
 *
 * El crudo está en `docs/probe-results/` y el análisis en `docs/spec-notes.md` §22.
 */

/**
 * How far `FechaHoraHusoGenRegistro` may sit from the AEAT's own clock: **240 seconds**.
 *
 * No aparece en F3, ni en F4, ni en el diccionario de datos. La AEAT lo interpola en el texto del
 * código 2004, que en el fichero de errores termina en dos puntos precisamente porque el número va
 * después:
 *
 * > «El valor del campo FechaHoraHusoGenRegistro debe ser la fecha actual del sistema de la AEAT,
 * > admitiéndose un margen de error de: 240 segundos.»
 *
 * Pasarse **no** rechaza el registro: lo acepta con error (`AceptadoConErrores`), lo almacena, y
 * obliga a subsanarlo después. Es de los peores resultados posibles, porque parece que ha ido bien.
 *
 * Dos consecuencias de diseño:
 *
 * 1. Una cola no puede sellar la fecha al encolar y enviar mucho más tarde. Cuatro minutos es poco
 *    margen para un reintento con espera.
 * 2. Un reloj de sistema mal sincronizado produce facturas defectuosas sin que salte nada.
 *    Comprobarlo antes de empezar vale más que cualquier reintento.
 *
 * Medido el 18/08/2026 en preproducción (sonda S-2, caso `offset-cero`). Es el valor que aplicaba
 * ese día: {@link desfaseDeReloj} lo usa como umbral por defecto, pero la respuesta real siempre
 * manda — si la AEAT lo cambia, lo dirá en `DescripcionErrorRegistro` antes que nosotros.
 */
export const MARGEN_RELOJ_AEAT_SEGUNDOS = 240;

/**
 * The `TiempoEsperaEnvio` the service asked for on every S-2 response: **60 seconds**.
 *
 * Es lo que hay que esperar entre envíos. Se documenta aquí solo como punto de partida razonable
 * cuando todavía no hay respuesta que leer: **el valor de la respuesta manda siempre**, y la AEAT
 * lo sube cuando quiere frenar a alguien.
 *
 * Medido el 18/08/2026 en preproducción, idéntico en las seis respuestas de S-2 (aceptadas y
 * rechazadas).
 */
export const TIEMPO_ESPERA_ENVIO_INICIAL_SEGUNDOS = 60;

/** How far the local clock sits from the AEAT's. */
export interface DesfaseReloj {
  /**
   * Local clock minus the AEAT's, in seconds. Positive means the local clock runs ahead.
   *
   * El signo importa: adelantado genera registros en el futuro, que es lo que disparó el 2004 en
   * S-2.
   */
  readonly segundos: number;
  /** Whether the gap fits inside {@link MARGEN_RELOJ_AEAT_SEGUNDOS}. */
  readonly dentroDelMargen: boolean;
  /** The threshold applied, so a caller can report it instead of hard-coding it again. */
  readonly margenSegundos: number;
  /** Qué pasa si se envía así, en castellano. `null` cuando no pasa nada. */
  readonly aviso: string | null;
}

/**
 * Compares the local clock against the AEAT's.
 *
 * La AEAT devuelve su propia hora en `DatosPresentacion.TimestampPresentacion` **en cada respuesta
 * aceptada**, así que esto se puede comprobar sin gastar nada extra: se envía un registro y de paso
 * se sabe si el reloj va bien. Para comprobarlo **antes** de enviar el primero, sirve la cabecera
 * `Date` de cualquier respuesta HTTP del host de la AEAT.
 *
 * @param instanteAeat - `TimestampPresentacion` de la respuesta, o cualquier instante del lado de
 *   la AEAT. Se aceptan `string` y `Date`.
 * @param ahora - El instante local. Parámetro para poder probarlo; en producción es `new Date()`.
 * @param margenSegundos - Umbral. Por defecto {@link MARGEN_RELOJ_AEAT_SEGUNDOS}, que es lo medido.
 *
 * @example
 * ```ts
 * const r = await cliente.enviar(remision);
 * const desfase = desfaseDeReloj(r.respuesta.DatosPresentacion?.TimestampPresentacion ?? '');
 * if (!desfase.dentroDelMargen) console.warn(desfase.aviso);
 * ```
 */
export function desfaseDeReloj(
  instanteAeat: Date | string,
  ahora: Date = new Date(),
  margenSegundos: number = MARGEN_RELOJ_AEAT_SEGUNDOS,
): DesfaseReloj {
  const aeat = instanteAeat instanceof Date ? instanteAeat.getTime() : Date.parse(instanteAeat);

  if (Number.isNaN(aeat)) {
    return {
      segundos: Number.NaN,
      dentroDelMargen: false,
      margenSegundos,
      aviso:
        'No se ha podido leer la hora de la AEAT, así que el desfase del reloj queda sin ' +
        'comprobar. No es que esté bien: es que no se sabe.',
    };
  }

  const segundos = Math.round((ahora.getTime() - aeat) / 1000);
  const dentroDelMargen = Math.abs(segundos) <= margenSegundos;

  if (dentroDelMargen) return { segundos, dentroDelMargen, margenSegundos, aviso: null };

  const sentido = segundos > 0 ? 'adelantado' : 'atrasado';
  return {
    segundos,
    dentroDelMargen,
    margenSegundos,
    aviso:
      `El reloj de esta máquina va ${Math.abs(segundos)} s ${sentido} respecto al de la AEAT, y ` +
      `el margen admitido son ${margenSegundos} s. Los registros que generes van a volver con el ` +
      'código 2004: la AEAT los ACEPTA y los almacena, pero con error, y hay que subsanarlos uno ' +
      'a uno. Sincroniza el reloj del sistema antes de seguir.',
  };
}
