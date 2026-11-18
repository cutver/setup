/**
 * Verificación de integridad SHA-256 de los archivos descargados por la acción.
 *
 * Este módulo es puro: no descarga nada ni toca el sistema de archivos, de modo que
 * la regla se puede probar sin red, sin runner y sin un release real. La descarga y
 * el cálculo del digest del archivo viven en `installer.ts`.
 */

/** Nombre del asset que publica los digests del release. */
export const CHECKSUM_ASSET_NAME = 'SHA256SUMS';

/** Nombre del input que permite al llamador desactivar la verificación. */
export const VERIFY_CHECKSUM_INPUT = 'verify-checksum';

/** Un digest SHA-256 completo en hexadecimal. */
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

/** Una línea de `SHA256SUMS`: "<digest>  <nombre>" o "<digest> *<nombre>". */
const CHECKSUM_LINE_PATTERN = /^([0-9a-f]{64})[ \t]+\*?(.+)$/i;

/**
 * Busca en el contenido de `SHA256SUMS` el digest del asset descargado.
 *
 * Devuelve el digest en minúsculas o `undefined` cuando el archivo no lista ese
 * asset, que el llamador debe tratar como un fallo (falla cerrado).
 */
export function findExpectedChecksum(checksumFileContent: string, assetName: string): string | undefined {
    const normalizedAssetName = normalizeFileName(assetName);

    for (const rawLine of checksumFileContent.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith('#')) {
            continue;
        }

        const match = CHECKSUM_LINE_PATTERN.exec(line);
        if (!match) {
            continue;
        }

        const digest = match[1];
        const fileName = match[2];
        if (digest === undefined || fileName === undefined) {
            continue;
        }

        if (normalizeFileName(fileName) === normalizedAssetName) {
            return digest.toLowerCase();
        }
    }

    return undefined;
}

/**
 * Compara el digest esperado con el calculado, sin distinguir mayúsculas ni espacios.
 *
 * Un valor esperado que no es un SHA-256 hexadecimal nunca coincide: falla cerrado.
 */
export function sha256Matches(expected: string, actual: string): boolean {
    const normalizedExpected = expected.trim().toLowerCase();
    const normalizedActual = actual.trim().toLowerCase();

    return SHA256_HEX_PATTERN.test(normalizedExpected) && normalizedExpected === normalizedActual;
}

/**
 * Decide si se verifica el archivo. El valor por defecto (input ausente) verifica,
 * y solo un `false` explícito del llamador lo omite.
 */
export function shouldVerifyChecksum(verifyChecksum: boolean | undefined): boolean {
    return verifyChecksum !== false;
}

/** Mensaje de fallo para un digest que no coincide con el publicado. */
export function mismatchedChecksumMessage(assetName: string, expected: string, actual: string): string {
    return `Verificación SHA-256 fallida para ${assetName}: esperado ${expected.trim().toLowerCase()}, obtenido ${actual.trim().toLowerCase()}. No se extrajo el archivo.`;
}

/** Mensaje de fallo cuando el release no publica `SHA256SUMS`. */
export function missingChecksumFileMessage(version: string, checksumUrl: string): string {
    return `No se encontró ${CHECKSUM_ASSET_NAME} para el release v${version} (${checksumUrl}). La descarga no se puede verificar; configure ${VERIFY_CHECKSUM_INPUT}: false para omitir la verificación (no recomendado).`;
}

/** Mensaje de fallo cuando `SHA256SUMS` no lista el asset descargado. */
export function missingChecksumEntryMessage(version: string, assetName: string): string {
    return `${CHECKSUM_ASSET_NAME} del release v${version} no contiene una entrada para ${assetName}. La descarga no se puede verificar; configure ${VERIFY_CHECKSUM_INPUT}: false para omitir la verificación (no recomendado).`;
}

/** Normaliza el nombre de archivo que aparece en `SHA256SUMS` antes de compararlo. */
function normalizeFileName(fileName: string): string {
    return fileName.trim().replace(/^\.\//, '');
}
