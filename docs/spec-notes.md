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

- **I-01 `BLOQUEA-ESTABLE` — Semántica exacta de «espacios» en el trim.** F1 dice «eliminando los espacios al inicio
  y al final de cada valor». La referencia Java usa `String.trim()` (recorta `<= U+0020`).
  No consta si la AEAT, al recalcular, aplica esa misma semántica o un trim Unicode.
  Impacto: valores con NBSP/tab/newline en los bordes. **Propuesta: replicar Java. Sin confirmar.**
- **I-02 `BLOQUEA-ESTABLE` — Espacios interiores.** El ejemplo `12345678 / G33` demuestra que se conservan, pero
  no consta si la AEAT colapsa espacios interiores múltiples al recalcular
  (XML `xs:string` no normaliza, pero algunos parsers sí). **Sin confirmar.**
- **I-03 `BLOQUEA-ESTABLE` — Normalización Unicode.** No consta si la cadena debe estar en NFC antes de codificar a
  UTF-8. Un `NombreRazon` o un `NumSerieFactura` con `é` precompuesta vs. descompuesta produce
  bytes distintos. Ningún documento lo menciona. **Sin confirmar.** (Nota: `NumSerieFactura` es
  el único campo de texto libre que entra en la huella del alta, y el QR limita `numserie` a
  ASCII 32-126 — pero la huella no impone esa restricción explícitamente.)
- **I-04 `BLOQUEA-ESTABLE` — Mecanismo de tolerancia decimal de la AEAT.** F1 dice que `123.1` y `123.10` son
  «igualmente válidos». No consta **cómo**: ¿la AEAT prueba ambas variantes?, ¿normaliza a 2
  decimales?, ¿normaliza quitando ceros a la derecha? Tampoco consta el comportamiento con
  `123` (sin punto), `123.` (punto sin decimales, que el XSD permite: `(\.\d{0,2})?`),
  `+123.45` (signo explícito, permitido por el XSD) o `-0.00`. **Sin confirmar. Alto riesgo.**
- **I-05 `BLOQUEA-ESTABLE` — Importes negativos y signo.** El XSD permite `(\+|-)?`. No hay ningún ejemplo oficial
  de huella con importe negativo (facturas rectificativas por diferencias). No consta si el `+`
  explícito se conserva en la cadena de la huella. **Sin confirmar.**

### Fechas y reloj

- **I-06 `ABIERTA` — Valor del «margen de error»** admitido entre `FechaHoraHusoGenRegistro` y el reloj de
  la AEAT. F3 lo menciona tres veces sin cuantificarlo. La FAQ F6 cita un umbral de **1 minuto**
  pero referido a otra cosa (comparación entre el registro anterior y el actual, art. 7.i.2º de la
  Orden), no a la comparación contra el reloj de la AEAT. **Sin confirmar.**
- **I-07 `BLOQUEA-ESTABLE` — Fracciones de segundo.** `xs:dateTime` las admite; el formato documentado
  `YYYY-MM-DDThh:mm:ssTZD` no las contempla. No consta si `2024-01-01T19:20:30.123+01:00` se
  acepta ni cómo entraría en la huella. **Propuesta: prohibirlas. Sin confirmar.**
- **I-08 `BLOQUEA-ESTABLE` — Offset `Z` vs `+00:00`.** Para Canarias en invierno el offset es cero. No consta si la
  AEAT acepta `Z` o exige `+00:00`. La huella daría resultados distintos. **Sin confirmar.**
  Afecta al caso Canarias del brief (`VERIFACTU-BRIEF.md` §6.2). Hay que probarlo contra
  preproducción; ahora es viable (ver I-27).
  **Mitigación en fase 1:** emitir siempre `+00:00`, nunca `Z`, y rechazar `Z` en la entrada.
- **I-09 `BLOQUEA-ESTABLE` — Offsets con segundos** (`+01:00:00`) o sin dos puntos (`+0100`): permitidos por
  `xs:dateTime` el primero, no el segundo. **Sin confirmar.**
  **Mitigación en fase 1:** emitir y exigir siempre `±hh:mm`.

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
- **I-16 — Estructura completa de `Cabecera` y `RespuestaSuministro`.** Extraída del XSD pero no
  auditada campo a campo en este documento. Pendiente para la fase 2/3.
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
| Declarar `0.1.0` **estable** | I-01, I-02, I-03, I-04, I-05, I-07, I-08, I-09 (`BLOQUEA-ESTABLE`) |
| Cerrar fase 2 (`xml` + `qr`) | I-10, I-11, I-14 |
| Cerrar fase 3 (`client`) | I-15 |

Las ocho `BLOQUEA-ESTABLE` afectan a casos borde (Unicode, signos, decimales exóticos, formato
del offset) y **todas** se aíslan en un único módulo de canonicalización, de modo que resolverlas
más adelante no obliga a rediseñar la API. Cada una lleva su `TODO(verify: I-XX)` en el código y
su test correspondiente marcado como pendiente.

Todas ellas se resuelven con **un certificado electrónico cualificado real** y una batería de
pruebas contra preproducción (§13).

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
(`HUSO_Z`, `SIN_HUSO`, `FRACCION_DE_SEGUNDO`, `OFFSET_CON_SEGUNDOS`, `FORMATO_DESCONOCIDO`).

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
