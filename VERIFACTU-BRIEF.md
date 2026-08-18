# Brief de proyecto: `@verifactu/*` — Toolkit TypeScript para VeriFactu (AEAT)

> **Documento de handoff para Claude Code.**
> Este documento NO es una especificación técnica final. Es el contexto, la tesis de producto
> y el conjunto de restricciones. **La especificación técnica exacta la tienes que extraer tú
> de las fuentes oficiales de la AEAT** (ver §3). Todo dato técnico concreto que aparezca aquí
> está marcado como `[VERIFICAR]` y debe ser contrastado antes de escribir una sola línea de código.

---

## 1. Contexto

**Autor:** desarrollador fullstack senior (Node.js / TypeScript / React / AWS), residente en Canarias, España.
**Objetivo doble:**
1. Publicar un paquete npm de alta visibilidad como carta de presentación técnica (búsqueda activa de empleo remoto).
2. Ocupar un nicho técnico real y defendible que puede derivar en producto comercial (SaaS de facturación con IGIC nativo).

**El problema del mercado:** el Real Decreto 1007/2023 (reglamento VeriFactu) obliga a que los sistemas
informáticos de facturación en España generen registros de facturación encadenados criptográficamente,
con QR de cotejo, y opcionalmente los remitan a la AEAT.

**Calendario relevante (a agosto de 2026):**

| Sujeto | Fecha límite |
|---|---|
| Desarrolladores/comercializadores de software de facturación | **29 julio 2025** (ya vencido, sigue vigente) |
| Sociedades sujetas a Impuesto sobre Sociedades | 1 enero 2027 |
| Autónomos y resto de empresas | 1 julio 2027 |

El aplazamiento del RDL 15/2025 movió las fechas de los contribuyentes, **pero no la de los
desarrolladores de software**. La demanda de tooling existe hoy.

**Ventana de oportunidad:** ~12 meses antes de que el mercado se sature. Hay que publicar algo
usable en semanas, no en meses.

---

## 2. Tesis de producto

> **"Bring your own database. Nosotros ponemos la huella, el XML y el SOAP."**

Toda decisión de diseño se deriva de esta frase. En caso de duda, vuelve aquí.

### Principios de diseño (no negociables)

1. **Agnóstico de persistencia.** Cero ORMs, cero tablas obligatorias, cero migraciones.
   La librería recibe el registro anterior como argumento y devuelve el nuevo. El usuario decide dónde guardarlo.
2. **Agnóstico de framework.** No es un middleware de Express. No es un servidor. Son funciones.
3. **`@verifactu/core` sin dependencias en runtime y isomórfico.** Debe funcionar en Node, Bun, Deno,
   Cloudflare Workers y navegador. Usa Web Crypto API (`crypto.subtle`), no `node:crypto`.
   Esto es un argumento de marketing por sí solo — no lo sacrifiques por comodidad.
4. **Funciones puras en el core.** Sin I/O, sin fechas implícitas (`new Date()` inyectable), sin estado global.
   Todo determinista y por tanto testeable con vectores fijos.
5. **Errores explicativos en castellano.** Cada código de error de la AEAT mapeado a causa probable
   y acción correctiva. Esto es un diferenciador enorme, no un extra.
6. **TypeScript estricto.** `strict: true`, sin `any`, tipos exportados y documentados con TSDoc.

### No-objetivos (explícitos)

- ❌ NO construir una aplicación de facturación completa.
- ❌ NO incluir base de datos, UI, ni servidor HTTP.
- ❌ NO ser un SDK de una API de terceros de pago. Hablamos directamente con la AEAT.
- ❌ NO soportar TicketBAI (País Vasco) ni Navarra en v1. Diseña para que quepa después, pero no lo implementes.
- ❌ NO gestionar la contabilidad, ni los libros registro, ni el SII.

---

## 3. Investigación obligatoria ANTES de codificar

**Esta es la primera fase del trabajo y no es opcional.** La corrección de este proyecto es su única
razón de existir; un byte mal colocado en la cadena de la huella y la AEAT rechaza el registro.

### Fuentes oficiales a localizar y leer

