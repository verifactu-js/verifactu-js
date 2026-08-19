/**
 * Los códigos de salida, con nombre.
 *
 * Un CLI se usa dentro de scripts, así que el código de salida es parte de su API pública: es
 * lo que decide si un `&&` sigue o se para. Se distingue **no he podido comprobarlo** de
 * **lo he comprobado y está mal**, porque un script tiene que poder tratarlos distinto.
 */

/** Comprobado y correcto. */
export const TODO_BIEN = 0;

/** Comprobado, y hay algo que mirar. */
export const HAY_HALLAZGOS = 1;

/** No se ha podido ni empezar: falta un argumento, el fichero no está, no es lo que dice ser. */
export const ERROR_DE_USO = 2;
