import * as tc from '@actions/tool-cache';
import { BasePlatformStrategy } from './base';

export class WindowsStrategy extends BasePlatformStrategy {
    readonly target = 'x86_64-pc-windows-msvc';
    readonly archiveExt = 'zip' as const;
    readonly binaryFileName = 'cutver.exe';

    async extract(archivePath: string): Promise<string> {
        return await tc.extractZip(archivePath);
    }

    override async preparePermissions(_binaryPath: string): Promise<void> {
        return Promise.resolve();
    }
}