Busca y descarga en `docs/reference/` (no las commitees si tienen restricciones de licencia; guarda enlaces y extractos):

1. **Real Decreto 1007/2023** — reglamento de requisitos de los sistemas informáticos de facturación (RRSIF).
2. **Orden HAC/1177/2024** — desarrolla las especificaciones técnicas, formato de la huella, del QR y de los registros.
   Presta atención especial a los **Anexos**.
3. **Sede electrónica de la AEAT — sección VERI\*FACTU / Sistemas Informáticos de Facturación:**
   - Documento de "Especificaciones técnicas para generación de la huella o hash".
   - Documento de "Diseño de registro" / diccionario de datos.
   - Esquemas **XSD** oficiales (`SuministroLR.xsd`, `SuministroInformacion.xsd` y dependencias). **Descárgalos y úsalos en los tests.**
   - **WSDL** del servicio web y URLs de los endpoints de **preproducción** y **producción**.
   - Documento de "Validaciones y errores" (listado de códigos de error). **Este listado es la base del §6.3.**
   - Especificación del **QR de cotejo** (URL base, parámetros, orden, codificación, tamaño y ubicación en la factura).

### Reglas de trabajo durante la investigación

- **Si un dato no está en una fuente oficial, no lo asumas: márcalo como `TODO(verify)` y sigue.**
- Vuelca todo lo aprendido en `docs/spec-notes.md` con **cita de la fuente y fecha de consulta** por cada afirmación.
  Este fichero es el contrato interno del proyecto.
- Si encuentras contradicciones entre la Orden y la documentación técnica de la sede, **gana la
  documentación técnica de la sede** (es la que valida el sistema real), pero deja constancia de la discrepancia.
- Las especificaciones han sido revisadas varias veces desde 2023. **Comprueba siempre la fecha de versión del documento.**

### Estado del arte (competencia) — analiza antes de diseñar

| Proyecto | Qué es | Por qué no basta |
|---|---|---|
| `mdiago/VeriFactu` (GitHub) | Librería .NET, la más madura del ecosistema | Otro lenguaje. **Úsala como referencia de corrección**: sus tests y su modelo de datos son oro. |
| `zarpilla/verifactu-node-lib` | Librería JS/TS | Parcial: cobertura incompleta, poco testeada |
| `EduardoRuizM/verifactu-api-nodejs` | Aplicación Node completa | Exige MySQL/MariaDB con esquema propio. No es una librería. Buena referencia funcional. |
| Verifacti, BeeL y similares | APIs SaaS de pago | Intermediario de pago, cesión de datos a terceros |

**Acción concreta:** clona `mdiago/VeriFactu` y extrae de su suite de tests los vectores de prueba
(entradas → huella esperada). Son el mejor material de validación disponible fuera de la AEAT.
Respeta su licencia: no copies código, usa los vectores como datos de test y cita la fuente.

---

## 4. Arquitectura del monorepo

```
verifactu/
├── packages/
│   ├── core/         → @verifactu/core      · tipos, validación, huella, encadenado
│   ├── xml/          → @verifactu/xml       · serialización al esquema AEAT
│   ├── qr/           → @verifactu/qr        · URL de cotejo + render del QR
│   ├── client/       → @verifactu/client    · SOAP + mTLS + control de flujo
│   ├── testing/      → @verifactu/testing   · fixtures oficiales + mock server AEAT
│   └── verifactu/    → verifactu            · meta-paquete + CLI
├── docs/
│   ├── spec-notes.md         · notas de la investigación con citas
│   └── reference/            · XSD, WSDL y extractos oficiales
├── examples/
│   ├── express-postgres/
│   ├── drizzle/
│   └── cloudflare-worker/
└── e2e/                      · tests contra el entorno de pruebas de la AEAT
```

### Grafo de dependencias

```
core  ←  xml  ←  client
  ↑       ↑        ↑
  └───── qr        │
                testing
```

`core` no depende de nada. `xml` depende de `core`. `client` depende de `core` y `xml`.
**Si en algún momento `core` necesita depender de algo, has diseñado mal.**

---

## 5. Especificación funcional por paquete

### 5.1 `@verifactu/core`

