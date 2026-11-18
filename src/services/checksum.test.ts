import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import type { IPlatformStrategy } from '../types/platform';
import { findExpectedChecksum, mismatchedChecksumMessage, sha256Matches, shouldVerifyChecksum } from '#services/checksum';
import { CutverInstaller } from '#services/installer';

const ASSET = 'cutver-0.5.1-linux-x86_64.tar.gz';
const EXPECTED_DIGEST = '9f'.repeat(32);
const OTHER_DIGEST = '0d'.repeat(32);
const ACTUAL_DIGEST = '3c'.repeat(32);
const MISSING_ASSET = 'cutver-0.5.1-linux-arm64.tar.gz';

/** Un SHA256SUMS realista: CRLF, modo binario ("*"), ruta relativa y una entrada ajena. */
const SUMS = [
    `${OTHER_DIGEST}  cutver-0.5.1-macos-arm64.tar.gz`,
    `${EXPECTED_DIGEST.toUpperCase()} *${ASSET}`,
    `${OTHER_DIGEST}  ./cutver-0.5.1-windows-x86_64.zip`,
    ''
].join('\r\n');

describe('findExpectedChecksum', () => {
    it('devuelve el digest en minúsculas de la entrada pedida y omite las demás', () => {
        assert.equal(findExpectedChecksum(SUMS, ASSET), EXPECTED_DIGEST);
    });

    it('devuelve undefined cuando el asset no aparece en el archivo', () => {
        assert.equal(findExpectedChecksum(SUMS, MISSING_ASSET), undefined);
    });

    it('ignora líneas malformadas y comentarios', () => {
        const malformed = [
            '# comentario',
            `${ASSET} ${EXPECTED_DIGEST}`,
            `no-es-un-digest  ${ASSET}`,
            ''
        ].join('\n');

        assert.equal(findExpectedChecksum(malformed, ASSET), undefined);
    });
});

describe('findExpectedChecksum falla cerrado ante SHA256SUMS hostil', () => {
    it('rechaza un digest truncado a 63 hex', () => {
        assert.equal(findExpectedChecksum(`${EXPECTED_DIGEST.slice(0, 63)}  ${ASSET}\n`, ASSET), undefined);
    });

    it('rechaza cuando solo lista otro asset aunque el digest sea el correcto', () => {
        assert.equal(findExpectedChecksum(`${EXPECTED_DIGEST}  cutver-0.5.1-linux-arm64.tar.gz\n`, ASSET), undefined);
    });

    it('rechaza una página HTML servida en lugar del archivo', () => {
        assert.equal(findExpectedChecksum(`<html>${EXPECTED_DIGEST}  ${ASSET}</html>`, ASSET), undefined);
    });

    it('un archivo vacío o con solo espacios no verifica nada', () => {
        assert.equal(findExpectedChecksum('', ASSET), undefined);
        assert.equal(findExpectedChecksum('  \n\r\n', ASSET), undefined);
    });

    it('la primera línea gana: un digest erróneo antes del correcto no se pasa por alto', () => {
        const sums = `${OTHER_DIGEST}  ${ASSET}\n${EXPECTED_DIGEST}  ${ASSET}\n`;
        assert.equal(sha256Matches(findExpectedChecksum(sums, ASSET)!, EXPECTED_DIGEST), false);
    });
});

describe('sha256Matches', () => {
    it('considera iguales los digests idénticos sin importar mayúsculas ni espacios', () => {
        assert.equal(sha256Matches(EXPECTED_DIGEST, EXPECTED_DIGEST), true);
        assert.equal(sha256Matches(` ${EXPECTED_DIGEST.toUpperCase()} `, EXPECTED_DIGEST), true);
    });

    it('rechaza un digest que no coincide y deja pasar el esperado', () => {
        assert.equal(sha256Matches(EXPECTED_DIGEST, OTHER_DIGEST), false);
    });

    it('rechaza un valor esperado que no es un SHA-256 hexadecimal (falla cerrado)', () => {
        assert.equal(sha256Matches('abc', 'abc'), false);
        assert.equal(sha256Matches('', ''), false);
    });
});

describe('shouldVerifyChecksum', () => {
    it('verifica por defecto, cuando el input no se ha definido', () => {
        assert.equal(shouldVerifyChecksum(undefined), true);
    });

    it('verifica cuando el input es true y no verifica solo con false', () => {
        assert.equal(shouldVerifyChecksum(true), true);
        assert.equal(shouldVerifyChecksum(false), false);
    });
});

describe('mensajes de fallo', () => {
    it('el mensaje de digest distinto lleva el esperado y el obtenido', () => {
        const message = mismatchedChecksumMessage(ASSET, EXPECTED_DIGEST.toUpperCase(), ACTUAL_DIGEST);

        assert.ok(message.includes(EXPECTED_DIGEST));
        assert.ok(message.includes(ACTUAL_DIGEST));
    });
});

