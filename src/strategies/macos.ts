import * as tc from '@actions/tool-cache';
import { BasePlatformStrategy } from './base';

export class MacStrategy extends BasePlatformStrategy {
    readonly target: string;
    readonly archiveExt = 'tar.gz' as const;
    readonly binaryFileName = 'cutver';

    constructor(arch: string) {
        super();
        this.target = arch === 'arm64'
            ? 'aarch64-apple-darwin'
            : 'x86_64-apple-darwin';
    }

    async extract(archivePath: string): Promise<string> {
        return await tc.extractTar(archivePath);
    }
}