Responsabilidades:
- Tipos de dominio: `RegistroAlta`, `RegistroAnulacion`, `SistemaInformatico`, `Destinatario`,
  `Desglose`, `TipoFactura` (F1, F2, R1–R5, F3…), `Emisor`, `Huella`.
- Validación de entrada con **Zod** (única dependencia aceptable si se justifica; explora hacerlo sin ella).
  Incluye validación de NIF/CIF/NIE español con dígito de control.
- Cálculo de la **huella** (SHA-256 vía Web Crypto, salida en hex mayúsculas).
- Encadenado: recibe el registro anterior (o `null` si es el primero de la cadena) y produce el siguiente.
- Verificación de una cadena completa: `verifyChain(registros[])` → detecta rotura, hueco o alteración.
  **Esta función es el gancho de marketing del paquete.**
- Normalización de importes (decimales, redondeo, separador) y de fechas con huso horario.

API tentativa (ajústala a lo que descubras, no la tomes como dogma):

```ts
import { createSifChain, verifyChain, hashRegistro } from '@verifactu/core';

const chain = createSifChain({ sistema, nifEmisor, now: () => new Date() });
const registro = await chain.alta({ ...datosFactura, previous });
const anulacion = await chain.anulacion({ ...idFacturaAnulada, previous });
const result = await verifyChain(registrosOrdenados); // { ok, brokenAt?, reason? }
```

**Requisitos de calidad:** cobertura ≥95%. Property-based testing (fast-check) sobre el encadenado:
para cualquier secuencia válida, `verifyChain` debe devolver `ok`, y cualquier mutación de un campo
del medio debe detectarse.

### 5.2 `@verifactu/xml`

- Serialización de registros al XML del esquema oficial. **Sin librerías genéricas de XML si generan
  ambigüedad de namespaces**; controla la salida byte a byte.
- Validación contra los **XSD oficiales** dentro de la suite de tests (usa `libxmljs2`, `xsd-schema-validator`
  o el que funcione en CI sin dependencias nativas problemáticas — evalúa opciones).
- Construcción del envoltorio SOAP y parseo de la respuesta.
- Debe soportar el envío por lotes (múltiples registros en una remisión) con el límite que marque la AEAT `[VERIFICAR]`.

### 5.3 `@verifactu/qr`

- Construcción de la URL de cotejo con los parámetros exactos y su codificación `[VERIFICAR]`.
- Distinguir URL de **preproducción** y **producción**.
- Render a SVG y a PNG data-URL, con el tamaño mínimo que exija la norma `[VERIFICAR]`.
- Exportar también el texto literal que debe acompañar al QR en la factura (difiere según se esté
  en modo VERI\*FACTU o no) `[VERIFICAR]`.

### 5.4 `@verifactu/client`

- Autenticación **mTLS con certificado** (`.p12` / `.pfx`, y también `.pem` + clave). Soporta certificado
  de persona física, de representante y de sello de entidad.
- Envío al endpoint SOAP, con selección de entorno (`'pruebas' | 'produccion'`).
- **Control de flujo obligatorio:** la AEAT devuelve un `TiempoEsperaEnvio`; el cliente debe respetarlo
  automáticamente mediante una cola interna. Que el usuario no tenga que pensar en ello.
- Reintentos con backoff exponencial sobre errores de red y 5xx, **nunca** sobre rechazos de negocio.
- Parseo de la respuesta: estado global (`Correcto` / `ParcialmenteCorrecto` / `Incorrecto`) y estado por línea.
- **Mapa de errores AEAT → mensaje en castellano + causa probable + acción sugerida.** Genera este mapa
  a partir del documento oficial de validaciones y errores.

### 5.5 `@verifactu/testing`

- Vectores de prueba oficiales.
- **Servidor mock de la AEAT** que valide contra los XSD reales y devuelva respuestas realistas,
  incluyendo escenarios de error. Esto permite que cualquiera contribuya sin tener un certificado.
- Factories de datos de prueba (`buildRegistroAlta({ overrides })`).

### 5.6 `verifactu` (CLI + meta-paquete)

