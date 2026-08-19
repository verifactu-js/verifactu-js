# spec-notes.md — Especificación técnica VERI\*FACTU verificada contra fuente oficial

> **Contrato interno del proyecto `@verifactu/*`.**
> Cada afirmación de este documento lleva cita textual, documento de origen, versión del
> documento y fecha de consulta. Lo que no está citado, está en §11 «Incógnitas».
>
> **Fecha de consulta de todas las fuentes: 16 de agosto de 2026.**
> Los ficheros citados están descargados en `docs/reference/` (ver §0).
>
> Regla de precedencia aplicada (§3 del brief): ante contradicción entre la Orden
> HAC/1177/2024 y la documentación técnica de la sede/portal de desarrolladores de la AEAT,
> **gana la documentación técnica**, dejando constancia de la discrepancia en §10.

---

## 0. Fuentes oficiales localizadas

| # | Documento | Versión | Fecha del documento | URL | Fichero local |
|---|---|---|---|---|---|
| F1 | *Detalle de las especificaciones técnicas para generación de la huella o hash de los registros de facturación* | **0.1.2** | **27/08/2024** | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf` | `reference/AEAT_huella_hash.pdf` |
| F2 | *Detalle de las especificaciones técnicas del código «QR» de la factura y de la «URL» del servicio de cotejo o remisión de información por parte del receptor de la factura* | **0.5.0** | **10/12/2025** | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf` | `reference/AEAT_QR.pdf` |
| F3 | *Validaciones — Sistemas Informáticos de Facturación y Sistemas VERI\*FACTU* | **1.2.2** | **08/04/2026** | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf` | `reference/AEAT_validaciones_errores.pdf` |
| F4 | *Sistemas Informáticos de Facturación · Remisión voluntaria* (descripción del servicio web) | **1.0.3** | n/d en portada | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf` | `reference/AEAT_descripcion_servicio_web.pdf` |
| F5 | *Diseños de registro de facturación* (diccionario de datos, XLSX) | **1.0** | **28/10/2024** | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DsRegistroVeriFactu.xlsx` | `reference/AEAT_DsRegistroVeriFactu.xlsx` |
| F6 | *Aclaraciones a dudas de los desarrolladores* (FAQ) | **1.3** | **04/12/2025** | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/FAQs-Desarrolladores.pdf` | `reference/AEAT_FAQs_desarrolladores.pdf` |
| F7 | WSDL `SistemaFacturacion.wsdl` | 1.0 | n/d | `https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl` | `reference/SistemaFacturacion.wsdl` |
| F8 | XSD oficiales (7 ficheros) | n/d | n/d | `https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/*.xsd` | `reference/*.xsd` |
| F9 | Orden HAC/1177/2024, de 17 de octubre (BOE-A-2024-22138), texto consolidado | consolidado | publicada 28/10/2024 | `https://www.boe.es/buscar/pdf/2024/BOE-A-2024-22138-consolidado.pdf` | `reference/BOE_Orden_HAC_1177_2024_consolidado.pdf` |
| F10 | Real Decreto 1007/2023, de 5 de diciembre (BOE-A-2023-24840), texto consolidado | consolidado | publicado 06/12/2023 | `https://www.boe.es/buscar/pdf/2023/BOE-A-2023-24840-consolidado.pdf` | `reference/BOE_RD_1007_2023_consolidado.pdf` |
| F11 | Sede AEAT — FAQ «Huella o «hash»» (página web) | — | actualizada **22/07/2026** | `https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/huella-hash.html` | (solo enlace) |

**No obtenido:** `errores.properties` (listado de códigos de error en formato máquina),
en `https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties`
— la propia sede lo marca como **«Con certificado»**. Ver §11.

---

## 1. Huella del `RegistroAlta`

### 1.1 Campos y orden literal

Cita textual de **F1 (v0.1.2, 27/08/2024), §3 «Datos de entrada», p. 5**:

> «a) Datos de campos a utilizar en el caso de registros de facturación de alta (y la “ruta” de su localización dentro del registro):
> 1. IDEmisorFactura (RegistroAlta/IDFactura/IDEmisorFactura)
> 2. NumSerieFactura (RegistroAlta/IDFactura/NumSerieFactura)
> 3. FechaExpedicionFactura (RegistroAlta/IDFactura/FechaExpedicionFactura)
> 4. TipoFactura (RegistroAlta/TipoFactura)
> 5. CuotaTotal (RegistroAlta/CuotaTotal)
> 6. ImporteTotal (RegistroAlta/ImporteTotal)
> 7. Huella (RegistroAlta/Encadenamiento/RegistroAnterior/Huella)
> 8. FechaHoraHusoGenRegistro (RegistroAlta/FechaHoraHusoGenRegistro)»

Confirmado por **F9 (Orden HAC/1177/2024), art. 13.1.a)**:

> «a) Para el registro de facturación de alta: 1.º NIF del emisor. 2.º Numero de factura y serie. 3.º Fecha de expedición de la factura. 4.º Tipo de factura. 5.º Cuota total. 6.º Importe total. 7.º Huella del registro de facturación anterior. 8.º Fecha, hora y huso horario de generación del registro.»

El orden **coincide con el del diseño de registro**, según F1 §3, p. 5:

> «…en el orden enunciado, que coincide con su aparición en los correspondientes diseños de registros publicados en el anexo de la orden.»

### 1.2 Separadores y estructura de la cadena

Cita textual de **F1 §3, p. 6**:

> «Independientemente del tipo de registro, los datos se concatenarán –en el orden descrito para cada caso– en una única cadena de texto con formato String, siguiendo la estructura descrita a continuación:
> `nombreCampo1=valorCampo1&nombreCampo2=valorCampo2&nombreCampoN=valorCampoN`
> El nombre del campo será un valor constante tal y como se describe en el XML del diseño de registro.»

De la implementación de referencia en Java publicada por la AEAT (**F1 §4, p. 8**, capturada como imagen en el PDF; transcripción literal del método relevante):

```java
public static String getValorCampo(String nombre, String valor, boolean separador) {
    String campo = nombre + "=" + ((valor == null) ? "" : valor.trim());
    if (separador)
        return campo + "&";
    else
        return campo;
}
```

y el ensamblado:

```java
return sb.append(getValorCampo("IDEmisorFactura", nifEmisor, true))
        .append(getValorCampo("NumSerieFactura", numFacturaSerie, true))
        .append(getValorCampo("FechaExpedicionFactura", fechaExpedicion, true))
        .append(getValorCampo("TipoFactura", tipoFactura, true))
        .append(getValorCampo("CuotaTotal", cuotaTotal, true))
        .append(getValorCampo("ImporteTotal", importeTotal, true))
        .append(getValorCampo("Huella", huellaAnterior, true))
        .append(getValorCampo("FechaHoraHusoGenRegistro", fechaHoraUsoRegistro, false)).toString();
```

**Consecuencias operativas confirmadas:**

- Separador entre pares: `&` (U+0026), **exactamente uno**.
- Separador nombre/valor: `=` (U+003D).
- **No hay `&` final.** El último campo (`FechaHoraHusoGenRegistro`) se emite con `separador = false`.
- **No hay URL-encoding en la cadena de la huella.** El método `getValorCampoEncoded` (que sí usa `URLEncoder`) existe en el mismo fichero pero **no se invoca** desde `getReferenciaRegistroAlta`; es el helper del QR.
- Los nombres de campo son literales, sin prefijo de namespace ni ruta.

### 1.3 Tratamiento de valores: trim y campos vacíos

Cita textual de **F1 §3, p. 6**:

> «Los valores de los campos deberán tener la misma información contenida en el campo correspondiente del fichero XML, pero eliminando los espacios al inicio y al final de cada valor […]
> Por ejemplo, si el campo NumSerieFactura contiene la siguiente información: `<NumSerieFactura>    12345678 / G33  </NumSerieFactura>` se obtendrá el valor “12345678 / G33”.»

Nótese que **los espacios interiores se conservan** (`12345678 / G33`).

Campos ausentes o vacíos, **F1 §3, pp. 6-7**:

> «Si el campo no aparece en el registro (o aparece, pero sin valor), en la cadena de caracteres solo se deberá poner el nombre del campo y el carácter “=” (sin valor a continuación), como en los siguientes ejemplos:
> - Primer registro de facturación, donde no hay una huella “anterior”:
>   `…ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=…`
> - Se informa NIF, pero no ID, en un registro de evento, al ser obligatorio informar, de forma excluyente, uno u otro:
>   `NIF=89890001K&ID=&IdSistemaInformatico=…`»

> ⚠️ **Nota de implementación (no es cita, es análisis):** la referencia usa `String.trim()` de Java,
> que elimina únicamente caracteres con code point `<= U+0020`. `String.prototype.trim()` de
> JavaScript elimina además espacios Unicode (NBSP `U+00A0`, `U+FEFF`, `U+2000`–`U+200A`…).
> Para un valor con NBSP al borde, ambas implementaciones producirían huellas distintas.
> **Decisión propuesta para `@verifactu/core`: replicar la semántica Java** (recortar solo
> `<= U+0020`) y documentarlo. Marcado como incógnita en §11 (**I-01**).

### 1.3.1 Decisión de diseño: quién es dueño del literal (huella ↔ XML)

**El problema.** F1 §3 obliga a hashear el valor **ya recortado**, mientras que el XML puede
llevar relleno legítimamente: el propio ejemplo oficial hashea `12345678 / G33` para un elemento
escrito como `<NumSerieFactura>    12345678 / G33  </NumSerieFactura>`. Es decir, la
especificación **admite** que el literal del XML y el valor hasheado no coincidan.

Eso abre exactamente el mismo hueco que D-1 abría con los importes: dos representaciones del
mismo dato, y una huella que depende de cuál se use.

**Decisión (16/08/2026).** `@verifactu/core` **canonicaliza y expone el literal resultante**.
No rechaza el relleno ASCII —la AEAT lo permite—, pero tampoco lo tolera en silencio:

1. `canonicalizeRegistroAlta(input)` y `canonicalizeRegistroAnulacion(input)` devuelven
   `{ fields, hashInput }`, donde `fields` son los literales **ya recortados** y `hashInput` es
   la cadena exacta que se hashea. Se garantiza la identidad
   `buildRegistroAltaHashInput(fields) === hashInput`.
2. **`@verifactu/xml` debe escribir `fields`, nunca la entrada cruda del usuario.** Con eso, el
   literal del XML y el valor hasheado son la misma cadena por construcción, y el recorte que
   haga la AEAT al recalcular pasa a ser una operación nula: no puede divergir del nuestro.
3. Es la misma regla que ya aplicamos a los importes (§1.7), generalizada a todos los campos:
   **se serializa una vez y esa cadena alimenta los dos caminos.**

**Excepción: la zona ambigua de I-01 se rechaza.** El punto 2 neutraliza la divergencia para
todo carácter `<= U+0020`, pero no para los que Java conserva y JavaScript recorta
(NBSP `U+00A0`, `U+2000`–`U+200A`, `U+202F`, `U+3000`, `U+FEFF`…). Ahí seguimos sin saber qué
huella calculará la AEAT, así que `@verifactu/core` lanza `ESPACIO_AMBIGUO_EN_BORDE` en lugar de
elegir por el usuario. Regla del proyecto: ante la duda, corrección antes que avance.

**Consecuencia para la fase 2.** El contrato de `@verifactu/xml` no es «serializa el registro que
te dé el usuario», sino «serializa el registro canonicalizado». Queda anotado en el TSDoc de
`RegistroAltaHashInput` y `RegistroAnulacionHashInput`.

### 1.4 Codificación de entrada

Cita textual de **F1 §3, p. 7**:

> «Dicha cadena de caracteres será codificada en un array de bytes en formato UTF-8 para generar la entrada del algoritmo (o función) de huella o «hash».»

Confirmado en la referencia Java (**F1 §4, p. 8**):

```java
java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
return new Base16(false).encodeAsString(digest.digest(msg.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
```

Sin BOM, sin terminador nulo, sin salto de línea final.

### 1.5 Algoritmo

Cita textual de **F1 §2, p. 4**:

> «El algoritmo a utilizar se detalla en la Lista L12 del apartado 6 del anexo de la orden.
> En la fecha de publicación de este documento el único algoritmo permitido es SHA-256.»

Lista **L12** en **F5 (Diseño de registro v1.0), hoja «6)Listas»**: `01` → `SHA-256`.
El XSD (**F8**, `SuministroInformacion.xsd`) restringe `TipoHuellaType` a la única enumeración `01`
con `<documentation xml:lang="es">SHA-256</documentation>`.

→ El campo `TipoHuella` del registro debe valer **`01`**.

### 1.6 Formato de salida

Cita textual de **F1 §5, p. 9**:

> «El formato de salida será:
> - En sistema hexadecimal.
> - En mayúsculas.
> El tamaño será de 64 caracteres alfanuméricos.»

Confirmado por **F3 (Validaciones v1.2.2), §18 «Huella (del registro anterior)», p. 15**:

> «Se validará que la huella del encadenamiento del registro anterior cumpla el formato de salida del algoritmo SHA-256, siendo de 64 caracteres en hexadecimal y en mayúsculas. En caso contrario se devolverá un aviso de error (no generará rechazo).»

Y por la referencia Java: `new Base16(false)` — el parámetro `false` de
`org.apache.commons.codec.binary.Base16(boolean lowerCase)` significa **mayúsculas**.

Destino del valor, **F1 §5, p. 9**: `Huella (RegistroAlta/Huella)`.

### 1.7 Formato numérico de los importes

Cita textual de **F1 §3, p. 6** (aclaración introducida precisamente en la revisión 0.1.2):

> «…y en los campos numéricos se tratarán indistintamente los valores con una o dos posiciones en los decimales, sin tener relevancia los ceros a la derecha, considerándose todos igualmente válidos para la generación de la huella o hash.
> Por ejemplo, si el campo ImporteTotal contiene la siguiente información: `<ImporteTotal>123.1</ImporteTotal>` se tratará correctamente, de la misma forma que si se informara `<ImporteTotal>123.10</ImporteTotal>`.»

El XSD (**F8**, `SuministroInformacion.xsd`) define:

```xml
<!-- Importe de 15 dígitos (12+2) "." como separador decimal -->
<simpleType name="ImporteSgn12.2Type">
    <restriction base="string">
        <pattern value="(\+|-)?\d{1,12}(\.\d{0,2})?"/>
    </restriction>
</simpleType>
```

`CuotaTotal` e `ImporteTotal` son ambos de tipo `sf:ImporteSgn12.2Type`.

**Regla operativa derivada (la única que es siempre segura):**
la cadena de la huella debe contener **exactamente los mismos caracteres que el valor léxico
del elemento XML correspondiente**. `123.4` y `123.40` producen huellas SHA-256 **distintas**
(verificado empíricamente, §1.9); es la AEAT quien acepta ambas al recalcular.
Por tanto `@verifactu/core` debe (a) serializar el importe una sola vez, (b) usar esa misma
cadena para el XML y para la huella, y (c) no re-formatear entre ambos pasos.
El mecanismo exacto por el que la AEAT normaliza es una incógnita (§11, I-04).

Separador decimal: `.` (punto). Sin separador de millares. Signo opcional `+`/`-`.

### 1.8 Vectores oficiales — RegistroAlta

**Caso 1 — primer registro de la cadena (F1 §6.1, p. 10):**

Entradas: `IDEmisorFactura: 89890001K`, `NumSerieFactura: 12345678/G33`,
`FechaExpedicionFactura: 01-01-2024`, `TipoFactura: F1`, `CuotaTotal: 12.35`,
`ImporteTotal: 123.45`, `Huella: (*)` — «(*) Sin contenido, al tratarse del primer registro de
ese SIF y, por tanto, no haber registro de facturación anterior» —,
`FechaHoraHusoGenRegistro: 2024-01-01T19:20:30+01:00`.

Cadena (199 bytes UTF-8):

```
IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00
```

Huella esperada:

```
3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60
```

**Caso 2 — segundo registro o sucesivo (F1 §6.2, p. 11):**

Cadena (263 bytes UTF-8):

```
IDEmisorFactura=89890001K&NumSerieFactura=12345679/G34&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60&FechaHoraHusoGenRegistro=2024-01-01T19:20:35+01:00
```

Huella esperada:

```
F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97
```

### 1.9 Verificación empírica realizada

Los tres vectores de F1 se han recalculado localmente con `hashlib.sha256(s.encode('utf-8')).hexdigest().upper()`:

| Vector | Origen | Resultado |
|---|---|---|
| Caso 1 (alta, primer registro) | F1 §6.1 | ✅ **coincide** |
| Caso 2 (alta, registro sucesivo) | F1 §6.2 | ✅ **coincide** |
| Caso 3 (anulación) | F1 §6.3 | ✅ **coincide** |

Pruebas de sensibilidad ejecutadas sobre el Caso 1:

- Con `\n` final → `31AED1A12718F6A86C9C4BB24AF6B6E138D880DE843FB4EA818C03EBB17638AA` ≠ esperado.
  **Confirma que no se añade terminador de línea.**
- Hex en minúsculas → `3c464daf…f12f60`. **Confirma que las mayúsculas no son cosmética: son el formato.**

**Vector de terceros reproducido (cross-check independiente).** El README de
`mdiago/VeriFactu` (líneas 269-309, consultado 16/08/2026) publica entrada y huella esperada.
Reconstruyendo la cadena a partir de sus datos:

```
IDEmisorFactura=B72877814&NumSerieFactura=GITHUB-EJ-003&FechaExpedicionFactura=04-11-2024&TipoFactura=F1&CuotaTotal=21.4&ImporteTotal=131.4&Huella=8C8DCEFB120522E0C71BC19902F44D5334FF6C98E74F0E3AC1D1E5A30C2EA836&FechaHoraHusoGenRegistro=2024-11-04T12:36:39+01:00
```

→ `4EECCE4DD48C0539665385D61D451BA921B7160CA6FEF46CD3C2E2BC5C778E14` ✅ **coincide con el valor publicado por mdiago**.

Dos conclusiones de este cross-check:

1. La reconstrucción de la cadena a partir de la especificación es correcta también fuera de
   los ejemplos de la AEAT (NIF distinto, serie con guiones, fecha distinta, huella previa presente).
2. La implementación .NET más madura del ecosistema serializa `21.4` / `131.4` (**sin relleno
   a dos decimales**). La misma cadena con `21.40` / `131.40` **no** reproduce su huella. Esto
   refuerza la regla de §1.7: la huella se calcula sobre el literal serializado, no sobre el número.

---

## 2. Huella del `RegistroAnulacion`

### 2.1 Campos y orden literal

Cita textual de **F1 §3, p. 5**:

> «b) Datos de campos a utilizar en el caso de registros de facturación de anulación (y la “ruta” de su localización dentro del registro):
> 1. IDEmisorFacturaAnulada (RegistroAnulacion/IDFactura/IDEmisorFacturaAnulada)
> 2. NumSerieFacturaAnulada (RegistroAnulacion/IDFactura/NumSerieFacturaAnulada)
> 3. FechaExpedicionFacturaAnulada (RegistroAnulacion/IDFactura/FechaExpedicionFacturaAnulada)
> 4. Huella (RegistroAnulacion/Encadenamiento/RegistroAnterior/Huella)
> 5. FechaHoraHusoGenRegistro (RegistroAnulacion/FechaHoraHusoGenRegistro)»

**Cinco campos, no ocho.** No intervienen `TipoFactura`, `CuotaTotal` ni `ImporteTotal`.
Los nombres de los tres primeros llevan el sufijo `Anulada` **también en la cadena de la huella**
(no son los mismos literales que en el alta).

Confirmado por **F9, art. 13.1.b)**: «1.º NIF del emisor. 2.º Numero de factura y serie.
3.º Fecha de expedición de la factura. 4.º Huella del registro de facturación anterior.
5.º Fecha, hora y huso horario de generación del registro.»

> ⚠️ La revisión **0.1.1 (10/06/2024)** de F1 se tituló literalmente «Corrección campos ejemplos
> hash anulación». Cualquier implementación basada en la v0.1.0 tiene los campos de anulación mal.

### 2.2 Reglas comunes

Separadores, trim, campos vacíos, UTF-8, SHA-256, hex mayúsculas de 64 caracteres: **idénticos al alta**
(F1 §3 y §5 son explícitamente «independientemente del tipo de registro»).
Destino del valor, **F1 §5, p. 9**: `Huella (RegistroAnulacion/Huella)`.

### 2.3 Vector oficial — RegistroAnulacion

**Caso 3 (F1 §6.3, p. 12):** `IDEmisorFacturaAnulada: 89890001K`,
`NumSerieFacturaAnulada: 12345679/G34`, `FechaExpedicionFacturaAnulada: 01-01-2024`,
`Huella: F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97`,
`FechaHoraHusoGenRegistro: 2024-01-01T19:20:40+01:00`.

Cadena (232 bytes UTF-8):

```
IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345679/G34&FechaExpedicionFacturaAnulada=01-01-2024&Huella=F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97&FechaHoraHusoGenRegistro=2024-01-01T19:20:40+01:00
```

Huella esperada:

```
177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68
```

✅ Verificado localmente (§1.9).

> Nota: los tres casos de F1 forman **una cadena real de tres eslabones**
> (alta → alta → anulación). Sirven como vector de `verifyChain` completo, no solo de `hashRegistro`.

---

## 3. Huella del `RegistroEvento` (fuera del alcance de v1, documentado para no perderlo)

Cita textual de **F1 §3, pp. 5-6**:

> «c) Datos de campos a utilizar en el caso de registros de evento (y la “ruta” de su localización dentro del registro):
> 1. NIF (RegistroEvento/Evento/SistemaInformatico/NIF)
> 2. ID (RegistroEvento/Evento/SistemaInformatico/IDOtro/ID)
> 3. IdSistemaInformatico (RegistroEvento/Evento/SistemaInformatico/IdSistemaInformatico)
> 4. Version (RegistroEvento/Evento/SistemaInformatico/Version)
> 5. NumeroInstalacion (RegistroEvento/Evento/SistemaInformatico/NumeroInstalacion)
> 6. NIF (RegistroEvento/Evento/ObligadoEmision/NIF)
> 7. TipoEvento (RegistroEvento/Evento/TipoEvento)
> 8. HuellaEvento (RegistroEvento/Evento/Encadenamiento/EventoAnterior/HuellaEvento)
> 9. FechaHoraHusoGenEvento (RegistroEvento/Evento/FechaHoraHusoGenEvento)»

