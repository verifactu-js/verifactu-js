# @verifactu-js/cli

Las versiones siguen [semver](https://semver.org/lang/es/). Mientras el paquete esté en `0.x`, un
cambio incompatible sube la versión menor.

## 0.1.0 — 2026-08-19

Primera versión. Dos comandos, y ninguno envía nada a la AEAT ni necesita certificado.

- `verifactu-js doctor`: versión de Node, alcance del servicio y **el reloj**, que es el motivo de
  que el comando exista. La AEAT compara `FechaHoraHusoGenRegistro` contra el suyo con un margen
  de 240 s medidos, y pasarse devuelve 2004: acepta el registro, lo almacena y lo marca con error.
  Se comprueba gratis, con la cabecera `Date` de cualquier respuesta suya.
- `verifactu-js verify <cadena.json>`: comprueba una cadena de huellas ya emitidas, **de cualquier
  procedencia**. Detecta alteración, rotura y hueco.
- Cuando no puede comprobar algo **no dice que esté bien: dice que no se sabe**, y sale con
  código 1 igual.
- Códigos de salida con significado: `0` correcto, `1` hay algo que mirar, `2` no se ha podido
  comprobar. La distinción entre `1` y `2` importa dentro de un script.
- `--json` en los dos comandos.
- `ejecutar()` es importable, recibe su entorno y **no lanza nunca**: un fallo al escribir —EPIPE
  al canalizar a `head`— devuelve 2 en vez de 0.