```bash
npx verifactu hash registro.json          # calcula la huella de un registro
npx verifactu verify cadena.json          # verifica una cadena completa e informa de la rotura
npx verifactu xml registro.json           # emite el XML y lo valida contra el XSD
npx verifactu qr registro.json -o qr.svg
npx verifactu doctor                      # comprueba certificado, conectividad y reloj del sistema
```

El CLI es el vehículo de difusión: `npx verifactu verify` es algo que la gente ejecuta desde un tuit.

---

## 6. Detalles críticos (aquí está el 80% del valor)

### 6.1 La huella / hash

- SHA-256 sobre una cadena de pares `campo=valor` unidos por `&`, en **orden estricto**, resultado en
  **hexadecimal mayúsculas**. `[VERIFICAR el orden exacto, los nombres de campo, el tratamiento de campos
  vacíos, el trim, y el formato numérico de los importes]`
- El registro de **alta** y el de **anulación** usan **conjuntos de campos distintos**. `[VERIFICAR ambos]`
- La huella del registro anterior entra como un campo más. El primer registro de la cadena usa un valor
  especial o vacío `[VERIFICAR]`.
- **Escribe un test por cada campo** que demuestre que cambiarlo cambia la huella.

### 6.2 Fechas y huso horario — el bug número uno del ecosistema

La causa más frecuente de discrepancia entre la huella local y la que recalcula la AEAT es el campo
de fecha-hora de generación del registro con huso horario.

- Formato ISO 8601 con **offset explícito**, nunca `Z` implícito ni hora local ambigua.
  **Medido el 18/08/2026 contra preproducción** (sonda S-2, `docs/spec-notes.md` §22): el offset es
  exactamente `±hh:mm`. Fracciones de segundo, `+01:00:00` y `+0100` los rechaza la AEAT con el
  código 1244. `Z` en cambio lo **acepta** — y lo hashea tal cual, lo que demuestra que la AEAT no
  normaliza el `xs:dateTime` antes de calcular la huella. Aun así seguimos emitiendo `±hh:mm`.
- **Caso Canarias:** el autor está en `Atlantic/Canary` (UTC+0 / UTC+1 en verano), **no** en hora peninsular.
  La librería no debe asumir `Europe/Madrid` en ningún sitio. Tests explícitos para ambos husos
  y para el cambio de hora (DST) en las dos zonas.
  **[PENDIENTE DE MEDIR:** si `+00:00` explícito se acepta igual que `Z`. Es exactamente este
  caso. Sonda S-2b, un envío.**]**
- La función que obtiene la hora debe ser **inyectable** para que los tests sean deterministas.
- Añade a `doctor` una comprobación de desfase del reloj del sistema. **El umbral está medido: 240
  segundos**, que es lo que la AEAT interpola en el texto del código 2004 y no publica en ninguna
  parte. Pasarse no rechaza el registro: lo **acepta con error**, lo almacena y obliga a subsanarlo,
  así que un reloj desincronizado produce facturas defectuosas sin que salte nada.
  Está en `MARGEN_RELOJ_AEAT_SEGUNDOS` y `desfaseDeReloj()` de `@verifactu-js/client`, con su
  procedencia. Se puede comprobar **sin enviar nada**: cualquier respuesta HTTP de la AEAT trae
  cabecera `Date`, y cada respuesta aceptada trae su `TimestampPresentacion`.

### 6.3 Modo VERI\*FACTU vs. sistema NO VERIFICABLE

Son dos regímenes distintos y soportar **los dos** es lo que diferencia este proyecto de todos los
repos parciales que existen:

| | VERI\*FACTU (remisión voluntaria) | No verificable |
|---|---|---|
| Remisión a AEAT | Sí, automática | No |
| Firma electrónica de los registros | No exigida | **Obligatoria (XAdES)** |
| Registro de eventos | Menos exigente | **Obligatorio y extenso** |
| Texto del QR en factura | Distinto | Distinto |

`[VERIFICAR los detalles exactos de cada columna contra el RD 1007/2023 y la Orden HAC/1177/2024]`

**v1 implementa el modo VERI\*FACTU. El modo no verificable (XAdES + registro de eventos) es fase 5**,
pero el diseño de tipos debe dejarle hueco desde el principio (`mode: 'verifactu' | 'no-verificable'`).