Destino: `HuellaEvento (RegistroEvento/Evento/HuellaEvento)` (F1 §5, p. 9).
Obsérvese que `NIF` aparece **dos veces** con el mismo nombre literal (posiciones 1 y 6) y que
`NIF`/`ID` son excluyentes: el que falte va como `nombre=` vacío.
Solo aplica a sistemas **NO VERI\*FACTU** (fase 5 del roadmap).

---

## 4. Valor de la huella previa en el primer registro de una cadena

**Respuesta: cadena vacía. El par se emite como `Huella=` (nombre + `=` + nada).**

Cita textual de **F1 §3, p. 7**:

> «- Primer registro de facturación, donde no hay una huella “anterior”:
> `…ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=…`»

Y **F1 §6.1, p. 10**: «7. Huella (*): […] (*) Sin contenido, al tratarse del primer registro de ese
SIF y, por tanto, no haber registro de facturación anterior.»

**No** es una cadena de 64 ceros, **no** es el hash del vacío, **no** se omite el par.

### 4.1 Qué va en el XML en ese caso

El bloque `Encadenamiento` es un `choice` en el XSD (**F8**, `SuministroInformacion.xsd`):

```xml
<element name="Encadenamiento">
    <complexType>
        <choice>
            <element name="PrimerRegistro" type="sf:PrimerRegistroCadenaType"/>
            <element name="RegistroAnterior" type="sf:EncadenamientoFacturaAnteriorType"/>
        </choice>
    </complexType>
</element>
```

con `PrimerRegistroCadenaType` restringido a la única enumeración `S`.

**F5 (Diseño de registro v1.0), hoja «2)D. Registro Facturación Alta»**, campo `PrimerRegistro`:

> «Indicador que especifica que no existe registro de facturación anterior en este sistema informático por tratarse del primer registro de facturación generado en él. En este caso, se informará con el valor "S". Si no se informa este campo se entenderá que no es el primer registro de facturación, en cuyo caso es obligatorio informar los campos de que consta «RegistroAnterior».»

### 4.2 La huella propia sí se calcula siempre

Cita textual de **F1 §5, p. 9**:

> «El dato de la huella –así calculada– del registro al que se refiera siempre ha de ir informado en el correspondiente campo de dicho registro. Es decir, incluso en el caso de que sea el primer registro de facturación o de evento (en cuyo caso se deberá indicar en el campo “PrimerRegistro” o “PrimerEvento” el valor a “S” y no será necesario informar los campos de los bloques “RegistroAnterior” o “EventoAnterior”, respectivamente), también será necesario generar el contenido de los campos Huella o HuellaEvento detallados anteriormente e incluirlos en el correspondiente registro.»

### 4.3 Contenido del bloque `RegistroAnterior` (registros no primeros)

**F8**, `EncadenamientoFacturaAnteriorType` — orden de elementos:
`IDEmisorFactura` (NIFType, 9), `NumSerieFactura` (TextMax60Type),
`FechaExpedicionFactura` (fecha `dd-mm-yyyy`), `Huella` (TextMax64Type).

**F5**, campo `Huella1` de `RegistroAnterior`:

> «Primeros 64 caracteres de la huella o «hash» del registro de facturación anterior (sea de alta o de anulación) generado en este sistema informático.»

Y sobre `IDEmisorFactura` del bloque anterior (**F5**):

> «NIF del obligado a expedir la factura a que se refiere el registro de facturación anterior (sea de alta o de anulación) generado en este sistema informático. […] es necesario para completar la identificación de la factura contenida en el registro de facturación anterior a encadenar en casos excepcionales y puntuales en los que no coincida con el actual, como al cambiar en un momento dado el NIF tras fusiones, absorciones, etc.»

→ **El NIF del registro anterior puede diferir del actual.** `verifyChain` no debe asumir NIF constante.

### 4.4 Qué debe comprobar el SIF al encadenar

**F6 (FAQ desarrolladores v1.3), §15, p. 28**, citando el art. 7.i) de la Orden:

> «7.i) Salvo cuando se trate del primer registro de facturación, cada vez que el sistema informático vaya a generar un nuevo registro de facturación, de alta o de anulación, antes deberá comprobar que se cumplen los siguientes requisitos:
> 1.º El último registro de facturación generado está correctamente encadenado.
> 2.º La fecha y hora de generación del último registro de facturación generado no es superior en más de un minuto a la fecha y hora actuales que se utilizarán para fechar el registro de facturación a generar.»

Y la aclaración de la propia FAQ:

> «debe verificarse que el campo "Huella" que figura dentro de las agrupaciones "Encadenamiento" - "RegistroAnterior" del último registro de facturación (RF) generado (RF n-1 […]) se corresponde con el campo "Huella" del RF n-2, cuya "identificación" también se aporta en las mencionadas agrupaciones del RF n-1.»

→ La comprobación normativa es **de ventana de dos eslabones** (n-1 vs n-2), no de cadena completa.
`verifyChain(registros[])` (cadena entera) es un superconjunto legítimo y es el gancho del paquete,
pero conviene exponer también la comprobación mínima exigida.

**F11 (FAQ sede, actualizada 22/07/2026), pregunta 6:**

> «los SIF VERI\*FACTU no están obligados a realizar comprobaciones de huellas ni a ofrecer funcionalidades que permitan comprobarlas […] Sin embargo, en el caso de un sistema de emisión de facturas no verificables, este también debe ofrecer como funcionalidad la posibilidad de comprobar las huellas de los registros generados que estén a su alcance.»

---

## 5. `FechaHoraHusoGenRegistro` — formato exacto

### 5.1 Formato

Cita textual de **F5 (Diseño de registro v1.0), hoja «2)D. Registro Facturación Alta»**, campo `FechaHoraHusoGenRegistro`, columna FORMATO:

> «DateTime. Formato: YYYY-MM-DDThh:mm:ssTZD (ej: 2024-01-01T19:20:30+01:00) (ISO 8601)»

Columna DESCRIPCIÓN, misma fila:

> «Fecha, hora y huso horario de generación del registro de facturación. El huso horario es el que está usando el sistema informático de facturación en el momento de generación del registro de facturación.»

Texto **idéntico** en la hoja «3)D. Reg. Facturación Anulación» para el registro de anulación.

Los ejemplos de F1 §6 usan los tres el mismo patrón: `2024-01-01T19:20:30+01:00`,
`2024-01-01T19:20:35+01:00`, `2024-01-01T19:20:40+01:00`.

**Formato canónico a emitir:** `YYYY-MM-DDThh:mm:ss` + offset `±hh:mm`.
Segundos con dos dígitos, `T` mayúscula, sin fracciones de segundo, con dos puntos en el offset.

### 5.2 Lo que el XSD permite (más laxo que el diseño de registro)

**F8**, `SuministroInformacion.xsd`:

```xml
<element name="FechaHoraHusoGenRegistro" type="dateTime"/>
```

Es el `xs:dateTime` estándar, **sin `pattern` restrictivo**. Es decir, el esquema aceptaría
sintácticamente `2024-01-01T19:20:30` (sin huso) o `…Z` o `…+01:00:00`. **Discrepancia
registrada en §10 (D-2).** La validación XSD **no** protege contra un huso ausente:
la protección debe estar en `@verifactu/core`.

### 5.3 Validación por parte de la AEAT

**F3 (Validaciones v1.2.2), §20 (alta) y §6 (anulación)**, texto idéntico:

> «Se validará que la FechaHoraHusoGenRegistro sea menor o igual que la fecha del sistema de la AEAT, admitiéndose un margen de error. En caso de superar el umbral, se devolverá un aviso de error (no generará rechazo).»

**F3**, tratamiento de errores admisibles:

> «- Si se ha informado en el campo FechaHoraHusoGenRegistro una fecha y hora mayor que la fecha del sistema de la AEAT, admitiéndose un margen de error. Se excepciona este error de la necesidad de ser subsanado.»

Y en el histórico de revisiones de F3, rev. **0.7.2 (21/05/2024)**:

> «Eliminación de la categorización de errores admisibles subsanables y no subsanables. El error en el campo FechaHoraHusoGenRegistro se excepcionada de la necesidad de subsanación.»

→ Reloj adelantado = aviso, no rechazo, y **no** obliga a subsanar. El valor del «margen de
error» no está publicado (§11, I-06).

### 5.4 Canarias

Ninguna fuente oficial menciona `Europe/Madrid` ni ninguna zona concreta. La norma dice
literalmente «el huso horario es el que está usando el sistema informático de facturación en el
momento de generación del registro». Para `Atlantic/Canary` eso es `+00:00` en invierno y
`+01:00` en verano. **La librería no debe tener ninguna zona por defecto**; el offset debe
derivarse del `Date` inyectado o pasarse explícitamente.

---

## 6. Bloque `SistemaInformatico`

### 6.1 Orden de elementos (XSD, normativo para el XML)

**F8**, `SuministroInformacion.xsd`, `SistemaInformaticoType`:

```xml
<complexType name="SistemaInformaticoType">
    <sequence>
        <sequence>
            <element name="NombreRazon" type="sf:TextMax120Type"/>
            <choice>
                <element name="NIF" type="sf:NIFType"/>
                <element name="IDOtro" type="sf:IDOtroType"/>
            </choice>
        </sequence>
        <element name="NombreSistemaInformatico" type="sf:TextMax30Type"/>
        <element name="IdSistemaInformatico" type="sf:TextMax2Type"/>
        <element name="Version" type="sf:TextMax50Type"/>
        <element name="NumeroInstalacion" type="sf:TextMax100Type"/>
        <element name="TipoUsoPosibleSoloVerifactu" type="sf:SiNoType"/>
        <element name="TipoUsoPosibleMultiOT" type="sf:SiNoType"/>
        <element name="IndicadorMultiplesOT" type="sf:SiNoType"/>
    </sequence>
</complexType>
```

`SiNoType` está restringido a las enumeraciones `S` y `N` (lista **L4** de F5).
`NIFType` tiene `<length value="9"/>` exacta.

El bloque es **obligatorio** en `RegistroAlta` y en `RegistroAnulacion`
(`<element name="SistemaInformatico" type="sf:SistemaInformaticoType"/>` sin `minOccurs="0"`).

### 6.2 Semántica de cada campo (F5, hoja «5)Definición SistemaInformatico»)

| Campo | Formato | Cita textual de F5 |
|---|---|---|
| `NombreRazon` | Alfanumérico (120) | «Nombre-razón social de la persona o entidad productora (ver \* NOTA aclaratoria al final del bloque «SistemaInformatico»).» |
| `NIF` | FormatoNIF (9) | «NIF de la persona o entidad productora […]» |
| `IDOtro/CodigoPais` | Alfanum. (2) ISO 3166-1 alpha-2 | «Código del país de la persona o entidad productora […]» |
| `IDOtro/IDType` | Alfanum. (2) L7 | «Clave para establecer el tipo de identificación de la persona o entidad productora […]» |
| `IDOtro/ID` | Alfanum. (20) | «Número de identificación de la persona o entidad productora […] en el país de residencia.» |
| `NombreSistemaInformatico` | Alfanum. (30) | «Nombre dado por la persona o entidad productora a su sistema informático de facturación (SIF) que, una vez instalado, se constituye en el SIF utilizado. Obligatorio en registros de facturación de alta y de anulación, y opcional en registros de evento.» |
| `IdSistemaInformatico` | Alfanum. (2) | «Código identificativo dado por la persona o entidad productora a su sistema informático de facturación (SIF) […]. Deberá distinguirlo de otros posibles SIF distintos que produzca esta misma persona o entidad productora.» |
| `Version` | Alfanum. (50) | «Identificación de la versión del sistema informático de facturación (SIF) que se ejecuta en el sistema informático de facturación utilizado.» |
| `NumeroInstalacion` | Alfanum. (100) | «Número de instalación del sistema informático de facturación (SIF) utilizado. Deberá distinguirlo de otros posibles SIF utilizados para realizar la facturación del obligado a expedir facturas, es decir, de otras posibles instalaciones de SIF pasadas, presentes o futuras […], incluso aunque en dichas instalaciones se emplee el mismo SIF de un productor.» |

Nota al pie del bloque en **F5**:

> «\* NOTA: dato de la persona o entidad productora del sistema informático de facturación (SIF) empleado. En el caso de haber varios productores (por ejemplo, cuando el SIF consta de varios componentes de distintos productores) se deberán consignar los datos del productor responsable del componente principal del SIF, según la definición dada en el artículo 1.2.c) de esta orden.»

### 6.3 Semántica de los tres indicadores booleanos (S/N) — citas literales de F5

**`TipoUsoPosibleSoloVerifactu`**

> «Especifica si para cumplir el Reglamento el sistema informático de facturación solo puede funcionar exclusivamente como «VERI\*FACTU» (valor "S") o puede funcionar también como «NO VERI\*FACTU» (valor "N"). Obligatorio en registros de facturación de alta y de anulación. No aplica en registros de evento.»

→ Es una propiedad **del producto**, no de la instalación ni del envío.

**`TipoUsoPosibleMultiOT`**

> «Especifica si el sistema informático de facturación permite llevar independientemente la facturación de varios obligados tributarios (valor "S") o solo de uno (valor "N"). Obligatorio en registros de facturación de alta y de anulación, y opcional en registros de evento.»

→ Capacidad **del producto**.

**`IndicadorMultiplesOT`**

> «Indicador de que el sistema informático, en el momento de la generación de este registro, está soportando la facturación de más de un obligado tributario. Este valor deberá obtenerlo automáticamente el sistema informático a partir del número de obligados tributarios contenidos y/o gestionados en él en ese momento, independientemente de su estado operativo (alta, baja...), no pudiendo obtenerse a partir de otra información ni ser introducido directamente por el usuario del sistema informático ni cambiado por él. El valor "N" significará que el sistema informático solo contiene y/o gestiona un único obligado tributario (de alta o de baja o en cualquier otro estado), que se corresponderá con el obligado a expedir factura de este registro de facturación. En cualquier otro caso, se deberá informar este campo con el valor "S". Obligatorio en registros de facturación de alta y de anulación, y opcional en registros de evento.»

→ **Este es de estado, no de configuración.** La norma prohíbe expresamente que lo introduzca
el usuario. Consecuencia de diseño para `@verifactu/core`: los dos primeros van en el objeto
de configuración estático que se pasa al crear la cadena; **`IndicadorMultiplesOT` no puede ser
una constante de configuración** — debe ser un valor calculado por el integrador en el momento
de generar el registro (callback o parámetro por llamada). Esto contradice parcialmente el §6.4
del brief («Diseña este bloque como un objeto de configuración que se pasa una vez»).

### 6.4 Validaciones de la AEAT sobre el bloque

**F3 (Validaciones v1.2.2), §3.1.5, p. 17** — citas literales:

> «- Si se cumplimenta NIF, no deberá existir la agrupación IDOtro y viceversa, pero es obligatorio que se cumplimente uno de los dos.
> - Si el campo IDType = “02” (NIF-IVA), no será exigible el campo CodigoPais.
> - Cuando la persona o entidad productora del sistema informático se identifique a través de la agrupación IDOtro e IDType sea “02”, se validará que el campo identificador se ajuste a la estructura de NIF-IVA de alguno de los Estados Miembros y debe estar identificado.
> - Si se identifica a través de la agrupación IDOtro y CodigoPais sea "ES", se validará que el campo IDType sea “03”.
> - No se admite el tipo de identificación IDType “07” (“No censado”).
> - **El campo IdSistemaInformatico deberá tener rellenas siempre las dos posiciones, cada una de las cuales deberá ser una letra mayúscula, excepto la Ñ, o un dígito numérico.**
> - El campo NombreSistemaInformatico es obligatorio y debe tener contenido.
> - El campo TipoUsoPosibleSoloVerifactu es obligatorio y debe tener contenido.
> - El campo TipoUsoPosibleMultiOT es obligatorio y debe tener contenido.»

→ `IdSistemaInformatico`: regex efectiva `^[A-Z0-9]{2}$` **excluyendo `Ñ`** (que de todas formas
no está en `[A-Z]` ASCII). El XSD solo impone `maxLength=2`, así que esta validación **no la
cubre el XSD**: hay que implementarla en `core`.

Lista **L7** (IDType), de **F9 anexo §6** y **F5** hoja «6)Listas»:
`02` NIF-IVA, `03` Pasaporte, `04` Documento oficial de identificación expedido por el país o
territorio de residencia, `05` Certificado de residencia, `06` Otro documento probatorio,
`07` No censado.

---

## 7. Código QR y URL de cotejo

### 7.1 URLs base — los cuatro casos

Cita textual de **F2 (v0.5.0, 10/12/2025), §5, p. 10**:

> «5.1. Sistema que emite facturas verificables
> - Entorno de pruebas (Portal de Pruebas Externas):
>   `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=XXXXXXXXY&numserie=YYYY...YYYY&fecha=DD-MM-AAAA&importe=NNNNNNNNN.DD`
> - Entorno de Producción:
>   `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=XXXXXXXXY&numserie=YYYY...YYYY&fecha=DD-MM-AAAA&importe=NNNNNNNNN.DD`
>
> 5.2. Sistema que emite facturas no verificables
> - Entorno de pruebas (Portal de Pruebas Externas):
>   `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=XXXXXXXXX&numserie=YYYYYYYY&fecha=DD-MM-AAAA&importe=NNNNNNNN.DD`
> - Entorno de Producción:
>   `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=XXXXXXXXX&numserie=YYYYYYYY&fecha=DD-MM-AAAA&importe=NNNNNNNN.DD`»

Resumen operativo:

| Modo | Entorno | URL base |
|---|---|---|
| Verificable (VERI\*FACTU) | Pruebas | `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR` |
| Verificable (VERI\*FACTU) | Producción | `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR` |
| No verificable | Pruebas | `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu` |
| No verificable | Producción | `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu` |

### 7.2 Parámetros obligatorios, orden y formato

Cita textual de **F2 §6, p. 11**:

> «La «URL» de cotejo o remisión de información de la factura contenida en el código «QR» deberá incorporar únicamente los siguientes 4 parámetros obligatorios, acompañados de sus correspondientes valores. El resultado será devuelto en formato “html” (web)»

| Parámetro | Formato (cita) | Longitud (cita) | Descripción (cita) |
|---|---|---|---|
| `nif` | «Formato NIF» | 9 | «NIF del obligado a expedir la factura» |
| `numserie` | «Cadena de texto, puede contener caracteres especiales (ASCII 32-126)» | «Máximo 60 caracteres» | «Nº Serie + Nº Factura que identifica a la factura» |
| `fecha` | «Tipo fecha con guiones medios (DD-MM-AAAA)» | 10 | «Fecha de expedición de la factura.» |
| `importe` | «Numérico con decimales. Utilizar el “.” (punto) para separar la parte entera de la decimal.» | «Máximo 12 dígitos en la parte entera, y 2 dígitos en la parte decimal» | «Importe total de la factura.» |

**Orden:** `nif`, `numserie`, `fecha`, `importe` — confirmado por el ejemplo de código Java de
**F2 §4.1, p. 9**, que construye la URL en ese orden exacto.

### 7.3 Codificación

Cita textual de **F2 §4, p. 8**:

> «A fin de asegurar que todos sus caracteres sean leídos e interpretados correctamente, la «URL» de cotejo o remisión de información de la factura contenida en el código «QR» que debe aparecer en la factura, concretamente el contenido de los parámetros, deberán ser codificados de forma adecuada siguiendo los estándares generales de las aplicaciones en entorno web («URL encoding») y utilizando la codificación UTF-8.»

> «Por último, es importante destacar que las cadenas de texto solo pueden contener caracteres ASCII con códigos del 32 al 126 (caracteres imprimibles).»

Ejemplo de la propia AEAT (**F2 §4, p. 8**), para `numserie = 12345678&G33`:

> «`https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%26G33&fecha=01-01-2024&importe=241.4`»

y el contraejemplo incorrecto (sin codificar) con `numserie=12345678&G33`.

Implementación de referencia (**F2 §4.1, p. 9**, transcripción literal de la imagen):

```java
public static String encodeParam(String param) {
    try {
        return java.net.URLEncoder.encode(param, "UTF-8");
    } catch (Exception e) {
        throw new RuntimeException(String.format("Error al codificar parametro %s", param));
    }
}
```

> ⚠️ **Nota de implementación (análisis, no cita):** `java.net.URLEncoder.encode` implementa
> `application/x-www-form-urlencoded`, **no** el percent-encoding de RFC 3986. Diferencias frente a
> `encodeURIComponent` de JavaScript:
>
> | Carácter | `URLEncoder` (Java, AEAT) | `encodeURIComponent` (JS) |
> |---|---|---|
> | espacio | `+` | `%20` |
> | `!` `'` `(` `)` | `%21 %27 %28 %29` | sin codificar |
> | `~` | `%7E` | sin codificar |
> | `*` | sin codificar | sin codificar |
> | `-` `_` `.` | sin codificar | sin codificar |
>
> `numserie` admite ASCII 32-126, luego el espacio y estos símbolos son valores posibles reales.
> **Esta divergencia es material.** Marcada como incógnita bloqueante para `@verifactu/qr` (§11, **I-10**).
> El ejemplo del §8.1 de F2 usa `numserie=12345678-G33` (guion, no `/`), que no discrimina entre
> ambas codificaciones. Hay que resolverlo probando contra el servicio real de cotejo antes de
> publicar la fase 2.

### 7.4 Parámetros opcionales del servicio (nunca dentro del QR)

**F2 §7, p. 12:**

| Parámetro | Valores | Cita |
|---|---|---|
| `idioma` | `gl`, `ca`, `eu`, `es`, `va`, `en` | «Indica el idioma en el que se visualizará la respuesta del cotejo de QR en Sede Electrónica. Por defecto, si no se informa, se visualizará en castellano.» |
| `formato` | `json` | «Indica que la respuesta será en formato máquina (json) para permitir la integración de aplicaciones de terceros. **IMPORTANTE: este parámetro nunca podrá incorporarse en la «URL» que va en el código «QR» de la factura**» |

`idioma` es nuevo en la revisión **0.5.0 (10/12/2025)** de F2.

### 7.5 Características físicas y ubicación del QR

**F2 §2, p. 6**, citando el art. 21.1 de la Orden:

> «El código «QR» deberá tener un tamaño entre 30x30 y 40x40 milímetros y seguir las especificaciones de la norma ISO/IEC 18004:2015. Para la generación del código «QR» se empleará el nivel M (medio) de corrección de errores.»

**F2 §3, p. 7:**

> «El contraste de colores entre el código «QR» y el fondo debe ser lo suficientemente alto para asegurar la legibilidad. A este respecto, se deben mantener como mínimo 2 milímetros de espacio vacío (en blanco) alrededor de los cuatro lados del código «QR», recomendándose que sean 6 milímetros.»

