# @verifactu-js/client

Las versiones siguen [semver](https://semver.org/lang/es/). Mientras el paquete esté en `0.x`, un
cambio incompatible sube la versión menor.

## 0.1.1 — 2026-08-19

- `author` en el `package.json`. Sin él, la página de npm no decía quién ha escrito esto.
  No cambia nada del código: es una versión de metadatos.

## 0.1.0 — 2026-08-19

Primera versión, y la primera que se apoya en **dieciocho registros enviados contra
preproducción** con un certificado cualificado real.

- Envío con mTLS. **La capa HTTP es un parámetro, no un import**: por defecto Node sobre `undici`,
  y para cualquier otra cosa se pasa una función.
- `crearCola()`: la cola de envío, con el contrato completo escrito antes que el código.
  - **La cadena se construye al enviar, no al encolar.** `FechaHoraHusoGenRegistro` entra en la
    huella, así que re-sellar un registro encolado invalida toda la cadena que cuelgue detrás.
    `encolar()` **rechaza** una entrada que traiga un eslabón ya firmado.
  - Respeta el `TiempoEsperaEnvio` de la respuesta. Una cadena vacía es «no hay dato», nunca cero.
  - Deja de reintentar cuando el sello se saldría del margen de 240 s, en vez de mandar algo que
    volvería 2004 — que la AEAT acepta, almacena y marca con error.
  - La cadena avanza solo hasta el último registro que la AEAT dijo haber **almacenado**.
- `explicarCodigo()`: los **247 códigos** de la AEAT con su texto oficial, su categoría y qué
  hacer con cada uno. Lo que hay que ramificar no es el código: es si el registro quedó
  almacenado.
- `MARGEN_RELOJ_AEAT_SEGUNDOS = 240` y `desfaseDeReloj()`. Ese margen **no está publicado en
  ninguna especificación**: la AEAT lo interpola en el texto del código 2004.
- Un error de cabecera llega como **SOAP Fault**, no como respuesta de negocio. El código se
  extrae del `faultstring` y `explicarCodigo()` da lo mismo por los dos caminos.
- **No se puede apuntar a producción.** Es deliberado.