/**
 * Pruebas de cableado del instalador: sin red, sin runner y sin release real.
 *
 * El único punto de entrada que no es determinista —la descarga del asset— se
 * sustituye en la instancia (`downloadArchive`), y la verificación se envuelve
 * para registrar su orden sin dejar de ejecutarse de verdad. Ninguno de esos
 * cambios existe en el código que se publica.
 */
const VERSION = '0.5.1';
const PRIMARY_ASSET = `cutver-${VERSION}-linux-x86_64.tar.gz`;
const LEGACY_ASSET = `cutver-${VERSION}-x86_64-unknown-linux-gnu.tar.gz`;
const ARCHIVE_CONTENT = 'contenido del archivo de prueba\n';
const ARCHIVE_SHA256 = createHash('sha256').update(ARCHIVE_CONTENT).digest('hex');
const RELEASE_URL = `https://github.com/cutver/cutver/releases/download/v${VERSION}`;

interface InstallerSeams {
    downloadArchive(url: string): Promise<string>;
    verifyArchiveChecksum(version: string, assetName: string, archivePath: string, token?: string): Promise<void>;
}

class FakeStrategy implements IPlatformStrategy {
    readonly slug = 'linux-x86_64';
    readonly legacyTarget = 'x86_64-unknown-linux-gnu';
    readonly archiveExt = 'tar.gz';
    readonly binaryFileName = 'cutver';

    private readonly calls: string[];
    private readonly extractDirectory: string;

    constructor(calls: string[], extractDirectory: string) {
        this.calls = calls;
        this.extractDirectory = extractDirectory;
    }

    get target(): string {
        return this.slug;
    }

    getAssetFileName(version: string, useLegacy = false, plugins = false): string {
        const identifier = useLegacy && this.legacyTarget ? this.legacyTarget : this.slug;
        const prefix = plugins ? 'cutver-plugins' : 'cutver';
        return `${prefix}-${version}-${identifier}.${this.archiveExt}`;
    }

    async extract(archivePath: string): Promise<string> {
        this.calls.push(`extract:${archivePath}`);
        await mkdir(this.extractDirectory, { recursive: true });
        await writeFile(join(this.extractDirectory, this.binaryFileName), 'binario');
        return this.extractDirectory;
    }

    async preparePermissions(): Promise<void> { }
}

interface TestBed {
    root: string;
    archivePath: string;
    calls: string[];
    installer: CutverInstaller;
}

/** Prepara un directorio temporal aislado y lo borra al terminar. */
async function withTestBed(run: (bed: TestBed) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'cutver-setup-test-'));
    const originalFetch = globalThis.fetch;
    try {
        const archivePath = join(root, 'archive.tar.gz');
        await writeFile(archivePath, ARCHIVE_CONTENT);

        const calls: string[] = [];
        const strategy = new FakeStrategy(calls, join(root, 'extracted'));
        const installer = new CutverInstaller('cutver', 'cutver', strategy);

        await run({ root, archivePath, calls, installer });
    } finally {
        globalThis.fetch = originalFetch;
        await rm(root, { recursive: true, force: true });
    }
}

/** Sustituye la descarga del asset en la instancia. */
function stubDownload(installer: CutverInstaller, impl: (url: string) => Promise<string>): void {
    (installer as unknown as InstallerSeams).downloadArchive = impl;
}

/** Registra el orden y el asset de cada verificación, ejecutando la verificación real. */
function recordVerification(installer: CutverInstaller, calls: string[]): void {
    const seams = installer as unknown as InstallerSeams;
    const original = seams.verifyArchiveChecksum.bind(installer);
    seams.verifyArchiveChecksum = async (version, assetName, archivePath, token) => {
        calls.push(`verify:${assetName}`);
        await original(version, assetName, archivePath, token);
    };
}

/** Sustituye la descarga de `SHA256SUMS` (la única llamada de red de la verificación). */
function stubChecksumResponse(body: string, status = 200): void {
    globalThis.fetch = (async () => new Response(body, { status })) as typeof fetch;
}

function extractCalls(calls: string[]): string[] {
    return calls.filter((call) => call.startsWith('extract:'));
}