> «El código «QR» se situará al principio de la factura […] Si la factura ocupara varias páginas, el código «QR» aparecería una única vez, en la primera página. Si se utiliza un formato de orientación vertical […] el código «QR» se situará arriba de esta, próximo al margen superior, preferiblemente centrado […] En el caso de utilizar un formato de orientación horizontal (apaisado) […] se situará a la izquierda de esta, preferiblemente cercana al margen superior-izquierdo […]»

### 7.6 Textos literales que acompañan al QR

**F2 §3, p. 7:**

> «La presentación del código «QR» incluirá también un texto que siempre deberá ir precediéndolo: **«QR tributario:»**, y que se situará encima del propio código «QR» (preferiblemente centrado con respecto a este) […]»

> «Además, en el caso de facturas expedidas por sistemas que emiten facturas verificables, justo debajo del código «QR» deberá aparecer la frase **«Factura verificable en la sede electrónica de la AEAT»** o **«VERI\*FACTU»**, preferiblemente centrada con respecto al código «QR». Si no cabe toda la frase en una sola línea, podrán utilizarse varias líneas hasta completarla.»

> «Tanto el texto que siempre debe preceder al código «QR», como, en su caso, la frase que habrán de incluir los sistemas «VERI\*FACTU» deberán tener un tipo de letra y tamaño legibles, siempre iguales o superiores a los del resto de datos de la factura.»

**F2 §2, p. 6** (art. 20.1.b de la Orden) añade el matiz de que esa frase «deberá tener un tipo de
letra y tamaño bien visibles, similares a los del resto de datos de la factura».

→ Resumen para `@verifactu/qr`:
- **Siempre**: `QR tributario:` encima del QR.
- **Solo modo verificable**: debajo, `Factura verificable en la sede electrónica de la AEAT` **o**
  la forma corta `VERI*FACTU`.
- **Modo no verificable**: solo `QR tributario:`, sin frase inferior (F2 §12, ejemplos f y g).

### 7.7 Respuestas del servicio de cotejo

Formato JSON (solo con `formato=json`), **F2 §9**. Campos: `status` (`OK`/`KO`), `mensaje`,
`visible`, `crashlytics`, y `respuesta` con `resultado`, `nif`, `numserie`, `fecha`, `importe`.

| `resultado` | `mensaje` | Situación (cita F2) |
|---|---|---|
| `00` | `Encontrada` | «la factura consta como recibida en la AEAT» (§9.1.1) |
| `01` | `No encontrada` | «la factura no consta como recibida en la AEAT o se encuentra en estado anulada» (§9.1.2) |
| `02` | `No contrastable` | respuesta para sistemas que emiten facturas **no** verificables (§9.2) |

Nótese que en los ejemplos de F2 el `importe` viene **como string entre comillas** en el JSON
(cambio introducido en la revisión 0.4.5, 02/10/2024).

### 7.8 Códigos de error de validación de la URL del QR

**F2 §10, pp. 22-23** — listado completo, cita literal:

| Código | Descripción |
|---|---|
| `1001` | «No se ha remitido el parámetro: nif (El parámetro "nif" es el número de identificación fiscal (NIF) del obligado a expedir la factura)» |
| `1002` | «No se ha remitido el parámetro: numserie (El parámetro "numserie" es el número de serie y número de factura que identifica a la factura emitida)» |
| `1003` | «No se ha remitido el parámetro: fecha (El parámetro "fecha" es la fecha de expedición de la factura)» |
| `1004` | «No se ha remitido el parámetro: importe (El parámetro "importe" es el importe total de la factura)» |
| `2001` | «El NIF tiene un formato erróneo o no es válido» |
| `2002` | «El número de serie excede el número máximo de caracteres» |
| `2003` | «El número de serie contiene caracteres no permitidos» |
| `2004` | «La fecha de expedición tiene formato inválido y debe tener el formato DD-MM-AAAA» |
| `2005` | «El importe tiene un formato incorrecto» |
| `2006` | «El importe excede el número máximo de caracteres» |
| `3001` | «Se ha producido un error técnico en los sistemas de la Agencia Tributaria, por favor, inténtelo de nuevo más tarde» |
| `3002` | «Se ha excedido el número máximo de intentos permitidos por día, el acceso ha sido bloqueado» |

**F2 §9.3.1, p. 20:** «Nótese que en la respuesta existen dos mensajes de error encadenados.
Si se producen estos casos, se encadenan con “.” tanto en el campo “mensaje” como en “codigo_error”.»
(ej.: `"codigo_error": "1003.1004"`).

### 7.9 La huella NO va en el QR

**F11 (FAQ sede, 22/07/2026), pregunta 7:**

> «¿Hay que incluir la huella del registro de facturación (RF), o parte de ella, entre los datos que forman parte del código «QR» tributario de la factura, como en TicketBAI?
> **No.** La huella del RF no forma parte de los datos que se incluyen en el código «QR» tributario […]»

Diferencia importante frente a TicketBAI. Documentar en el README.

---

## 8. Endpoints SOAP

### 8.1 Direcciones (fuente: WSDL oficial, F7)

El WSDL es **idéntico byte a byte** en preproducción y producción
(SHA-256 `05919120708FF7650612FA6683C9336EAF919335D9A4DB10E86759190AF48602`, comprobado el 16/08/2026
descargando desde `prewww2.aeat.es` y desde `www2.agenciatributaria.gob.es`).
Contiene **ocho** `soap:address`:

**Servicio `sfVerifactu`** (sistemas que emiten facturas verificables):

| Puerto | Comentario literal del WSDL | Dirección |
|---|---|---|
| `SistemaVerifactu` | «Sistemas que emiten facturas verificables. Entorno de PRODUCCION» | `https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |
| `SistemaVerifactuSello` | «…Entorno de PRODUCCION para acceso con certificado de sello» | `https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |
| `SistemaVerifactuPruebas` | «…Entorno de PRUEBAS» | `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |
| `SistemaVerifactuSelloPruebas` | «…Entorno de PRUEBAS para acceso con certificado de sello» | `https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |

**Servicio `sfRequerimiento`** (sistemas que emiten facturas NO verificables, remisión bajo requerimiento):

| Puerto | Comentario literal del WSDL | Dirección |
|---|---|---|
| `SistemaRequerimiento` | «Sistemas que emiten facturas NO verificables. (Remision bajo requerimiento). Entorno de PRODUCCION» | `https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP` |
| `SistemaRequerimientoSello` | «…PRODUCCION para acceso con certificado de sello» | `https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP` |
| `SistemaRequerimientoPruebas` | «…Entorno de PRUEBAS» | `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP` |
| `SistemaRequerimientoSelloPruebas` | «…PRUEBAS para acceso con certificado de sello» | `https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP` |

> ⚠️ El host **cambia según el tipo de certificado**: `www1`/`prewww1` para certificado de persona
> física o de representante; `www10`/`prewww10` para **certificado de sello de entidad**.
> Esto es un detalle que rompe integraciones y que ninguna librería JS del ecosistema modela hoy.
> El brief pedía soportar los tres tipos de certificado: la selección de host es parte de eso.
>
> Obsérvese también que los hosts del **SOAP** (`www1`/`www10`/`prewww1`/`prewww10`) son
> **distintos** de los del **QR** (`www2` / `prewww2`).

### 8.2 Operaciones y binding

**F7**, `wsdl:portType`:

- `sfPortTypeVerifactu`: operaciones `RegFactuSistemaFacturacion` y `ConsultaFactuSistemaFacturacion`.
- `sfPortTypePorRequerimiento`: solo `RegFactuSistemaFacturacion`.

Ambos bindings: `<soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>`,
`use="literal"`, y **`soapAction=""` (vacío)** en todas las operaciones.

Elemento raíz del cuerpo de la petición de alta/anulación: `sfLR:RegFactuSistemaFacturacion`.
Elemento raíz de la respuesta: `sfR:RespuestaRegFactuSistemaFacturacion`.

### 8.3 Namespaces — trampa detectada

Los XSD/WSDL se **descargan** de rutas que contienen `tikeV1.0`:

`https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroLR.xsd`

pero sus `targetNamespace` **no llevan el `V1.0`** y apuntan a `www2.agenciatributaria.gob.es`:

```
https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd
https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd
https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaSuministro.xsd
https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/ConsultaLR.xsd
https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaConsultaLR.xsd
https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SistemaFacturacion.wsdl
```

`elementFormDefault="qualified"` en `SuministroLR.xsd` y en `SuministroInformacion.xsd`
→ **todos** los elementos hijos van cualificados con su namespace.

Copiar la URL de descarga como namespace es un error silencioso que produce XML rechazado.
Anotado como caso de test obligatorio en `@verifactu/xml`.

### 8.4 Límite de lote

**F8**, `SuministroLR.xsd`:

```xml
<element name="RegFactuSistemaFacturacion">
    <complexType>
        <sequence>
            <element name="Cabecera" type="sf:CabeceraType"/>
            <element name="RegistroFactura" type="sfLR:RegistroFacturaType" maxOccurs="1000"/>
        </sequence>
    </complexType>
</element>
```

→ **máximo 1.000 registros por envío** (`[VERIFICAR]` del brief §5.2, resuelto).

Confirmado por **F9, anexo §2.2**:

> «Bloque que se utiliza en los casos de remisión, pudiéndose repetir de 1 a 1.000 veces.»

y **F9, anexo §4**:

> «podrá repetirse tantas veces como sea necesario (hasta un máximo de 1.000 por fichero remitido) […] En una misma remisión pueden incluirse indistintamente bloques de «RegistroFactura» que contengan un bloque 3 «RegistroAlta», junto con bloques de «RegistroFactura» que contengan un bloque 4 «RegistroAnulacion».»

→ Se pueden mezclar altas y anulaciones en el mismo envío.

`RegistroFacturaType` es un `choice` entre `sf:RegistroAlta` y `sf:RegistroAnulacion`.

### 8.5 Control de flujo — `TiempoEsperaEnvio`

**F4 (Descripción del servicio web v1.0.3), §6.4.4.1 «Mecanismo de control de flujo», p. 40**,
que cita el art. 16.2 de la Orden:

> «2. Los sistemas informáticos «VERI\*FACTU» deberán implementar un mecanismo de control de flujo basado en el tiempo de espera entre envíos, el cual tomará **inicialmente el valor de 60 segundos**, y en el número máximo de registros admitidos en cada envío.
> Los mensajes de respuesta de la Agencia Estatal de Administración Tributaria informarán sobre el valor de este parámetro, el cual deberá ser tenido en cuenta para el siguiente envío. […]
> El funcionamiento será el siguiente:
> a) El sistema informático realiza el envío del primer conjunto de registros de facturación […]
> b) La Agencia Estatal de Administración Tributaria devuelve, entre otros datos, un valor actualizado del parámetro de tiempo de espera «t» entre envíos.
> c) Para poder realizar el siguiente envío, el sistema informático deberá esperar a que transcurran «t» segundos desde el anterior envío **o** deberá esperar a tener acumulados un número de registros de facturación igual al límite establecido en el diseño de registro para cada envío, **la circunstancia que ocurra primero**.
> d) El sistema informático realiza un nuevo envío cumpliendo con lo establecido en la letra c). En la respuesta puede recibir una nueva actualización del valor del parámetro «t».»

Ejemplo literal de la respuesta (**F4, p. 40**):

```xml
<sf:TiempoEsperaEnvio>60</sf:TiempoEsperaEnvio>
```

Descripción del campo en la tabla de respuesta (**F4, p. 38**):

> «Segundos de espera entre envíos. Para poder realizar el siguiente envío, el sistema informático deberá esperar a que transcurran `<TiempoEsperaEnvio>` segundos desde el anterior envío o deberá esperar a tener acumulados un número de registros de facturación igual al límite establecido en el diseño de registro para cada envío, la circunstancia que ocurra primero» — tipo `Numérico`.

→ La cola de `@verifactu/client` debe implementar exactamente esa disyunción:
`esperar min(t segundos, hasta acumular 1000 registros)`. Es un **o**, no un **y**.
El valor arranca en 60 s **antes del primer envío**.

### 8.6 Estados de respuesta

**F4, p. 37-39 y listas L18/L19:**

Estado global del envío (`EstadoEnvio`, alfanumérico(20), lista **L18**):

| Valor | Descripción (cita F4) |
|---|---|
| `Correcto` | «Todos los registros de facturación de la remisión tienen estado “Correcto”.» |
| `ParcialmenteCorrecto` | «Algunos registros de la remisión tienen estado “Incorrecto” o “AceptadoConErrores”.» |
| `Incorrecto` | «Todos los registros de la remisión tienen estado “Incorrecto”.» |

Estado por línea (`EstadoRegistro`, alfanumérico(18), lista **L19**):

| Valor | Descripción (cita F4) |
|---|---|
| `Correcto` | «El registro de facturación es totalmente correcto y se registra en el sistema.» |
| `AceptadoConErrores` | «El registro de facturación tiene errores que no provocan su rechazo. Se registra en el sistema.» |
| `Incorrecto` | «El registro de facturación tiene errores que provocan su rechazo. No se registra en el sistema.» |

Otros campos de `RespuestaLinea` relevantes (**F4, pp. 38-39**): `IDFactura`,
`Operacion/TipoOperacion` («Alta» o «Anulacion», lista L22), `Subsanacion`, `RechazoPrevio`,
`SinRegistroPrevio`, `RefExterna`, `CodigoErrorRegistro` (alfanum. 5, lista **L20**),
`DescripcionErrorRegistro` (alfanum. 500), y el bloque `RegistroDuplicado` con
`IdPeticionRegistroDuplicado` y `EstadoRegistroDuplicado` («Correcta, AceptadaConErrores y Anulada»,
lista L21) que solo se suministra «si el registro enviado es rechazado por estar duplicado».

**Consecuencia para el brief §5.4:** el reintento con backoff **nunca** debe dispararse ante
`Incorrecto` ni ante `AceptadoConErrores`; solo ante fallo de transporte. Y `AceptadoConErrores`
**se registra en el sistema** — reenviarlo produciría un duplicado.

### 8.7 Qué provoca «Aceptado con errores» relacionado con la huella

**F3 (Validaciones v1.2.2), §23 (alta) y §7 (anulación)**, texto idéntico:

> «Se validará que la huella o «hash» generado sea acorde a las especificaciones y formato detallados en el documento “Especificaciones técnicas para generación de la huella o «hash» de los registros de facturación” publicado en Sede Electrónica de la AEAT. En caso contrario, se devolverá un aviso de error (no generará rechazo).»

y **F1 §7 «Validación», p. 13**:

> «Cuando en una remisión de un sistema «VERI\*FACTU» la huella informada no coincida con el cálculo realizado por la AEAT, el registro de facturación se marcará como “Aceptado con errores”.»

→ **Una huella mal calculada NO produce rechazo**: produce aceptación con errores.
Esto significa que un bug en la huella **no se detecta mirando si el envío “funciona”**.
Refuerza que la única defensa real son los vectores y los tests, no la prueba de humo contra
preproducción. Es exactamente la razón de existir de este proyecto.

---

## 9. Estado del arte (competencia) — hallazgos con impacto en el plan

### 9.1 `mdiago/VeriFactu` (.NET)

Clonado el 16/08/2026 (`git clone --depth 1`, HEAD de `main`).

**Hallazgo 1 — no tiene suite de tests.** El brief (§3, «Acción concreta») asume que sí:
«clona `mdiago/VeriFactu` y extrae de su suite de tests los vectores de prueba». **Esa premisa es falsa.**
La solución `VeriFactu.sln` contiene 7 proyectos (`NetCore`, `NetFramework`, `NetFramework461`,
`NetFramework472`, y 3 de interop COM). Ninguno referencia xunit, NUnit, MSTest ni
`Microsoft.NET.Test.Sdk`. No existe carpeta de tests. Búsqueda de literales hexadecimales de 64
caracteres en todo el repo (`*.cs`, `*.md`, `*.xml`, `*.txt`): **2 coincidencias, ambas en el README**.

**Hallazgo 2 — el único vector aprovechable está en el README**, no en tests, y **lo he reproducido**
(§1.9). Es un vector real y útil: NIF distinto al de la AEAT, serie con guiones, huella previa presente,
importes con un solo decimal.

**Hallazgo 3 — licencia AGPL-3.0**, no permisiva. El brief decía «respeta su licencia: no copies
código». Con AGPL-3.0 la precaución debe ser mayor que con MIT: **no derivar estructura de tipos,
nombres de clase ni algoritmos de su código**. Los vectores (pares entrada→hash) son datos
fácticos no protegibles por copyright, y además se citan. Con eso basta y es lo único que se toma.

**Hallazgo 4** — el repo incluye una copia del PDF de la huella de la AEAT
(`NetFramework/Doc/Veri-Factu_especificaciones_huella_hash_registros.pdf`), y una colección de
«Declaración Responsable» versionadas (v1.0.4-alpha … v1.0.64-release) que son un buen ejemplo
de cómo un productor documenta la declaración responsable exigida (§11 del brief).

### 9.2 `zarpilla/verifactu-node-lib`

MIT, ~6 estrellas. Cubre generación de registros, encadenamiento, huella, QR (data URL) y
validación; tiene tests con Jest. **No cubre**: envío SOAP a la AEAT, gestión de certificados,
firma electrónica. Su propio README declara «**NOT** sends invoices to AEAT».

→ Hueco confirmado: **no hay librería JS que hable con el servicio SOAP de la AEAT**.

### 9.3 `EduardoRuizM/verifactu-api-nodejs`

MIT, ~15 estrellas, última actividad ~marzo 2025. Es una **aplicación**, no una librería:
exige MySQL/MariaDB con esquema propio (`mysql.sql`), incluye framework HTTP propio
(JuNe BackServer), y expone API REST. Sí implementa huella SHA-256, QR, certificado PKCS#12,
envíos de hasta 1000 facturas y espaciado entre envíos. **No tiene tests automatizados.**

→ Buena referencia funcional del flujo completo; inservible como dependencia.

### 9.4 Conclusión sobre el foso

Ninguno de los tres proyectos ofrece: (a) validación contra los XSD oficiales en CI,
(b) tests contra preproducción, (c) mapa de errores AEAT en castellano, (d) core isomórfico sin
dependencias, (e) `verifyChain`. La tesis del brief se sostiene. Lo que cambia es que
**los vectores oficiales hay que sacarlos de la AEAT, no de mdiago** — y ya están (§1.8, §2.3).

---

## 10. Discrepancias detectadas entre fuentes

| # | Discrepancia | Resolución aplicada |
|---|---|---|
| **D-1** | **F1 (huella)** dice que los valores «deberán tener la misma información contenida en el campo correspondiente del fichero XML» pero también que los ceros a la derecha «no tienen relevancia». Ambas cosas no pueden ser simultáneamente ciertas para un hash SHA-256, que es bit-exacto. | Gana la interpretación operativa: **hashear el literal serializado**. La «irrelevancia» es una propiedad del recalculo de la AEAT, no de nuestra generación. Ver I-04. |
| **D-2** | **F5 (diseño de registro)** exige `YYYY-MM-DDThh:mm:ssTZD (ISO 8601)` con huso; **F8 (XSD)** solo declara `type="dateTime"`, que admite valores sin huso. | Gana la documentación técnica de diseño de registro (regla del brief §3). La librería **exige** offset explícito. El XSD no protege: validar en `core`. |
| **D-3** | **F3 (validaciones)** impone que `IdSistemaInformatico` sean dos posiciones de `[A-Z0-9]` excepto `Ñ`; **F8 (XSD)** solo impone `maxLength=2`. | Gana F3. Validar en `core`; un XML con `id` inválido pasa el XSD y falla en la AEAT. |
| **D-4** | Las URL de descarga de XSD/WSDL contienen `tikeV1.0`; los `targetNamespace` declarados dentro contienen `tike` (sin versión) y apuntan a `www2.agenciatributaria.gob.es`. | Los namespaces son los declarados en los ficheros. Ver §8.3. Test obligatorio. |
| **D-5** | **F9 (Orden)** describe el registro de anulación como «NIF del emisor / Numero de factura y serie / Fecha de expedición»; **F1** usa los nombres literales `IDEmisorFacturaAnulada`, `NumSerieFacturaAnulada`, `FechaExpedicionFacturaAnulada`. | Gana F1: en la cadena de la huella van los nombres **con sufijo `Anulada`**. Verificado por el vector oficial del caso 3. |
| **D-6** | El texto consolidado de **F9** en BOE trae los anexos con los diseños de registro **como imágenes**, no como texto (páginas 18, 19, 21, 23-27 salen vacías al extraer). | El diccionario de datos operativo es **F5 (XLSX v1.0)**, no el PDF del BOE. |
| **D-7** | El PDF del QR (**F2 v0.5.0**) arrastra la cabecera «Versión: 0.4.2» en su última página (35/35). | Errata editorial de la AEAT. La versión del documento es 0.5.0 (portada e histórico). Sin impacto técnico. |
| **D-8** | Tanto **F1** como **F2** se refieren a la Orden como «la Orden XXXXXXX» / «orden XXXXXXXXXXX» (placeholder sin rellenar tras la publicación). | Se trata de la Orden HAC/1177/2024. Sin impacto técnico, pero indica que la AEAT no ha revisado esos documentos desde antes de la publicación en BOE. |
| **D-9** | **F4** documenta `CodigoErrorRegistro` como «alfanumérico(5)» con lista L20; **F8** (`RespuestaSuministro.xsd`) lo declara `ErrorDetalleType` = `<restriction base="integer"/>`, **sin facetas**: ni longitud, ni mínimo, ni máximo. | Gana el XSD para el parseo: leerlo como entero y **no** asumir 5 posiciones ni ceros a la izquierda. Conservar además el literal recibido. Auditado el 16/08/2026 (I-16). |
| **D-10** | `DescripcionErrorRegistro` es `TextMax1500Type` en `RespuestaLinea` pero `TextMax500Type` dentro de `RegistroDuplicado` — **mismo nombre de elemento, dos longitudes máximas** según dónde aparezca. F4 documenta 500 para ambos. | No compartir un solo tipo entre los dos contextos. Auditado el 16/08/2026 (I-16). |
| **D-11** | `TiempoEsperaEnvio` se documenta como «Numérico» en F4; el XSD lo declara `Tipo6Type`, que es **`string`** con `pattern="\d{0,4}"`. Admite la cadena vacía y topa en 9999 s. | Parsear defensivamente: cadena vacía ⇒ sin dato, no `0`. Auditado el 16/08/2026 (I-16). |
| **D-12** | `EstadoRegistro` usa masculinos (`Correcto`, `AceptadoConErrores`, `Incorrecto`); `EstadoRegistroDuplicado` usa **femeninos y un conjunto distinto** (`Correcta`, `AceptadaConErrores`, **`Anulada`**). | Son dos enumeraciones distintas, no una compartida con otro género. `Anulada` no existe en la primera ni `Incorrecto` en la segunda. Auditado el 16/08/2026 (I-16). |
| **D-13** | El elemento `RechazoPrevio` es `RechazoPrevioType` (**S/N/X**) dentro de `RegistroAlta` y `RechazoPrevioAnulacionType` (**S/N**) dentro de `RegistroAnulacion`. Mismo nombre, dominio distinto según el contexto. | Tipar por contexto. Un `X` en una anulación no valida contra el XSD. Auditado el 16/08/2026 (I-16). |
| **D-14** | **F2 (QR)** §6 admite para `numserie` «ASCII 32-126» **sin** excluir los cinco caracteres que **F3** §3.1.3.1 sí prohíbe en `NumSerieFactura`. Un `=` sería aceptable para el servicio de cotejo e inaceptable para el registro. | Gana F3, que es la que rige el registro: `core` rechaza los cinco. Consecuencia práctica: la sonda del QR **no** puede cerrar I-28, porque mide otro servicio con otras reglas. Ver §18.4. |
| **D-15** | El histórico de revisiones de **F3** sitúa la restricción de caracteres en «sección 3.1. **Validaciones sintácticas**» (rev. 1.1.3 y 1.1.4); el título real de §3.1 en ese mismo documento es «Validaciones de **negocio**». | Sin impacto en la consecuencia: F3 §3 (p. 6) establece que **ambas** categorías, a nivel de registro, «provocarán el rechazo del registro, pero se seguirán procesando el resto». Ver §18.4. |
| **D-16** | **F3** §3.1.1 hace `RemisionVoluntaria` exclusiva de los sistemas verificables y `RemisionRequerimiento` exclusiva —y obligatoria— de los no verificables; el **XSD** declara ambos bloques como `minOccurs="0"` independientes, así que admite los dos a la vez y ninguno de los dos. | Gana F3. `@verifactu-js/xml` rechaza la combinación con `CABECERA_INCOHERENTE`. Ver §19.3. |
| **D-17** | El XSD admite `<RemisionVoluntaria/>` vacío: sus dos hijos son opcionales. Sintácticamente válido, semánticamente nada. | Se omite el bloque entero en lugar de emitirlo vacío, igual que con las listas vacías. Ver §19.3. |

