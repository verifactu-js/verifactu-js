# @verifactu-js/xml

Serialización al esquema oficial de VERI\*FACTU, envoltorio SOAP y lectura de la respuesta.
Sin dependencias de terceros.

```bash
npm i @verifactu-js/xml
```

Los literales que van al XML son los que ha hasheado [`@verifactu-js/core`](https://github.com/verifactu-js/verifactu-js/tree/main/packages/core#readme), y el tipo lo garantiza:
`writeRegistroAlta` no acepta un objeto plano, solo el eslabón canonicalizado que devuelve
`createSifChain()`. No es posible escribir en el XML un valor distinto del que entró en la huella.

```ts
import { createSifChain } from '@verifactu-js/core';
import { serializarSobreSoap, endpoint, SOAP_ACTION, SOAP_CONTENT_TYPE } from '@verifactu-js/xml';

const chain = createSifChain({ timeZone: 'Europe/Madrid' });
const eslabon = await chain.alta({
  IDEmisorFactura: '89890001K',
  NumSerieFactura: 'A/1',
  FechaExpedicionFactura: '15-01-2025',
  TipoFactura: 'F1',
  CuotaTotal: '21.00',
  ImporteTotal: '121.00',
  previous: ultimoEslabonGuardado,
});

const sobre = serializarSobreSoap({
  cabecera: { ObligadoEmision: { NombreRazon: 'EMPRESA SL', NIF: '89890001K' } },
  registros: [{ eslabon, datos }],
});

await fetch(endpoint({ entorno: 'produccion', certificado: 'representante', servicio: 'verifactu' }), {
  method: 'POST',
  headers: { 'Content-Type': SOAP_CONTENT_TYPE, SOAPAction: SOAP_ACTION },
  body: sobre,
});
```

---

## Las dos trampas de namespace

Son la razón principal por la que existe este paquete. Las dos producen un documento que parece
correcto, que un editor XML no discute, y que la AEAT rechaza con un mensaje que señala al
elemento y no al namespace.

### 1. La URL de descarga no es el namespace

Los XSD se descargan de rutas que contienen **`tikeV1.0`**:

```text
https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroLR.xsd
```

pero el `targetNamespace` que cada fichero declara **dentro** usa `tike`, sin versión, y el host
`www2.agenciatributaria.gob.es`:

```text
https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd
```

Copiar la URL de descarga al XML es el error más fácil de cometer y el más difícil de ver. Este
paquete exporta los namespaces correctos como constantes y tiene tests que construyen el
documento con la forma equivocada y comprueban que el XSD oficial lo rechaza.

### 2. `Cabecera`: el nombre en un namespace y el contenido en otro

El elemento `Cabecera` está **declarado en `SuministroLR.xsd`**, así que toma el namespace de ese
esquema. Su **tipo** es `sf:CabeceraType`, declarado en `SuministroInformacion.xsd`, y de ahí
sacan el suyo los hijos:

```xml
<sfLR:Cabecera>
  <sf:ObligadoEmision>
    <sf:NombreRazon>EMPRESA SL</sf:NombreRazon>
    <sf:NIF>89890001K</sf:NIF>
  </sf:ObligadoEmision>
</sfLR:Cabecera>
```

Un mismo bloque, dos namespaces. Escribirlo entero en `sf:` produce este error, que no menciona
la palabra «namespace» por ninguna parte:

```text
Element '{...SuministroInformacion.xsd}Cabecera': This element is not expected.
Expected is ( {...SuministroLR.xsd}Cabecera ).
```

Y hay un tercero: el mismo `CabeceraType` vuelve en la respuesta, declarado allí dentro de
`RespuestaSuministro.xsd`, así que **de vuelta viaja como `sfR:Cabecera`**. Tres prefijos para el
mismo tipo según dónde aparezca. El parser de este paquete resuelve por URI de namespace y no por
prefijo, precisamente por esto.

---

## Validar contra los XSD oficiales

Si vas a validar por tu cuenta, hay un obstáculo que no está documentado en ningún sitio:

**`SuministroInformacion.xsd` importa el esquema XMLDSig del W3C por URL remota.**

```xml
<import namespace="http://www.w3.org/2000/09/xmldsig#"
        schemaLocation="http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd"/>
```

Quien no lo tenga en local acaba en una de dos situaciones, y ninguna es buena:

- **Falla**, con un error sobre `ds:Signature` que parece un problema del documento y es un
  problema de red. Cualquier validador en sandbox (WASM, contenedor sin salida, CI restringido)
  cae aquí.
- **Se lo descarga en cada build**, lo que mete a `w3.org` en la ruta crítica de tu CI y hace que
  el resultado dependa de que un servidor de terceros conteste.

La solución es vendorizar el esquema del W3C y precargarlo bajo esa URL exacta, sin tocar los XSD
oficiales, que deben quedarse byte a byte como se descargaron. Este repositorio lo hace así y
publica un SHA-256 por fichero para poder comprobarlo.

---

## Qué comprueba al serializar, y qué no

La línea es: **lo que hace que el documento se contradiga a sí mismo se comprueba aquí; lo que
depende del criterio de la AEAT sobre el contenido de la factura, no.**

| Se comprueba aquí | Por qué |
|---|---|
| El bloque `Encadenamiento` coincide con la `Huella` que se hasheó | Es una contradicción interna del documento |
| El lote es un tramo contiguo y ordenado de una cadena | Aritmética local sobre las huellas del propio lote |
| `IDEmisorFactura` = `ObligadoEmision/NIF` | Regla citada, y su incumplimiento parte el lote en dos |
| Cardinalidades (1-12 líneas de desglose, 1-1000 registros) | Estructura del esquema |
| `RemisionVoluntaria` y `RemisionRequerimiento` no van juntas | El XSD lo admite y la AEAT no |
| Que ningún importe llegue como `number` | `String(131.40)` es `"131.4"` |

Las **validaciones de negocio** de la AEAT (§3.1.3: `TipoRectificativa` obligatoria en R1-R5,
`Macrodato`, las reglas del desglose, los cuadres de totales) están en
[`@verifactu-js/validation`](https://github.com/verifactu-js/verifactu-js/tree/main/packages/validation#readme)
y **no se ejecutan al serializar**. Cambian con cada revisión del documento de la AEAT, mientras
que la serialización es estructural y estable; una regla que se dispare de más bloquearía una
factura que la AEAT habría aceptado. El sitio para validar es antes de enviar.

---

## El lote es un tramo de cadena, no un conjunto

La huella de cada registro se calcula sobre la del anterior, así que el orden del lote no es una
preferencia de presentación: es la única forma en que la AEAT puede recalcular la cadena.

`writeRemision` rechaza, diciendo en qué índice se rompe, un lote con registros desordenados, con
un hueco, con un segundo `PrimerRegistro` en medio, o con una referencia al anterior que no
cuadra. Lo que **no** puede comprobar es si el primer registro del lote enlaza con el último del
lote anterior: ese registro no viaja en el mensaje. Para eso está `verifyChain` en `core`.

Un primer registro que apunta fuera del lote es perfectamente válido: un lote es un segmento.

---

## Leer la respuesta

`parsearRespuesta` acepta el cuerpo con o sin sobre SOAP. Un `SOAP Fault` se reporta como tal, con
su código y su motivo, en vez de como «falta EstadoEnvio».

```ts
import { parsearRespuesta } from '@verifactu-js/xml';

const respuesta = parsearRespuesta(await peticion.text());
for (const linea of respuesta.RespuestaLinea) {
  if (linea.EstadoRegistro === 'AceptadoConErrores') {
    // Se ha registrado en la AEAT. Reenviarlo produce un duplicado.
  }
}
```

El parser es propio y **no normaliza nada**. Un parser cualquiera puede devolver un `xs:dateTime`
en su forma canónica, y `2024-01-01T19:20:30+01:00` y `2024-01-01T18:20:30Z` son el mismo instante
y el mismo valor, pero solo uno reproduce la huella. Lo único que normaliza es lo que XML 1.0
obliga —finales de línea (§2.11) y valores de atributo (§3.3.3)—, que es justo por lo que el
escritor emite un retorno de carro como `&#13;`.

---

## Fuera de alcance

- `ds:Signature` (XAdES).
- `ConsultaFactuSistemaFacturacion`, el servicio de consulta.
- Los registros de evento.
- El envío por HTTP con certificado: es el trabajo de `@verifactu-js/client`.

---

## Licencia

MIT.
