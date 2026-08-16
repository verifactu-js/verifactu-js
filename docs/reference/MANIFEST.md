# MANIFEST — procedencia y verificación

<!-- Generado por scripts/reference-manifest.mjs. No editar a mano. -->

Esta carpeta redistribuye documentación oficial **sin modificar**. La tabla permite comprobarlo
sin tener que fiarse de nosotros:

```bash
node scripts/reference-manifest.mjs --check    # verifica que los SHA-256 siguen coincidiendo
sha256sum docs/reference/AEAT_huella_hash.pdf  # o a mano, contra la tabla
```

Descargados el **2026-08-16**. Ninguno se ha alterado: si un fichero cambia, el
hash deja de coincidir y el CI falla.

## Condiciones de reutilización

**AEAT** — [Utilización de la información contenida en la web](https://sede.agenciatributaria.gob.es/Sede/condiciones-uso-sede-electronica/aviso-legal/utilizacion-informacion-contenida-web-aeat.html),
consultado el 2026-08-16:

> La información «es susceptible de reutilización, quedando autorizada su reproducción total o
> parcial, modificación, distribución y comunicación, para usos comerciales y no comerciales».

Con tres condiciones, que esta carpeta cumple:

| Condición de la AEAT | Cómo se cumple |
|---|---|
| «Queda prohibida en cualquier circunstancia la desnaturalización del contenido de la información» | Los ficheros son los originales, sin modificar. El SHA-256 lo demuestra |
| «Es obligatorio citar la fuente de los documentos objeto de la reutilización» | Columna «Origen» de la tabla, y cita por afirmación en `docs/spec-notes.md` |
| «Es obligatorio mencionar la fecha de la última actualización, cuando esté disponible» | Columnas «Versión» y «Fecha doc.» |

**BOE** — [Aviso legal](https://www.boe.es/informacion/aviso_legal/index.php). La reutilización
se permite para fines comerciales y no comerciales. Además, el artículo 13 del texto refundido de
la Ley de Propiedad Intelectual (RDL 1/1996) establece que **las disposiciones legales y
reglamentarias no son objeto de propiedad intelectual**, por lo que los textos normativos de esta
carpeta no están protegidos por derechos de autor.

**W3C** — `xmldsig-core-schema.xsd` se redistribuye bajo la
[W3C Document Notice](https://www.w3.org/copyright/document-license/). Está aquí porque
`SuministroInformacion.xsd` lo importa desde una URL remota y el validador XSD que usamos en los
tests no tiene acceso a red.

## Ficheros

| Fichero | Documento | Versión | Fecha doc. | Tamaño | SHA-256 |
|---|---|---|---|---|---|
| `AEAT_descripcion_servicio_web.pdf` | Sistemas Informáticos de Facturación · Remisión voluntaria (descripción del servicio web) | 1.0.3 | — | 1672.8 KB | `b3570f6a308ce98a5f52001a0dc427310ad6cf7bccd60a9ee98720a59e553c02` |
| `AEAT_DsRegistroVeriFactu.xlsx` | Diseños de registro de facturación (diccionario de datos) | 1.0 | 2024-10-28 | 58.5 KB | `40ce191aa1def6e44a5f1e86d7ece727258745b34e3fe4d6abe1468252dac2ca` |
| `AEAT_FAQs_desarrolladores.pdf` | Aclaraciones a dudas de los desarrolladores | 1.3 | 2025-12-04 | 675.3 KB | `73906dc8afbbb9da35f6cb489980352b42aed66d48828fd62a00168883c09d5e` |
| `AEAT_huella_hash.pdf` | Detalle de las especificaciones técnicas para generación de la huella o hash de los registros de facturación | 0.1.2 | 2024-08-27 | 1146.6 KB | `f4334c254bb875b417247b54315199f89d75a8c4814dfd1e86efec562653d7de` |
| `AEAT_QR.pdf` | Detalle de las especificaciones técnicas del código «QR» de la factura y de la «URL» del servicio de cotejo | 0.5.0 | 2025-12-10 | 768.1 KB | `f86b3c260d8a4963dbc18c5007732b53199156c5d1db63242e68db71501b49eb` |
| `AEAT_validaciones_errores.pdf` | Validaciones — Sistemas Informáticos de Facturación y Sistemas VERI*FACTU | 1.2.2 | 2026-04-08 | 643.5 KB | `426eb926fc098a36a163f66ca5f40d9e0847ca23300bbe5008979832d3513440` |
| `BOE_Orden_EHA_451_2008_NIF.pdf` | Orden EHA/451/2008, de 20 de febrero (BOE-A-2008-3580), texto consolidado | consolidado | 2008-02-26 | 116.6 KB | `bc127e6e40da40d64d617b526f9e13400162498e5a8ce24ff5698bfaf4b14493` |
| `BOE_Orden_HAC_1177_2024_consolidado.pdf` | Orden HAC/1177/2024, de 17 de octubre (BOE-A-2024-22138), texto consolidado | consolidado | 2024-10-28 | 3880.3 KB | `a0090109d56c29c1f1d9be42df5fecc5d7b2384605dd2b2af549236ff5bcc5de` |
| `BOE_RD_1007_2023_consolidado.pdf` | Real Decreto 1007/2023, de 5 de diciembre (BOE-A-2023-24840), texto consolidado | consolidado | 2023-12-06 | 229.6 KB | `34418589f3c5684cbb5aa55cf208d08de96e81bb216623c14db51f3da5b9731f` |
| `ConsultaLR.xsd` | Operación de consulta de registros de facturación | — | — | 3.8 KB | `bf2cdb8fc4b95b291757a72b76d8fffca06a6d30d9329122ca2fd6b2d5f8f1b1` |
| `EventosSIF.xsd` | Registro de Eventos para sistemas no VERI*FACTU | — | — | 30.1 KB | `cc7347c6a9a57a0c8edbc6b9ddcce55176452d0db0e68369477e207e9fbdd7e7` |
| `RespuestaConsultaLR.xsd` | Respuesta de la operación de consulta | — | — | 9.8 KB | `de35063acb8d9ba0d6ae51acc6b595de9c2b12333250e95e13108ef5f2670d45` |
| `RespuestaSuministro.xsd` | Respuesta de las operaciones de alta y anulación | — | — | 6.1 KB | `82acf80f785643caac13087aae66808ed721a13f08ca5218cf8ae81b695549ef` |
| `RespuestaValRegistNoVeriFactu.xsd` | Respuesta de la validación de un registro de facturación no VERI*FACTU | — | — | 4.1 KB | `8f47af4f3c49d29b6a62aed261c09f171e855ad6d6bb72ef3fc0b147dc9572f0` |
| `SistemaFacturacion.wsdl` | WSDL del servicio de remisión de registros de facturación | 1.0 | — | 8.6 KB | `05919120708ff7650612fa6683c9336eaf919335d9a4db10e86759190af48602` |
| `SuministroInformacion.xsd` | Definición de tipos comunes | — | — | 48.4 KB | `ee4c1655175644de44c4c25055ffeb8e5f4bb4bc3834ce8254d4222ef18c8aa1` |
| `SuministroLR.xsd` | Operaciones de alta y anulación (VERI*FACTU y no VERI*FACTU) | — | — | 1.5 KB | `cbdac8d427cc5ab5d77ca48974cab0f35d6bb819c4c66db361681e3710aeba36` |
| `xmldsig-core-schema.xsd` | XML Signature Syntax and Processing — esquema XMLDSig | — | — | 10.1 KB | `d102ad3df7664c307e0c2c776ba4a90513b1969974d8a940bae1a77f9f21e15d` |

## Origen

| Fichero | Publica | URL de descarga |
|---|---|---|
| `AEAT_descripcion_servicio_web.pdf` | AEAT | https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf |
| `AEAT_DsRegistroVeriFactu.xlsx` | AEAT | https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DsRegistroVeriFactu.xlsx |
| `AEAT_FAQs_desarrolladores.pdf` | AEAT | https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/FAQs-Desarrolladores.pdf |
| `AEAT_huella_hash.pdf` | AEAT | https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf |
| `AEAT_QR.pdf` | AEAT | https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf |
| `AEAT_validaciones_errores.pdf` | AEAT | https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf |
| `BOE_Orden_EHA_451_2008_NIF.pdf` | BOE | https://www.boe.es/buscar/pdf/2008/BOE-A-2008-3580-consolidado.pdf |
| `BOE_Orden_HAC_1177_2024_consolidado.pdf` | BOE | https://www.boe.es/buscar/pdf/2024/BOE-A-2024-22138-consolidado.pdf |
| `BOE_RD_1007_2023_consolidado.pdf` | BOE | https://www.boe.es/buscar/pdf/2023/BOE-A-2023-24840-consolidado.pdf |
| `ConsultaLR.xsd` | AEAT | https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/ConsultaLR.xsd |
| `EventosSIF.xsd` | AEAT | https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/EventosSIF.xsd |
| `RespuestaConsultaLR.xsd` | AEAT | https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/RespuestaConsultaLR.xsd |
| `RespuestaSuministro.xsd` | AEAT | https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/RespuestaSuministro.xsd |
| `RespuestaValRegistNoVeriFactu.xsd` | AEAT | https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/RespuestaValRegistNoVeriFactu.xsd |
| `SistemaFacturacion.wsdl` | AEAT | https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl |
| `SuministroInformacion.xsd` | AEAT | https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroInformacion.xsd |
| `SuministroLR.xsd` | AEAT | https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroLR.xsd |
| `xmldsig-core-schema.xsd` | W3C | https://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd |

> **`SistemaFacturacion.wsdl`** — Byte a byte idéntico al servido desde www2.agenciatributaria.gob.es
>
> **`xmldsig-core-schema.xsd`** — SuministroInformacion.xsd lo importa por URL remota. Se vendoriza porque el validador WASM no tiene red. Licencia W3C Document Notice.

## Nota sobre los XSD y el WSDL

Se descargan de rutas que contienen `tikeV1.0`, pero los `targetNamespace` declarados dentro
usan `tike` (sin versión) y el host `www2.agenciatributaria.gob.es`. Copiar la URL de descarga
como namespace produce XML que la AEAT rechaza. Ver `docs/spec-notes.md` §8.3.

## Derivados

`extracted/` contiene texto plano extraído de los PDF para poder buscar en ellos. Son
**derivados**, no originales: para citar, usa siempre el PDF.
