import * as os from 'node:os';
import type { IPlatformStrategy } from '../types/platform';
import { LinuxStrategy } from '../strategies/linux';
import { MacStrategy } from '../strategies/macos';
import { WindowsStrategy } from '../strategies/windows';

export class PlatformFactory {
    static create(): IPlatformStrategy {
        const platform = os.platform();
        const arch = os.arch();

        switch (platform) {
            case 'linux':
                if (arch !== 'x64') {
                    throw new Error(`Arquitectura Linux no soportada: ${arch}. Solo x64 está disponible.`);
                }
                return new LinuxStrategy();

            case 'darwin':
                if (arch !== 'x64' && arch !== 'arm64') {
                    throw new Error(`Arquitectura macOS no soportada: ${arch}.`);
                }
                return new MacStrategy(arch);

            case 'win32':
                if (arch !== 'x64') {
                    throw new Error(`Arquitectura Windows no soportada: ${arch}. Solo x64 está disponible.`);
                }
                return new WindowsStrategy();

            default:
                throw new Error(`Sistema operativo no soportado: ${platform}`);
        }
    }
}