# @verifactu-js/xml

Las versiones siguen [semver](https://semver.org/lang/es/). Mientras el paquete esté en `0.x`, un
cambio incompatible sube la versión menor.

## Sin publicar

- `author` en el `package.json`, que faltaba.

## 0.1.0 — 2026-08-17

Primera versión.

- Serialización al esquema oficial: `RegistroAlta`, `RegistroAnulacion`, `Cabecera` y el lote
  completo, validados contra los XSD de la AEAT en la suite.
- **Un lote es un segmento contiguo de una cadena, no un conjunto.** `assertLoteContiguo` se
  niega a serializar un lote que no lo sea y dice en qué índice se rompió. Detectarlo antes de
  enviar es aritmética local; detectarlo después es reconciliar contra un estado remoto que ya
  no cuadra.
- Envoltorio SOAP y los **ocho endpoints**, incluida la variante por certificado de sello.
- `parsearRespuesta()`: estados, `RespuestaLinea`, duplicados y `DatosPresentacion`. Los códigos
  de error se conservan como la cadena literal que llegó, sin convertir a número, porque el
  esquema no fija ni longitud ni relleno.
- Escribe los `fields` canónicos que produjo `core`, nunca la entrada cruda: es lo que garantiza
  que el documento y la huella digan lo mismo.
- Cero dependencias en runtime.