---

## 11. Incógnitas

> Todo lo que **no** he podido confirmar en fuente oficial. Nada de esto debe entrar en el
> código como supuesto silencioso: cada punto va a `TODO(verify: I-XX)` con enlace a este apartado.

### Clasificación de bloqueo

Ninguna incógnita impide **empezar a implementar**: los cuatro vectores verificados fijan el
comportamiento del camino principal, y todo lo que falta son casos borde aislables tras una API
estable. Lo que sí condicionan es **qué se puede prometer al publicar**:

| Etiqueta | Significado |
|---|---|
| `BLOQUEA-ESTABLE` | No impide implementar ni publicar `0.1.0` como **preestreno**. Impide declarar `0.1.0` **estable** (o subir a `1.0.0`) sin resolverla. Debe quedar documentada en el README y cubierta por un test `it.todo` o `skip` con enlace a esta sección. |
| `BLOQUEA-FASE-N` | Impide cerrar la fase N indicada. |
| `ABIERTA` | Anotada; sin impacto inmediato en el código de la fase 1. |

### Canonicalización de la huella — `BLOQUEA-ESTABLE`

Afectan a casos borde (Unicode, signos, decimales exóticos), **no** al camino principal.
La estrategia es aislarlas tras la API (`canonicalize.ts`) y resolverlas contra preproducción
antes de declarar `0.1.0` estable.

- **I-01 ~~`BLOQUEA-ESTABLE`~~ `NO BLOQUEA` (19/08/2026) — Semántica exacta de «espacios» en el trim.** Sin medir y **sin poder medirse por esta vía**: el NBSP se rechaza con el código 1130 antes de llegar a comparar huellas (S-5). Como `NumSerieFactura` es el único campo de texto libre que entra en la huella y está restringido a ASCII en los dos extremos, ningún carácter de la zona gris alcanza nunca una huella. Inalcanzable por construcción. Ver §24.2 y §24.6.
  Texto original: F1 dice «eliminando los espacios al inicio
  y al final de cada valor». La referencia Java usa `String.trim()` (recorta `<= U+0020`).
  No consta si la AEAT, al recalcular, aplica esa misma semántica o un trim Unicode.
  Impacto: valores con NBSP/tab/newline en los bordes. **Propuesta: replicar Java. Sin confirmar.**
- **I-02 ~~`BLOQUEA-ESTABLE`~~ `RESUELTA` (19/08/2026) — Espacios interiores.** Medida en S-5: una serie con dos espacios seguidos vuelve `Correcto` (CSV `A-TDPEZN6FG2CYFE`). La AEAT **no los colapsa** y calcula la misma huella. Ver §24.1.
  Texto original: El ejemplo `12345678 / G33` demuestra que se conservan, pero
  no consta si la AEAT colapsa espacios interiores múltiples al recalcular
  (XML `xs:string` no normaliza, pero algunos parsers sí). **Sin confirmar.**
- **I-03 ~~`BLOQUEA-ESTABLE`~~ `NO BLOQUEA` (19/08/2026) — Normalización Unicode.** Sin medir y **sin poder medirse por esta vía**: la AEAT rechaza el no-ASCII en la serie con el código 1130 (S-5, acento combinante `U+0301`; antes el NBSP). Mismo razonamiento que I-01 — ningún carácter que la normalización pueda tocar entra en una huella. De paso confirma que `core` **no** es más estricto que la AEAT al restringir a ASCII 32-126. Ver §24.6.
  Texto original: No consta si la cadena debe estar en NFC antes de codificar a
  UTF-8. Un `NombreRazon` o un `NumSerieFactura` con `é` precompuesta vs. descompuesta produce
  bytes distintos. Ningún documento lo menciona. **Sin confirmar.** (Nota: `NumSerieFactura` es
  el único campo de texto libre que entra en la huella del alta, y el QR limita `numserie` a
  ASCII 32-126 — pero la huella no impone esa restricción explícitamente.)
- **I-04 ~~`BLOQUEA-ESTABLE`~~ `RESUELTA` (19/08/2026) — Mecanismo de tolerancia decimal de la AEAT.** Medida en S-5: `121.10` y `121.1` —el mismo importe, dos escrituras— vuelven los dos `Correcto`, cada uno con su huella sobre su propio literal. **No hay que normalizar nada antes de hashear.** Queda un matiz que el par no separa —si la AEAT hashea el literal o prueba variantes— y que no cambia ninguna decisión: ver §24.7.
  Texto original: F1 dice que `123.1` y `123.10` son
  «igualmente válidos». No consta **cómo**: ¿la AEAT prueba ambas variantes?, ¿normaliza a 2
  decimales?, ¿normaliza quitando ceros a la derecha? Tampoco consta el comportamiento con
  `123` (sin punto), `123.` (punto sin decimales, que el XSD permite: `(\.\d{0,2})?`),
  `+123.45` (signo explícito, permitido por el XSD) o `-0.00`. **Sin confirmar. Alto riesgo.**
- **I-05 ~~`BLOQUEA-ESTABLE`~~ `RESUELTA` (19/08/2026) — Importes negativos y signo.** Medida en S-5: `+121.00` y `-121.00` vuelven los dos `Correcto`, con las huellas sobre esos literales. El `+` explícito viaja y entra en la huella tal cual, y el negativo de una rectificativa por diferencias también. **La huella no es función del importe sino de cómo se escriba.** Ver §24.8.
  Texto original: El XSD permite `(\+|-)?`. No hay ningún ejemplo oficial
  de huella con importe negativo (facturas rectificativas por diferencias). No consta si el `+`
  explícito se conserva en la cadena de la huella. **Sin confirmar.**

- **I-28 ~~`BLOQUEA-ESTABLE`~~ `RESUELTA` (19/08/2026) — Separadores sin escapar dentro de los valores.** Medida en la sonda S-3: el `&` vuelve `Correcto` y la AEAT calcula la misma huella. El texto oficial del código 1287 enumera `<`, `>`, `"`, `'` y `=`, y **no incluye el `&`**. La decisión de permitirlo queda confirmada por medición. §18.4 también cerrada: la restricción alcanza a la anulación, aunque el `%s` devuelva un nombre genérico. Ver §23.
  Texto original de la incógnita: La cadena canónica
  usa `&` y `=` como separadores y **no escapa nada** dentro de los valores. Si
  `NumSerieFactura` valiera `A&B`, la cadena queda visualmente ambigua:
  `…&NumSerieFactura=A&B&FechaExpedicionFactura=…`

  **Parcialmente resuelto (16/08/2026).** Ver §18 para el análisis completo. Resumen:
  F3 v1.2.2 §3.1.3.1 **prohíbe `=`** (junto a `"`, `'`, `<`, `>`) en `NumSerieFactura`, lo que
  hace imposible falsificar un límite de campo. `&` **no** está prohibido, pero por sí solo es
  inocuo. Queda abierto que la restricción está documentada **solo para el alta**, no para
  `NumSerieFacturaAnulada`.

### Fechas y reloj

- **I-06 `ABIERTA` — Valor del «margen de error»** admitido entre `FechaHoraHusoGenRegistro` y el reloj de
  la AEAT. F3 lo menciona tres veces sin cuantificarlo. La FAQ F6 cita un umbral de **1 minuto**
  pero referido a otra cosa (comparación entre el registro anterior y el actual, art. 7.i.2º de la
  Orden), no a la comparación contra el reloj de la AEAT. **Sin confirmar.**
- **I-07 ~~`BLOQUEA-ESTABLE`~~ `RESUELTA` (18/08/2026) — Fracciones de segundo.** `xs:dateTime` las
  admite; el formato documentado `YYYY-MM-DDThh:mm:ssTZD` no las contempla.
  **Medida en preproducción (sonda S-2):** `2026-08-18T17:19:06.123+02:00` →
  **`Incorrecto`, código 1244** «El campo FechaHoraHusoGenRegistro tiene un formato incorrecto».
  La AEAT las **rechaza**. La mitigación de fase 1 era correcta y se mantiene. Ver §22.
- **I-08 ~~`BLOQUEA-ESTABLE`~~ `RESUELTA` (19/08/2026) — Offset `Z` vs `+00:00`.**
  Para Canarias en invierno el offset es cero.
  **Medido:** `2026-08-18T15:21:06Z` → **`Correcto`**. La AEAT acepta `Z` **y hashea el literal tal
  y como llega**: si hubiera normalizado a `+00:00` antes de calcular la huella, su digest habría
  diferido del nuestro y habría contestado 2000. No lo hizo. Eso cierra el miedo de fondo de toda
  la incógnita — **la AEAT no normaliza el `xs:dateTime` antes de hashear** — y obliga a que la
  inspección no trate `Z` como defecto: una cadena histórica que lo lleve es válida y verificable.
  **Y `+00:00` explícito también se acepta** (sonda S-2b, 19/08/2026):
  `2026-08-18T23:36:50+00:00` → **`Correcto`**, CSV `A-T5BLBWD7HKASYZ`. Es el caso de Canarias en
  invierno y es exactamente lo que emitimos allí, así que el caso Canarias del brief
  (`VERIFACTU-BRIEF.md` §6.2) queda cubierto.
  **Las dos formas del huso cero valen**, y cada una se hashea como viene escrita: son literales
  distintos, con huellas distintas, y las dos correctas. Ver §22.7.
  **Mitigación en fase 1, que se mantiene:** emitir siempre `+00:00`, nunca `Z`, y rechazar `Z` en
  la entrada. Que `Z` sea válido no es motivo para empezar a emitirlo.
- **I-09 ~~`BLOQUEA-ESTABLE`~~ `RESUELTA` (18/08/2026) — Offsets con segundos** (`+01:00:00`) **o sin
  dos puntos** (`+0100`): permitidos por `xs:dateTime` el primero, no el segundo.
  **Medidos en preproducción (sonda S-2):** los dos → **`Incorrecto`, código 1244**. El offset es
  **exactamente `±hh:mm`**, ni más ni menos. La mitigación de fase 1 era correcta y se mantiene.
  Nótese que la AEAT usa esa misma forma en su propio `TimestampPresentacion`. Ver §22.

### QR

- **I-10 `RESUELTA` (16/08/2026) — Codificación exacta de los parámetros del QR.** Ver §17.
  Resumen: el servicio decodifica **form-urlencoded**, luego `+` sin escapar se lee como espacio.
  `encodeURIComponent` es correcto porque escapa `+` a `%2B`. Texto original de la incógnita:
  `URLEncoder` (form-urlencoded, espacio → `+`) vs `encodeURIComponent` (espacio → `%20`);
  el único ejemplo oficial con carácter especial (`&` → `%26`) no discriminaba.
- **I-11 `BLOQUEA-FASE-2` — Formato del `importe` en la URL del QR.** F2 dice «máximo 12 dígitos en la parte entera,
  y 2 dígitos en la parte decimal», y los ejemplos usan `241.4` (un decimal) y `241.40`.
  No consta si es obligatorio 2 decimales, ni cómo se representan importes negativos.
  **Sin confirmar.**
- **I-12 `ABIERTA` — Coherencia `importe` del QR ↔ `ImporteTotal` del registro.** La respuesta JSON del
  cotejo devuelve el importe y F2 rev. 0.4.7 menciona «Nuevo mensaje informativo en respuesta de
  cotejo de QR sobre importe», pero no consta la tolerancia. **Sin confirmar.**
- **I-13 `ABIERTA` — Tamaño mínimo en píxeles / DPI.** La norma da milímetros (30×30 a 40×40) y nivel de
  corrección M. Para render SVG/PNG hay que elegir un DPI. No hay norma oficial. **Sin confirmar.**
- **I-14 `BLOQUEA-FASE-2` — «Modo verificable» ≠ «modo VERI\*FACTU».** F2 distingue «sistema que emite facturas
  verificables» de «no verificables» y usa URLs distintas, pero un SIF **no** VERI\*FACTU que
  remite bajo requerimiento ¿usa `ValidarQRNoVerifactu` siempre? No he encontrado la regla
  explícita de qué URL usar cuando un sistema puede operar en ambos modos. **Sin confirmar.**

### Servicio SOAP y errores

- **I-15 `BLOQUEA-FASE-3` — Listado de códigos de error (`errores.properties`).** Marcado «Con certificado» en la
  sede. **No obtenido.** Es la base del mapa de errores en castellano (`VERIFACTU-BRIEF.md` §6.3).
  Sin él, el mapa hay que construirlo desde el PDF F3 (que describe validaciones, no la tabla
  código→mensaje completa).
  **Actualización (16/08/2026):** deja de ser un bloqueo estructural. El fichero está en
  `prewww2.aeat.es`, y ese host admite cualquier certificado electrónico cualificado (ver I-27),
  luego es descargable con el mismo certificado que se use para los tests de integración.
  **CERRADA (18/08/2026).** Descargado por la sonda S-1 contra **preproducción**
  (`prewww2.aeat.es`, ruta `tikeV1.0`), HTTP 200, 25 232 bytes,
  `sha256 06519ceb23422bd6b0ad3bfb659e3007615050da4920781d12cff536481d5902`. **247 códigos** en
  tres secciones. El fichero está en `docs/reference/AEAT_errores.properties` con su hash en el
  manifiesto, y compilado en `@verifactu-js/client` (`CODIGOS_AEAT`, `explicarCodigo`). El
  análisis y lo que cambia está en **§21**. Resultó no requerir certificado —se sirve en abierto—,
  pero el marcado «Con certificado» de la sede no era falso: lo que hay detrás del certificado es
  la *página* que lo enlaza, no el fichero.
- **I-16 — Estructura completa de `Cabecera` y `RespuestaSuministro`.**
  **Auditada campo a campo el 16/08/2026** contra `RespuestaSuministro.xsd` y
  `SuministroInformacion.xsd`. Resultado: cinco divergencias entre lo que documenta F4 y lo que
  declara el XSD, todas anotadas como **D-9 … D-13** en §10. Ninguna afecta a la huella; todas
  afectan al parseo de la respuesta (fase 2). **Cerrada.**
- **I-17 — `IdPeticion` / correlación de envíos.** Aparece `IdPeticionRegistroDuplicado` en la
  respuesta, luego existe un `IdPeticion`. No he documentado cómo se genera ni si lo asigna la AEAT.
  **Sin confirmar.**
- **I-18 — Comportamiento del control de flujo ante error.** Si un envío devuelve `Incorrecto`
  global o falla el transporte, ¿corre igualmente el temporizador `t`? **Sin confirmar.**
- **I-19 — Requisitos TLS/mTLS concretos** (versiones de TLS, cifrados, formato de cadena de
  certificados, si se admite `.p12` con contraseña vacía). No documentado en F4. **Sin confirmar.**
- **I-20 — Compresión / tamaño máximo de mensaje** (¿gzip?, ¿límite de bytes además del de 1000
  registros?). **Sin confirmar.**
- **I-21 — Endpoint del servicio de validación de registros NO VERI\*FACTU.** Existe
  `RespuestaValRegistNoVeriFactu.xsd` entre los esquemas publicados, pero **no aparece en el WSDL**
  descargado. **Sin confirmar** dónde vive esa operación.

### Modo no verificable (fase 5) y misceláneos

- **I-22 — Detalles de la firma XAdES.** F9 art. 14 remite a «los detalles técnicos que para su
  generación se recojan en la sede electrónica». Existe una página específica de la sede
  («Especificaciones técnicas de la firma electrónica de los registros de facturación y de evento»)
  que **no he descargado ni leído** en esta fase, por estar fuera del alcance de v1.
- **I-23 — Catálogo completo de tipos de evento** (`TipoEvento`) y estructura del `RegistroEvento`.
  Está en `EventosSIF.xsd` (descargado) y en F5 hoja 4, pero no auditado. Fase 5.
- **I-24 — `ImporteTotal`: fórmula exacta de cálculo.** F5 dice literalmente «Se detallará la forma
  de calcularlo en la documentación correspondiente en la sede electrónica de la AEAT (documento de
  validaciones...)». F3 contiene la validación con margen «+/- 10,00 euros» y exclusiones por
  `ClaveRegimen` («03», «05», «06», «08» o «09»), pero **no he transcrito la fórmula completa**.
  Necesario para `@verifactu/core` si se quiere validar coherencia; no necesario para la huella.
- **I-25 `RESUELTA por decisión` (16/08/2026) — Validación de NIF con dígito de control.**
  Ver §15. Resumen: **error duro** para DNI, NIE y K/L/M; **aviso** para NIF de entidad;
  la validación nunca bloquea el cálculo de la huella. Texto original de la incógnita: El XSD solo impone `length=9`. F3 valida
  contra el censo de la AEAT (algo que una librería offline no puede hacer). El brief pide
  validación de NIF/CIF/NIE con dígito de control: eso es **más estricto que el XSD y menos que la
  AEAT**, y podría rechazar NIF válidos poco comunes. Decisión pendiente: ¿error o *warning*?
- **I-26 `RESUELTA` (16/08/2026) — Disponibilidad del scope npm `@verifactu`.**
  **Ocupados el scope `@verifactu` y el nombre `verifactu`.** Ver §14 para la comprobación,
  el experimento de control y las alternativas libres.
- **I-27 `PARCIALMENTE RESUELTA` (16/08/2026) — Certificado para el entorno de preproducción.**
  Ver §13. **La AEAT no emite certificados de prueba: sirve un certificado electrónico
  cualificado real** (FNMT de persona física / autónomo incluido). Queda abierto el subconjunto
  de detalles operativos listado en §13.4.

---

## 12. Resumen ejecutivo: lo que ya está cerrado y se puede implementar sin riesgo

1. Cadena de la huella de **alta**: 8 campos, orden, nombres literales, `=`, `&`, sin `&` final. ✅
2. Cadena de la huella de **anulación**: 5 campos con sufijo `Anulada` en los tres primeros. ✅
3. Campo vacío → `nombre=` (nombre + `=` + nada). Primer registro → `Huella=`. ✅
4. UTF-8, sin BOM, sin terminador. SHA-256. Hex **mayúsculas**, 64 caracteres. ✅
5. **3 vectores oficiales + 1 de terceros, los cuatro verificados byte a byte.** ✅
6. `FechaHoraHusoGenRegistro`: `YYYY-MM-DDThh:mm:ss±hh:mm`, huso del sistema, sin zona por defecto. ✅
7. `TipoHuella` = `01`. `IDVersion` = `1.0`. `PrimerRegistro` = `S`. ✅
8. Bloque `SistemaInformatico`: 8 campos + `choice` NIF/IDOtro, orden del XSD, semántica de los tres S/N. ✅
9. QR: 4 URLs base, 4 parámetros en orden `nif,numserie,fecha,importe`, textos literales, 30-40 mm, nivel M. ✅
10. SOAP: 8 endpoints (4 verifactu + 4 requerimiento, con variante de certificado de sello),
    document/literal, `soapAction` vacío, lote máximo 1000, `TiempoEsperaEnvio` inicial 60 s. ✅

### 12.1 Qué bloquea qué

**Nada impide arrancar la fase 1.** Los cuatro vectores verificados fijan el camino principal.

Lo que sí está condicionado, según la clasificación de §11:

| Hito | Incógnitas que lo bloquean |
|---|---|
| Empezar a implementar `@verifactu/core` | **ninguna** |
| Publicar `0.1.0` como **preestreno** (con las salvedades en el README) | **ninguna** |
| Declarar `0.1.0` **estable** | **ninguna** (19/08/2026) · ver §12.2 |
| Cerrar fase 2 (`xml` + `qr`) | I-10, I-11, I-14 |
| Cerrar fase 3 (`client`) | ~~I-15~~ (cerrada 18/08/2026, §21) |

Las `BLOQUEA-ESTABLE` afectaban a casos borde (Unicode, signos, decimales exóticos, formato del
offset) y **todas** se aislaron en un único módulo de canonicalización, de modo que resolverlas más
adelante no obligara a rediseñar la API. Esa apuesta salió bien: **ninguna obligó a cambiar la API**,
y la única que habría cambiado el comportamiento —si la AEAT hubiera normalizado antes de hashear—
resultó no darse.

