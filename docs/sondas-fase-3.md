# Plan de sondas contra preproducción — fase 3

> **Estado: S-1 y S-2 hechas (6 registros). Pendientes: S-2b, S-3 y S-4.**
>
> Redactado el 18/08/2026, corregido el mismo día con las observaciones al diseño experimental, y
> **corregido otra vez tras S-1**: la tabla de códigos obligó a cambiar cómo se aíslan las cadenas
> (§21.8 de `spec-notes.md`) y convirtió varias lecturas de inferencia en literales.

## Las reglas, antes que nada

1. **Solo `prewww1.aeat.es` y `prewww2.aeat.es`.** Nunca producción. El cliente no tiene forma de
   apuntar a producción: `crearClientePruebas` es la única fábrica que existe.
2. **Diez registros en total, en diez envíos.** Uno por variable medida, más los controles
   positivos. No hay bucles, ni repeticiones, ni reintentos automáticos.
   Cada serie lleva **sufijo de marca temporal**: un reintento tras un fallo de red no puede
   chocar con una serie ya almacenada y volver como `RegistroDuplicado`, que parecería un hallazgo
   sin serlo.
3. **Se para a la primera sorpresa.** Si una sonda devuelve algo que el plan no contempla, se
   detiene todo y se analiza antes de seguir. No se «prueba otra cosa a ver».
4. **NIF real, del titular del certificado.** F4 §4.1: «Todos los NIFs se tienen que validar contra
   la "Base de Datos Centralizada de la AEAT"». El NIF ficticio de la documentación (`89890001K`)
   no sirve en `ObligadoEmision`.
5. Los envíos de preproducción **no tienen efecto fiscal**: «se guardan en una Base de Datos del
   entorno de pruebas de la AEAT, sin que en ningún caso tengan trascendencia tributaria».
6. ⚠️ **La AEAT prohíbe expresamente las pruebas masivas en preproducción.** Diez registros
   puntuales es exactamente lo contrario de eso, y por eso el número está fijado por escrito aquí
   en vez de dejarse al criterio de quien ejecute.

Cada registro va en **su propia cadena**, como `PrimerRegistro`, con un `NumSerieFactura` distinto.
Así una rechazada no arrastra a las demás y cada resultado se lee solo.

**Y con su propia `NumeroInstalacion`**, que es la corrección que obligó a hacer S-1. El código
**2007** («No debe informarse como primer registro, existen facturas emitidas con el obligado
emisión y el sistema informático actual») haría que, tras el primer caso, todos los demás
volvieran con 2007. Como `CodigoErrorRegistro` es `maxOccurs="1"` —un código por registro— ese
2007 taparía al 2000, que es justo lo que S-2 mide. El diccionario de datos de la AEAT dice que
`NumeroInstalacion` sirve precisamente para distinguir instalaciones «pasadas, presentes o
futuras […] incluso aunque en dichas instalaciones se emplee el mismo SIF de un productor», así
que cada caso es legítimamente una instalación distinta. Detalle completo en `spec-notes.md`
§21.8.

---

## S-1 · `errores.properties` (I-15) — **0 registros** · ✅ HECHA

**No es un envío.** Es una descarga autenticada con el certificado contra `prewww2.aeat.es`, el
mismo host de donde ya salieron los XSD y el WSDL.

- **Qué mide:** la tabla completa código → mensaje, que hoy no tenemos. F3 describe validaciones,
  no la tabla.
- **Por qué va primero:** es gratis, no envía nada, y **es lo que hace interpretables las demás**.
  Sin ella, un rechazo es un número; con ella, es una frase.

**Resultado (18/08/2026):** HTTP 200, 25 232 bytes, **247 códigos** en tres secciones.
`sha256 06519ceb…d5902`. Guardada sin modificar en `docs/reference/AEAT_errores.properties` y
compilada en `@verifactu-js/client`. Análisis completo en `spec-notes.md` §21.

Y valió para más de lo previsto: descubrió que el fichero es **ISO-8859-1**, no UTF-8, que la
primera descarga lo había destruido al decodificarlo mal, y que el transporte del cliente tenía el
mismo fallo latente sobre respuestas que **no se pueden volver a pedir**. Ver §21.1.

---

## S-2 · Formato de `FechaHoraHusoGenRegistro` (I-07, I-08, I-09) — **6 registros**

Seis altas idénticas salvo por el literal de la fecha. Seis series distintas, seis envíos.

