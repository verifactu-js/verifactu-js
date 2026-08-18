# Resultados de las sondas

Aquí caen la petición y la respuesta **en crudo** de cada sonda, más un `.json` con el resumen
(estado del envío, estado del registro, **código** de error, descripción, CSV, `TiempoEsperaEnvio`
y duración).

Cada envío es caro —un registro real bajo un NIF real contra un sistema de la AEAT— así que no se
tira nada: una sonda que sorprende tiene que poder releerse sin volver a enviar.

## Esta carpeta está en .gitignore, y es a propósito

Las peticiones llevan el **NIF y el nombre reales** del titular del certificado. F4 §4.1 obliga a
que sean reales: «Todos los NIFs se tienen que validar contra la "Base de Datos Centralizada de la
AEAT"». Un NIF es un dato personal, y este repositorio es público.

Si en algún momento quieres publicar alguna como evidencia, **redáctala antes**: el NIF aparece en
`ObligadoEmision/NIF`, en `IDFactura/IDEmisorFactura`, en `SistemaInformatico/NIF` y en la propia
huella no, pero sí en la cadena canónica si la reconstruyes.

Quitar el ignore es una línea. Despublicar un NIF no.