describe('CutverInstaller: verificación de integridad', () => {
    it('verifica el asset primario después de descargarlo y antes de extraerlo', async () => {
        await withTestBed(async ({ archivePath, calls, installer }) => {
            stubChecksumResponse(`${ARCHIVE_SHA256}  ${PRIMARY_ASSET}\n`);
            stubDownload(installer, async (url) => {
                calls.push(`download:${url}`);
                return archivePath;
            });
            recordVerification(installer, calls);

            await installer.install(VERSION, undefined, false, false, true);

            assert.deepEqual(calls, [
                `download:${RELEASE_URL}/${PRIMARY_ASSET}`,
                `verify:${PRIMARY_ASSET}`,
                `extract:${archivePath}`
            ]);
            assert.equal(extractCalls(calls).length, 1);
        });
    });

    it('no extrae nada cuando el digest no coincide, y el error lleva ambos digests', async () => {
        await withTestBed(async ({ archivePath, calls, installer }) => {
            stubChecksumResponse(`${OTHER_DIGEST}  ${PRIMARY_ASSET}\n`);
            stubDownload(installer, async (url) => {
                calls.push(`download:${url}`);
                return archivePath;
            });
            recordVerification(installer, calls);

            await assert.rejects(
                () => installer.install(VERSION, undefined, false, false, true),
                (error: Error) => {
                    assert.ok(error.message.includes(OTHER_DIGEST), 'falta el digest esperado');
                    assert.ok(error.message.includes(ARCHIVE_SHA256), 'falta el digest obtenido');
                    return true;
                }
            );

            assert.deepEqual(extractCalls(calls), []);
            assert.deepEqual(calls, [`download:${RELEASE_URL}/${PRIMARY_ASSET}`, `verify:${PRIMARY_ASSET}`]);
        });
    });

    it('no verifica ni extrae cuando SHA256SUMS no está publicado', async () => {
        await withTestBed(async ({ archivePath, calls, installer }) => {
            stubChecksumResponse('Not Found', 404);
            stubDownload(installer, async () => archivePath);
            recordVerification(installer, calls);

            await assert.rejects(
                () => installer.install(VERSION, undefined, false, false, true),
                (error: Error) => {
                    assert.ok(error.message.includes('SHA256SUMS'));
                    assert.ok(error.message.includes('verify-checksum'));
                    return true;
                }
            );

            assert.deepEqual(extractCalls(calls), []);
        });
    });

    it('en el fallback legacy verifica el asset legacy, no el primario', async () => {
        await withTestBed(async ({ archivePath, calls, installer }) => {
            // SHA256SUMS solo lista el primario: si verificara ese nombre, el paso pasaría.
            stubChecksumResponse(`${ARCHIVE_SHA256}  ${PRIMARY_ASSET}\n`);
            stubDownload(installer, async (url) => {
                if (url.endsWith(PRIMARY_ASSET)) {
                    throw new Error('404 primario');
                }
                calls.push(`download:${url}`);
                return archivePath;
            });
            recordVerification(installer, calls);

            await assert.rejects(
                () => installer.install(VERSION, undefined, false, false, true),
                (error: Error) => {
                    assert.ok(error.message.includes(LEGACY_ASSET), 'no nombró el asset legacy');
                    return true;
                }
            );

            assert.deepEqual(calls.filter((call) => call.startsWith('verify:')), [`verify:${LEGACY_ASSET}`]);
            assert.deepEqual(extractCalls(calls), []);
        });
    });

    it('en el fallback legacy instala cuando SHA256SUMS lista el asset legacy', async () => {
        await withTestBed(async ({ archivePath, calls, installer }) => {
            stubChecksumResponse(`${ARCHIVE_SHA256}  ${LEGACY_ASSET}\n`);
            stubDownload(installer, async (url) => {
                if (url.endsWith(PRIMARY_ASSET)) {
                    throw new Error('404 primario');
                }
                calls.push(`download:${url}`);
                return archivePath;
            });
            recordVerification(installer, calls);

            await installer.install(VERSION, undefined, false, false, true);

            assert.deepEqual(calls, [
                `download:${RELEASE_URL}/${LEGACY_ASSET}`,
                `verify:${LEGACY_ASSET}`,
                `extract:${archivePath}`
            ]);
        });
    });

    it('con verify-checksum=false extrae sin verificar (opt-out explícito)', async () => {
        await withTestBed(async ({ archivePath, calls, installer }) => {
            let networkCalls = 0;
            globalThis.fetch = (async () => {
                networkCalls += 1;
                return new Response('', { status: 200 });
            }) as typeof fetch;
            stubDownload(installer, async () => archivePath);
            recordVerification(installer, calls);

            await installer.install(VERSION, undefined, false, false, false);

            assert.equal(networkCalls, 0);
            assert.deepEqual(calls, [`extract:${archivePath}`]);
        });
    });

    it('un acierto de caché no descarga ni verifica nada (intención actual, sin cambios)', async () => {
        await withTestBed(async ({ root, calls, installer }) => {
            const toolCache = join(root, 'tool-cache');
            const cachedTool = join(toolCache, 'cutver', VERSION, 'linux-x86_64');
            await mkdir(cachedTool, { recursive: true });
            await writeFile(`${cachedTool}.complete`, '');

            const previousToolCache = process.env['RUNNER_TOOL_CACHE'];
            process.env['RUNNER_TOOL_CACHE'] = toolCache;

            let networkCalls = 0;
            globalThis.fetch = (async () => {
                networkCalls += 1;
                return new Response('', { status: 200 });
            }) as typeof fetch;
            stubDownload(installer, async (url) => {
                calls.push(`download:${url}`);
                throw new Error('la caché no debe descargar');
            });
            recordVerification(installer, calls);

            try {
                const result = await installer.install(VERSION, undefined, true, false, true);
                assert.equal(result.path, cachedTool);
            } finally {
                if (previousToolCache === undefined) {
                    delete process.env['RUNNER_TOOL_CACHE'];
                } else {
                    process.env['RUNNER_TOOL_CACHE'] = previousToolCache;
                }
            }

            assert.deepEqual(calls, []);
            assert.equal(networkCalls, 0);
        });
    });
});
