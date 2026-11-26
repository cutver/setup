/**
 * Detección de la libc del runner Linux.
 *
 * Cutver publica dos familias de binarios para Linux: los enlazados contra glibc
 * (`linux-x86_64`, `linux-arm64`) y los estáticos contra musl
 * (`linux-musl-x86_64`, `linux-musl-arm64`). El binario glibc no arranca en un
 * runner musl como Alpine, así que la acción necesita saber qué libc tiene en
 * frente antes de armar el nombre del asset.
 *
 * La detección no ejecuta procesos ni consulta la red: lee el mapa de memoria del
 * propio proceso de Node, que es quien va a quedar enlazado contra la libc del
 * sistema. Es la única evidencia que no se contamina con toolchains de
 * compilación cruzada instaladas en el host (por ejemplo `musl-tools` en
 * `ubuntu-latest`).
 */

import { readFile } from 'node:fs/promises';

/** Familia de libc contra la que se enlaza el binario que se descarga. */
export type Libc = 'gnu' | 'musl';

/** Preferencia del llamador: detectar, o forzar una familia. */
export type LibcPreference = 'auto' | Libc;

/** Nombre del input que permite al llamador forzar o desactivar la detección. */
export const LIBC_INPUT = 'libc';

/** Valores admitidos por el input, en el orden en que se documentan. */
const LIBC_CHOICES = 'auto, gnu, musl';

/**
 * El loader dinámico de musl tal como aparece mapeado en `/proc/self/maps`
 * (`/lib/ld-musl-x86_64.so.1`, `/lib/ld-musl-aarch64.so.1`). Un host glibc con
 * `musl-tools` instalado nunca mapea este archivo en su propio proceso.
 */
const MUSL_LOADER_PATTERN = /\/ld-musl-[^\s]*\.so\.\d+/;

/**
 * Traduce el input del llamador a una preferencia explícita.
 *
 * Un valor ausente equivale a `auto`. Un valor desconocido falla en lugar de
 * adivinar: instalar el binario equivocado rompe el paso más adelante, con un
 * error que no menciona el input.
 */
export function parseLibcPreference(raw: string): LibcPreference {
    const normalized = raw.trim().toLowerCase();

    if (normalized === '' || normalized === 'auto') {
        return 'auto';
    }

    if (normalized === 'gnu' || normalized === 'musl') {
        return normalized;
    }

    throw new Error(`Valor inválido para el input ${LIBC_INPUT}: "${raw.trim()}". Valores admitidos: ${LIBC_CHOICES}.`);
}

/**
 * Decide la libc a partir del contenido de `/proc/self/maps`.
 *
 * Ante cualquier duda responde `gnu`, que es el comportamiento previo a este
 * cambio: un runner sin evidencia de musl no cambia de binario.
 */
export function detectLibcFromMaps(maps: string | undefined): Libc {
    if (!maps) {
        return 'gnu';
    }

    return MUSL_LOADER_PATTERN.test(maps) ? 'musl' : 'gnu';
}

/**
 * Resuelve la libc efectiva respetando la preferencia del llamador.
 *
 * Un valor explícito gana y no consulta el sistema. En `auto`, una sonda que
 * falla (por ejemplo `/proc` no está montado) cae en `gnu` en lugar de romper la
 * instalación.
 */
export async function resolveLibc(preference: LibcPreference, probe: () => Promise<string | undefined>): Promise<Libc> {
    if (preference !== 'auto') {
        return preference;
    }

    try {
        return detectLibcFromMaps(await probe());
    } catch {
        return 'gnu';
    }
}

/** Lee el mapa de memoria del proceso actual, o `undefined` si no está disponible. */
export async function readProcessMaps(): Promise<string | undefined> {
    try {
        return await readFile('/proc/self/maps', 'utf8');
    } catch {
        return undefined;
    }
}

/**
 * Slug del asset Linux para la arquitectura y la libc dadas.
 *
 * Con `gnu` devuelve los slugs históricos; con `musl` los que cutver publica
 * desde la matriz de build musl.
 */
export function linuxSlug(arch: string, libc: Libc): string {
    const archSuffix = arch === 'arm64' ? 'arm64' : 'x86_64';

    return libc === 'musl' ? `linux-musl-${archSuffix}` : `linux-${archSuffix}`;
}
