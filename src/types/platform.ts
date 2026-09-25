export interface IPlatformStrategy {
    readonly target: string;
    readonly archiveExt: 'tar.gz' | 'zip';
    readonly binaryFileName: string;

    getAssetFileName(version: string): string;
    extract(archivePath: string): Promise<string>;
    preparePermissions(binaryPath: string): Promise<void>;
}