**Todas resueltas o degradadas el 19/08/2026**, con un certificado electrónico cualificado real y
**dieciocho registros** contra preproducción (§13, §21-§24). El código ya no tiene ningún
`TODO(verify:)` de los que bloqueaban: solo queda I-25, que no bloquea nada.

### 12.2 Qué queda para declarar `core` estable (revisado el 19/08/2026)

Cerradas I-07, I-08 e I-09 (§22), quedan cinco. Y ha cambiado algo que las afecta a todas:
**ahora son medibles**. Antes, un desacuerdo de huella con la AEAT era invisible —o el registro
pasaba, o fallaba por cualquier otra razón—. Con el código **2000** de la tabla de S-1
(«El cálculo de la huella suministrada es incorrecta») cada una de estas cinco preguntas tiene un
oráculo directo: se envía un registro con el literal dudoso, hasheado a nuestra manera, y la
respuesta dice si la AEAT calculó lo mismo.

| Incógnita | ¿Abierta? | ¿Bloquea estable? | Coste de cerrarla |
|---|:--:|:--:|---|
| **I-01** trim de espacios | en el papel | **no** | Inalcanzable por construcción (§24.2, §24.6) |
| **I-02** espacios interiores múltiples | **CERRADA** | no | Medida: no los colapsa (§24.1) |
| **I-03** normalización Unicode (NFC/NFD) | en el papel | **no** | Inalcanzable por construcción (§24.6) |
| **I-04** tolerancia decimal | **CERRADA** | no | Medida: no normaliza (§24.7) |
| **I-05** signo en importes | **CERRADA** | no | Medida: el signo entra tal cual (§24.8) |

> **Cerrado el 19/08/2026 con S-5.** Ya no queda ninguna incógnita bloqueando declarar `0.1.0`
> estable. Tres medidas y cerradas; dos que siguen abiertas en el papel y que **no pueden afectar a
> ninguna huella** producida ni verificada por esta librería.

#### Por qué I-01 e I-03 no bloquean aunque sigan abiertas

Las dos preguntan qué hace la AEAT con caracteres que **no pueden llegar a una huella**.
`NumSerieFactura` y `NumSerieFacturaAnulada` son los únicos campos de texto libre que entran en las
huellas del alta y de la anulación —los demás son NIF, fecha, enum, decimal y hex— y los dos están
restringidos a ASCII 32-126 en los dos extremos: `core` por `assertSerieValida`, y la AEAT por
medición (código 1130, sobre `U+00A0` y sobre `U+0301`).

Ni el recorte de espacios exóticos ni la normalización Unicode pueden cambiar una huella. Siguen
anotadas porque afectan a **verificar** cadenas ajenas que sí los lleven, y ahí lo honesto es decir
que no se puede determinar.

#### Lo que S-5 no resolvió, y por qué da igual

El par de I-04 no separa «la AEAT hashea el literal» de «la AEAT prueba variantes y acepta si alguna
coincide». Bajo las dos hipótesis, `121.10` y `121.1` vuelven `Correcto`. Bajo las dos, lo correcto
es lo que `core` ya hace. El detalle está en §24.7, con el envío que lo separaría si algún día
importara.

#### I-01 se degrada: sigue abierta, pero ya no bloquea

No se ha medido, y lo digo primero para no confundir «resuelta» con «neutralizada». Lo que ha
cambiado es que la decisión de §1.3.1 la vuelve **inalcanzable por construcción**:

- `@verifactu-js/xml` escribe `fields`, los literales ya recortados, nunca la entrada cruda. El
  literal del XML y el valor hasheado son la misma cadena, de modo que el recorte que haga la AEAT
  al recalcular es una operación nula: no puede divergir del nuestro. Eso cubre todo `<= U+0020`,
  que es la semántica de `String.trim()` y la única que la referencia Java sugiere.
- Para la zona gris —NBSP, `U+2000`–`U+200A`, `U+202F`, `U+3000`, `U+FEFF`— `core` **lanza**
  `ESPACIO_AMBIGUO_EN_BORDE` en vez de elegir. No se puede construir un registro cuya huella
  dependa de esa respuesta.

O el valor es inequívoco, o la librería se niega. En ningún camino se produce una huella que
dependa de I-01, así que **no bloquea declarar estable**. Sigue abierta porque afecta a la
**verificación** de cadenas ajenas que sí lleven esos caracteres, y ahí lo honesto es decir que no
se puede determinar.

#### Las otras cuatro sí bloquean, y por qué

Ninguna está neutralizada por diseño. En las cuatro, un usuario legítimo puede producir un registro
cuya huella dependa de la respuesta:

- **I-02** — `NumSerieFactura` es el único campo de texto libre que entra en la huella del alta. El
  vector oficial `12345678 / G33` prueba que los espacios simples se conservan, pero no dice nada
  de los dobles. Si la AEAT los colapsara al recalcular, la huella no cuadraría.
- **I-03** — mismo campo, mismo problema con `é` precompuesta contra descompuesta: son bytes
  distintos y ninguna fuente dice si hay que normalizar a NFC.
  Que S-2 haya demostrado que la AEAT **no** normaliza el `xs:dateTime` antes de hashear sube la
  probabilidad de que tampoco normalice Unicode, pero **no lo demuestra**: son capas distintas —una
  es normalización semántica en un parser de fechas, la otra es normalización de codificación de
  texto— y un sistema puede hacer la segunda sin hacer la primera. Se mide, no se deduce.
- **I-04** — `CuotaTotal` e `ImporteTotal` entran en la huella. F1 dice que `123.1` y `123.10` son
  «igualmente válidos» y no dice cómo. Es la de mayor riesgo real, porque todo el mundo formatea
  importes y casi nadie lo hace igual.
- **I-05** — el XSD permite `(\+|-)?` y no hay ni un ejemplo oficial de huella con importe
  negativo. Afecta a las rectificativas por diferencias, que no son un caso exótico.

#### Cómo se cerrarían: sonda S-5, seis registros

Cada caso es un alta con un literal deliberadamente dudoso, hasheado como lo haría `core`, con su
propia `NumeroInstalacion`. La lectura es binaria y la da el código:

| # | Qué se envía | `Correcto` significa | `2000` significa |
|---|---|---|---|
| 1 | `NumSerieFactura` con NBSP al final (I-01) | La AEAT no recorta más allá de `U+0020` | Recorta con semántica Unicode |
| 2 | `NumSerieFactura` con dos espacios interiores (I-02) | Los conserva | Los colapsa |
| 3 | `NumSerieFactura` con `é` en NFD (I-03) | No normaliza Unicode | Normaliza a NFC |
| 4 | `ImporteTotal` con un solo decimal, `121.1` (I-04) | Hashea el literal dado | Normaliza a dos decimales |
| 5 | `ImporteTotal` con `+` explícito (I-05) | Conserva el signo | Lo quita al recalcular |
| 6 | Rectificativa por diferencias con importes negativos (I-05) | El `-` entra en la huella tal cual | Otra cosa |

Los casos 1, 2 y 3 tienen que **saltarse la validación de `core`**, igual que hicieron los casos 2
y 3 de S-3: la librería rechaza a propósito lo que se quiere medir. Eso vive en el script, marcado,
y no toca la librería.

El caso 6 es el único que necesita montaje aparte —`TipoFactura` R1-R5, `TipoRectificativa`,
`FacturasRectificadas`— y es también el único que puede volver rechazado por reglas de negocio
(1140, 1143: los signos de base y cuota deben coincidir) sin llegar a medir la huella. Si pasa eso,
se anota como no concluyente y se rehace el montaje, no se interpreta.

**S-5 va después de S-3 y S-4**, y como todas, con el plan aprobado antes de enviar nada.

---

## 13. Certificado para el entorno de preproducción

> Añadido el 16/08/2026 a petición expresa. Es la raíz común de I-08, I-10, I-15 e I-27.

### 13.1 Respuesta corta

**Sirve un certificado electrónico cualificado real, incluido el de FNMT de persona física
o de autónomo. La AEAT no emite ni exige un certificado específico de pruebas.**

### 13.2 Base documental

**Portal de Pruebas Externas de la AEAT** (`https://preportal.aeat.es/`, consultado 16/08/2026)
— cita textual:

> «con la única condición de autenticarse mediante un certificado electrónico»

> «Estos sitios web están destinados a ofrecer exclusivamente pruebas en un entorno de PREPRODUCCIÓN para facilitar la integración y validación de servicios»

> «se guardan en una Base de Datos del entorno de pruebas de la AEAT, sin que en ningún caso tengan trascendencia tributaria»

Hosts de preproducción listados en esa misma página:

| Host | Uso |
|---|---|
| `https://prewww1.aeat.es` | Servicios web (certificado de persona física / representante) |
| `https://prewww2.aeat.es` | Ficheros estáticos (XSD, WSDL, `errores.properties`) y servicio de cotejo del QR |
| `https://prewww10.aeat.es` | «pruebas de Web Services para contribuyentes con certificado de sello» |

Se corresponden uno a uno con los puertos del WSDL documentados en §8.1.

**F4 (Descripción del servicio web v1.0.3), §4.1, p. 13** — cita textual:

> «La remisión a través del servicio web podrá ser efectuada por el obligado tributario, un apoderado suyo a este trámite o un colaborador social, que deberá disponer de un certificado electrónico cualificado reconocido. Todos los NIFs se tienen que validar contra la “Base de Datos Centralizada de la AEAT”.»

**F4, §4.3 «Medio de envío», p. 14** — cita textual:

> «Entorno: Internet. Protocolo: HTTPS. Mensajes: Web Service con SOAP 1.1 modo Document.
> **Certificado: Las aplicaciones que envían información a los servicios web deberán autenticarse con certificado electrónico cualificado reconocido.**
> Codificación: UTF-8.»

Ninguno de los dos documentos distingue el tipo de certificado entre preproducción y producción.
La única diferencia documentada entre entornos es el **host**.

### 13.3 Consecuencias prácticas

1. **El certificado de FNMT del autor sirve.** No hay que solicitar nada especial a la AEAT.
   Esto desbloquea I-08, I-10 e I-15, y resuelve el grueso de I-27.
2. **El NIF tiene que ser real.** F4 §4.1: «Todos los NIFs se tienen que validar contra la
   “Base de Datos Centralizada de la AEAT”». No se puede probar con `89890001K` (el NIF ficticio
   de los ejemplos de la documentación) en `ObligadoEmision`. El NIF de la cabecera debe ser el
   del titular del certificado, o uno sobre el que tenga apoderamiento a este trámite, o actuar
   como colaborador social.
3. **Los envíos de preproducción no tienen efecto fiscal.** Cita de §13.2: «sin que en ningún
   caso tengan trascendencia tributaria».
4. ⚠️ **La AEAT prohíbe las pruebas masivas en preproducción.** El portal reserva el entorno para
   pruebas puntuales y excluye expresamente «pruebas masivas» y «validaciones integradas en
   procesos de presentación en producción».
   **Esto restringe el plan de testing del brief (`VERIFACTU-BRIEF.md` §7.5):** el cron semanal
   contra preproducción debe ser un *smoke test* de unos pocos registros, no una suite completa.
   El grueso de la cobertura tiene que ir contra el mock server de `@verifactu/testing`.
5. **El host depende del tipo de certificado**, también en pruebas: `prewww1` para persona
   física/representante, `prewww10` para sello de entidad (§8.1).

### 13.4 Lo que sigue sin confirmar

- **I-27.a** — Si la AEAT exige algún alta o registro previo del NIF/certificado antes del primer
  envío a `prewww1` (para el SII existía un trámite de alta; no consta que aplique aquí).
- **I-27.b** — Si el censo de preproducción es un espejo del real y con qué frecuencia se
  sincroniza. Un NIF dado de alta recientemente podría fallar en pruebas y funcionar en producción.
- **I-27.c** — Dónde está el límite entre «prueba puntual» y «prueba masiva». Sin cuantificar.
- **I-27.d** — Si `errores.properties` en `prewww2` requiere certificado **de cliente TLS** o
  autenticación de sesión del portal. No verificado (no dispongo de certificado).
- **I-27.e** — Si el entorno de preproducción tiene ventanas de indisponibilidad programadas
  que puedan hacer fallar un cron de CI.

### 13.5 Alcance de esta comprobación

He localizado la política **general** del entorno de preproducción de la AEAT y los requisitos
**generales** de certificado del servicio web de VERI\*FACTU. **No he encontrado una declaración
específica de VERI\*FACTU que diga literalmente «para preproducción vale un certificado real»**;
la conclusión de §13.1 es la composición de las dos fuentes citadas en §13.2. Es sólida, pero
no es una cita única y directa. Se confirmará definitivamente el día que se ejecute el primer
envío real contra `prewww1`.

---

## 14. Nombres en npm (resolución de I-26)

> Comprobado el **16/08/2026** contra `registry.npmjs.org`.

### 14.1 Resultado

| Nombre | Estado |
|---|---|
| `verifactu` (sin scope) | ❌ **OCUPADO** |
| scope `@verifactu` | ❌ **OCUPADO** |
| `@verifactu-js/*` | ✅ libre |
| `@sifjs/*` | ✅ libre |
| `@verifactujs/*`, `@verifacto/*` | ✅ libres |
| `sifjs`, `verifactu-js`, `verifactu-cli`, `verifactu-core`, `verifactu-kit`, `verifactu-hash` | ✅ libres |

### 14.2 Cómo se ha comprobado el scope

Un `404` en `registry.npmjs.org/@verifactu%2Fcore` **no** prueba que el scope esté libre: los
scopes pertenecen a usuarios u organizaciones, no a paquetes. Se ha usado
`registry.npmjs.org/-/org/<nombre>/user` con un grupo de control:

| Nombre | Respuesta | Lectura |
|---|---|---|
| `estanciasupercalifragilistica999` (inventado) | `404` | no existe |
| `sifjs` | `404` | no existe → scope libre |
| **`verifactu`** | **`200 {}`** | **existe**, sin miembros públicos |
| `babel` | `200 {}` | existe |
| `nestjs` | `200 {}` | existe |
| `angular` | `200 {"angular":"owner"}` | existe, con miembros públicos |

Confirmado con un segundo endpoint, `/-/org/<nombre>/package`: `404` para los inexistentes,
`200 {}` para `verifactu` (organización sin paquetes públicos), `200` con la lista completa
para `babel`.

→ La organización `verifactu` **existe y no ha publicado nada**. Es una reserva.

### 14.3 El paquete `verifactu` es un placeholder vacío

```
descripcion : (vacía)
versiones   : 1.0.0
creado      : 2024-01-30T00:20:03.381Z
modificado  : 2024-01-30T00:20:03.827Z
maintainers : admiboxdev
license     : ISC
repository  : (vacío)
dist        : unpackedSize=223 bytes  fileCount=1
```

223 bytes, un fichero, sin repositorio ni descripción, publicado una vez en enero de 2024 y
nunca tocado. Reclamarlo por la política de disputas de nombres de npm es lento e incierto.

**Consecuencia para el brief:** `npx verifactu verify` —el activo de difusión del §12— **no es
posible** con ese nombre.

### 14.4 Estado del arte, revisado (agosto de 2026)

La búsqueda del registro devuelve **30 paquetes** relacionados con VERI\*FACTU. Los relevantes:

| Paquete | Versión | Fecha | Alcance declarado |
|---|---|---|---|
| `@inoguerols/verifactu` | 1.4.0 | 15/07/2026 | «huella encadenada SHA-256, QR de cotejo, verificador de cumplimiento, generación de XML (XSD oficial), envío al web service (TLS mutuo), firma XAdES y servidor MCP» |
| `@doscientos/verifactu` | 0.1.11 | **09/08/2026** | «invoice submission, SIF hash chain and QR generation» |
| `@kreyo/verifactu-hash-calculator` | 0.1.2 | 10/05/2026 | Implementación de referencia del hash encadenado. Cero dependencias |
| `verifactu-tools` | 1.0.13 | 30/09/2025 | — |
| `facturahub-verifactu-hash` / `-qr` / `-nif-validator` | 0.1.0 | 20/06/2026 | Utilidades separadas |
| `verifactu-node-lib` | 1.0.0 | 29/06/2025 | El de la tabla del brief |

**Esto contradice la premisa de mercado del brief (§1, «ventana de oportunidad de ~12 meses»).**
`@inoguerols/verifactu` declara, bajo licencia MIT, prácticamente **todo el roadmap de este
proyecto, fases 1 a 5 incluidas**. `@doscientos/verifactu` se publicó hace una semana.

No he auditado la corrección de ninguno de ellos —puede que el foso de testing siga siendo
real—, pero el supuesto de «nicho vacío» ya no se sostiene sin comprobarlo. Es una decisión de
producto, no técnica, y queda anotada aquí para que se tome con el dato delante.

---

## 15. Validación de NIF: decisión (resolución de I-25)

> Decidido el **16/08/2026**. Implementado en `packages/core/src/nif.ts`.

### 15.1 Qué dicen las fuentes

- **XSD** (`SuministroInformacion.xsd`): `NIFType` es `<restriction base="string"><length value="9"/></restriction>`. Nada más.
- **F3 (Validaciones v1.2.2)**: nunca comprueba un carácter de control. Lo que exige es
  «El NIF del obligado a expedir (emitir) facturas asociado a la remisión debe estar
  identificado en la AEAT» — una consulta al censo, que una librería offline no puede hacer.
- **Orden EHA/451/2008, art. 2** (BOE-A-2008-3580, consultada 16/08/2026,
  `docs/reference/BOE_Orden_EHA_451_2008_NIF.pdf`):

  > «El número de identificación fiscal de las personas jurídicas y entidades sin personalidad jurídica estará compuesto por nueve caracteres, con la siguiente composición:
  > a) Una letra, que informará sobre la forma jurídica […]
  > b) Un número aleatorio de siete dígitos.
  > c) Un carácter de control.»

  Los artículos 3 a 5 enumeran las letras (A, B, C, D, E, F, G, H, J, P, Q, R, S, U, V para
  entidades españolas; N para extranjeras; W para establecimientos permanentes).
  **La Orden NO publica el algoritmo que produce el carácter de control.**

### 15.2 El hallazgo que decide

No existe fuente oficial citable para **ninguno** de estos algoritmos de control. La letra
módulo 23 del DNI/NIE y el carácter de control del NIF de entidad son de dominio público y
están implementados en todas partes, pero eso es tradición, no norma publicada.

Ahora bien, la asimetría es clara:

- La letra módulo 23 es **universal y sin excepciones conocidas**. Todo DNI y todo NIE la cumple.
- El carácter de control de entidades tiene además una regla de **representación** por tipo de
  entidad (letra para N/P/Q/R/S/W, dígito para A/B/E/H, cualquiera de las dos para el resto)
  que no está en la Orden, y circulan identificadores heredados que no cuadran.

### 15.3 Decisión

| Tipo | Severidad | Justificación |
|---|---|---|
| DNI (`8 dígitos + letra`) | **`error`** | Módulo 23, determinista, sin excepción documentada. Un fallo es una errata. |
| NIE (`X/Y/Z + 7 dígitos + letra`) | **`error`** | Mismo algoritmo tras mapear X→0, Y→1, Z→2. |
| K / L / M (persona física) | **`error`** | Mismo módulo 23 sobre los siete dígitos. |
| NIF de entidad («CIF») | **`aviso`** | El algoritmo del control **no está en la norma que define la composición del NIF**. Rechazar duro sería imponer una regla no publicada. |
| Cualquier otra forma | **`error`** | No puede ser un NIF español. Un obligado extranjero va por `IDOtro`, no por `NIF`. |

Y, por encima de todo:

**La validación de NIF nunca bloquea el cálculo de la huella.** Un NIF equivocado produce una
huella perfectamente correcta sobre un NIF equivocado; son dos problemas distintos.
`validateNif` devuelve un informe y no lanza. Mezclarlos haría que la librería rechazase
registros que sabe encadenar bien, que es peor que no validar.

### 15.4 Verificación

El algoritmo de entidad se ha contrastado contra NIF reales antes de fijarlo:
`B72877814` → control `4` ✅ y `B44531218` → control `8` ✅ (ambos del README de
`mdiago/VeriFactu`). Y `89890001K`, el NIF que la AEAT usa en todos sus ejemplos, resulta ser un
DNI con letra de control válida (`89890001 % 23 = 21` → `K`) ✅.

### 15.5 Qué sigue abierto

Si la AEAT llega a publicar el algoritmo del carácter de control, el caso de entidad puede
ascender a `error`. Hasta entonces se queda en `aviso`, con el motivo citado en el propio
mensaje de error.

---

## 16. `FechaHoraHusoGenRegistro`: generar y verificar son dos modos (decisión)

> Decidida el **16/08/2026**. Implementada en `packages/core/src/datetime.ts`.

Al **generar**, el valor es responsabilidad nuestra, así que se emite la forma más conservadora
posible: `±hh:mm` siempre, nunca `Z`, nunca fracciones de segundo, nunca offset con segundos.
Es la mitigación en código de I-07, I-08 e I-09 mientras sigan abiertas.

Al **verificar**, la cadena ya existe. Su huella se calculó sobre el literal que hubiera en su
momento, que puede venir de otro sistema o de una versión anterior de este. Rechazarlo haría
inútil la verificación, que es justo la función que da valor al paquete. Así que
`inspectFechaHoraHuso` no lanza nunca, devuelve el literal intacto y adjunta avisos
(`HUSO_Z`, `SIN_HUSO`, `FRACCION_DE_SEGUNDO`, `OFFSET_CON_SEGUNDOS`, `OFFSET_SIN_DOS_PUNTOS`,
`FORMATO_DESCONOCIDO`).

**Actualización (18/08/2026), tras medir.** La decisión aguanta y gana una pieza. Ahora sabemos
que `Z` la AEAT lo **acepta** y que las fracciones y los offsets raros los **rechaza**, así que un
aviso ya no es una categoría única: hay avisos que solo dicen «esto no es lo que generamos» y
avisos que dicen «esto la AEAT no lo admite». Esa diferencia decide si un registro hay que
rehacerlo, de modo que se expone aparte y no se deduce del nombre:

- `VEREDICTO_AEAT` — qué contestó la AEAT a cada aviso. Lo no medido **no aparece**, y que falte
  es la información.
- `FechaHoraHusoInspection.aceptadoPorLaAeat` — `true` / `false` / `null` (sin medir).

`ok` sigue significando lo que significaba: «coincide con la forma estricta que emitimos». Un
literal con `Z` sale `ok: false` y `aceptadoPorLaAeat: true`, y las dos cosas son ciertas.

Rechazar al leer lo que nos negamos a escribir rompería toda cadena histórica que se supone que
debemos poder comprobar.

