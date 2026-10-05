import * as tc from '@actions/tool-cache';
import { BasePlatformStrategy } from './base';

export class LinuxStrategy extends BasePlatformStrategy {
    readonly slug: string;
    readonly legacyTarget?: string | undefined;
    readonly archiveExt = 'tar.gz' as const;
    readonly binaryFileName = 'cutver';

    constructor(arch: string) {
        super();
        this.slug = arch === 'arm64' ? 'linux-arm64' : 'linux-x86_64';
        this.legacyTarget = arch === 'x64' ? 'x86_64-unknown-linux-gnu' : undefined;
    }

    async extract(archivePath: string): Promise<string> {
        return await tc.extractTar(archivePath);
    }
}
