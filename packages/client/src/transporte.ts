/**
 * The seam.
 *
 * Everything above this file is platform-independent: build the envelope, send bytes, read the
 * answer. Everything below it is "how do I open a TLS socket with a client certificate here",
 * which is the one thing that genuinely differs between Node, Deno, Bun, Workers and a browser
 * (where it is not possible at all).
 *
 * So the HTTP layer is a parameter, not an import. The default is Node; anything else is a
 * function you pass in.
 */

/** What the client needs to send. */
export interface PeticionHttp {
  readonly url: string;
  readonly metodo: 'POST';
  readonly cabeceras: Readonly<Record<string, string>>;
  /** The SOAP envelope, already serialised. */
  readonly cuerpo: string;
  /** Milliseconds before giving up. */
  readonly timeoutMs: number;
}

/** What it needs back. */
export interface RespuestaHttp {
  readonly estado: number;
  readonly cabeceras: Readonly<Record<string, string>>;
  /** Body as text. Never parsed here: `@verifactu-js/xml` owns that. */
  readonly cuerpo: string;
}

/**
 * A transport.
 *
 * It must not throw for an HTTP error status — a 500 with a SOAP Fault inside is a perfectly
 * normal answer that the caller needs to read. Throw only when no answer arrived at all.
 */
export type Transporte = (peticion: PeticionHttp) => Promise<RespuestaHttp>;

/**
 * Client certificate, in either of the two shapes a Spanish taxpayer actually has.
 *
 * The FNMT hands out a `.p12`/`.pfx`; a certificate exported from a browser or converted with
 * OpenSSL usually ends up as a PEM pair. Both go straight into the TLS options — there is no
 * parsing here, and no dependency for it, because Node's TLS accepts PKCS#12 natively.
 */
export type Credenciales =
  | {
      readonly tipo: 'p12';
      /** Contents of the `.p12` / `.pfx` file. */
      readonly pfx: Uint8Array;
      readonly passphrase: string;
    }
  | {
      readonly tipo: 'pem';
      readonly cert: string | Uint8Array;
      readonly key: string | Uint8Array;
      /** Only if the private key is encrypted. */
      readonly passphrase?: string;
    };
