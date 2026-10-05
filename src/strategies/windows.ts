import * as tc from '@actions/tool-cache';
import { BasePlatformStrategy } from './base';

export class WindowsStrategy extends BasePlatformStrategy {
    readonly slug: string;
    readonly legacyTarget?: string | undefined;
    readonly archiveExt = 'zip' as const;
    readonly binaryFileName = 'cutver.exe';

    constructor(arch: string) {
        super();
        this.slug = arch === 'arm64' ? 'windows-arm64' : 'windows-x86_64';
        this.legacyTarget = arch === 'x64' ? 'x86_64-pc-windows-msvc' : undefined;
    }

    async extract(archivePath: string): Promise<string> {
        return await tc.extractZip(archivePath);
    }

    override async preparePermissions(_binaryPath: string): Promise<void> {
        return Promise.resolve();
    }
}
