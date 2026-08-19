# @verifactu-js/validation

Las versiones siguen [semver](https://semver.org/lang/es/). Mientras el paquete esté en `0.x`, un
cambio incompatible sube la versión menor.

## 0.1.1 — 2026-08-19

- `author` en el `package.json`. Sin él, la página de npm no decía quién ha escrito esto.
  No cambia nada del código: es una versión de metadatos.

## 0.1.0 — 2026-08-17

Primera versión.

- El modelo de datos del registro (`DatosAlta`, `DatosAnulacion`, `DetalleDesglose`, `Cabecera`…),
  que vive aquí porque las reglas de la AEAT **son** la semántica de esos tipos.
- Las validaciones de negocio, cada regla con su cita, su documento y su versión.
- **Lo que deliberadamente no comprueba, y por qué**, está escrito en el README: las reglas que
  exigen consultar el censo de la AEAT no son una propiedad del documento sino una consulta
  remota, y una librería local que dijera que sí las comprueba estaría mintiendo.
- Cero dependencias en runtime.
