import * as tc from '@actions/tool-cache';
import { BasePlatformStrategy } from './base'

export class LinuxStrategy extends BasePlatformStrategy {
    readonly target = 'x86_64-unknown-linux-gnu';
    readonly archiveExt = 'tar.gz' as const;
    readonly binaryFileName = 'cutver';

    async extract(archivePath: string): Promise<string> {
        return await tc.extractTar(archivePath);
    }
}