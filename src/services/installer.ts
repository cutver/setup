import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { IPlatformStrategy } from '../types/platform';
import {
    CHECKSUM_ASSET_NAME,
    findExpectedChecksum,
    mismatchedChecksumMessage,
    missingChecksumEntryMessage,
    missingChecksumFileMessage,
    sha256Matches,
    shouldVerifyChecksum
} from '#services/checksum';

export class CutverInstaller {
    private readonly repoOwner: string;
    private readonly repoName: string;
    private readonly strategy: IPlatformStrategy;

    constructor(repoOwner: string, repoName: string, strategy: IPlatformStrategy) {
        this.repoOwner = repoOwner;
        this.repoName = repoName;
        this.strategy = strategy;
    }

    async resolveLatestVersion(token?: string, bypassCache = false): Promise<string> {
        const headers: Record<string, string> = {
            'User-Agent': 'setup-cutver-action'
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }
        if (bypassCache) {
            headers['Cache-Control'] = 'no-cache';
            headers['Pragma'] = 'no-cache';
        }

        const url = bypassCache
            ? `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest?_ts=${Date.now()}`
            : `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Fallo al consultar último release en GitHub API: ${response.statusText}`);
        }

        const data = (await response.json()) as { tag_name: string };
        return data.tag_name.trim().replace(/^v/i, '');
    }

    async install(requestedVersion: string, token?: string, useCache = true, plugins = false, verifyChecksum?: boolean): Promise<{ path: string; version: string }> {
        const rawNormalized = requestedVersion.trim().replace(/^v/i, '');
        const version = !rawNormalized || rawNormalized.toLowerCase() === 'latest'
            ? await this.resolveLatestVersion(token, !useCache)
            : rawNormalized;

        const toolName = plugins ? 'cutver-plugins' : 'cutver';
        const prefix = plugins ? 'cutver-plugins' : 'cutver';

        core.info(`Versión resuelta de ${toolName}: v${version}`);

        if (useCache) {
            let toolDirectory = tc.find(toolName, version, this.strategy.slug);
            if (!toolDirectory && this.strategy.legacyTarget) {
                toolDirectory = tc.find(toolName, version, this.strategy.legacyTarget);
            }

            if (toolDirectory) {
                core.info(`${toolName} v${version} encontrado en tool-cache local.`);
                return { path: toolDirectory, version };
            }
        } else {
            core.info('Bypassing local tool-cache due to cache=false.');
        }

        const primaryAssetName = this.strategy.getAssetFileName(version, false, plugins);
        const primaryUrl = `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/v${version}/${primaryAssetName}`;

        let archivePath: string;
        let downloadedAssetName = primaryAssetName;
        try {
            core.info(`Descargando binario desde: ${primaryUrl}`);
            archivePath = await this.downloadArchive(primaryUrl);
        } catch (error) {
            if (this.strategy.legacyTarget) {
                const legacyAssetName = this.strategy.getAssetFileName(version, true, plugins);
                const legacyUrl = `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/v${version}/${legacyAssetName}`;
                core.warning(`Fallo descarga de asset primario (${primaryAssetName}). Intentando fallback legacy: ${legacyUrl}`);
                archivePath = await this.downloadArchive(legacyUrl);
                downloadedAssetName = legacyAssetName;
            } else {
                throw error;
            }
        }

        if (shouldVerifyChecksum(verifyChecksum)) {
            await this.verifyArchiveChecksum(version, downloadedAssetName, archivePath, token);
        } else {
            core.warning('Verificación de integridad SHA-256 omitida (verify-checksum=false).');
        }

        core.info('Extrayendo archivo...');
        const extractedRoot = await this.strategy.extract(archivePath);

        const candidates = [
            extractedRoot,
            path.join(extractedRoot, `${prefix}-${version}-${this.strategy.slug}`),
            ...(this.strategy.legacyTarget ? [path.join(extractedRoot, `${prefix}-${version}-${this.strategy.legacyTarget}`)] : []),
            path.join(extractedRoot, `cutver-${version}-${this.strategy.slug}`)
        ];

        let finalBinaryDir = extractedRoot;
        for (const candidate of candidates) {
            try {
                const stats = await fs.stat(path.join(candidate, this.strategy.binaryFileName));
                if (stats.isFile()) {
                    finalBinaryDir = candidate;
                    break;
                }
            } catch {
                // Ignore missing file check and proceed to next candidate
            }
        }

        const fullBinaryPath = path.join(finalBinaryDir, this.strategy.binaryFileName);
        await this.strategy.preparePermissions(fullBinaryPath);

        let toolDirectory = finalBinaryDir;
        if (useCache) {
            core.info('Almacenando en tool-cache del runner...');
            toolDirectory = await tc.cacheDir(finalBinaryDir, toolName, version, this.strategy.slug);
        }

        return { path: toolDirectory, version };
    }

    /**
     * Descarga un asset del release al disco y devuelve su ruta.
     *
     * Existe como método propio para que las pruebas puedan sustituirlo en la
     * instancia; en producción siempre delega en `tc.downloadTool`.
     */
    private async downloadArchive(url: string): Promise<string> {
        return await tc.downloadTool(url);
    }

    /**
     * Verifica el archivo descargado contra el `SHA256SUMS` del mismo release.
     *
     * Falla cerrado: si el release no publica el archivo de sumas, si el archivo no
     * lista el asset descargado o si el digest no coincide, lanza un error y la
     * extracción nunca ocurre.
     */
    private async verifyArchiveChecksum(version: string, assetName: string, archivePath: string, token?: string): Promise<void> {
        const checksumUrl = `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/v${version}/${CHECKSUM_ASSET_NAME}`;
        const headers: Record<string, string> = {
            'User-Agent': 'setup-cutver-action'
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        core.info(`Descargando sumas de verificación desde: ${checksumUrl}`);
        const response = await fetch(checksumUrl, { headers });
        if (!response.ok) {
            throw new Error(missingChecksumFileMessage(version, checksumUrl));
        }

        const expectedChecksum = findExpectedChecksum(await response.text(), assetName);
        if (!expectedChecksum) {
            throw new Error(missingChecksumEntryMessage(version, assetName));
        }

        core.info(`Calculando SHA-256 de ${assetName}...`);
        const actualChecksum = await computeFileSha256(archivePath);
        if (!sha256Matches(expectedChecksum, actualChecksum)) {
            throw new Error(mismatchedChecksumMessage(assetName, expectedChecksum, actualChecksum));
        }

        core.info(`SHA-256 verificado para ${assetName}: ${expectedChecksum}`);
    }
}

/** Calcula el SHA-256 de un archivo sin cargarlo completo en memoria. */
async function computeFileSha256(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    await pipeline(createReadStream(filePath), hash);
    return hash.digest('hex');
}
