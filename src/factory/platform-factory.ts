import * as os from 'node:os';
import type { IPlatformStrategy } from '../types/platform';
import { parseLibcPreference, readProcessMaps, resolveLibc } from '#services/libc';
import { LinuxStrategy } from '#strategies/linux';
import { MacStrategy } from '#strategies/macos';
import { WindowsStrategy } from '#strategies/windows';

/** Orígenes de plataforma y arquitectura, sustituibles en las pruebas. */
export interface PlatformFactoryDeps {
    readonly platform?: string;
    readonly arch?: string;
    readonly probe?: () => Promise<string | undefined>;
}

export class PlatformFactory {
    /**
     * Crea la estrategia de la plataforma del runner.
     *
     * `libcPreference` solo tiene efecto en Linux, donde elige entre el binario
     * glibc y el musl; en el resto de las plataformas se valida y se ignora.
     */
    static async create(libcPreference = 'auto', deps: PlatformFactoryDeps = {}): Promise<IPlatformStrategy> {
        const platform = deps.platform ?? os.platform();
        const arch = deps.arch ?? os.arch();
        const preference = parseLibcPreference(libcPreference);

        switch (platform) {
            case 'linux': {
                if (arch !== 'x64' && arch !== 'arm64') {
                    throw new Error(`Arquitectura Linux no soportada: ${arch}. Solo x64 y arm64 están disponibles.`);
                }
                const libc = await resolveLibc(preference, deps.probe ?? readProcessMaps);
                return new LinuxStrategy(arch, libc);
            }

            case 'darwin':
                if (arch !== 'x64' && arch !== 'arm64') {
                    throw new Error(`Arquitectura macOS no soportada: ${arch}. Solo x64 y arm64 están disponibles.`);
                }
                return new MacStrategy(arch);

            case 'win32':
                if (arch !== 'x64' && arch !== 'arm64') {
                    throw new Error(`Arquitectura Windows no soportada: ${arch}. Solo x64 y arm64 están disponibles.`);
                }
                return new WindowsStrategy(arch);

            default:
                throw new Error(`Sistema operativo no soportado: ${platform}`);
        }
    }
}
