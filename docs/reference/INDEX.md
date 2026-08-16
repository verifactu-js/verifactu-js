# docs/reference — fuentes oficiales descargadas

Descarga realizada el **16 de agosto de 2026**. Ver `../spec-notes.md` para el análisis citado.

## Documentos AEAT (portal de desarrolladores / sede electrónica)

| Fichero | Documento | Versión | Fecha doc. | Origen |
|---|---|---|---|---|
| `AEAT_huella_hash.pdf` | Detalle de las especificaciones técnicas para generación de la huella o hash de los registros de facturación | 0.1.2 | 27/08/2024 | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf` |
| `AEAT_QR.pdf` | Detalle de las especificaciones técnicas del código «QR» de la factura y de la «URL» del servicio de cotejo | 0.5.0 | 10/12/2025 | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf` |
| `AEAT_validaciones_errores.pdf` | Validaciones — Sistemas Informáticos de Facturación y Sistemas VERI\*FACTU | 1.2.2 | 08/04/2026 | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf` |
| `AEAT_descripcion_servicio_web.pdf` | Sistemas Informáticos de Facturación · Remisión voluntaria (descripción del servicio web) | 1.0.3 | — | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf` |
| `AEAT_DsRegistroVeriFactu.xlsx` | Diseños de registro de facturación (diccionario de datos) | 1.0 | 28/10/2024 | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DsRegistroVeriFactu.xlsx` |
| `AEAT_FAQs_desarrolladores.pdf` | Aclaraciones a dudas de los desarrolladores | 1.3 | 04/12/2025 | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/FAQs-Desarrolladores.pdf` |

## Esquemas y WSDL

Todos descargados de
`https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/`

| Fichero | Contenido (descripción de la sede) |
|---|---|
| `SistemaFacturacion.wsdl` | Remisión de información de registros de facturación para sistemas VERI\*FACTU y no VERI\*FACTU |
| `SuministroLR.xsd` | Operaciones de alta y anulación de los sistemas VERI\*FACTU y no VERI\*FACTU |
| `SuministroInformacion.xsd` | Definición de tipos comunes |
| `RespuestaSuministro.xsd` | Respuesta de las operaciones |
| `ConsultaLR.xsd` | Operación de consulta de registros de facturación VERI\*FACTU |
| `RespuestaConsultaLR.xsd` | Respuesta de la operación de consulta |
| `EventosSIF.xsd` | Registro de Eventos para sistemas no VERI\*FACTU |
| `RespuestaValRegistNoVeriFactu.xsd` | Respuesta de la validación de un registro de facturación no VERI\*FACTU |

> El WSDL descargado de `prewww2.aeat.es` y el descargado de `www2.agenciatributaria.gob.es`
> son **idénticos** (SHA-256 `05919120708FF7650612FA6683C9336EAF919335D9A4DB10E86759190AF48602`).
>
> ⚠️ Los `targetNamespace` declarados **dentro** de estos ficheros usan la ruta `…/tike/cont/ws/…`
> (sin `V1.0`) y el host `www2.agenciatributaria.gob.es`. Ver `../spec-notes.md` §8.3.

## Normativa (BOE)

| Fichero | Norma |
|---|---|
| `BOE_RD_1007_2023_consolidado.pdf` | Real Decreto 1007/2023, de 5 de diciembre (BOE-A-2023-24840), texto consolidado |
| `BOE_Orden_HAC_1177_2024_consolidado.pdf` | Orden HAC/1177/2024, de 17 de octubre (BOE-A-2024-22138), texto consolidado |

> El anexo de la Orden (diseños de registro) viene en el PDF del BOE **como imágenes**.
> El diccionario de datos utilizable es `AEAT_DsRegistroVeriFactu.xlsx`.

## No obtenido

- `errores.properties` — listado de códigos de error en formato máquina.
  `https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties`
  — la sede lo marca «Con certificado». Ver `../spec-notes.md` I-15.
- Especificaciones técnicas de la firma electrónica (XAdES) de los registros — fuera del alcance de v1.

## Nota de licencia

Estos ficheros son documentación pública de la AEAT y textos legales del BOE, conservados aquí
para trazabilidad de las citas de `../spec-notes.md`. No se redistribuyen modificados.
Si su inclusión en el repositorio público resultara problemática, basta con borrar esta carpeta:
`spec-notes.md` conserva URL, versión y fecha de consulta de cada afirmación.