### 6.4 Bloque `SistemaInformatico`

Es obligatorio en **cada** registro e identifica al desarrollador del software: razón social y NIF del
productor, nombre del programa, identificador del sistema (2 caracteres), versión, número de instalación,
y varios indicadores booleanos (`S`/`N`) sobre si el programa se usa solo en modo VeriFactu, si lo pueden
usar varios obligados tributarios, y si de hecho lo usan varios. `[VERIFICAR nombres de campo y semántica exacta]`

Diseña este bloque como un objeto de configuración que se pasa una vez al crear la cadena, no en cada llamada.

---

## 7. Estrategia de testing — el foso defensivo

Este proyecto compite en **confianza**, no en features. El testing no es una tarea del final, es el producto.

1. **Unitarios con vectores oficiales** — entradas conocidas → huellas esperadas. De la documentación de
   la AEAT y de la suite de `mdiago/VeriFactu`.
2. **Validación XSD en CI** — todo XML generado por los tests se valida contra los esquemas oficiales.
   Si no valida, el build falla.
3. **Property-based (fast-check)** — invariantes del encadenado y de la detección de manipulación.
4. **Snapshot de la cadena canónica de hash** — para detectar regresiones silenciosas al refactorizar.
5. **Tests de integración contra el entorno de PRUEBAS de la AEAT**, ejecutados en CI con un certificado
   de test almacenado en secrets. **Nadie más en el ecosistema JS tiene esto.** Es el badge del README.
   - Deben poder saltarse limpiamente si no hay certificado (para contribuidores externos).
   - Ejecución programada (cron semanal) para detectar cambios en el servicio de la AEAT.
6. **Matriz de runtimes** — Node LTS, Bun, Deno y Workers para `core` y `qr`.

---

## 8. Roadmap por fases

Cada fase termina en un release publicable. **No acumules trabajo sin publicar.**

| Fase | Alcance | Definition of Done |
|---|---|---|
| **0** | Investigación (§3) + scaffold del monorepo | `docs/spec-notes.md` completo y citado; CI verde en un paquete vacío |
| **1** | `@verifactu/core` | Huella y encadenado correctos contra vectores oficiales; cobertura ≥95%; publicado `0.1.0` |
| **2** | `@verifactu/xml` + `@verifactu/qr` | XML valida contra XSD en CI; QR verificable manualmente en la web de cotejo de la AEAT |
| **3** | `@verifactu/client` | Envío real correcto contra preproducción; cola de `TiempoEsperaEnvio`; mapa de errores completo |
| **4** | `@verifactu/testing` + CLI + ejemplos | Mock server usable; `npx verifactu verify` funcionando; 3 ejemplos ejecutables |
| **5** | Modo no verificable | Firma XAdES + registro de eventos |
| **6** | Adaptadores opcionales | `@verifactu/drizzle`, `@verifactu/prisma` (helpers de persistencia, opt-in) |

**Regla:** la fase 1 debe estar publicada en npm en cuestión de días, no de semanas. Un `core` correcto
y bien testeado ya es más de lo que ofrece hoy el ecosistema JS.

---

## 9. Convenciones técnicas

- **Gestor:** pnpm workspaces.
- **Build:** tsup (ESM + CJS + `.d.ts`). `exports` map con `types` primero en cada condición.
- **Versionado:** Changesets. Semver estricto. `0.x` hasta validar contra producción real.
- **Tests:** Vitest. `fast-check` para property-based.
- **Lint/format:** Biome (rápido, cero config, buen argumento de README).
- **Node:** ≥20. ESM nativo. `core` sin APIs específicas de Node.
- **CI:** GitHub Actions. Publicación con **npm provenance** (`--provenance`) y OIDC — nada de tokens de
  larga duración; encaja con las restricciones de tokens de npm de 2026/2027.
- **Commits:** Conventional Commits.
- **Licencia:** MIT (maximiza adopción; es el objetivo aquí).
- **Idioma:** código, tipos, TSDoc y commits en **inglés**. README y mensajes de error al usuario final,
  **bilingüe ES/EN** (el README en inglés arriba con un enlace a la versión en castellano, o secciones duplicadas).

