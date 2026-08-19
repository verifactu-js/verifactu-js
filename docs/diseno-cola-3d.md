# Diseño de la cola de envío (fase 3d)

> Escrito el 19/08/2026, **antes** de implementar nada, con lo medido en las sondas S-1, S-2 y
> S-2b. Cada restricción va con la medición de la que sale. Lo que no esté medido se dice que no
> lo está.
>
> El razonamiento largo está en [`spec-notes.md`](spec-notes.md) §22. Esto es el contrato que la
> implementación tiene que cumplir.

## R-1. La cadena se construye al enviar, no al encolar

**Es la restricción que da forma a todo lo demás**, y la que cualquiera descubriría en producción
a un coste alto.

`FechaHoraHusoGenRegistro` entra en la huella. Re-sellar un registro cambia su huella, y como la
huella de cada registro es un campo del siguiente, invalida toda la cadena que cuelgue detrás:

```
2026-08-19T12:00:00+02:00  →  6172DDF8744FEA88…
2026-08-19T12:05:00+02:00  →  F5AB113C5911A072…
```

Un registro encolado con su huella ya calculada es, a efectos prácticos, inmutable. Y la AEAT
compara ese sello contra **su propio reloj** con un margen de 240 s (R-3), así que un registro
correcto al generarse deja de serlo por el mero paso del tiempo.

**La cola guarda datos de factura. El sello, la huella y el eslabón se calculan justo antes de
abrir el socket.**

- La entrada de la cola es un `DatosAlta` / `DatosAnulacion` más su identificación, no un eslabón.
- `createSifChain(...).alta(...)` se invoca en el momento del envío, con el eslabón previo que de
  verdad se envió.
- La API no debe **poder** aceptar un eslabón ya firmado en la cola. Si lo acepta, alguien lo usará
  así, y el fallo que produce es silencioso (R-3).

> Medición: §22.9. Derivada de S-2 (caso `offset-cero`) y S-2b.

## R-2. La cola es estrictamente secuencial dentro de una cadena

Consecuencia directa de R-1: no se puede preparar el registro *n+1* sin la huella del *n*, y esa
huella no se conoce hasta haberlo enviado. **No hay paralelismo posible dentro de una cadena.**

No es una limitación de esta librería: es la forma del problema, y viene del RD 1007/2023.

Lo que sí puede ir en paralelo son **cadenas distintas**, que es lo mismo que decir sistemas
informáticos distintos: la AEAT las separa por obligado más SIF (código 2007, §21.8). Un
`NumeroInstalacion` distinto es una cadena distinta.

## R-3. Un registro puede envejecer fuera de plazo, y falla en silencio

Margen medido: **240 segundos** contra el reloj de la AEAT. No está publicado en ninguna parte; la
AEAT lo interpola en el texto del código 2004.

Lo peligroso es la categoría: **2004 es *aceptado con errores***. El registro queda almacenado,
cuenta a efectos del RD 1007/2023, y hay que subsanarlo uno a uno. No hay excepción ni rechazo.

La cola tiene que:

1. **Medir la antigüedad del sello antes de enviar**, y no enviar a ciegas un registro que ya se
   pasó. `desfaseDeReloj()` hace la resta.
2. **No re-sellarlo** para arreglarlo: eso rompe la cadena (R-1). Las salidas son enviarlo sabiendo
   que volverá 2004 y subsanarlo, o rehacer la cadena desde ese punto. La decisión es del usuario,
   no de la librería, pero la librería tiene que darle el dato.
3. **Comprobar el reloj de la máquina al arrancar.** Un reloj desincronizado produce facturas
   defectuosas en silencio, todas. Sale gratis: cada respuesta aceptada trae
   `DatosPresentacion.TimestampPresentacion`.

> Medición: §22.4 y §22.9. `MARGEN_RELOJ_AEAT_SEGUNDOS` en `packages/client/src/medido.ts`.

## R-4. La espera entre envíos la dicta la AEAT

`TiempoEsperaEnvio` vino como `60` en las siete respuestas medidas, **incluidas las rechazadas**.

- **El valor de la respuesta manda siempre.** La AEAT lo sube cuando quiere frenar a alguien.
- `TIEMPO_ESPERA_ENVIO_INICIAL_SEGUNDOS = 60` es solo el punto de partida cuando todavía no hay
  respuesta que leer.
- El campo es `\d{0,4}` en el XSD: máximo 9999 s, y **puede venir vacío**. Cadena vacía no es cero.

Con 60 s de espera y 240 s de margen, **cuatro esperas agotan la ventana de R-3**. La cola no puede
tratar la espera y la antigüedad como problemas separados.

> Medición: §22.5.

## R-5. Reintentar es solo para la ausencia de respuesta y los 5xx

Ningún código de la tabla de la AEAT es reintentable con la misma carga: llegan en un HTTP 200 bien
formado y volver a mandar lo mismo da lo mismo.

| Situación | ¿Reintentar? |
|---|---|
| No llegó respuesta (DNS, TLS, timeout, conexión cortada) | **Sí.** El envío no se registró |
| HTTP 5xx | **Sí** |
| HTTP 200 con código de error de datos | **No.** Corregir y reenviar es otra cosa |
| HTTP 200 con código técnico de la AEAT (13 códigos) | **Sí**, mismo lote sin tocar. `reenviable` |
| Código **4141** (acceso suspendido) | **Nunca.** Se resuelve escribiendo a la AEAT |
| Categoría `aceptado` (2xxx) | **Nunca.** Ya está almacenado; se subsana |

Y un reintento no es gratis respecto a R-3: cada espera consume ventana.

> Medición: §21.7. `explicarCodigo()` en `packages/client/src/errores-aeat.ts`.

## R-6. Un lote es un segmento contiguo de una sola cadena

Ya implementado en `@verifactu-js/xml` (`assertLoteContiguo`, `assertMismoObligado`,
`assertCardinalidad`). La cola no puede saltárselo:

- Máximo **1000** `RegistroFactura` por envío, altas y anulaciones juntas. La AEAT lo valida
  también en destino (códigos 4113 y 4114).
- Todos del mismo obligado.
- Contiguos y en orden.

## Lo que este documento NO decide

- **Persistencia.** Si la cola vive en memoria, en disco o en una base de datos es del usuario. La
  librería no elige almacenamiento.
- **Qué hacer ante un 2004.** Se le da el dato y decide.
- **Política de reintentos concreta** (número de intentos, factor de backoff). R-5 dice *cuándo* es
  legítimo reintentar, no *cuántas veces*.

## Pendiente de medir antes de dar la cola por buena

- **I-02, I-03, I-04, I-05** — sonda S-5. Bloquean declarar `core` estable (§12.2), y una cola
  sobre una huella que no cuadra no sirve de nada.
- **Comportamiento con `TiempoEsperaEnvio` vacío.** No lo hemos visto: las siete respuestas
  trajeron `60`. La cola tiene que tratar la cadena vacía como «no hay dato», nunca como cero.
- **Qué hace la AEAT ante dos envíos seguidos sin respetar la espera.** No se ha probado, y probarlo
  cuesta registros contra un NIF real.
