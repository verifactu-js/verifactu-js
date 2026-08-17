/**
 * The SOAP envelope and the endpoints.
 *
 * The endpoint table is not derived by pattern: every URL here appears verbatim as a
 * `soap:address` in `SistemaFacturacion.wsdl`, and there is a test that reads the WSDL and checks
 * exactly that.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  type Destino,
  endpoint,
  NS_SOAP_ENVELOPE,
  parsearXml,
  SOAP_ACTION,
  SOAP_CONTENT_TYPE,
  serializarSobreSoap,
  type VerifactuXmlError,
} from '../src/index.js';
import { altaMinima, CABECERA } from './helpers/documentos.js';
import { esperarValido } from './helpers/xsd.js';

const REFERENCIA = join(
  dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))),
  'docs',
  'reference',
);

const NS_LR =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd';

describe('the envelope', () => {
  it('puts the submission straight into the Body, with no wrapper element', async () => {
    // document/literal with a single message part. An operation wrapper would be RPC style and
    // the service would not recognise it.
    const sobre = serializarSobreSoap({
      cabecera: CABECERA,
      registros: [await altaMinima()],
    });

    const raiz = parsearXml(sobre);
    expect(raiz.ns).toBe(NS_SOAP_ENVELOPE);
    expect(raiz.nombre).toBe('Envelope');

    const cuerpo = raiz.hijos[0];
    expect(cuerpo?.nombre).toBe('Body');
    expect(cuerpo?.hijos).toHaveLength(1);
    expect(cuerpo?.hijos[0]?.ns).toBe(NS_LR);
    expect(cuerpo?.hijos[0]?.nombre).toBe('RegFactuSistemaFacturacion');
  });

  it('emits no Header: the AEAT authenticates with the TLS certificate', async () => {
    const sobre = serializarSobreSoap({ cabecera: CABECERA, registros: [await altaMinima()] });
    expect(sobre).not.toContain('Header');
  });

  it('declares the SOAP 1.1 envelope namespace', async () => {
    const sobre = serializarSobreSoap({ cabecera: CABECERA, registros: [await altaMinima()] });
    expect(sobre).toContain(`xmlns:soapenv="${NS_SOAP_ENVELOPE}"`);
  });

  it('starts with the XML declaration', async () => {
    const sobre = serializarSobreSoap({ cabecera: CABECERA, registros: [await altaMinima()] });
    expect(sobre.startsWith('<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope')).toBe(true);
  });

  it('carries a body that validates against SuministroLR.xsd on its own', async () => {
    const sobre = serializarSobreSoap({ cabecera: CABECERA, registros: [await altaMinima()] });

    // Strip the envelope and validate what the AEAT will hand to its own schema validator.
    const desde = sobre.indexOf('<sfLR:RegFactuSistemaFacturacion');
    const hasta = sobre.indexOf('</soapenv:Body>');
    await esperarValido(sobre.slice(desde, hasta));
  });

  it('validates the batch before writing a single byte', async () => {
    const registro = await altaMinima({ IDEmisorFactura: 'B72877814' });

    try {
      serializarSobreSoap({ cabecera: CABECERA, registros: [registro] });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuXmlError).code).toBe('EMISOR_DISTINTO_DEL_OBLIGADO');
    }
  });
});

describe('the HTTP headers the binding requires', () => {
  it('sends SOAPAction as an empty quoted string, not as an absent header', () => {
    // The WSDL declares soapAction="". SOAP 1.1 requires the header to be present; omitting it
    // is not the same as sending it empty, and some stacks reject the request.
    expect(SOAP_ACTION).toBe('""');
  });

  it('uses the SOAP 1.1 content type', () => {
    expect(SOAP_CONTENT_TYPE).toBe('text/xml; charset=utf-8');
  });
});

describe('endpoints', () => {
  const wsdl = readFileSync(join(REFERENCIA, 'SistemaFacturacion.wsdl'), 'utf8');

  const TODOS: readonly Destino[] = [
    { entorno: 'produccion', certificado: 'representante', servicio: 'verifactu' },
    { entorno: 'produccion', certificado: 'sello', servicio: 'verifactu' },
    { entorno: 'pruebas', certificado: 'representante', servicio: 'verifactu' },
    { entorno: 'pruebas', certificado: 'sello', servicio: 'verifactu' },
    { entorno: 'produccion', certificado: 'representante', servicio: 'requerimiento' },
    { entorno: 'produccion', certificado: 'sello', servicio: 'requerimiento' },
    { entorno: 'pruebas', certificado: 'representante', servicio: 'requerimiento' },
    { entorno: 'pruebas', certificado: 'sello', servicio: 'requerimiento' },
  ];

  it.each(TODOS)('$entorno / $certificado / $servicio appears verbatim in the WSDL', (destino) => {
    expect(wsdl).toContain(`location="${endpoint(destino)}"`);
  });

  it('covers every soap:address the WSDL declares, and invents none', () => {
    const declaradas = [...wsdl.matchAll(/<soap:address location="([^"]+)"/g)].map((m) => m[1]);
    const nuestras = TODOS.map(endpoint);

    expect(new Set(nuestras)).toEqual(new Set(declaradas));
    expect(nuestras).toHaveLength(declaradas.length);
  });

  it('keeps the seal host separate: the two are not interchangeable', () => {
    const normal = endpoint({
      entorno: 'produccion',
      certificado: 'representante',
      servicio: 'verifactu',
    });
    const sello = endpoint({
      entorno: 'produccion',
      certificado: 'sello',
      servicio: 'verifactu',
    });

    expect(normal).toContain('www1.');
    expect(sello).toContain('www10.');
  });

  it('uses the pruebas hosts for the test environment', () => {
    expect(
      endpoint({ entorno: 'pruebas', certificado: 'representante', servicio: 'verifactu' }),
    ).toBe('https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP');
  });
});