El offset se deriva **del instante y de la zona IANA**, con `Intl.DateTimeFormat` y
`timeZoneName: 'longOffset'` — parte del lenguaje, sin dependencias. Nunca de configuración
fija: `Atlantic/Canary` es `+00:00` en invierno y `+01:00` en verano, y no coincide con
`Europe/Madrid` en ningún momento del año.

---

## 17. Codificación de la URL del QR: medido (resolución de I-10)

> Medido el **16/08/2026** con `scripts/probe-qr-encoding.mjs` contra
> `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR`. No requiere certificado.

### 17.1 Método

El servicio de cotejo, con el 5.º parámetro `formato=json`, **devuelve el `numserie` que ha
decodificado**. Eso lo convierte en un oráculo: se envía una codificación conocida y se lee lo
que sale por el otro lado. Seis peticiones espaciadas 1,5 s (ver la nota de §13.3.4 sobre
pruebas masivas: esto es una sonda, no un fuzzer).

### 17.2 Resultados

| Enviado como `numserie=` | Valor devuelto | Conclusión |
|---|---|---|
| `A%20B` | `A B` | `%20` se decodifica como espacio |
| `A+B` | `A B` | **`+` sin escapar se decodifica como espacio** |
| `A%2BB` | `A+B` | `%2B` se decodifica como `+` literal |
| `A~B` | `A~B` | `~` sin escapar pasa tal cual |
| `A%7EB` | `A~B` | `%7E` también |
| `A(B)'C` | `A(B)'C` | `(`, `)`, `'` sin escapar pasan tal cual |

Todas las respuestas fueron `"mensaje": "No encontrada"`, lo esperado para facturas que no
existen, con eco del `numserie` decodificado.

### 17.3 Conclusión

**El servicio decodifica `application/x-www-form-urlencoded`**, coherente con el
`java.net.URLEncoder` del ejemplo de la AEAT (F2 §4.1).

Consecuencia práctica, que corrige el análisis de §7.3:

> **`encodeURIComponent` es correcto y es lo que debe usar `@verifactu-js/qr`.**

El razonamiento: el riesgo no estaba en usar `encodeURIComponent`, sino en dejar un `+` sin
codificar. Y `encodeURIComponent('+')` devuelve `'%2B'`, que el servicio decodifica como `+`
literal. Los caracteres que `encodeURIComponent` deja sin escapar (`~ ! * ' ( )`) atraviesan el
servicio sin alterarse, según se ha medido.

Es decir, **ambas codificaciones transmiten correctamente**; la de Java es más conservadora
(escapa de más) y la del navegador es suficiente. Se elige `encodeURIComponent` por ser la
primitiva de la plataforma y no requerir código propio.

### 17.4 La trampa que sí existe

Construir la URL concatenando sin codificar:

```js
`...?numserie=${serie}`        // ❌ un "+" en la serie se convierte en espacio
`...?numserie=${encodeURIComponent(serie)}`  // ✅
```

Una serie como `A+B` transmitida sin codificar llega a la AEAT como `A B`. Como el QR no lleva
la huella (§7.9), nada lo detecta: el cotejo simplemente responde «No encontrada».

### 17.5 Lo que sigue sin medir

- `%` literal, `#`, `&` dentro de `numserie` (el `&` sí está en el ejemplo oficial, como `%26`).
- Caracteres no ASCII: la especificación los prohíbe (ASCII 32-126), así que no aplica.
- Si el entorno de **producción** se comporta igual que preproducción. Se asume que sí; queda
  como comprobación previa a la fase 2 definitiva.

---

## 18. Separadores dentro de los valores de la huella (I-28)

> Analizado el **16/08/2026**.

### 18.1 El problema

La cadena canónica es `nombre=valor&nombre=valor…` y **no escapa nada**. De los ocho campos que
entran en la huella del alta, siete están fuertemente restringidos (NIF de 9, fecha `dd-mm-yyyy`,
enumeración, patrón numérico, hex de 64, `xs:dateTime`). **Solo `NumSerieFactura` es texto
libre**, y el XSD no le impone patrón: `TextoIDFacturaType` es `minLength 1, maxLength 60`.

Si un valor pudiera contener `&` y `=`, sería construible una serie que simulara el final de un
campo y el principio de otro, y dos registros distintos producirían la misma cadena y la misma
huella.

### 18.2 Lo que dice la fuente

**F3 (Validaciones v1.2.2), §3.1.3.1, p. 8** — cita textual:

> «NumSerieFactura solo puede contener caracteres ASCII del 32 a 126 (caracteres imprimibles), no permitiéndose la existencia de los siguientes caracteres:
> - `"`   (ASCII 34)
> - `'`   (ASCII 39)
> - `<`   (ASCII 60)
> - `>`   (ASCII 62)
> - `=`   (ASCII 61)»

### 18.2.1 Por qué esto no es una casualidad

La regla, leída sola, parece una validación de saneamiento cualquiera —de hecho cuatro de los
cinco caracteres (`"` `'` `<` `>`) son los sospechosos habituales de inyección en XML y HTML, y
`=` parecería estar ahí de acompañante. El histórico de revisiones de F3 demuestra que no lo es:

| Rev. | Fecha | Descripción (cita literal del histórico de F3, pp. 2-3) |
|---|---|---|
| 1.1.3 | 09/09/2025 | «Caracteres no permitidos en campos alfanuméricos de texto libre en sección 3.1. Validaciones sintácticas» |
| 1.1.4 | 23/09/2025 | «Se eliminan las validaciones de caracteres no permitidos en campos alfanuméricos de texto libre en sección 3.1. Validaciones sintácticas, **pero se mantienen exclusivamente a nivel de IDFactura (número serie/factura)**, modificando la sección 3.1.3.1» |

La secuencia es: la AEAT restringió **todos** los campos alfanuméricos de texto libre, dos semanas
después lo revirtió por completo —presumiblemente porque rechazaba descripciones y nombres
legítimos— y, al replegarse, **conservó la restricción exactamente en `IDFactura`**.

`NumSerieFactura` es el único campo de texto libre que entra en la huella. De todo lo que la AEAT
podría haber conservado, conservó justo eso.

**Consecuencia para la valoración del riesgo:** que la cadena canónica no escape sus separadores
**no es un agujero abierto**, es un problema *mitigado en el diseño del formato*, y la mitigación
está en el sitio correcto —en la validación de entrada del único campo que podría explotarlo— en
lugar de en un escapado que habría roto la compatibilidad de la huella con lo ya emitido. La
librería no está tapando un descuido de la especificación: está **replicando una defensa que la
especificación ya tiene**, y por eso `core` puede rechazar esos caracteres sin miedo a rechazar
facturas que la AEAT aceptaría.

### 18.3 Conclusión: `=` prohibido resuelve el problema; `&` es inocuo

Para falsificar un límite de campo hace falta la secuencia `&Nombre=`. Sin `=` **no es
construible**. `&` por sí solo no puede crear un campo nuevo, así que el conjunto de cadenas
canónicas sigue siendo inyectivo respecto de los valores de los campos.

Además, ni la AEAT ni nosotros *parseamos* la cadena: ambos la **construimos** desde los mismos
valores. La ambigüedad sería un problema de parseo, y no hay parseo.

→ **`&` no debe rechazarse.** La AEAT lo permite explícitamente (no está en su lista), y
prohibirlo bloquearía facturas legítimas con series tipo `A&B`. Es el mismo error que rechazar
un CIF por una regla no publicada (§15).

### 18.4 Lo que queda abierto

**La restricción está documentada solo para el alta.** F3 §3.1.4 (validaciones de
`RegistroAnulacion`) **no la repite**, y en todo el documento la lista de caracteres aparece una
sola vez. Formalmente, `NumSerieFacturaAnulada` podría contener `=` y la cadena de la anulación
volvería a ser falsificable.

Contra eso juega un argumento fuerte: una anulación anula una factura cuyo `NumSerieFactura` ya
pasó (o pasará) por la validación del alta, así que una serie con `=` no debería poder existir.
Pero eso es razonamiento, no cita.

**Severidad: resuelta (rechazo del registro).** F3 no lo dice en §3.1.3.1, pero no hace falta:
§3 (p. 6) fija la consecuencia por *categoría* de validación, y las dos candidatas coinciden.

> «2. Validaciones sintácticas […] Cuando estos errores se hayan producido a nivel de registro (agrupaciones RegistroAlta o RegistroAnulacion dentro del bloque RegistroFactura), provocarán el **rechazo del registro**, pero se seguirán procesando el resto de registros incluidos en el mensaje de remisión.
>
> 3. Validaciones de negocio […] Estos errores provocarán el **rechazo del registro**, pero se seguirán procesando el resto de registros en el mensaje de remisión.»

Hay una ambigüedad sobre a cuál de las dos categorías pertenece la regla (**D-15**: el histórico
dice «sintácticas», el título de la sección dice «de negocio»), pero **da igual**: por cualquiera
de los dos caminos el registro se rechaza y el resto de la remisión sigue procesándose.

Esto separa I-28 de las demás incógnitas de la huella: una serie con `=` **no** produce un
«Aceptado con errores» silencioso, produce un rechazo visible. Rechazarla en `core` adelanta un
error que la AEAT iba a dar de todas formas.

También sin confirmar:

- **Discrepancia D-14:** el documento del QR (F2 §6) admite para `numserie` «ASCII 32-126» **sin**
  la lista de cinco caracteres prohibidos. Un `=` sería válido en el QR e inválido en el registro.

### 18.5 Decisión para `@verifactu-js/core`

| Carácter | Decisión | Motivo |
|---|---|---|
| `=` (ASCII 61) | **rechazar** en `NumSerieFactura` y `NumSerieFacturaAnulada` | Prohibido por F3 §3.1.3.1, y es lo que garantiza que la cadena canónica no sea falsificable |
| `"` `'` `<` `>` | **rechazar** en los mismos campos | Prohibidos por F3 §3.1.3.1 |
| Fuera de ASCII 32-126 | **rechazar** | F3 §3.1.3.1 |
| `&` (ASCII 38) | **permitir** | La AEAT lo permite; con `=` prohibido no crea ambigüedad explotable |

La restricción se aplica **también a la anulación**, aunque ahí no esté documentada: es
consistente con el alta y no puede rechazar nada legítimo, porque esa serie tampoco habría podido
darse de alta.

Código de error: `CARACTER_NO_PERMITIDO`, citando §3.1.3.1.

### 18.6 Cómo se cierra

Requiere medir contra preproducción con certificado, así que **pertenece a la fase 3**, no a la
sonda del QR (que mide otro servicio: ver D-14). Casos a enviar:

1. Alta con `&` en `NumSerieFactura` → ¿`Correcto` o `AceptadoConErrores`? Confirmaría que la
   huella con `&` sin escapar coincide con la que recalcula la AEAT. **Es el caso importante**:
   si saliera `AceptadoConErrores`, la AEAT estaría escapando o normalizando algo que nosotros no.
2. Alta con `=` en `NumSerieFactura` → se espera `Incorrecto` (§18.4). Sirve de control: confirma
   que el envío de prueba llega y que la regla está realmente implementada, no solo documentada.
3. Anulación con `=` en `NumSerieFacturaAnulada` → cierra el único hueco que queda de §18.4.

---

## 19. `Cabecera` y el lote: auditoría campo a campo

> Auditado el **17/08/2026** contra `SuministroInformacion.xsd` (`CabeceraType`),
> `SuministroLR.xsd` (raíz), F3 v1.2.2 §3.1.1-§3.1.4 y F5 (diseño de registro).

### 19.1 Estructura real

`RegFactuSistemaFacturacion` (raíz, `SuministroLR.xsd`) es **exactamente**:

```
Cabecera            (sf:CabeceraType)          1
RegistroFactura     (sfLR:RegistroFacturaType) 1..1000
```

y `RegistroFacturaType` es un `choice` de un `sf:RegistroAlta` **o** un `sf:RegistroAnulacion`.
No hay nada más en la raíz.

`CabeceraType` es:

| Elemento | Tipo | Ocurrencias |
|---|---|---|
| `ObligadoEmision` | `PersonaFisicaJuridicaESType` (`NombreRazon` + `NIF`) | 1 |
| `Representante` | `PersonaFisicaJuridicaESType` | 0..1 |
| `RemisionVoluntaria` | `{ FechaFinVeriFactu?, Incidencia? }` | 0..1 |
| `RemisionRequerimiento` | `{ RefRequerimiento, FinRequerimiento? }` | 0..1 |

**Trampa de namespace, la segunda de este proyecto (ver §8.3).** El elemento `Cabecera` está
**declarado en `SuministroLR.xsd`**, así que con `elementFormDefault="qualified"` toma el
namespace *de ese* esquema: se escribe **`sfLR:Cabecera`**. Pero su **tipo** es
`sf:CabeceraType`, declarado en `SuministroInformacion.xsd`, y de ahí sacan el namespace sus
hijos: `sf:ObligadoEmision`, `sf:Representante`, `sf:RemisionVoluntaria`,
`sf:RemisionRequerimiento`.

> Un mismo bloque, con el **nombre en un namespace y el contenido en otro**.

Escribir `sf:Cabecera` produce este error, que no menciona el namespace por ninguna parte:

```
Element '{…/SuministroInformacion.xsd}Cabecera': This element is not expected.
Expected is ( {…/SuministroLR.xsd}Cabecera ).
```

Y como el mismo `CabeceraType` se devuelve en la respuesta —declarado allí dentro de
`RespuestaSuministro.xsd`— **el mismo bloque viaja como `sfR:Cabecera` de vuelta**. Tres prefijos
distintos para el mismo tipo según dónde aparezca. Hay test.

`ObligadoEmision` y `Representante` usan `PersonaFisicaJuridicaESType`, que **solo admite `NIF`**:
a diferencia de `Tercero`, `Destinatarios` o `SistemaInformatico`, aquí no existe la alternativa
`IDOtro`. El obligado y su representante son necesariamente españoles.

### 19.2 Dos campos que no existen

**No hay `IDVersion` en `Cabecera`.** Ni en la raíz. `IDVersion` es el primer elemento de
`RegistroAlta` y de `RegistroAnulacion`, uno por registro. Un lote de 1000 registros lleva 1000
`IDVersion` y ninguno en la cabecera.

**No existe `TipoComunicacion` en VERI\*FACTU.** Búsqueda sobre los 8 XSD, el WSDL y los seis
documentos extraídos: **cero coincidencias**. Es un elemento del **SII** (`CabeceraSii/TipoComunicacion`,
valores `A0` alta / `A1` modificación), y quien venga de integrar el SII lo buscará por costumbre.
El concepto equivalente en VERI\*FACTU **no está en la cabecera sino en cada registro**:
`Subsanacion` (`S`/`N`) y `RechazoPrevio` (`S`/`N`/`X`), que distinguen un envío nuevo de la
corrección de uno anterior registro a registro, no remisión a remisión.

### 19.3 Validaciones de negocio de la cabecera (F3 §3.1.1)

Citas literales:

> «El NIF del obligado a expedir (emitir) facturas asociado a la remisión debe estar identificado en la AEAT.»
> «El NIF del representante/asesor […] debe estar identificado en la AEAT.»
> «FechaFinVeriFactu — Sólo se permite contenido en sistemas que emite facturas verificables. A partir del 1 de enero de 2027, el campo FechaFinVeriFactu debe tener el formato 31-12-20XX. El año de la fecha deberá ser igual al año de la fecha del sistema de la AEAT, o al año anterior […]»
> «Incidencia — Sólo se permite contenido en sistemas que emite facturas verificables.»
> «RefRequerimiento — Sólo se permite contenido en sistemas que emiten facturas no verificables. Obligatorio en sistemas que emiten facturas no verificables. La referencia del requerimiento deberá existir en la AEAT.»

**Discrepancia D-16.** De esas reglas se sigue que `RemisionVoluntaria` y `RemisionRequerimiento`
son **mutuamente excluyentes** —la primera solo para sistemas verificables, la segunda solo para
no verificables— pero el XSD declara las dos como `minOccurs="0"` independientes: admite ambas a
la vez, y admite ninguna. Gana F3: la librería rechaza la combinación.

**D-17.** El XSD admite `<RemisionVoluntaria/>` vacío, porque sus dos hijos son opcionales. Es
sintácticamente válido y semánticamente nada. La librería omite el bloque en lugar de emitirlo
vacío, igual que hace con las listas vacías.

`FinRequerimiento` «solo puede cumplimentarse si el campo RefRequerimiento viene informado»
(F5): aquí el esquema **sí** lo garantiza, porque `FinRequerimiento` vive dentro de
`RemisionRequerimiento` y `RefRequerimiento` es obligatorio ahí. No hace falta comprobación extra.

### 19.4 Lo que ata el lote a la cabecera

Dos citas, una por tipo de registro:

> **F3 §3.1.3.1** (alta): «El NIF del campo IDEmisorFactura debe ser el mismo que el del campo NIF de la agrupación ObligadoEmision del bloque Cabecera.»
>
> **F3 §3.1.4.1** (anulación): «El NIF del campo IDEmisorFacturaAnulada debe ser el mismo que el del campo NIF de la agrupación ObligadoEmision del bloque Cabecera.»

Esto **resuelve la pregunta del NIF en el lote**. §4.3 dice que el NIF puede cambiar entre
eslabones de una cadena, y `verifyChain` no debe asumirlo constante. Las dos cosas conviven así:

> Una **cadena** puede cambiar de NIF a lo largo del tiempo. Un **lote** no: todos sus registros
> han de llevar el NIF que declara su cabecera. Una cadena que cambia de NIF se parte en dos
> lotes justo en ese punto.

No es una inferencia nuestra, es la regla de la AEAT, y es comprobable localmente.

### 19.5 Mezcla de altas y anulaciones (F3 §3.1.2)

> «Dentro de cada una de las posibles repeticiones u "ocurrencias" de RegistroFactura (de 1 a 1000) se pueden incluir registros de facturación de alta (agrupación RegistroAlta) y de anulación (agrupación RegistroAnulacion) en un mismo mensaje remitido, pero siempre que vayan en distintas ocurrencias de RegistroFactura (no pueden ir ambas agrupaciones a la vez dentro de la misma ocurrencia).»

Mezclar está **explícitamente permitido**. Lo que no se puede es meter las dos agrupaciones en la
misma ocurrencia, y eso ya lo impide el `choice` del XSD.

### 19.6 Contigüidad: por qué se comprueba aquí y no en fase 3

Un lote es un **segmento de cadena**, no un conjunto. La huella de cada registro se calculó sobre
la huella del anterior, así que el orden del lote no es una preferencia de presentación: es la
única forma en que la AEAT puede recalcular la cadena.

Lo que sí es comprobable dentro del lote, y por tanto se exige:

1. Entre 1 y 1000 registros (`maxOccurs="1000"`, y una `sequence` no puede quedar vacía).
2. El `Huella` hasheado de cada registro (salvo el primero del lote) es la `huella` del registro
   inmediatamente anterior **del lote**.
3. Su `registroAnterior` identifica a ese mismo registro: emisor, serie y fecha de expedición.
4. `PrimerRegistro` solo puede aparecer **en la posición 0**. En medio significaría que la cadena
   se reinicia dentro del lote.
5. Todos los `IDEmisorFactura`/`IDEmisorFacturaAnulada` coinciden con `ObligadoEmision/NIF`
   (§19.4).

Lo que **no** es comprobable: si el primer registro del lote enlaza correctamente con el último
del lote anterior. Ese registro no está en el mensaje. Es responsabilidad de quien mantiene la
cadena, y `verifyChain` de `core` es la herramienta para ello.

El coste de no comprobarlo se paga tarde: si un registro intermedio se rechaza, la AEAT ve un
hueco en la cadena y los posteriores quedan colgando de una huella que, para ella, no existe.
Detectarlo antes de enviar es aritmética local; detectarlo después es reconstruir una cadena
contra un estado remoto que ya no coincide.

---

## 20. Dónde viven las validaciones de negocio (F3 §3.1)

> Decidido el **17/08/2026**, antes de escribir la primera.

### 20.1 La decisión

**Paquete propio: `@verifactu-js/validation`**, que depende de `core`. Ni dentro de `core` ni
dentro de `xml`.

```
core  ──►  validation  ──►  xml
  │            │             │
  └────────────┴─────────────┴──►  client   (fase 3)
```

### 20.2 Por qué no dentro de `core`

`core` conoce **ocho campos** del alta y cinco de la anulación: los que entran en la huella. Las
validaciones de F3 §3.1.3 hablan de `Desglose`, `Destinatarios`, `TipoRectificativa`,
`ClaveRegimen`, `Macrodato`… campos que `core` no modela y que no debería empezar a modelar. Para
alojarlas habría que meter el registro completo en el paquete cuya promesa es «la huella y la
cadena, cero dependencias, superficie mínima».

### 20.3 Por qué no dentro de `xml`

Porque quien instala solo `core` —la mayoría, porque la huella es la parte que nadie quiere
implementar a mano— se quedaría sin ellas, y no tiene por qué cargar con un serializador y un
parser para poder comprobar si su factura rectificativa lleva `TipoRectificativa`.

Y al revés: hay un caso legítimo de serializar sin validar, el de reenviar un registro archivado
tal y como se emitió. Acoplar las dos cosas obliga a una de ellas siempre.

### 20.4 Qué se lleva `validation` además de las reglas

**El modelo de datos del registro completo** (`DatosAlta`, `DetalleDesglose`,
`SistemaInformatico`, `PersonaFisicaJuridica`, `IDOtro`…), que hoy vive en `xml`. Las reglas de
§3.1.3 *son* la semántica de ese modelo: qué combinaciones de esos campos son legales. Tipo y
regla van juntos.

`xml` los importa con `import type`, que se borra al compilar: depender de `validation` no le
añade un solo byte al bundle mientras no ejecute una validación.

> **Hecho el 17/08/2026**, antes de quitarle el `private` a `xml`, que era la ventana en la que
> el movimiento salía gratis. Comprobado: el bundle de `xml` es **byte a byte el mismo** antes y
> después (`sha256 6a341ae7…`, 38 890 bytes) y no contiene ni una aparición de la cadena
> «validation».

**Matiz sobre «dependencia de runtime».** El bundle no importa nada —ni `core` ni `validation`—,
pero las dos figuran en `dependencies` de `xml`, y **tienen que figurar**: los `.d.ts` publicados
reexportan sus tipos, así que un consumidor los necesita instalados para que le resuelvan. npm no
tiene una categoría para «dependencia solo de tipos»; `peerDependencies` opcional rompería los
tipos en silencio, que es peor. Lo que sí dejó de ser cierto es la frase «cero dependencias» de la
descripción del paquete, corregida a «sin dependencias de terceros», que es lo que se sostiene.

