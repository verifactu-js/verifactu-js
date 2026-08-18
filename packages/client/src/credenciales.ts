/**
 * Loading a client certificate from disk.
 *
 * Node only, obviously: it reads files. Kept apart from the transport so that a caller who
 * already has the bytes — from a secret manager, a KMS, an env var — never touches the
 * filesystem.
 *
 * **A `.p12` is not parsed here.** Node's TLS stack accepts PKCS#12 directly through the `pfx`
 * option, so the file goes to the socket as-is. Parsing it ourselves would mean either a
 * crypto dependency or hand-rolled ASN.1, both for nothing.
 */

import { readFile } from 'node:fs/promises';
import { VerifactuClientError } from './errors.js';
import type { Credenciales } from './transporte.js';

/** Reads a `.p12` / `.pfx` and its passphrase. */
export async function cargarP12(ruta: string, passphrase: string): Promise<Credenciales> {
  if (passphrase === '') {
    throw new VerifactuClientError({
      code: 'CREDENCIALES_INVALIDAS',
      message: 'El fichero .p12 necesita una contraseña y se ha recibido una cadena vacía.',
      causaProbable:
        'Los certificados que emite la FNMT siempre van protegidos con contraseña. Una cadena ' +
        'vacía suele significar que la variable de entorno que la lleva no está definida.',
      accionSugerida:
        'Comprueba de dónde sale la contraseña. Si de verdad el fichero no la tiene, conviértelo ' +
        'a PEM y usa cargarPem().',
    });
  }

  return { tipo: 'p12', pfx: await leer(ruta, 'el certificado .p12'), passphrase };
}

/** Reads a PEM certificate and its private key. */
export async function cargarPem(
  rutaCert: string,
  rutaClave: string,
  passphrase?: string,
): Promise<Credenciales> {
  const [cert, key] = await Promise.all([
    leer(rutaCert, 'el certificado PEM'),
    leer(rutaClave, 'la clave privada PEM'),
  ]);

  const texto = new TextDecoder().decode(key);
  if (texto.includes('ENCRYPTED PRIVATE KEY') && passphrase === undefined) {
    throw new VerifactuClientError({
      code: 'CREDENCIALES_INVALIDAS',
      message: 'La clave privada está cifrada y no se ha dado contraseña.',
      causaProbable:
        'El fichero contiene una cabecera «ENCRYPTED PRIVATE KEY». Sin contraseña, el handshake ' +
        'TLS fallaría más tarde con un error de OpenSSL que no menciona la contraseña.',
      accionSugerida: 'Pasa la contraseña como tercer argumento de cargarPem().',
    });
  }

  return passphrase === undefined
    ? { tipo: 'pem', cert, key }
    : { tipo: 'pem', cert, key, passphrase };
}

async function leer(ruta: string, que: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(ruta));
  } catch (error) {
    throw new VerifactuClientError({
      code: 'CREDENCIALES_INVALIDAS',
      message: `No se ha podido leer ${que} en «${ruta}».`,
      causaProbable: String(error),
      accionSugerida:
        'Comprueba la ruta y los permisos. Y no metas el certificado en el repositorio: el hook ' +
        'de pre-commit escanea el stage, pero un fichero que nunca se añade es más seguro que ' +
        'uno que se detecta.',
      cause: error,
    });
  }
}
