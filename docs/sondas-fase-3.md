# Plan de sondas contra preproducción — fase 3

> **Estado: S-1, S-2, S-2b, S-3, S-4 y 2 de los 7 casos de S-5 hechas (13 registros).**
> **Cerradas: I-07, I-08, I-09, I-15, I-28, D-16 e I-02.** Quedan I-03, I-04 e I-05.
> I-01 degradada, y ahora con una medición que la respalda (§24.2).
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

**I-08 quedó abierta en su parte importante** por un fallo de diseño de la propia sonda, y la
cerró S-2b. Análisis completo en `spec-notes.md` §22.

**Dos constantes medidas que no están publicadas en ningún sitio:** el margen de reloj de la AEAT
son **240 s** (interpolado por ella en el texto del 2004), y `TiempoEsperaEnvio` fue **60 s** en las
seis respuestas.

La 5 debería morir en validación estructural (el XSD), no en la huella. Sirve para confirmar que el
XSD se aplica de verdad antes que las validaciones de negocio.

---

## S-2b · `+00:00` explícito (I-08) — **1 registro** · ✅ HECHA

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

### Resultado (19/08/2026)

```
literal: 2026-08-18T23:36:50+00:00
huella:  35EC18A6A88B268E0E8BFB08E240A666B6F011904D4B9211F3EBDBFA78484C75
→ envío Correcto · registro Correcto · CSV A-T5BLBWD7HKASYZ
```

**I-08 cerrada.** `+00:00` explícito vale, y se hashea tal cual. Las dos formas del huso cero se
aceptan por igual, y no son intercambiables: literales distintos, huellas distintas, las dos
correctas.

La comprobación de reloj previa se validó a sí misma: la cabecera `Date` del host estático dio 0 s
y el `TimestampPresentacion` del servicio SOAP dio 0 s también. Un solo punto de datos, pero dice
que los dos relojes van juntos.

---

## S-3 · Caracteres en el número de serie (I-28) — **3 registros** · ✅ HECHA

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

## S-4 · `RemisionVoluntaria` + `RemisionRequerimiento` (D-16) — **1 registro** · ✅ HECHA

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

---

## S-5 · Las cuatro que bloquean el estable (I-01…I-05) — **7 registros** · ⏸ 2 de 7

> **Aprobada en principio. No enviada.** Va después de S-3 y S-4.

Cada caso es un alta con un literal deliberadamente dudoso, hasheado como lo haría `core`. La
lectura es **binaria y la da el código**, gracias a la tabla de S-1:

- **`Correcto`** → la AEAT calculó la misma huella sobre ese literal. No normaliza.
- **`2000`** → «El cálculo de la huella suministrada es incorrecta». Normalizó antes de hashear.
  Es *aceptado con errores*: el registro **queda almacenado** y hay que subsanarlo.

Cualquier otro código no mide la huella y se anota como tal, sin interpretar.

### Los seis casos

| # | Incógnita | Qué se envía | `Correcto` significa | `2000` significa |
|---|---|---|---|---|
| 1 ✅ | **I-01** | `NumSerieFactura` con NBSP (`U+00A0`) al final | — | — |
| 2 ✅ | **I-02** | `NumSerieFactura` con dos espacios interiores | Los conserva | Los colapsa a uno |
| 3 | **I-03** | `NumSerieFactura` con `é` en NFD (`e` + `U+0301`) | **Admite no-ASCII** y no normaliza | Admite no-ASCII y normaliza a NFC |

**Resultado de los dos primeros (19/08/2026).** El caso 2 volvió `Correcto`: **I-02 cerrada**, la
AEAT conserva los espacios interiores múltiples. El caso 1 volvió **1130** —«contiene caracteres no
permitidos»—, así que el NBSP se rechaza antes de llegar a la huella y **I-01 no queda medida**;
lo que sí queda es que el juego de caracteres de la serie es más estrecho que la lista de 1287.
Ver §24.

**El caso 3 cambia de pregunta.** `core` restringe la serie a ASCII 32-126, y esa es la única vía
por la que texto libre entra en una huella. Si la AEAT restringe igual, I-03 es inalcanzable por
construcción como I-01. Si **no** restringe, `core` es más estricto que la AEAT y estaría
rechazando series legales con `Ñ` o acentos. Esa es ahora la pregunta primaria.
| 4 | **I-04** | `ImporteTotal` = `121.10` — **control positivo del par** | La forma que emite `core` cuadra | **PARA**: el problema no son los decimales |
| 5 | **I-04** | `ImporteTotal` = `121.1`, el mismo importe | Hashea el literal dado | Normaliza a dos decimales |
| 6 | **I-05** | `ImporteTotal` con `+` explícito: `+121.00` | Conserva el signo en la cadena | Lo quita al recalcular |
| 7 | **I-05** | Rectificativa por diferencias, importes negativos | El `-` entra en la huella tal cual | Otra cosa |

**I-04 va en par, y ese es el cambio respecto al plan anterior.** Un solo caso con `121.1` distingue
«hashea el literal» de «normaliza», pero no dice nada si falla por otro motivo. Con `121.10` delante
—la forma que emite `core`— hay control positivo: si ese no cuadra, el problema no son los decimales
y el segundo caso no mediría nada. Y juntos contestan la pregunta de fondo de F1, que es **cómo**
consigue la AEAT que `123.1` y `123.10` sean «igualmente válidos»: aceptándolos como cadenas
distintas, o normalizándolos a una.

**El caso 1 no cierra I-01 aunque salga `Correcto`.** I-01 ya está degradada (§12.2) porque el
diseño la vuelve inalcanzable; medirla es información, no desbloqueo. Va porque cuesta un registro
y porque afecta a la **verificación** de cadenas ajenas, que sí pueden llevar esos caracteres.

