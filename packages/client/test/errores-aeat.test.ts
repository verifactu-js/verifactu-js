/**
 * The AEAT error-code map, and the encoding trap underneath it.
 *
 * Nothing here touches the network. The table is baked in at build time from
 * `docs/reference/AEAT_errores.properties`, whose SHA-256 está en el manifiesto.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { decodificarProperties, parsearProperties } from '../../../scripts/properties.mjs';
import { CODIGOS_AEAT, decodificarXml, explicarCodigo, FUENTE_CODIGOS } from '../src/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FUENTE = join(RAIZ, 'docs', 'reference', 'AEAT_errores.properties');

describe('la tabla de códigos', () => {
  it('trae los 247 códigos de las tres secciones', () => {
    expect(Object.keys(CODIGOS_AEAT)).toHaveLength(247);
    expect(FUENTE_CODIGOS.codigos).toBe(247);
  });

  it('conserva el texto oficial con sus acentos', () => {
    // Si alguna vez esto falla con «cdigos» o «c�digos», el fichero se ha decodificado como UTF-8
    // en algún punto de la cadena y la tabla ya no vale para nada.
    expect(CODIGOS_AEAT['4108']?.texto).toBe('Error técnico al obtener el certificado.');
    expect(CODIGOS_AEAT['4104']?.texto).toContain('no está identificado');
    expect(CODIGOS_AEAT['2004']?.texto).toContain('admitiéndose un margen de error');
  });

  it('no contiene ni un solo carácter de reemplazo', () => {
    const conBasura = Object.values(CODIGOS_AEAT).filter((c) => c.texto.includes('�'));
    expect(conBasura).toEqual([]);
  });

  it('repara la doble codificación del origen en el código 1214', () => {
    // El fichero de la AEAT trae ahí una `ú` en UTF-8 dentro de un fichero ISO-8859-1.
    // Decodificado en latin1 estricto saldría «nÃºmerico»; leído como UTF-8, «n�merico».
    //
    // Y sí, el texto oficial dice «númerico», con la tilde en la primera vez que toca.
    // Es una errata de la AEAT y se conserva tal cual: el valor de esta tabla está en poder
    // citarla literalmente, y «corregir» el mensaje lo haría inbuscable para quien lo reciba.
    expect(CODIGOS_AEAT['1214']?.texto).toBe(
      'El campo NumeroOTAlta debe ser númerico positivo de 4 posiciones.',
    );
    expect(CODIGOS_AEAT['1214']?.texto).not.toContain('Ãº');
    expect(CODIGOS_AEAT['1214']?.texto).not.toContain('�');
  });

  it('clasifica por la sección del fichero, no por el primer dígito', () => {
    // 3500 y 3501 son 3xxx pero viven en la sección de rechazo del envío completo, y 3000-3004
    // son 3xxx en la de rechazo de la factura. Clasificar por el número los pondría juntos.
    expect(CODIGOS_AEAT['3500']?.categoria).toBe('envio');
    expect(CODIGOS_AEAT['3000']?.categoria).toBe('registro');
    expect(CODIGOS_AEAT['2000']?.categoria).toBe('aceptado');
  });

  it('sigue coincidiendo con el fichero de docs/reference', () => {
    // El equivalente en test de `node scripts/generar-codigos-aeat.mjs --check`: si alguien edita
    // el fichero generado a mano, esto lo caza.
    const { texto } = decodificarProperties(readFileSync(FUENTE));
    const delFichero = new Map<string, string>();
    for (const seccion of parsearProperties(texto)) {
      for (const e of seccion.entradas) delFichero.set(e.codigo, e.texto);
    }

    expect(delFichero.size).toBe(Object.keys(CODIGOS_AEAT).length);
    for (const [codigo, texto_] of delFichero) {
      expect(CODIGOS_AEAT[codigo]?.texto, `código ${codigo}`).toBe(texto_);
    }
  });
});

describe('explicarCodigo', () => {
  it('dice si el registro quedó almacenado, que es lo que decide qué hacer', () => {
    expect(explicarCodigo('2000')?.almacenado).toBe(true);
    expect(explicarCodigo('1130')?.almacenado).toBe(false);
    expect(explicarCodigo('4104')?.almacenado).toBe(false);
  });

  it('marca reenviable solo los fallos técnicos de la AEAT', () => {
    expect(explicarCodigo('3501')?.reenviable).toBe(true);
    expect(explicarCodigo('4108')?.reenviable).toBe(true);
    // Un error de datos nunca: reenviar lo mismo da lo mismo.
    expect(explicarCodigo('1130')?.reenviable).toBe(false);
    expect(explicarCodigo('2000')?.reenviable).toBe(false);
  });

  it('da la acción específica cuando la hay', () => {
    expect(explicarCodigo('4141')?.accion).toContain('verifactu@correo.aeat.es');
    expect(explicarCodigo('2007')?.accion).toContain('NumeroInstalacion');
    expect(explicarCodigo('1287')?.accion).toContain('%s');
  });

  it('cae en la acción por categoría cuando no la hay', () => {
    // 1101 no tiene acción propia: el mensaje oficial ya lo dice todo.
    const e = explicarCodigo('1101');
    expect(e?.accion).toContain('no se ha almacenado');
    expect(e?.accion).toContain('no ha avanzado');
  });

  it('avisa de que un aceptado-con-errores se subsana, no se reenvía', () => {
    // Es el error caro: reenviar lo que la AEAT ya guardó produce un duplicado (3000).
    expect(explicarCodigo('2001')?.accion).toContain('subsanarlo');
    expect(explicarCodigo('2005')?.accion).toContain('almacenado');
  });

  it('devuelve undefined en vez de inventarse un código que no conoce', () => {
    expect(explicarCodigo('9999')).toBeUndefined();
    expect(explicarCodigo(null)).toBeUndefined();
    expect(explicarCodigo(undefined)).toBeUndefined();
  });
});

describe('decodificarXml', () => {
  const acentos = 'El NIF no está identificado en el censo de la AEAT.';

  it('usa UTF-8 cuando el documento lo declara', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><d>${acentos}</d>`;
    expect(decodificarXml(Buffer.from(xml, 'utf8'))).toContain(acentos);
  });

  it('usa UTF-8 cuando no hay declaración, que es lo que manda XML 1.0', () => {
    const xml = `<d>${acentos}</d>`;
    expect(decodificarXml(Buffer.from(xml, 'utf8'))).toContain(acentos);
  });

  it('usa ISO-8859-1 cuando el documento lo declara', () => {
    // Este es el caso que `body.text()` destruía: en UTF-8 cada acento sería un U+FFFD.
    const xml = `<?xml version="1.0" encoding="ISO-8859-1"?><d>${acentos}</d>`;
    const bytes = Buffer.from(xml, 'latin1');

    expect(decodificarXml(bytes)).toContain(acentos);
    expect(bytes.toString('utf8')).toContain('�');
  });

  it('no se cree una declaración que aparezca a mitad del documento', () => {
    const xml = `<d><![CDATA[<?xml version="1.0" encoding="ISO-8859-1"?>]]>${acentos}</d>`;
    expect(decodificarXml(Buffer.from(xml, 'utf8'))).toContain(acentos);
  });

  it('cae a UTF-8 ante una codificación que el runtime no conoce', () => {
    const xml = `<?xml version="1.0" encoding="INVENTADA-9"?><d>${acentos}</d>`;
    expect(decodificarXml(Buffer.from(xml, 'utf8'))).toContain(acentos);
  });
});
