export interface IPlatformStrategy {
    readonly slug: string;
    readonly legacyTarget?: string | undefined;
    readonly archiveExt: 'tar.gz' | 'zip';
    readonly binaryFileName: string;
    readonly target: string;

    getAssetFileName(version: string, useLegacy?: boolean): string;
    extract(archivePath: string): Promise<string>;
    preparePermissions(binaryPath: string): Promise<void>;
}