### 20.5 Qué NO hace `xml` con ellas

**No valida automáticamente al serializar.** Las reglas de negocio cambian con cada revisión de
F3 —§18.2.1 es un ejemplo de una que se puso, se quitó y se dejó a medias—, mientras que la
serialización es estructural y estable. Una regla que se dispare de más bloquearía una factura
que la AEAT habría aceptado, y ese es el mismo error que rechazar un CIF por una regla no
publicada (§15).

El punto natural para validar es **antes de enviar**, en `client` (fase 3), donde el coste de un
rechazo es visible y la decisión de enviar de todas formas es del usuario.

### 20.6 Lo que `xml` sí comprueba, y por qué eso no contradice lo anterior

`xml` comprueba **lo que el XSD no puede expresar y afecta a la huella o a la cadena**:

| Comprobación | Por qué no es una validación de negocio |
|---|---|
| `Encadenamiento` coherente con la `Huella` hasheada | Es una contradicción interna del documento, no una regla de la AEAT |
| Lote contiguo y ordenado (§19.6) | Aritmética local sobre las huellas del propio lote |
| `IDEmisorFactura` = `ObligadoEmision/NIF` (§19.4) | Regla citada, comprobable sin contexto, y su incumplimiento parte el lote |
| Cardinalidades 1..12 / 1..1000 | Estructura del esquema, no negocio |
| `RemisionVoluntaria` XOR `RemisionRequerimiento` (D-16) | **Medido (S-4, 19/08/2026): código 4126.** La exclusión va por endpoint, no por cabecera. Ver §23.3 |

La línea es: **lo que hace que el documento se contradiga a sí mismo va en `xml`; lo que depende
del criterio de la AEAT sobre el contenido de la factura va en `validation`.**


## 21. La tabla de errores de la AEAT (I-15, cerrada el 18/08/2026)

Descargada por la sonda S-1 contra **preproducción**, `prewww2.aeat.es`, ruta `tikeV1.0`.
HTTP 200, 25 232 bytes, `sha256 06519ceb…d5902`, **247 códigos**. El fichero vive sin modificar en
`docs/reference/AEAT_errores.properties`, con su hash en `MANIFEST.md`, y se compila en
`@verifactu-js/client` mediante `scripts/generar-codigos-aeat.mjs`.

### 21.1 Es ISO-8859-1, y leerlo mal lo destruye

Un `.properties` de Java es **ISO-8859-1 por especificación** (javadoc de
`java.util.Properties#load(InputStream)`). La primera descarga usó `body.text()` de undici, que
decodifica como UTF-8, y guardó **184 U+FFFD sobre 186 bytes altos**. No quedó feo: quedó
**destruido**, porque de un U+FFFD no se recupera si era `ó`, `í` o `á`. Se pudo rehacer solo
porque el fichero se sirve en abierto; una respuesta a un envío real no se puede volver a pedir.

De ahí salen tres cambios:

1. `scripts/properties.mjs` decodifica en latin1, resuelve `\uXXXX` (hoy hay 0, se implementa
   igual porque el formato los admite) y repara la doble codificación de §21.2.
2. S-1 guarda `.bin` **antes** de decodificar. La regla de «guardar en crudo» ya estaba en S-2…S-4
   para peticiones y respuestas; faltaba aquí.
3. `transporteNode` deja de usar `body.text()` y honra la codificación declarada en el prólogo XML
   (`decodificarXml`). El mismo fallo sobre una `DescripcionErrorRegistro` sería irreversible.

### 21.2 El fichero de la AEAT no es latin1 puro

El código 1214 trae la `ú` codificada en **UTF-8** (bytes `C3 BA`) dentro de un fichero por lo
demás ISO-8859-1. En latin1 estricto sale `nÃºmerico`. La reparación es deliberadamente estrecha:
solo la secuencia `Ã` + continuación que vuelva a ser **una** letra Latin-1. No puede dispararse
sobre castellano legítimo, porque ninguna palabra castellana contiene `Ã`.

El texto oficial de ese mismo código dice `númerico`, con la tilde cambiada de sitio. Es una
errata de la AEAT y **se conserva tal cual**: el valor de esta tabla está en poder citarla
literalmente, y «corregirla» la haría inbuscable para quien reciba ese mensaje.

### 21.3 Las tres secciones, y por qué la categoría no es el primer dígito

| Sección | Códigos | Qué significa |
|---|:--:|---|
| «rechazo del envío completo» | 44 | **Nada** del lote se ha registrado. La cadena no avanza |
| «rechazo de la factura (o de la petición completa si el error se produce en la cabecera)» | 193 | Ese registro **no** se ha almacenado. La cadena no avanza |
| «aceptación del registro […] (posteriormente deben ser subsanados)» | 10 | El registro **sí** está almacenado y cuenta. Se subsana, **no se reenvía** |

La tercera fila es la que hay que no confundir: reenviar lo que la AEAT ya guardó produce un
duplicado (3000) y deja el original mal igual.

**La categoría se parsea de las cabeceras del fichero, no se infiere del número.** Inferirla
fallaría hoy mismo: `3500`–`3503` son 3xxx y están en la sección de envío, mientras `3000`–`3004`
son 3xxx y están en la de registro.

### 21.4 El oráculo de S-2 deja de ser una inferencia

> **2000 = El cálculo de la huella suministrada es incorrecta.**

Está en la sección de **aceptado con errores**. Eso convierte la lectura de S-2 de inferencia
(«AceptadoConErrores debe de significar que recalculó otra huella») en lectura literal: si una
variante de fecha vuelve con **2000**, la AEAT admitió el literal pero hasheó otra cosa, es decir
**normalizó la fecha antes de hashear**. Ese es exactamente el fallo silencioso que este proyecto
existe para evitar.

Los otros códigos que S-2 puede encontrarse, y que ahora se distinguen entre sí:

| Código | Texto oficial | Qué significaría |
|---|---|---|
| 2000 | El cálculo de la huella suministrada es incorrecta. | Normalizó la fecha antes de hashear |
| 1244 | El campo FechaHoraHusoGenRegistro tiene un formato incorrecto. | Rechazo por forma, sin llegar a la huella |
| 1268 | La longitud del campo FechaHoraHusoGenRegistro no cumple con las especificaciones. | Rechazo por **tamaño** — distinto de 1244, y probable en los casos de offset |
| 1243 | Error técnico al obtener el cálculo de la fecha del huso horario. | Fallo interno de la AEAT, no medida |
| 4106 / 1145 | El formato de fecha es incorrecto. / Formato de fecha incorrecto. | Fechas `dd-mm-aaaa`, no este campo |
| 2004 | …debe ser la fecha actual del sistema de la AEAT, admitiéndose un margen de error de: | Ver §21.7 |

### 21.5 I-28 (S-3) también gana un oráculo, y con la lista literal

