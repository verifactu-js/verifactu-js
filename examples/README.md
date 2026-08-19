# Ejemplos ejecutables

Tres, en orden de menos a más compromiso. Los dos primeros no tocan la red.

```bash
pnpm install
pnpm -r build

node examples/01-alta-simple.mjs
node examples/02-cadena-y-verificacion.mjs
node examples/03-envio-preproduccion.mjs        # explica qué necesita y no envía nada
```

| | Qué enseña | ¿Sale a la red? |
|---|---|:--:|
| `01-alta-simple` | La cadena exacta que se hashea, la huella y la URL del QR | no |
| `02-cadena-y-verificacion` | Tres registros encadenados, y qué se ve cuando alguien toca uno | no |
| `03-envio-preproduccion` | Un envío real con la cola, certificado y mapa de errores | **sí, si se lo pides** |

## El tercero manda un registro de verdad

Con tu NIF real, contra el entorno de **pruebas** de la AEAT. Necesita certificado y hay que
pedírselo explícitamente con `--enviar`; sin esa bandera solo explica lo que haría.

```bash
export VERIFACTU_P12=/ruta/certificado.p12
export VERIFACTU_P12_PASS=...        # nunca como argumento: acabaría en el historial de la shell
export VERIFACTU_NIF=...             # el del titular del certificado
export VERIFACTU_NOMBRE=...

node examples/03-envio-preproduccion.mjs --enviar
```

Un envío no es gratis aunque sea a preproducción: cuenta dentro de tu cadena de pruebas y el
RD 1007/2023 prohíbe expresamente las pruebas masivas. Manda **uno**.

**A producción no se puede apuntar.** El cliente solo ofrece `crearClientePruebas`, y es
deliberado: un envío a producción es una declaración tributaria bajo un NIF real que no se retira.