### Cuáles se saltan la validación de `core`, y por qué

| # | ¿Se salta? | Motivo |
|---|:--:|---|
| 1 | **sí** | `core` lanza `ESPACIO_AMBIGUO_EN_BORDE` sobre el NBSP. Es la decisión de §1.3.1 y es correcta: se niega a elegir por el usuario. El objeto de la medición es precisamente lo que se niega a construir |
| 2 | no | Los espacios interiores son legales y `core` los conserva |
| 3 | **sí** | `core` lanza `CARACTER_NO_PERMITIDO`: restringe la serie a ASCII 32-126 (F3 §3.1.3.1). **El plan decía que no y era falso**; la sonda se estrelló ahí tras gastar dos registros |
| 4 | no | `121.10` es la forma canónica |
| 5 | no | `121.1` cumple el XSD (`(\.\d{0,2})?`) y `core` lo acepta |
| 6 | no | El `+` explícito lo permite el XSD |
| 7 | no | Es un registro legal, solo que más laborioso de montar |

Es decir: **los casos 1 y 3**. Construyen su cadena canónica a mano y la hashean en el script,
igual que hicieron los casos 2 y 3 de S-3. La librería no se toca, y cada uno declara su motivo en
`motivoSalto` para que la excepción sea explícita y no haya que deducirla del código.

### La comprobación en seco, y por qué existe

La sonda **construye los siete casos antes de enviar ninguno** y aborta con la lista de los que
fallan. Existe porque el error del caso 3 se descubrió a mitad de la tanda, con dos registros ya
gastados, cuando era local, gratis y detectable sin tocar la red.

```bash
node packages/client/probes/s5-huella.mjs --seco     # construye los siete y para. Cero envíos.
```

### Reanudar sin repetir lo ya medido

```bash
node packages/client/probes/s5-huella.mjs unicode-nfd decimal-dos decimal-uno signo-mas importe-negativo
```

Cinco envíos, los que faltan.

### Las dos reglas que vienen de lo que costó S-2

1. **Cada caso genera su sello justo antes de enviar**, nunca derivado de otro. Con siete registros
   y esperas de 60 s, el último saldría 360 s después del primero — fuera de los 240 s de margen,
   y volvería `2004` sin haber medido nada. Es el modo de fallo de §22.9.
2. **`NumeroInstalacion` distinta por caso**, para que un `2007` no tape el `2000`. Recuérdese que
   `CodigoErrorRegistro` es `maxOccurs="1"`: un solo código por registro, y el que llegue tapa al
   resto.

### Riesgos conocidos de cada caso

- **1** — el NBSP podría chocar con `1104` («NumSerieFactura no es válido») o `1130`
  («caracteres no permitidos») antes de llegar a la huella. La lista de `1287` es `< > " ' =` y no
  incluye el NBSP, así que en principio pasa; si no pasa, es no concluyente para I-01 pero es un
  hallazgo propio sobre qué caracteres admite la serie.
- **4 y 5** — pueden chocar con `1210` («ImporteTotal tiene un valor incorrecto para… los campos
  suministrados»), que es aritmética y no huella. El desglose va cuadrado para que no sea el caso.
  Si el 4 —el control— vuelve `2000`, **se para**: sin control positivo el 5 no mide nada.
- **6** — el `+` podría rebotar en el XSD antes que nada (`4102`). Sería una respuesta útil igual:
  significaría que la forma `+121.00` no viaja, y entonces I-05 se reduce al signo negativo.
- **7** — es el único con montaje aparte (`TipoFactura` R1-R5, `TipoRectificativa`,
  `FacturasRectificadas`) y el único que puede volver rechazado por reglas de negocio —`1140` y
  `1143`, los signos de base y cuota deben coincidir— sin llegar a medir la huella. Si pasa, se
  anota **no concluyente** y se rehace el montaje. No se interpreta.

### Qué NO se hace

- No se barre el espacio de formatos de importe. Un caso por pregunta.
- No se reintenta un caso que vuelva con un código que no mide la huella. Se anota y se rehace el
  montaje con el plan revisado.
- No se deduce I-03 de lo medido en S-2. Que la AEAT no normalice el `xs:dateTime` sube la
  probabilidad de que tampoco normalice Unicode, pero son capas distintas (§12.2).

## Resumen

| Sonda | Envíos | Registros | Incógnitas |
|---|:--:|:--:|---|
| S-1 `errores.properties` ✅ | 0 | 0 | I-15 **cerrada** |
| S-2 fechas ✅ | 6 | 6 | I-07 **cerrada**, I-09 **cerrada**, I-08 a medias |
| S-2b `+00:00` ✅ | 1 | 1 | I-08 **cerrada** |
| S-3 caracteres ✅ | 3 | 3 | I-28 **cerrada** |
| S-4 cabecera ✅ | 1 | 1 | D-16 **confirmada** |
| S-5 huella ⏸ | 2 de 7 | 2 de 7 | I-02 **cerrada** · faltan I-03, I-04, I-05 |
| **Total enviado** | **13** | **13** | |
| **Total previsto** | **18** | **18** | |

**Orden y paradas:** S-1 ✅ → *parada, tabla de códigos* ✅ → S-2 ✅ → *parada, las tres
incógnitas* ✅ → S-2b ✅ → S-3 ✅ → S-4 ✅ → *parada, plan de S-5* ✅ → **S-5**.

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
pnpm --filter @verifactu-js/client probe:s5   # 7 envíos
```