> **1287 = El valor del campo %s contiene carácteres no validos (<, >, ", ', =).**

Dos cosas importantes. La primera: la lista de prohibidos es literalmente `<`, `>`, `"`, `'`, `=`,
y **el `&` no está en ella**, lo que confirma por escrito lo que §18 sostiene por diseño — el
separador de la cadena canónica viaja sin escapar y no hay ambigüedad que explotar.

La segunda: el `%s` es un hueco que la AEAT rellena con **el nombre del campo infractor**. Es
decir, el caso 3 de S-3 (anulación con `=`) no devolverá un sí/no: devolverá el nombre del campo,
y con eso **§18.4 queda cerrada en un solo envío**. Existe además `1130` («El campo
NumSerieFactura contiene caracteres no permitidos»), específico del alta.

### 21.6 D-16 (S-4) pasa de «probablemente no concluyente» a legible

El plan daba S-4 por poco fiable, porque un rechazo podía deberse a la incompatibilidad de bloques
o a que la `RefRequerimiento` inventada no existe. La tabla desempata:

| Código | Lectura |
|---|---|
| 4126 «RefRequerimiento solo debe informarse en… la contestación a requerimientos» | **D-16 confirmada.** Gana F3 sobre el XSD |
| 4127 «la remisión voluntaria solo debe informarse en sistemas VERIFACTU» | **D-16 confirmada** |
| 4122 / 4133 / 4125 (valor incorrecto, no alfanumérico, obligatorio) | **NO CONCLUYENTE.** Rechazó la referencia antes de mirar la combinación |
| cualquier otro | **NO CONCLUYENTE** |

Y 4126 aporta algo que no estaba en F3 con esa claridad: la exclusión va por **endpoint**, no solo
por cabecera. El bloque de requerimiento pertenece al servicio de contestación a requerimientos.

### 21.7 Lo que cambia en el diseño del cliente (fase 3d)

- **2004** — `FechaHoraHusoGenRegistro` tiene que caer dentro de una ventana alrededor de la hora
  del sistema de la AEAT. El mensaje oficial **termina en dos puntos** porque el margen se
  interpola en tiempo de respuesta: hay que leerlo de `DescripcionErrorRegistro`, no suponerlo.
  Esto es una restricción directa sobre la cola: un registro generado y encolado demasiado pronto
  se acepta *con error*. La cola no puede sellar la fecha al encolar y enviar mucho después.
- **4141** — suspensión temporal del acceso. **Nunca reintentar**; el propio mensaje dice que se
  resuelve escribiendo a `verifactu@correo.aeat.es`. Cualquier backoff tiene que reconocerlo.
- **4113 / 4114** — dos códigos distintos para los límites de tamaño. Confirman que el tope de
  1000 `RegistroFactura` que ya impone `xml` se valida también en destino.
- **Reintentar**: ningún código de esta tabla es reintentable con la misma carga, salvo los
  técnicos de la AEAT (`1129`, `1241`, `1243`, `1256`, `1288`, `3500`, `3501`, `4103`, `4108`,
  `4110`, `4111`, `4118`, `4128`). Llegan en un HTTP 200 bien formado, así que el backoff por red
  y 5xx no los ve. Se marcan con `reenviable` en `explicarCodigo`.
- **4119 / 4138** — codificación de la petición. Refuerzan que el sobre va en UTF-8 de extremo a
  extremo.

### 21.8 Hallazgo que obliga a corregir las sondas: el código 2007

> **2007 = No debe informarse como primer registro, existen facturas emitidas con el obligado
> emisión y el sistema informático actual.**

El plan mandaba cada caso «en su propia cadena, como `PrimerRegistro`». Con 2007 sobre la mesa eso
no funciona: en cuanto el primer caso queda almacenado, todos los siguientes que se declaren
primeros de cadena con el **mismo** sistema informático disparan 2007.

Y `CodigoErrorRegistro` es `maxOccurs="1"` en `RespuestaSuministro.xsd` — **un código por
registro**. Un 2007 podría por tanto **tapar al 2000**, que es justo lo que S-2 va a medir. Se
habrían gastado cinco registros contra un NIF real para no medir nada.

La salida no es un truco, es la definición del campo. El diccionario de datos de la AEAT dice de
`NumeroInstalacion`: «Deberá distinguirlo de otros posibles SIF utilizados […] de otras posibles
instalaciones de SIF pasadas, presentes o futuras […] **incluso aunque en dichas instalaciones se
emplee el mismo SIF de un productor**». Cada caso de sonda es una instalación distinta, luego cada
uno empieza legítimamente su propia cadena. Implementado en `datos({ instalacion })`.

De paso arregla una variable de confusión que el plan tenía sin darse cuenta: antes el control iba
«en limpio» y las cinco variantes no. Ahora los seis parten del mismo estado.

Si aun así saliera 2007, la lectura sigue siendo limpia: significaría que la AEAT no separa las
cadenas por `NumeroInstalacion`, y el código lo diría. Ese caso quedaría **sin medir**, y así se
anotaría.

### 21.9 Las dos rutas `tike` sirven tablas distintas

| Ruta | Bytes | Códigos | Diferencia |
|---|--:|--:|---|
| `…/tikeV1.0/cont/ws/errores.properties` | 25 232 | 247 | **La buena.** Añade 1290-1293 y 2009 |
| `…/tike/cont/ws/errores.properties` | 24 892 | 243 | Anterior. Sin IPSI en 1245/1260 |

Es la misma trampa de §8.3 en otra forma. Además hay un detalle que no es cosmético: la regla «la
huella del registro anterior debe ser distinta de la actual» es **1278 (rechazo de la factura)**
en la ruta vieja y **2008 (aceptado con errores)** en la nueva. La misma regla cambió de severidad
entre versiones, que es exactamente el tipo de cosa que este documento existe para registrar.

S-1 compara el `sha256` descargado contra la copia de `docs/reference/` y avisa si difieren.


## 22. `FechaHoraHusoGenRegistro` medida contra el servicio (S-2, 18/08/2026)

Seis altas contra **preproducción**, idénticas salvo por este literal, cada una en su propia
cadena y con su propia `NumeroInstalacion`. Crudo completo en `docs/probe-results/s2-*`.

| Caso | Literal enviado | Envío | Registro | Código |
|---|---|---|---|:--:|
| control | `2026-08-18T17:19:06+02:00` | Correcto | **Correcto** | — |
| fracción | `2026-08-18T17:19:06.123+02:00` | Incorrecto | Incorrecto | **1244** |
| huso Z | `2026-08-18T15:21:06Z` | Correcto | **Correcto** | — |
| offset con segundos | `2026-08-18T17:19:06+02:00:00` | Incorrecto | Incorrecto | **1244** |
| offset sin dos puntos | `2026-08-18T17:19:06+0200` | Incorrecto | Incorrecto | **1244** |
| offset cero | `2026-08-18T17:19:06+00:00` | ParcialmenteCorrecto | AceptadoConErrores | **2004** |

`TiempoEsperaEnvio` = `60` en las seis respuestas, aceptadas y rechazadas.

### 22.1 El hallazgo: la AEAT hashea el literal tal y como llega

El caso `Z` volvió **`Correcto`**. Eso no es un detalle sobre la letra `Z`: es la respuesta a la
pregunta que había debajo de I-07, I-08 e I-09 desde el principio.

Si la AEAT normalizase el `xs:dateTime` antes de calcular la huella —pasando `Z` a `+00:00`, que
es la normalización obvia y la que haría cualquier parser de XML Schema— su digest habría sido
distinto del nuestro y habría contestado **2000** («El cálculo de la huella suministrada es
incorrecta»), que es la categoría de *aceptado con errores*. No lo hizo. Aceptó el registro sin
una sola queja, luego calculó el mismo SHA-256 que nosotros sobre la cadena canónica que contenía
`FechaHoraHusoGenRegistro=2026-08-18T15:21:06Z`.

**La AEAT no normaliza antes de hashear.** El literal es el dato.

Crudo, del envío y de la respuesta:

```
<sf:FechaHoraHusoGenRegistro>2026-08-18T15:21:06Z</sf:FechaHoraHusoGenRegistro>
<sf:Huella>3710B1E7E31DA3A00CD7F55A0992A2A25E49A3FBE06974FDC601B80C90392F7C</sf:Huella>
```
```
<tikR:CSV>A-5LDM92G53JYSRM</tikR:CSV>
<tik:TimestampPresentacion>2026-08-18T17:21:06+02:00</tik:TimestampPresentacion>
<tikR:EstadoEnvio>Correcto</tikR:EstadoEnvio>
<tikR:EstadoRegistro>Correcto</tikR:EstadoRegistro>
```

Consecuencia directa en código: `inspectFechaHoraHuso` **no puede** tratar `HUSO_Z` como defecto.
Una cadena histórica con `Z` es válida, verificable y su huella cuadra. Ver §16.

### 22.2 El offset es exactamente `±hh:mm` (I-07 e I-09, cerradas)

Los tres casos que se salían de esa forma volvieron **1244**, rechazo de registro: fracciones de
segundo, offset con segundos y offset sin dos puntos. Ninguno llegó a la huella — la validación de
formato los paró antes, que es lo que dice el propio mensaje.

Esto **confirma la mitigación de fase 1** en vez de relajarla. Emitir `+01:00:00` porque
`xs:dateTime` lo permite habría producido registros rechazados. Y hay una confirmación de segunda
mano: la AEAT usa esa misma forma en su propio `TimestampPresentacion`.

Que además acepte `Z` no es motivo para empezar a emitirlo. `±hh:mm` está medido como bueno, es lo
que usa la AEAT, y cambiar lo que se genera solo puede restar.

### 22.3 El caso que midió otra cosa, y por qué

`offset-cero` debía responder la pregunta que importa —¿vale `+00:00` explícito, el caso de
Canarias en invierno?— y no la respondió. Volvió **2004**, que mide desfase de reloj.

Llevaba **dos** defectos independientes, y cualquiera de los dos bastaba:

1. **Cambió el instante, no la forma de escribirlo.** El caso sustituía el sufijo dejando la hora
   de pared: `17:19:06+02:00` → `17:19:06+00:00`. Eso no reescribe un instante, lo mueve dos horas
   al futuro. Se envió 17:19:06 UTC cuando la AEAT marcaba 15:24 UTC.
2. **El literal venía del control, ya rancio.** Las cinco variantes derivaban del literal generado
   al principio de la ejecución, y entre envío y envío se esperan 60 s. `offset-cero` se envió
   **301 s** después de la hora que llevaba escrita — por encima del margen, incluso sin el
   defecto anterior.

El segundo no mordió en los otros casos de puro azar: la validación de formato los rechazaba antes
de llegar al reloj. Los dos están arreglados en `s2-fechas.mjs`, y el reintento fue **S-2b** (§22.7),
un envío, que además comprueba el reloj **antes** de gastarlo leyendo la cabecera `Date` de un host
de la AEAT — cero registros.

La lección es que el literal de fecha es a la vez el dato que se mide **y** algo que la AEAT
contrasta contra su reloj. Tocarlo sin querer cambia la pregunta.

Y el segundo defecto no es solo nuestro: es el modo de fallo que le espera a cualquiera que encole
registros. Va aparte, en **§22.9**.

### 22.4 Constante medida: el margen de reloj son **240 segundos**

```
El valor del campo FechaHoraHusoGenRegistro debe ser la fecha actual del sistema de la AEAT,
admitiéndose un margen de error de: 240 segundos.
```

**No está publicado en ningún sitio.** No aparece en F3, ni en F4, ni en el diccionario de datos.
El texto del código 2004 en `errores.properties` termina en dos puntos precisamente porque el
número se interpola en tiempo de respuesta; solo se ve enviando algo fuera de plazo.

Lo que hace peligroso al 2004 es su categoría: **aceptado con errores**. El registro **queda
almacenado** y cuenta, con un error que hay que subsanar después. No falla ruidosamente.

Dos consecuencias de diseño para la fase 3d:

1. **La cola no puede sellar la fecha al encolar y enviar mucho más tarde.** Cuatro minutos es muy
   poco margen para un reintento con espera: si `TiempoEsperaEnvio` son 60 s, cuatro reintentos ya
   agotan la ventana. El sellado tiene que ir junto al envío, no junto al encolado. Desarrollado
   en **§22.9**, con la consecuencia que no es obvia: re-sellar cambia la huella, así que un
   registro encolado ya firmado no se puede «poner al día».
2. **Un reloj de sistema desincronizado produce facturas defectuosas en silencio.** Comprobarlo
   antes de empezar vale más que cualquier reintento, y sale gratis: la AEAT devuelve su hora en
   `DatosPresentacion.TimestampPresentacion` en **cada respuesta aceptada**, y cualquier respuesta
   HTTP suya trae cabecera `Date` para comprobarlo sin enviar nada.

En código: `MARGEN_RELOJ_AEAT_SEGUNDOS = 240` y `desfaseDeReloj()` en
`packages/client/src/medido.ts`, con la procedencia pegada. Es el umbral de aviso que le toca al
`doctor` del CLI (`VERIFACTU-BRIEF.md` §7). El valor de la respuesta manda siempre: si la AEAT lo
cambia, lo dirá en `DescripcionErrorRegistro` antes que nosotros.

### 22.5 `TiempoEsperaEnvio` = 60 s

Idéntico en las seis respuestas, incluidas las rechazadas. Se documenta como punto de partida
razonable cuando todavía no hay respuesta que leer (`TIEMPO_ESPERA_ENVIO_INICIAL_SEGUNDOS`), no
como constante del servicio: la AEAT lo sube cuando quiere frenar a alguien, y **el valor de la
respuesta manda siempre**.

### 22.6 De propina: `DatosPresentacion`

La respuesta aceptada trae `NIFPresentador` y `TimestampPresentacion`, que `@verifactu-js/xml` ya
parseaba y nadie usaba. `TimestampPresentacion` es **el reloj de la AEAT**, y llega en cada envío
aceptado: comprobar el desfase no cuesta nada extra. Las respuestas rechazadas (1244) **no** traen
el bloque, lo cual tiene sentido — no hubo presentación que sellar.

### 22.7 S-2b: `+00:00` explícito también vale (I-08, cerrada el 19/08/2026)

Un envío, el instante de ese momento escrito con offset cero:

```
<sf:FechaHoraHusoGenRegistro>2026-08-18T23:36:50+00:00</sf:FechaHoraHusoGenRegistro>
<sf:Huella>35EC18A6A88B268E0E8BFB08E240A666B6F011904D4B9211F3EBDBFA78484C75</sf:Huella>
```
```
<tikR:CSV>A-T5BLBWD7HKASYZ</tikR:CSV>
<tik:TimestampPresentacion>2026-08-19T01:36:51+02:00</tik:TimestampPresentacion>
<tikR:EstadoEnvio>Correcto</tikR:EstadoEnvio>
<tikR:EstadoRegistro>Correcto</tikR:EstadoRegistro>
```

**Las dos formas del huso cero valen.** `Z` y `+00:00` se aceptan por igual, y cada una se hashea
como viene escrita. No son intercambiables: son literales distintos, producen huellas distintas, y
las dos son correctas. La elección la hace quien genera, y queda congelada en la cadena para
siempre — que es exactamente por qué esta librería emite una sola forma y nunca la cambia.

Con esto **I-07, I-08 e I-09 quedan cerradas** y `packages/core/src/datetime.ts` se queda sin
ningún `TODO(verify:)` de fechas.

La comprobación de reloj previa funcionó y de paso se validó a sí misma: la cabecera `Date` del
host estático dio 0 s de desfase, y el `TimestampPresentacion` del servicio SOAP dio 0 s también.
Un solo punto de datos, pero es el único que había y dice que los dos relojes van juntos.

### 22.8 Dos observaciones incidentales, dichas como lo que son

**El reloj de la AEAT es peninsular.** `TimestampPresentacion` vino con `+02:00` en las tres
respuestas aceptadas (agosto, horario de verano). No es una sorpresa, pero conviene tenerlo escrito
antes de razonar sobre husos: cuando la AEAT dice «la fecha actual del sistema de la AEAT» (código
2004) se refiere a un instante, no a una fecha de calendario, y el margen de 240 s se aplica sobre
instantes. Un SIF en Canarias no tiene ningún problema por estar una hora por detrás.

**Las dos fechas del registro salieron de zonas distintas y nadie se quejó.** El registro de S-2b
llevaba `FechaExpedicionFactura` = `19-08-2026` —la fecha local peninsular en ese momento— y
`FechaHoraHusoGenRegistro` = `2026-08-18T23:36:50+00:00`, que en UTC es todavía el día 18. La AEAT
lo aceptó sin errores.

Eso **no** demuestra que la AEAT tolere cualquier discrepancia entre ambos campos: demuestra que
ninguna regla saltó en ese caso concreto, y la única regla candidata (1112, «FechaExpedicionFactura
es superior a la fecha actual») no podía saltar porque la fecha de la AEAT era también el 19. No se
extrapola.

Lo que sí deja es una lección para quien integre, y para nuestras propias sondas: **derivar las dos
fechas de zonas distintas es un error esperando a ocurrir**, y es justo la forma que toma el
problema de Canarias. Ambas tienen que salir del mismo instante y de la misma zona. Las sondas ya
lo hacen así.


### 22.9 El literal que envejece: un modo de fallo para cualquiera que encole

Lo de §22.3 no fue solo un fallo de la sonda. **Es lo que le va a pasar a cualquiera que encole
registros**, y merece estar escrito como modo de fallo y no como anécdota, porque el sistema no
avisa cuando ocurre.

**El mecanismo.** `FechaHoraHusoGenRegistro` se sella cuando se *genera* el registro. Entre generar
y enviar puede pasar tiempo: una cola, un reintento, un proceso nocturno, un usuario que cierra la
caja y el envío sale luego. La AEAT no compara ese sello contra la fecha de la factura: lo compara
contra **su propio reloj**, con un margen de **240 s** (§22.4). Un registro correcto en el momento
de generarse deja de serlo por el mero paso del tiempo.

**La aritmética es más ajustada de lo que parece.** `TiempoEsperaEnvio` fue 60 s en las siete
respuestas medidas. Cuatro esperas agotan la ventana. Un lote que reintenta unas pocas veces, o un
envío por detrás de otros tres en la cola, ya está fuera. A la sonda le pasó sin proponérselo: el
literal salió 301 s después de la hora que llevaba escrita.

**Y falla en silencio, que es lo peor.** El código 2004 es de categoría *aceptado con errores*: el
registro **queda almacenado**, cuenta a efectos del RD 1007/2023, y hay que subsanarlo uno a uno.
No hay excepción, no hay rechazo, no hay nada que mirar en los logs salvo un código en la respuesta
que es fácil dar por bueno porque el `EstadoEnvio` dice `ParcialmenteCorrecto`.

#### La consecuencia que no es obvia: no se puede re-sellar

La reacción natural es «pues le pongo la fecha de ahora antes de enviarlo». **No se puede**, o no
sin más: `FechaHoraHusoGenRegistro` **entra en la huella**.

```
2026-08-19T12:00:00+02:00  →  6172DDF8744FEA88…
2026-08-19T12:05:00+02:00  →  F5AB113C5911A072…
```

El mismo registro, sellado cinco minutos después, tiene otra huella. Y como la huella de cada
registro es un campo del siguiente, re-sellar uno **invalida toda la cadena que cuelgue detrás**.
Un registro encolado con su huella ya calculada es, a efectos prácticos, inmutable: o se envía
dentro de la ventana, o se envía tarde y se subsana.

#### La regla que sale de aquí

**La cadena se construye en el momento de enviar, no en el de encolar.** Lo que se encola son los
datos de la factura; el sello temporal, la huella y el eslabón con el registro anterior se calculan
justo antes de abrir el socket, y con lo que de verdad se envió como eslabón previo.

Es lo contrario de lo que sugiere la intuición —«dejo el registro listo y ya lo mandaré»— y es la
restricción que más forma le da a la cola de la fase 3d:

1. La cola guarda **datos**, no registros firmados.
2. El encadenamiento es una operación de envío, no de preparación. Sale de ahí que la cola tenga
   que ser estrictamente secuencial: no se puede preparar el registro *n+1* sin saber la huella del
   *n*, y no se sabe hasta enviarlo.
3. Si aun así hay que encolar registros ya firmados —porque el SIF los genera en otro proceso, que
   es un caso real—, entonces hay que **medir la antigüedad antes de enviar** y decidir a
   conciencia: enviar sabiendo que va a volver 2004 y subsanarlo después, o rehacer la cadena desde
   ese punto. Lo que no vale es enviarlo sin mirar.

`desfaseDeReloj()` mide las dos distancias, porque las dos son la misma resta contra el mismo
margen: pasándole el `TimestampPresentacion` de la AEAT dice si la máquina va mal, y pasándole el
sello del propio registro dice cuánto ha envejecido. El texto de `aviso` está redactado para el
primer caso; para el segundo, lo que se mira es `segundos` y `dentroDelMargen`.


## 23. I-28 y D-16 medidas contra el servicio (S-3 y S-4, 19/08/2026)

### 23.1 El `&` viaja sin escapar, y la AEAT calcula la misma huella (I-28, cerrada)

| Caso | `NumSerieFactura` | Envío | Registro | Código |
|---|---|---|---|:--:|
| 1 | `S3-A&B-…` | Correcto | **Correcto** | — |
| 2 | `S3-A=B-…` | Incorrecto | Incorrecto | **1287** |
| 3 | anulación con `=` | Incorrecto | Incorrecto | **1287** |

El caso 1 volvió `Correcto` con CSV `A-VFVXAT4FXN9JUR`. Eso significa que la AEAT calculó **la misma
huella** sobre una cadena canónica que contenía un `&` dentro de un valor:

```
IDEmisorFactura=…&NumSerieFactura=S3-A&B-20260819…&FechaExpedicionFactura=…
```

**Queda medido lo que §18 sostenía por diseño.** La discusión era si permitir el `&` o rechazarlo
por precaución: la cadena canónica usa `&` como separador y no escapa nada, así que un valor con `&`
la vuelve visualmente ambigua. La decisión fue permitirlo, porque la ambigüedad es aparente y no
real —el número de campos es fijo y su orden también, de modo que un parser posicional nunca se
confunde—. Ahora está confirmado por medición y no por razonamiento.

Y el texto oficial del código 1287 lo dice por escrito:

> El valor del campo %s contiene carácteres no validos (`<`, `>`, `"`, `'`, `=`).

**Cinco caracteres, y el `&` no está entre ellos.** Rechazarlo habría sido más estricto que la AEAT,
y habría rechazado series legales de usuarios reales.

### 23.2 §18.4 cerrada, con un matiz sobre el `%s`

La pregunta abierta era si la restricción de caracteres alcanza también a la anulación, donde el
campo se llama `NumSerieFacturaAnulada`. **Sí la alcanza**: el caso 3 volvió rechazado con 1287.

Pero el `%s` **no** trae el nombre real del campo. La respuesta a una anulación con `=` en
`NumSerieFacturaAnulada` fue, literal:

```
El valor del campo NumSerieFactura contiene carácteres no validos (<, >, ", ', =).
```

El registro enviado no contiene ningún elemento llamado `NumSerieFactura` —una anulación lleva
`IDEmisorFacturaAnulada`, `NumSerieFacturaAnulada` y `FechaExpedicionFacturaAnulada`—, así que la
AEAT rellena el `%s` con un **nombre genérico o normalizado**, no con el nombre del elemento XML.

Lo que sí queda medido y lo que no:

- **Medido:** la restricción se aplica a la anulación. El registro se rechaza.
- **Medido:** el `%s` no es un identificador fiable del elemento infractor cuando el registro es una
  anulación.
- **No medido:** si la AEAT normaliza el nombre («Anulada» fuera) o si simplemente usa una etiqueta
  fija para la familia. Con un solo campo candidato en el registro no se puede distinguir, y
  distinguirlo costaría otro registro para responder algo que no cambia ninguna decisión.

Consecuencia práctica: **no ramificar sobre el `%s`.** Sirve para enseñárselo a una persona, no para
que un programa deduzca qué campo corregir. `core` ya rechaza el `=` en los dos campos, que es lo
correcto sea cual sea el nombre que devuelva la AEAT.

### 23.3 D-16 confirmada, y la exclusión va **por endpoint** (S-4)

La cabecera con `RemisionVoluntaria` y `RemisionRequerimiento` a la vez volvió con **4126**:

> Codigo[4126].Error en la cabecera: el campo RefRequerimiento solo debe informarse en sistemas en
> remisiones al endpoint del servicio a usar para la contestación a requerimientos de registros de
> facturación.

D-16 queda confirmada: gana F3 sobre el XSD. Pero el mensaje dice **más** que F3, y es lo importante
del hallazgo.

F3 §3.1.1 presenta los dos bloques como excluyentes *dentro de la cabecera*. La AEAT no habla de la
cabecera: habla del **endpoint**. `RefRequerimiento` pertenece al servicio de contestación a
requerimientos, y en el endpoint de remisión voluntaria sobra siempre — con `RemisionVoluntaria`
delante o sin ella.

**Y eso explica el XSD.** La pregunta que quedaba en §19 era por qué el esquema declara los dos
bloques como opcionales independientes si son excluyentes. La respuesta es que el esquema **es común
a los dos endpoints**: `SuministroLR.xsd` describe la forma del documento, y la restricción no vive
en la forma sino en el servicio que lo recibe. Un esquema por endpoint habría podido expresarlo; uno
compartido, no. No es un descuido de la AEAT, es una consecuencia de compartir esquema.

Para la librería no cambia nada: `writeCabecera` sigue rechazando la combinación con
`CABECERA_INCOHERENTE`, que ahora está medido como correcto. Cambia el **motivo** que se documenta:
no es «F3 lo prohíbe», es «este bloque pertenece a otro servicio».

### 23.4 Un error de cabecera llega como SOAP Fault, no como respuesta de negocio

S-4 preguntaba por D-16 y contestó de paso algo que no estaba probado. El 4126 **no llegó** en una
`RespuestaLinea` con su `CodigoErrorRegistro`: llegó como **SOAP Fault**, con el código embebido en
el `faultstring` con la forma `Codigo[4126].`.

Tiene sentido — un error de cabecera tumba el envío entero y no hay línea de la que colgarlo — pero
significa que **hay dos caminos por los que llega un código de la AEAT**, y hasta ahora solo uno
estaba tratado. El código quedaba dentro de una frase y `explicarCodigo()` no lo veía nunca.

Corregido:

- `@verifactu-js/xml` extrae el código del `faultstring` y lo expone en
  `VerifactuXmlError.codigoAeat`. Si el patrón no aparece, devuelve `undefined`: inventarse un
  código sería peor que no tenerlo.
- `@verifactu-js/client` lo propaga a `VerifactuClientError.codigoAeat`, y su `accionSugerida`
  remite a `explicarCodigo()`.
- Los dos caminos dan **el mismo objeto** de explicación. Quien integra no debería tener que saber
  por cuál llegó.

### 23.5 Y un defecto de la sonda: el cuerpo del fault se perdió

S-4 declaraba la respuesta HTTP dentro del `try`. Cuando `parsearRespuesta` lanzó sobre el fault, el
cuerpo se descartó y el fichero quedó con `(no hubo respuesta)`. La conclusión se salvó **solo
porque el mensaje del error llevaba el texto dentro**, lo cual es suerte y no diseño.

Es el mismo principio de §22.9 aplicado a otra cosa: **una respuesta de la AEAT a un registro real
no se puede volver a pedir.** Arreglado en la sonda, y también en la librería —
`VerifactuClientError.cuerpo` lleva ahora el cuerpo entero cuando no se ha podido parsear, que es
justo cuando más falta hace y cuando más fácil es perderlo.


## 24. S-5: las cuatro que bloqueaban el estable (19/08/2026)

> **Completa: siete registros, en dos tandas.** La primera paró en el tercer caso por un error de
> construcción —local, antes de enviarlo— que se explica en §24.4. La segunda envió los cinco que
> faltaban.
>
> **Resultado: I-02, I-04 e I-05 cerradas. I-01 e I-03 inalcanzables por construcción.**
> Con eso no queda ninguna incógnita bloqueando declarar `0.1.0` estable.

| # | Caso | `NumSerieFactura` | Envío | Registro | Código |
|---|---|---|---|---|:--:|
| 1 | I-01 | `S5-NBSP-…` + `U+00A0` | Incorrecto | Incorrecto | **1130** |
| 2 | I-02 | `S5-A␣␣B-…` (dos espacios) | Correcto | **Correcto** | — |
| 3 | I-03 | — | *no se envió* | — | — |

### 24.1 I-02 cerrada: los espacios interiores se conservan

`S5-A  B-20260819012803`, con dos espacios seguidos, volvió **`Correcto`** con CSV
`A-TDPEZN6FG2CYFE`. La AEAT calculó la misma huella sobre una cadena canónica que contenía los dos
espacios seguidos, luego **no los colapsa**.

Era una de las cuatro que bloqueaban declarar `core` estable. El vector oficial `12345678 / G33`
probaba que los espacios simples se conservan; ahora se sabe que los múltiples también, y `core` no
tiene que hacer nada distinto de lo que ya hace.

### 24.2 I-01: no concluyente para la huella, pero con un hallazgo propio

El NBSP viajó de verdad —los bytes `C2 A0` están en `s5-nbsp-final.request.xml`— y volvió con
**1130**, «El campo NumSerieFactura contiene caracteres no permitidos». El registro se rechazó
antes de llegar a comparar huellas, así que **la pregunta de I-01 no se ha medido**: seguimos sin
saber qué semántica de recorte aplica la AEAT.

Lo que sí se ha medido es más útil de lo que parece:

1. **La AEAT rechaza el NBSP en `NumSerieFactura`.** No con 1287 —la lista de ese código es
   `<`, `>`, `"`, `'`, `=`, y el NBSP no está—, sino con **1130**, que es la regla específica del
   campo. Es decir, el juego de caracteres admitido en la serie es **más estrecho** que «todo menos
   esos cinco», y la restricción a ASCII que `core` aplica (F3 §3.1.3.1) queda respaldada por una
   medición.
2. **La pregunta de I-01 puede no tener sentido.** El recorte solo importa si el carácter llega a
   la huella, y este no llega: lo rechaza la AEAT antes. Como `NumSerieFactura` es el **único campo
   de texto libre que entra en la huella del alta** —los demás son NIF, fecha, enum, decimal y
   hex—, no hay ningún sitio por donde un carácter de la zona gris pueda alcanzarla.

**I-01 sigue degradada, no cerrada** (§12.2). La medición es de un solo carácter; el resto de la
zona gris —`U+2000`–`U+200A`, `U+202F`, `U+3000`, `U+FEFF`— comparte la propiedad que provocó el
rechazo, pero eso es inferencia y no medición.

### 24.3 I-03 cambia de pregunta

`core` restringe `NumSerieFactura` y `NumSerieFacturaAnulada` a ASCII 32-126, y esos son los únicos
campos de texto libre que entran en las huellas del alta y de la anulación. De ahí sale una
consecuencia que no estaba escrita:

> **Si la AEAT también restringe la serie a ASCII, entonces ningún carácter que la normalización
> Unicode pueda tocar entra jamás en una huella, e I-03 queda inalcanzable por construcción — igual
> que I-01.**

Así que la pregunta primaria del caso 3 ya no es «¿normaliza la AEAT a NFC?», sino **«¿admite la
AEAT caracteres no ASCII en el número de serie?»**. La de normalización solo existe si la respuesta
es que sí.

Y esa reformulación tiene valor propio, porque la respuesta interesante es la incómoda: si la AEAT
**sí** los admite, entonces `core` es **más estricto que la AEAT** y está rechazando series legales
con `Ñ` o con acentos, que en España no es un caso raro. Sería el mismo hallazgo que el del `&`
(§23.1) pero al revés, y habría que decidir si se afloja.

El 1130 del caso 1 apunta a que la AEAT restringe, pero un NBSP es un carácter de espaciado y una
`é` es una letra: no es la misma pregunta y no se deduce una de la otra.

### 24.4 El error del plan, y el arreglo que faltaba

El plan de S-5 decía que el caso 3 **no** se saltaba `core`. Era falso y no se comprobó: `core`
rechaza cualquier no-ASCII en la serie con `CARACTER_NO_PERMITIDO`. La sonda se estrelló ahí,
**después de haber gastado dos registros** contra un NIF real.

El fallo no es que el caso estuviera mal: es que un error de construcción —local, gratis, detectable
sin red— se descubrió a mitad de la tanda. La sonda ahora **construye los siete casos antes de
enviar ninguno** y aborta con la lista de los que fallan. Y `--seco` deja ejercitar esa comprobación
sin enviar nada, que es lo único de esta sonda que se puede probar sin gastar registros.

Cada caso que se salta `core` declara además su motivo en `motivoSalto`, para que la excepción sea
explícita y no algo que haya que deducir leyendo el código:

| Caso | Motivo del salto |
|---|---|
| 1 · NBSP | `ESPACIO_AMBIGUO_EN_BORDE` — `core` se niega a elegir en la zona gris de I-01 |
| 3 · NFD | `CARACTER_NO_PERMITIDO` — `core` restringe la serie a ASCII 32-126 |

Es el mismo principio que §22.9 y §23.5: **lo que cuesta registros se comprueba antes de gastarlos**.

---

### 24.5 Segunda tanda: I-04 e I-05 cerradas, I-03 inalcanzable

Cinco envíos, reanudando sin repetir los dos ya medidos.

| Caso | `ImporteTotal` enviado | Envío | Registro | Código | CSV |
|---|---|---|---|:--:|---|
| `unicode-nfd` | — | Incorrecto | Incorrecto | **1130** | — |
| `decimal-dos` | `121.10` | Correcto | **Correcto** | — | `A-5P4FLP7VZBVTPF` |
| `decimal-uno` | `121.1` | Correcto | **Correcto** | — | `A-TW2XNG7A7GWZEH` |
| `signo-mas` | `+121.00` | Correcto | **Correcto** | — | `A-QDUDCB8SD7MFVF` |
| `importe-negativo` | `-121.00` | Correcto | **Correcto** | — | `A-BW2EGNA3QJ8WS6` |

Las cuatro huellas aceptadas se han **recalculado desde el XML guardado** y coinciden con la que
viajó, así que en los cuatro casos la AEAT dio por buena una huella computada sobre exactamente el
literal que aparecía en el documento.

### 24.6 I-03: inalcanzable por construcción, y `core` no es más estricto que la AEAT

El acento combinante (`U+0301`) volvió con **1130**, el mismo código que el NBSP. Son dos
caracteres de familias distintas —uno de espaciado, otro una marca combinante— y los dos rechazados
por la misma regla de campo.

**La pregunta de normalización queda sin medir y deja de importar.** `NumSerieFactura` y
`NumSerieFacturaAnulada` son los únicos campos de texto libre que entran en las huellas, y están
restringidos a ASCII en los dos extremos: `core` por `assertSerieValida`, y la AEAT por lo medido.
Ningún carácter que la normalización Unicode pueda tocar llega jamás a una huella.

Y contesta la pregunta incómoda que planteaba §24.3: **`core` no es más estricto que la AEAT.** El
riesgo era estar rechazando series legales con `Ñ` o acentos; no las hay, la AEAT también las
rechaza. La restricción a ASCII 32-126 de F3 §3.1.3.1 queda confirmada por medición.

I-03 pasa al mismo estado que I-01: **abierta en el papel, inalcanzable en la práctica, sin
bloquear nada.**

### 24.7 I-04 cerrada, con un matiz que estos dos casos no resuelven

`121.10` y `121.1` —el mismo importe, dos escrituras— volvieron los dos `Correcto`, cada uno con su
huella sobre su propio literal. El control positivo cumplió su función: `121.10` cuadró primero, así
que el resultado de `121.1` es legible.

**Lo que queda medido:** se puede escribir un importe con uno o con dos decimales, y la huella
calculada sobre esa escritura se acepta. La tolerancia que promete F1 es real y no hay que
normalizar nada antes de hashear.

**Lo que estos dos casos NO distinguen**, y conviene decirlo porque F1 lo planteaba como pregunta
abierta: siguen vivas dos hipótesis.

- **(a) La AEAT hashea el literal que recibe.**
- **(b) La AEAT prueba varias normalizaciones y acepta si alguna coincide.**

Bajo las dos, `121.10` y `121.1` vuelven `Correcto`. El par no las separa.

Lo que sí puede decirse: **(a) es la explicación parsimoniosa y compatible con los trece registros
enviados**, incluido el `Z` de S-2 —que bajo (b) obligaría a que la estrategia de «probar variantes»
se aplicara también a fechas—. Pero parsimonia no es medición.

**Y la distinción no cambia ninguna decisión.** Bajo (a) y bajo (b), lo correcto es lo que `core`
ya hace: serializar una vez y usar esa misma cadena para el XML y para la huella (§1.7, §1.3.1). El
mecanismo interno de la AEAT es curiosidad, no requisito.

Si algún día se quisiera separar: **un registro** en el que el literal del XML y la entrada de la
huella discrepen a propósito —XML con `121.10`, huella sobre `121.1`—. Bajo (a) devolvería 2000;
bajo (b), `Correcto`. Es justo lo que §1.3.1 prohíbe construir con la librería, así que tendría que
armarse a mano, como los casos 1 y 3.

### 24.8 I-05 cerrada: el signo entra en la huella tal cual

`+121.00` y `-121.00` volvieron los dos `Correcto`, con las huellas sobre esos literales. El `+`
explícito **viaja** —no lo tumba el XSD ni lo quita la AEAT— y el negativo de una rectificativa por
diferencias también.

De ahí sale una frase que merece estar escrita sin rodeos, porque es contraintuitiva y es el origen
de la mitad de los errores de huella que este proyecto existe para evitar:

> **La huella no es función del importe. Es función de cómo se escriba el importe.**

`121.00` y `+121.00` son el mismo dinero y **huellas distintas**, las dos válidas. Quien serialice
de dos formas distintas en dos sitios del código producirá registros irreproducibles sin que nada
falle en el momento. Por eso `core` obliga a pasar el importe ya serializado y `xml` escribe
exactamente lo que se hasheó.

