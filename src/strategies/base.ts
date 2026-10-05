import * as fs from 'node:fs/promises';
import type { IPlatformStrategy } from '../types/platform';

export abstract class BasePlatformStrategy implements IPlatformStrategy {
    abstract readonly slug: string;
    abstract readonly legacyTarget?: string | undefined;
    abstract readonly archiveExt: 'tar.gz' | 'zip';
    abstract readonly binaryFileName: string;

    get target(): string {
        return this.slug;
    }

    getAssetFileName(version: string, useLegacy = false): string {
        const identifier = useLegacy && this.legacyTarget ? this.legacyTarget : this.slug;
        return `cutver-${version}-${identifier}.${this.archiveExt}`;
    }

    abstract extract(archivePath: string): Promise<string>;

    async preparePermissions(binaryPath: string): Promise<void> {
        try {
            await fs.chmod(binaryPath, 0o755);
        } catch {
        }
    }
}
