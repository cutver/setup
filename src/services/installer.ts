import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { IPlatformStrategy } from '../types/platform';

export class CutverInstaller {
    constructor(
        private readonly repoOwner: string,
        private readonly repoName: string,
        private readonly strategy: IPlatformStrategy
    ) { }

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

    async install(requestedVersion: string, token?: string, useCache = true): Promise<{ path: string; version: string }> {
        const rawNormalized = requestedVersion.trim().replace(/^v/i, '');
        const version = !rawNormalized || rawNormalized.toLowerCase() === 'latest'
            ? await this.resolveLatestVersion(token, !useCache)
            : rawNormalized;

        core.info(`Versión resuelta de cutver: v${version}`);

        if (useCache) {
            let toolDirectory = tc.find('cutver', version, this.strategy.slug);
            if (!toolDirectory && this.strategy.legacyTarget) {
                toolDirectory = tc.find('cutver', version, this.strategy.legacyTarget);
            }

            if (toolDirectory) {
                core.info(`cutver v${version} encontrado en tool-cache local.`);
                return { path: toolDirectory, version };
            }
        } else {
            core.info('Bypassing local tool-cache due to cache=false.');
        }

        const primaryAssetName = this.strategy.getAssetFileName(version, false);
        const primaryUrl = `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/v${version}/${primaryAssetName}`;

        let archivePath: string;
        try {
            core.info(`Descargando binario desde: ${primaryUrl}`);
            archivePath = await tc.downloadTool(primaryUrl);
        } catch (error) {
            if (this.strategy.legacyTarget) {
                const legacyAssetName = this.strategy.getAssetFileName(version, true);
                const legacyUrl = `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/v${version}/${legacyAssetName}`;
                core.warning(`Fallo descarga de asset primario (${primaryAssetName}). Intentando fallback legacy: ${legacyUrl}`);
                archivePath = await tc.downloadTool(legacyUrl);
            } else {
                throw error;
            }
        }

        core.info('Extrayendo archivo...');
        const extractedRoot = await this.strategy.extract(archivePath);

        const candidates = [
            extractedRoot,
            path.join(extractedRoot, `cutver-${version}-${this.strategy.slug}`),
            ...(this.strategy.legacyTarget ? [path.join(extractedRoot, `cutver-${version}-${this.strategy.legacyTarget}`)] : [])
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
            toolDirectory = await tc.cacheDir(finalBinaryDir, 'cutver', version, this.strategy.slug);
        }

        return { path: toolDirectory, version };
    }
}
