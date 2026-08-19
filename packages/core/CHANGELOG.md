# @verifactu-js/core

Las versiones siguen [semver](https://semver.org/lang/es/). Mientras el paquete esté en `0.x`, un
cambio incompatible sube la versión menor.

## 0.2.1 — 2026-08-19

- El error `IMPORTE_NO_SERIALIZADO` cita ahora las cuatro escrituras que la AEAT aceptó midiendo
  contra preproducción: `121.10`, `121.1`, `+121.00` y `-121.00`. La huella no es función del
  importe, es función de **cómo se escriba**, y ese error es donde alguien se entera.
- `author` en el `package.json`, que faltaba.

## 0.2.0 — 2026-08-17

Tres incógnitas de fecha, cerradas midiendo contra el servicio real. **Cambia comportamiento.**

- `FechaHoraHusoGenRegistro` rechaza las fracciones de segundo, el offset con segundos
  (`+02:00:00`) y el compacto (`+0200`): la AEAT devuelve 1244 en los tres casos.
- `Z` como designador de huso **es válido y hashable**. Se sigue emitiendo `±hh:mm` al generar,
  pero el modo de inspección ya no marca como rota una cadena histórica que lleve `Z`.
- `VEREDICTO_AEAT` recoge qué formas están medidas y cuáles no. Las que no lo están, no aparecen:
  ausencia no es aprobación.
- La canonicalización deja de tener `TODO(verify:)`. La AEAT **no colapsa** espacios interiores
  múltiples, **no normaliza** decimales antes de hashear y el signo entra tal cual.

## 0.1.1 — 2026-08-16

- Corrige el campo `repository` del `package.json`, que había salido con un marcador sin
  sustituir y dejaba la página de npm sin enlace al código. Las versiones de npm son inmutables,
  así que hubo que quemar una.

## 0.1.0 — 2026-08-16

Primera versión.

- Huella SHA-256 encadenada para alta y anulación, verificada contra los **tres vectores
  oficiales** de la AEAT más uno de terceros reproducido de forma independiente.
- `createSifChain()`: recibe el registro anterior y devuelve el siguiente. Sin estado global, sin
  tablas obligatorias, sin decidir dónde guardas nada.
- `verifyChain()`: detecta alteración, rotura y hueco en una cadena ya emitida.
- `formatFechaHoraHusoGenRegistro()` con zona horaria **obligatoria y sin valor por defecto**: el
  huso que se escribe es el que usa el sistema en ese instante, y en Canarias no coincide con el
  peninsular en ningún momento del año.
- `validateNif()`.
- Cero dependencias en runtime. Isomórfico sobre Web Crypto: Node, Bun, Deno, Workers y navegador.