**El caso 1 es el control positivo y puede abortar la sonda.** Lo genera `createSifChain()` tal
cual, sin tocarle la fecha: es el formato que la librería da por bueno. Si no vuelve `Correcto`,
los otros cinco **no se envían**. Cinco rechazos seguidos sin control serían ilegibles —no se
sabría si falla el formato de fecha o el sobre, la cabecera, el certificado o el NIF— y habrían
costado cinco registros contra un NIF real.

| # | `FechaHoraHusoGenRegistro` | Incógnita | Qué se espera |
|---|---|---|---|
| 1 | generado por la librería | **control positivo** | `Correcto`. Si no, se para y se avisa |
| 2 | `…T10:00:00.123+01:00` | I-07 | ¿Admite fracciones de segundo? ¿Y entran en la huella? |
| 3 | `…T10:00:00Z` | I-08 | ¿Admite `Z` donde el huso es cero, o exige `+00:00`? |
| 4 | `…T10:00:00+01:00:00` | I-09 | Offset con segundos: `xs:dateTime` lo permite |
| 5 | `…T10:00:00+0100` | I-09 | Offset sin dos puntos: `xs:dateTime` **no** lo permite |
| 6 | `…T10:00:00+00:00` | I-08 | Contraste del caso 3: el mismo huso cero, escrito como toca |

La huella de cada uno se calcula sobre su propio literal. **S-1 convirtió la lectura de esta
sonda en literal**, porque la tabla trae el código exacto:

| Código | Texto oficial | Qué significa |
|---|---|---|
| — (`Correcto`) | | La AEAT calculó la misma huella. Formato válido |
| **2000** | El cálculo de la huella suministrada es incorrecta. | **Admitió el literal pero hasheó otra cosa: normalizó la fecha antes de hashear.** El hallazgo que se busca |
| 1244 | El campo FechaHoraHusoGenRegistro tiene un formato incorrecto. | Rechazo por forma, sin llegar a la huella |
| 1268 | La longitud del campo FechaHoraHusoGenRegistro no cumple con las especificaciones. | Rechazo por **tamaño**. Distinto de 1244 y muy probable en los casos de offset |
| 4102 | El XML no cumple el esquema. | Lo paró el XSD, antes de las validaciones de negocio |
| 2007 | No debe informarse como primer registro… | **No mide nada de esto.** Significa que la AEAT no separa cadenas por `NumeroInstalacion`; ese caso queda sin medir |

Antes había que inferir «AceptadoConErrores ⇒ recalculó otra huella». Ya no: el código lo dice.

### Resultado (18/08/2026)

| Caso | Literal | Envío | Registro | Código |
|---|---|---|---|:--:|
| control | `2026-08-18T17:19:06+02:00` | Correcto | **Correcto** | — |
| fracción | `2026-08-18T17:19:06.123+02:00` | Incorrecto | Incorrecto | **1244** |
| huso Z | `2026-08-18T15:21:06Z` | Correcto | **Correcto** | — |
| offset con segundos | `2026-08-18T17:19:06+02:00:00` | Incorrecto | Incorrecto | **1244** |
| offset sin dos puntos | `2026-08-18T17:19:06+0200` | Incorrecto | Incorrecto | **1244** |
| offset cero | `2026-08-18T17:19:06+00:00` | ParcialmenteCorrecto | AceptadoConErrores | **2004** |

**I-07 e I-09 cerradas:** el offset es exactamente `±hh:mm`, y las fracciones se rechazan. La
mitigación de fase 1 era correcta y se mantiene.

**I-08, el hallazgo grande:** `Z` volvió `Correcto`, luego la AEAT calculó **la misma huella sobre
ese literal**. Si hubiera normalizado `Z` a `+00:00` antes de hashear habría contestado 2000. No lo
hizo. Queda medido que **la AEAT no normaliza el `xs:dateTime` antes de calcular la huella**, que
era el miedo de fondo de las tres incógnitas.

**I-08 sigue abierta en su parte importante**, y por un fallo de diseño de la propia sonda. Ver
S-2b. Análisis completo en `spec-notes.md` §22.

**Dos constantes medidas que no están publicadas en ningún sitio:** el margen de reloj de la AEAT
son **240 s** (interpolado por ella en el texto del 2004), y `TiempoEsperaEnvio` fue **60 s** en las
seis respuestas.

La 5 debería morir en validación estructural (el XSD), no en la huella. Sirve para confirmar que el
XSD se aplica de verdad antes que las validaciones de negocio.

