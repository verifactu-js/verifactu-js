# @verifactu-js/validation

Las validaciones de negocio de la AEAT para registros VERI\*FACTU. Cada regla trae su cita
literal, su sección **y la versión del documento** con la que se escribió.

```bash
npm i @verifactu-js/validation
```

```ts
import { validarRegistroAlta, esAceptable } from '@verifactu-js/validation';

const problemas = validarRegistroAlta({ fields: eslabon.fields, datos });

if (!esAceptable(problemas)) {
  // Al menos uno provoca rechazo del registro. No lo envíes todavía.
  for (const p of problemas) {
    console.error(`[${p.regla}] ${p.mensaje}`);
    console.error(`  ${p.fuente.documento} v${p.fuente.version} §${p.fuente.seccion}: ${p.cita}`);
  }
}
```

No lanza excepciones y no para en el primer problema: la AEAT devuelve todos los que encuentra en
una sola respuesta, y aquí igual. La idea es ver la lista entera antes de enviar, no jugar a las
veinte preguntas.

---

## Por qué cada regla lleva la versión del documento

El documento de validaciones de la AEAT cambia, y no solo añadiendo reglas. Su propio histórico
recoge una que se **introdujo** en la v1.1.3, se **eliminó** en la v1.1.4 y se **mantuvo para un
único campo**:

> «Se eliminan las validaciones de caracteres no permitidos en campos alfanuméricos de texto libre
> en sección 3.1. Validaciones sintácticas, pero se mantienen exclusivamente a nivel de IDFactura
> (número serie/factura), modificando la sección 3.1.3.1»

Una cita sin versión no te dice qué releer cuando salga la siguiente. Con versión, «revísalo todo»
se convierte en un diff. `reglas()` devuelve el catálogo completo para poder hacerlo sección a
sección:

```ts
import { reglas, DOCUMENTOS } from '@verifactu-js/validation';

console.log(DOCUMENTOS.F3); // { titulo, version: '1.2.2', fecha: '2026-02-23' }

for (const r of reglas()) {
  console.log(`${r.id}  §${r.seccion}  v${r.version}  ${r.severidad}`);
}
```

---

## Rechazo y aviso no son lo mismo

| Severidad | Qué hace la AEAT |
|---|---|
| `rechazo` | No registra el registro. El resto de la remisión sigue procesándose |
| `aviso` | **Lo registra igualmente**, marcado «Aceptado con errores» |

El segundo es el peligroso: nada falla de forma visible. Un registro con la huella mal calculada
cae exactamente en esa categoría, y por eso `esAceptable()` solo mira los de rechazo — pero los
avisos merecen mirarse igual, porque reenviar un registro ya aceptado produce un duplicado.

Las tres reglas marcadas como aviso son las que el documento dice literalmente que no rechazan:
los cuadres de `CuotaTotal` (§16) e `ImporteTotal` (§17), y la clave de régimen para IPSI (§15.6),
que es aviso hasta el 31-12-2026 y rechazo desde el 01-01-2027.

---

## Qué comprueba

Reglas de registro (§3.1.3) y de desglose (§3.1.3.15, §16, §17):

