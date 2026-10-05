import * as tc from '@actions/tool-cache';
import { BasePlatformStrategy } from './base';

export class MacStrategy extends BasePlatformStrategy {
    readonly slug: string;
    readonly legacyTarget?: string | undefined;
    readonly archiveExt = 'tar.gz' as const;
    readonly binaryFileName = 'cutver';

    constructor(arch: string) {
        super();
        this.slug = arch === 'arm64' ? 'macos-arm64' : 'macos-x86_64';
        this.legacyTarget = arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
    }

    async extract(archivePath: string): Promise<string> {
        return await tc.extractTar(archivePath);
    }
}