---

## S-2b · `+00:00` explícito (I-08, lo que queda) — **1 registro**

El caso `offset-cero` de S-2 estaba mal construido y midió otra cosa. Llevaba **dos** defectos
independientes, y cualquiera bastaba para estropearlo:

1. **Cambió el instante, no la forma de escribirlo.** Sustituía el sufijo dejando la hora de pared:
   `17:19:06+02:00` → `17:19:06+00:00`. Eso mueve el momento dos horas al futuro. Se envió 17:19:06
   UTC cuando la AEAT marcaba 15:24 UTC.
2. **El literal venía del control, ya rancio.** Las cinco variantes derivaban del literal generado
   al principio, y entre envíos se esperan 60 s. `offset-cero` salió **301 s** después de la hora
   que llevaba escrita — fuera del margen de 240 s incluso sin el defecto anterior.

Volvió **2004**, que mide desfase de reloj y no validez de `+00:00`. Los dos defectos están
arreglados en `s2-fechas.mjs`; esta sonda repite **solo ese caso**.

**Qué se envía:** un alta con el instante de *ahora mismo* escrito con offset cero
(`2026-08-18T15:19:06+00:00`), `NumeroInstalacion` nueva. Es el caso de **Canarias en invierno**,
que es lo que `formatFechaHoraHusoGenRegistro` emite allí.

**Comprueba el reloj antes de gastar el registro**, leyendo la cabecera `Date` de un host de la
AEAT: cero envíos. Si está fuera de margen, no envía nada y lo dice.

| Respuesta | Lectura |
|---|---|
| `Correcto` | **I-08 cerrada.** `+00:00` vale y se hashea tal cual |
| `2000` | Normalizó antes de hashear. **Contradiría** lo medido con `Z`: parar y revisar |
| `1244` | La AEAT exige `Z` para huso cero. Habría que cambiar lo que genera `core` |
| `2004` | **No mide nada.** Reloj desfasado: sincronizar y repetir |
| `2007` | **No mide nada.** La AEAT no separa cadenas por `NumeroInstalacion` |

---

## S-3 · Caracteres en el número de serie (I-28) — **3 registros**

| # | Qué se envía | Qué se espera | Por qué importa |
|---|---|---|---|
| 1 | Alta con `&` en `NumSerieFactura` | `Correcto` | **Control positivo**, porque el `&` es una serie legal que `core` acepta. Y a la vez el caso importante: confirma que va sin escapar a la huella y la AEAT calcula lo mismo |
| 2 | Alta con `=` en `NumSerieFactura` | `Incorrecto` | Control negativo. Confirma que F3 §3.1.3.1 está implementada y no solo escrita |
| 3 | Anulación con `=` en `NumSerieFacturaAnulada` | ? | **La pregunta abierta de §18.4:** la restricción está documentada solo para el alta |

Si el caso 1 no sale `Correcto`, los otros dos no se envían: el problema no sería el carácter.

Los casos 2 y 3 **tienen que saltarse la validación de `core`**, que rechaza el `=` a propósito.
El script construye esas dos cadenas canónicas a mano y las hashea directamente, y eso queda
aislado en el script, marcado, y no toca la librería.

El 3 va con `SinRegistroPrevio: 'S'`: anula una factura que nunca existió, que es la forma de
probar la anulación sin dar de alta nada antes.

**S-1 hace esta sonda mucho más precisa.** La tabla trae:

> **1287** = El valor del campo `%s` contiene carácteres no validos (`<`, `>`, `"`, `'`, `=`).

Dos cosas. La lista de prohibidos es literal y **el `&` no está en ella**, lo que confirma por
escrito lo que §18 de `spec-notes.md` sostenía por diseño. Y ese `%s` lo rellena la AEAT con el
**nombre del campo infractor**: el caso 3 no devolverá un sí/no, devolverá el nombre del campo, y
con eso **§18.4 queda cerrada en un solo envío**. Existe además `1130`, específico de
`NumSerieFactura` en el alta.

---

## S-4 · `RemisionVoluntaria` + `RemisionRequerimiento` (D-16) — **1 registro**

Una cabecera con los dos bloques a la vez. El XSD lo admite; F3 §3.1.1 los hace excluyentes.

**Esta sonda no es limpia, y conviene saberlo antes de ejecutarla.** `RefRequerimiento` «deberá
existir en la AEAT» y no tenemos ninguno real, así que un rechazo puede significar dos cosas:

