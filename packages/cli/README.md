# @verifactu-js/cli

Dos comprobaciones que cuestan poco y evitan mucho, en la línea de comandos.

```bash
npx @verifactu-js/cli doctor
npx @verifactu-js/cli verify cadena.json
```

Ninguno de los dos envía nada a la AEAT, ninguno necesita certificado y ninguno consume un
registro.

## `doctor` — si esta máquina puede facturar bien

```
OK     node      v24.15.0
OK     servicio  preproducción responde 200
OK     reloj     0 s respecto a la AEAT (margen medido: 240 s)
```

**El reloj es el motivo de que este comando exista.** La AEAT no compara
`FechaHoraHusoGenRegistro` contra la fecha de la factura: lo compara contra **su propio reloj**,
con un margen de **240 segundos** que no está publicado en ninguna especificación — lo medimos
enviando registros reales contra preproducción y leyendo lo que contestó.

Y pasarse **no rechaza el registro**. Devuelve el código 2004, que es de categoría *aceptado con
errores*: la factura queda almacenada, cuenta a efectos del RD 1007/2023 y hay que subsanarla una
a una. Un reloj desviado no rompe nada visible; estropea en silencio todo lo que emitas.

Comprobarlo sale gratis porque **cualquier respuesta HTTP de la AEAT trae su hora en la cabecera
`Date`**. Una petición `HEAD` a un fichero estático de preproducción basta.

```
FALLO  reloj     El reloj de esta máquina va 480 s adelantado respecto al de la AEAT, y el
                 margen admitido son 240 s. Los registros que generes van a volver con el
                 código 2004: la AEAT los ACEPTA y los almacena, pero con error.
```

Cuando no puede comprobarlo —sin red, sin cabecera `Date`— **no dice que esté bien: dice que no
se sabe**, y sale con código 1 igual. No es lo mismo, y tratarlo como si lo fuera es justo el
error que este comando previene.

## `verify` — si una cadena de huellas está entera

Coge un JSON con los registros en orden y comprueba las tres cosas que pueden ir mal:
**alteración** (un registro ya no reproduce su propia huella), **rotura** (encadena con algo que
no es su anterior) y **hueco** (se ha borrado uno).

```
FALLO  3 registros · la cadena se rompe en el registro 1

  registro 1 · HUELLA_NO_COINCIDE
    El registro 1 no reproduce su propia huella: alguno de los campos que entran en el
    cálculo ha cambiado desde que se generó.
    esperado    A45F85A4E83E4870B3B44A60AB9950D900223B6ED4929D681CA7291612F1068B
    encontrado  C160F424CCAEEA15BDEF625ACFB58FD0F867548DE429FDE46B5E2657209A5A9D
```

**Funciona sobre cadenas de cualquier procedencia.** No hace falta que las haya generado esta
librería: el formato es el registro tal y como lo define la AEAT.

El fichero es un array con los eslabones, del más antiguo al más reciente — exactamente lo que
devuelven `alta()` y `anulacion()` de `@verifactu-js/core`:

```json
[
  {
    "tipo": "alta",
    "huella": "A45F85A4E83E4870B3B44A60AB9950D900223B6ED4929D681CA7291612F1068B",
    "fields": {
      "IDEmisorFactura": "89890001K",
      "NumSerieFactura": "A/1",
      "FechaExpedicionFactura": "19-08-2026",
      "TipoFactura": "F1",
      "CuotaTotal": "21.00",
      "ImporteTotal": "121.00",
      "Huella": "",
      "FechaHoraHusoGenRegistro": "2026-08-19T11:00:00+01:00"
    }
  }
]
```

## Códigos de salida

Un CLI se usa dentro de scripts, así que el código de salida es parte de la API:

| | |
|---|---|
| `0` | Comprobado y correcto |
| `1` | Comprobado, y hay algo que mirar |
| `2` | No se ha podido comprobar: falta un argumento, el fichero no está, no es lo que dice ser |

La distinción entre `1` y `2` importa. **«No he podido comprobarlo» no es «está bien»**, y un
script tiene que poder tratarlos distinto.

## `--json`

Los dos comandos aceptan `--json` y escriben un único documento en la salida estándar, pensado
para encadenar con otra cosa:

```bash
npx @verifactu-js/cli doctor --json | jq '.comprobaciones[] | select(.estado != "ok")'
```

## Uso programable

El paquete también se puede importar. `ejecutar()` recibe su entorno —consola, disco, red y
reloj— y devuelve el código de salida, así que se puede probar sin lanzar un proceso:

```ts
import { ejecutar, entornoNode } from '@verifactu-js/cli';

const codigo = await ejecutar(['doctor', '--json'], entornoNode());
```

## Licencia

MIT