---

## 10. Riesgos y cómo mitigarlos

| Riesgo | Mitigación |
|---|---|
| La especificación de la AEAT cambia | Tests de integración programados semanalmente contra preproducción; `spec-notes.md` con versiones y fechas |
| Implementación incorrecta de la huella | Vectores oficiales + suite de `mdiago` + verificación manual de un registro real en preproducción antes de publicar la fase 1 |
| Un competidor con más recursos ocupa el nicho | Velocidad: publica `core` la primera semana. Y el foso es el testing, no el código |
| Responsabilidad legal por incumplimiento del usuario | Disclaimer claro (§11) |
| Certificados y credenciales filtrados en el repo | `.gitignore` estricto, `gitleaks` en pre-commit y en CI, certificados de test solo en GitHub Secrets |

---

## 11. Aviso legal obligatorio en el README

Redacta una sección que deje claro, sin ambigüedad:

- Esta librería es una **herramienta técnica** que ayuda a generar registros conformes al RD 1007/2023.
- El **Sistema Informático de Facturación (SIF)** es la aplicación completa que la integra, no la librería.
- La **declaración responsable** exigida al productor del software la firma **quien distribuye el producto final**,
  no el mantenedor de esta librería.
- Se ofrece "as is", sin garantía de conformidad fiscal. El usuario debe validar su implementación
  y consultar con un asesor fiscal.

⚠️ **Antes de publicar, el autor debe hacer revisar esta redacción por un asesor fiscal o abogado.**
No la des por buena solo porque suene razonable.

---

## 12. Lanzamiento (contexto para que priorices bien)

El README es el producto tanto como el código. Debe tener, en este orden:

1. Una frase que explique el problema (no la solución).
2. Un bloque de código de 10 líneas que resuelva un caso real.
3. Los badges: cobertura, **"tested against AEAT preproduction"**, tamaño del bundle, provenance.
4. Tabla comparativa honesta con las alternativas existentes (incluidas las de pago).
5. El aviso legal.

Canales de difusión previstos: Dev.to, r/node, Hacker News, comunidad hispana de desarrollo en LinkedIn/X,
y foros de gestorías/autónomos. El CLI (`npx verifactu verify`) es el activo más compartible.

---

## 13. Prompt inicial sugerido para arrancar

> Lee `VERIFACTU-BRIEF.md` por completo. **No escribas código todavía.**
>
> Ejecuta la Fase 0:
> 1. Localiza y descarga las fuentes oficiales listadas en §3 (RD 1007/2023, Orden HAC/1177/2024,
>    XSD, WSDL, documento de huella, documento de errores, especificación del QR).
> 2. Analiza los repos de la tabla de competencia, especialmente los tests de `mdiago/VeriFactu`.
> 3. Escribe `docs/spec-notes.md`: la especificación exacta de la huella (alta y anulación), formato de
>    fechas, formato de importes, estructura del QR, endpoints, y bloque `SistemaInformatico` —
>    **cada afirmación con su cita y fecha de consulta**.
> 4. Marca explícitamente en una sección "Incógnitas" todo lo que no hayas podido confirmar en fuente oficial.
> 5. Propón el plan de implementación de la Fase 1 y espera aprobación antes de codificar.
>
> Si en cualquier momento tienes que elegir entre avanzar rápido y estar seguro de la corrección
> de la huella, elige la corrección: es la única razón de existir de este proyecto.

---

## Anexo: checklist de arranque

- [ ] Comprobar disponibilidad de los nombres en npm: `verifactu`, `@verifactu/core`, scope `@verifactu`
      (si el scope está cogido, alternativa: `@sifjs/*` o `@verifactu-js/*`)
- [ ] Obtener certificado digital de pruebas para el entorno de preproducción de la AEAT
- [ ] Crear el repo con `gitleaks` en pre-commit **antes** del primer commit
- [ ] Configurar npm provenance vía OIDC en GitHub Actions
- [ ] Verificar manualmente un QR generado contra la web de cotejo de la AEAT antes de publicar la fase 2