- que los dos bloques son incompatibles (lo que se quiere medir), o
- que la referencia de requerimiento no existe (ruido).

**Solo es interpretable con S-1 hecha** — y S-1 ya está hecha, así que sí puede concluir:

| Código | Lectura |
|---|---|
| **4126** «RefRequerimiento solo debe informarse en… la contestación a requerimientos» | **D-16 confirmada.** Gana F3 sobre el XSD |
| **4127** «la remisión voluntaria solo debe informarse en sistemas VERIFACTU» | **D-16 confirmada** |
| 4122 / 4133 / 4125 (valor incorrecto / no alfanumérico / obligatorio) | **NO CONCLUYENTE.** Rechazó la referencia inventada antes de mirar la combinación |
| cualquier otro | **NO CONCLUYENTE** |

4126 aporta además algo que F3 no dice con esa claridad: la exclusión va por **endpoint**, no solo
por cabecera. Si el código no permite distinguir, se anota como no concluyente y D-16 sigue
abierta — no se fuerza una conclusión.

---

## Resumen

| Sonda | Envíos | Registros | Incógnitas |
|---|:--:|:--:|---|
| S-1 `errores.properties` ✅ | 0 | 0 | I-15 **cerrada** |
| S-2 fechas ✅ | 6 | 6 | I-07 **cerrada**, I-09 **cerrada**, I-08 a medias |
| S-2b `+00:00` | 1 | 1 | I-08, lo que queda |
| S-3 caracteres | 3 | 3 | I-28 |
| S-4 cabecera | 1 | 1 | D-16 |
| **Total** | **11** | **11** | |

**Orden y paradas:** S-1 ✅ → *parada, tabla de códigos* ✅ → S-2 ✅ → *parada, las tres
incógnitas* ✅ → **S-2b** → S-3 → S-4.

El total sube de 10 a 11 registros: el envío de más es el reintento de I-08, y sale de un fallo de
diseño de S-2, no de un cambio de alcance.

Entre envío y envío se respeta el `TiempoEsperaEnvio` que devuelva la propia AEAT. Con el valor
inicial documentado (60 s), los diez envíos ocupan unos diez minutos.

## Lo que NO se envía

- Nada a producción.
- Ningún lote de más de un registro.
- Ninguna repetición del mismo caso «por si acaso».
- Ningún barrido de valores: cada sonda cambia **una** variable.
- Ningún dato de un tercero. Los destinatarios son el propio NIF o datos inventados de un
  destinatario que no existe.

## Qué se guarda de cada sonda

En `docs/probe-results/`, por caso:

- `*.request.xml` — el sobre enviado, **en crudo**.
- `*.response.xml` — el cuerpo recibido, **en crudo**, antes de parsear.
- `*.json` — estado HTTP, `EstadoEnvio`, `EstadoRegistro`, **`CodigoErrorRegistro`**,
  `DescripcionErrorRegistro`, CSV, `TiempoEsperaEnvio` y duración. Desde S-1, también la
  **categoría** del código y si el registro **quedó almacenado**, sacados del mapa del cliente:
  dentro de seis meses «2007» no le dirá nada a nadie y estos ficheros tienen que poder releerse
  sin la tabla al lado.

Y en **crudo** quiere decir bytes: S-1 guarda `.bin` antes de decodificar nada, porque su primera
ejecución decodificó mal y perdió el original de forma irreversible.

El **código** de error, no solo el estado: es lo que se contrasta con `errores.properties` y lo
único que puede desempatar S-4.

La carpeta está en `.gitignore`. Las peticiones llevan el NIF y el nombre reales del titular del
certificado —F4 §4.1 obliga a que lo sean— y este repositorio es público. Quitar el ignore es una
línea; despublicar un NIF no.

## Cómo se ejecutan

```bash
pnpm build

export VERIFACTU_P12=/ruta/certificado.p12
export VERIFACTU_P12_PASS=...        # nunca como argumento: acabaría en el historial
export VERIFACTU_NIF=...             # el real, del titular del certificado
export VERIFACTU_NOMBRE=...

pnpm --filter @verifactu-js/client probe:s1   # 0 envíos. PARADA.
pnpm --filter @verifactu-js/client probe:s2   # 6 envíos. PARADA.
pnpm --filter @verifactu-js/client probe:s2b  # 1 envío  (reintento de I-08)
pnpm --filter @verifactu-js/client probe:s3   # 3 envíos
pnpm --filter @verifactu-js/client probe:s4   # 1 envío
```
