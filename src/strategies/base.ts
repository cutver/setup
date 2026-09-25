import * as fs from 'node:fs/promises';
import type { IPlatformStrategy } from '../types/platform';

export abstract class BasePlatformStrategy implements IPlatformStrategy {
    abstract readonly target: string;
    abstract readonly archiveExt: 'tar.gz' | 'zip';
    abstract readonly binaryFileName: string;

    getAssetFileName(version: string): string {
        return `cutver-${version}-${this.target}.${this.archiveExt}`;
    }

    abstract extract(archivePath: string): Promise<string>;

    async preparePermissions(binaryPath: string): Promise<void> {
        try {
            await fs.chmod(binaryPath, 0o755);
        } catch {
        }
    }
}