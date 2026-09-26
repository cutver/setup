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

    async resolveLatestVersion(token?: string): Promise<string> {
        const headers: Record<string, string> = {
            'User-Agent': 'setup-cutver-action'
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const response = await fetch(
            `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`,
            { headers }
        );

        if (!response.ok) {
            throw new Error(`Fallo al consultar último release en GitHub API: ${response.statusText}`);
        }

        const data = (await response.json()) as { tag_name: string };
        return data.tag_name.replace(/^v/, '');
    }

    async install(requestedVersion: string, token?: string): Promise<{ path: string; version: string }> {
        const version = requestedVersion.toLowerCase() === 'latest'
            ? await this.resolveLatestVersion(token)
            : requestedVersion.replace(/^v/, '');

        core.info(`Versión resuelta de cutver: v${version}`);

        let toolDirectory = tc.find('cutver', version, this.strategy.target);

        if (toolDirectory) {
            core.info(`cutver v${version} encontrado en tool-cache local.`);
            return { path: toolDirectory, version };
        }

        const assetName = this.strategy.getAssetFileName(version);
        const downloadUrl = `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/v${version}/${assetName}`;

        core.info(`Descargando binario desde: ${downloadUrl}`);
        const archivePath = await tc.downloadTool(downloadUrl);

        core.info('Extrayendo archivo...');
        const extractedRoot = await this.strategy.extract(archivePath);

        const archiveBaseName = `cutver-${version}-${this.strategy.target}`;
        const nestedFolder = path.join(extractedRoot, archiveBaseName);
        let finalBinaryDir = extractedRoot;

        try {
            const stats = await fs.stat(nestedFolder);
            if (stats.isDirectory()) {
                finalBinaryDir = nestedFolder;
            }
        } catch {
        }

        const fullBinaryPath = path.join(finalBinaryDir, this.strategy.binaryFileName);
        await this.strategy.preparePermissions(fullBinaryPath);

        core.info('Almacenando en tool-cache del runner...');
        toolDirectory = await tc.cacheDir(finalBinaryDir, 'cutver', version, this.strategy.target);

        return { path: toolDirectory, version };
    }
}