| Sección | Regla |
|---|---|
| 3.1.3.1 | La fecha de expedición no es anterior al 28-10-2024 ni está en el futuro |
| 3.1.3.2 | `RechazoPrevio` «X» o «S» exigen `Subsanacion` = «S» |
| 3.1.3.3 | `TipoRectificativa` obligatoria en R1-R5, y prohibida fuera de ellas |
| 3.1.3.4 | `FacturasRectificadas` solo en rectificativas |
| 3.1.3.5 | `FacturasSustituidas` solo en F3 |
| 3.1.3.6 | `ImporteRectificacion` si y solo si `TipoRectificativa` = «S» |
| 3.1.3.7 | `FechaOperacion` entre hace veinte años y el año que viene |
| 3.1.3.8 | Art. 7.2/7.3 solo en F1, F3 y R1-R4 |
| 3.1.3.9 | Art. 6.1.d solo en F2 y R5 |
| 3.1.3.10 | `Macrodato` obligatorio desde 100.000.000,00 € en valor absoluto |
| 3.1.3.11 | «T» exige `Tercero`; «D» exige `Destinatarios` |
| 3.1.3.12 | El tercero no puede ser el emisor; nada de `IDType` «07»; España exige «03» |
| 3.1.3.13 | Destinatarios obligatorios en F1/F3/R1-R4 y prohibidos en F2/R5, con sus reglas de identificación |
| 3.1.3.14 | `Cupon` solo en R1 y R5 |
| 15.1 | Tipos impositivos admitidos para IVA, con sus ventanas temporales |
| 15.2 | `BaseImponibleACoste` solo con clave 06 o impuestos 02/05 |
| 15.3 | Recargo de equivalencia emparejado con el tipo, con sus ventanas |
| 15.4 | «S2» fuerza tipo y cuota a cero; «N1»/«N2» no admiten ninguno de los cuatro campos |
| 15.6 | `ClaveRegimen` obligatoria en IVA; lista restringida en IPSI |
| 15.7 | Cuota repercutida contra base y tipo, mismo signo, margen de 10,00 € |
| 15.8 | Techo de 3.000,00 € en facturas simplificadas, con sus dos excepciones |
| 16 | `CuotaTotal` cuadra con el desglose (aviso) |
| 17 | `ImporteTotal` cuadra con el desglose (aviso) |

Las sumas se hacen en **céntimos enteros**, no en coma flotante. Una regla que existe para
detectar una diferencia de unos céntimos no puede evaluarse con un operador que introduce la suya:
`0.1 + 0.2` es `0.30000000000000004`.

---

## Qué NO comprueba, y por qué

Está aquí escrito para que sea visible, no para que se dé por supuesto.

**Reglas que exigen consultar el censo de la AEAT.** «El NIF debe estar identificado» aparece en
§3.1.1, §3.1.3.4, §3.1.3.12 y §3.1.3.13. No es una propiedad del documento: es una consulta contra
un sistema remoto. Ninguna librería local puede responderla.

**Sublistas de `ClaveRegimen` (§15.6.1 a §15.6.11) y la lista L10 de `OperacionExenta` (§15.5).**
Son once mini-especificaciones y dos listas que viven en el diseño de registro, no en el documento
de validaciones. Implementarlas a medias sería peor que no implementarlas: daría la impresión de
cobertura donde no la hay.

**Nada de lo estructural.** Longitudes, enumeraciones y orden de elementos los comprueba el XSD, y
[`@verifactu-js/xml`](https://github.com/verifactu-js/verifactu-js/tree/main/packages/xml#readme)
valida contra los oficiales en su suite.

---

## No se ejecuta al serializar

`@verifactu-js/xml` **no** llama a este paquete. Las reglas de negocio cambian con cada revisión
del documento de la AEAT; la serialización es estructural y estable. Una regla que se dispare de
más bloquearía una factura que la AEAT habría aceptado, y ese fallo es peor que un rechazo que
puedes leer.

El punto natural para validar es antes de enviar, donde el coste de un rechazo es visible y la
decisión de enviar de todas formas es tuya.

---

## El modelo de datos vive aquí

`DatosAlta`, `DetalleDesglose`, `SistemaInformatico`, `PersonaFisicaJuridica`, `Cabecera` y los
demás se declaran en este paquete, no en el de serialización, porque **estas reglas son la
semántica de esos tipos**: qué combinaciones de sus campos son legales. Tipo y regla van juntos.

`@verifactu-js/xml` los importa con `import type` y los reexporta, así que su bundle no crece ni un
byte por ello.

Los ocho campos que entran en la huella del alta y los cinco de la anulación **no** están aquí:
son de [`@verifactu-js/core`](https://github.com/verifactu-js/verifactu-js/tree/main/packages/core#readme),
que es quien manda sobre la huella y la cadena.

---

## Licencia

MIT.
