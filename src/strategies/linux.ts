import * as tc from '@actions/tool-cache';
import { linuxSlug, type Libc } from '#services/libc';
import { BasePlatformStrategy } from '#strategies/base';

export class LinuxStrategy extends BasePlatformStrategy {
    readonly slug: string;
    readonly legacyTarget?: string | undefined;
    readonly archiveExt = 'tar.gz' as const;
    readonly binaryFileName = 'cutver';

    constructor(arch: string, libc: Libc = 'gnu') {
        super();
        this.slug = linuxSlug(arch, libc);
        // El fallback legacy solo tiene sentido en glibc x86_64: cutver nunca
        // publicó un asset con triple musl, así que ofrecerlo solo agrega un 404
        // que enmascara el error real.
        this.legacyTarget = libc === 'gnu' && arch === 'x64' ? 'x86_64-unknown-linux-gnu' : undefined;
    }

    async extract(archivePath: string): Promise<string> {
        return await tc.extractTar(archivePath);
    }
}
