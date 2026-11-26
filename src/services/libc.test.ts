import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PlatformFactory } from '#factory/platform-factory';
import { detectLibcFromMaps, linuxSlug, parseLibcPreference, resolveLibc } from '#services/libc';
import { LinuxStrategy } from '#strategies/linux';

/** Un `/proc/self/maps` real de un runner glibc: el loader es `ld-linux`. */
const GLIBC_MAPS = [
    '5612b5c1d000-5612b5c42000 r--p 00000000 08:01 1234567 /usr/bin/node',
    '7f1b2c000000-7f1b2c028000 r--p 00000000 08:01 7654321 /usr/lib/x86_64-linux-gnu/libc.so.6',
    '7f1b2c028000-7f1b2c02a000 r-xp 00000000 08:01 7654322 /lib64/ld-linux-x86-64.so.2',
    ''
].join('\n');

/** Un `/proc/self/maps` de un runner musl: el loader es `ld-musl`. */
const MUSL_MAPS = [
    '55d0c2f00000-55d0c2f12000 r--p 00000000 00:00 0 /usr/bin/node',
    '7f3e1a200000-7f3e1a228000 r--p 00000000 00:00 0 /lib/ld-musl-x86_64.so.1',
    ''
].join('\n');

describe('detectLibcFromMaps', () => {
    it('reconoce glibc cuando el proceso mapea el loader de glibc', () => {
        assert.equal(detectLibcFromMaps(GLIBC_MAPS), 'gnu');
    });

    it('reconoce musl cuando el proceso mapea ld-musl en x86_64', () => {
        assert.equal(detectLibcFromMaps(MUSL_MAPS), 'musl');
    });

    it('reconoce musl cuando el proceso mapea ld-musl en arm64', () => {
        const maps = '7f3e1a200000-7f3e1a228000 r--p 00000000 00:00 0 /lib/ld-musl-aarch64.so.1\n';

        assert.equal(detectLibcFromMaps(maps), 'musl');
    });

    it('no confunde una toolchain musl instalada en un host glibc con un proceso musl', () => {
        const maps = [
            GLIBC_MAPS,
            '7f1b2c030000-7f1b2c032000 r-xp 00000000 08:01 9000001 /usr/lib/x86_64-linux-musl/libc.so',
            ''
        ].join('\n');

        assert.equal(detectLibcFromMaps(maps), 'gnu');
    });

    it('sin evidencia de musl responde glibc, que es el comportamiento previo a este cambio', () => {
        assert.equal(detectLibcFromMaps(undefined), 'gnu');
        assert.equal(detectLibcFromMaps(''), 'gnu');
    });
});

describe('parseLibcPreference', () => {
    it('trata ausente, vacío y "auto" como detección automática', () => {
        assert.equal(parseLibcPreference(''), 'auto');
        assert.equal(parseLibcPreference('   '), 'auto');
        assert.equal(parseLibcPreference('auto'), 'auto');
    });

    it('acepta los valores explícitos sin distinguir mayúsculas ni espacios', () => {
        assert.equal(parseLibcPreference(' musl '), 'musl');
        assert.equal(parseLibcPreference('MUSL'), 'musl');
        assert.equal(parseLibcPreference('Gnu'), 'gnu');
    });

    it('falla ante un valor desconocido nombrando los admitidos', () => {
        assert.throws(() => parseLibcPreference('glibc'), /glibc.*auto, gnu, musl/s);
    });
});

describe('resolveLibc', () => {
    it('un valor explícito gana y nunca consulta /proc', async () => {
        let probed = false;
        const libc = await resolveLibc('musl', async () => {
            probed = true;
            return GLIBC_MAPS;
        });

        assert.equal(libc, 'musl');
        assert.equal(probed, false);
    });

    it('en automático responde según el loader del proceso', async () => {
        assert.equal(await resolveLibc('auto', async () => MUSL_MAPS), 'musl');
        assert.equal(await resolveLibc('auto', async () => GLIBC_MAPS), 'gnu');
    });

    it('si /proc no se puede leer, cae en glibc en lugar de romper la instalación', async () => {
        assert.equal(await resolveLibc('auto', async () => undefined), 'gnu');
        assert.equal(await resolveLibc('auto', async () => {
            throw new Error('ENOENT: /proc/self/maps');
        }), 'gnu');
    });
});

describe('linuxSlug', () => {
    it('conserva los slugs históricos de glibc', () => {
        assert.equal(linuxSlug('x64', 'gnu'), 'linux-x86_64');
        assert.equal(linuxSlug('arm64', 'gnu'), 'linux-arm64');
    });

    it('nombra los slugs musl que cutver publica', () => {
        assert.equal(linuxSlug('x64', 'musl'), 'linux-musl-x86_64');
        assert.equal(linuxSlug('arm64', 'musl'), 'linux-musl-arm64');
    });
});

describe('LinuxStrategy con musl', () => {
    it('arma el asset primario con el slug musl', () => {
        const strategy = new LinuxStrategy('x64', 'musl');

        assert.equal(strategy.slug, 'linux-musl-x86_64');
        assert.equal(strategy.getAssetFileName('0.22.0-alpha.1'), 'cutver-0.22.0-alpha.1-linux-musl-x86_64.tar.gz');
    });

    it('arma el asset de la variante plugins con el slug musl', () => {
        const strategy = new LinuxStrategy('arm64', 'musl');

        assert.equal(strategy.getAssetFileName('0.22.0-alpha.1', false, true), 'cutver-plugins-0.22.0-alpha.1-linux-musl-arm64.tar.gz');
    });

    it('no ofrece fallback legacy en musl: cutver nunca publicó un triple musl', () => {
        const strategy = new LinuxStrategy('x64', 'musl');

        assert.equal(strategy.legacyTarget, undefined);
        assert.equal(strategy.getAssetFileName('0.22.0-alpha.1', true), 'cutver-0.22.0-alpha.1-linux-musl-x86_64.tar.gz');
    });

    it('mantiene el fallback legacy en glibc x86_64, como antes del cambio', () => {
        const strategy = new LinuxStrategy('x64', 'gnu');

        assert.equal(strategy.legacyTarget, 'x86_64-unknown-linux-gnu');
        assert.equal(strategy.getAssetFileName('0.22.0-alpha.1', true), 'cutver-0.22.0-alpha.1-x86_64-unknown-linux-gnu.tar.gz');
    });

    it('sin argumento de libc sigue comportándose como glibc', () => {
        assert.equal(new LinuxStrategy('x64').slug, 'linux-x86_64');
    });
});

describe('PlatformFactory y libc', () => {
    it('en Linux respeta el valor explícito de libc', async () => {
        const strategy = await PlatformFactory.create('musl', { platform: 'linux', arch: 'arm64' });

        assert.equal(strategy.slug, 'linux-musl-arm64');
    });

    it('en Linux en automático usa el loader detectado', async () => {
        const strategy = await PlatformFactory.create('auto', {
            platform: 'linux',
            arch: 'x64',
            probe: async () => MUSL_MAPS
        });

        assert.equal(strategy.slug, 'linux-musl-x86_64');
    });

    it('en Linux en automático sobre glibc no cambia nada', async () => {
        const strategy = await PlatformFactory.create('auto', {
            platform: 'linux',
            arch: 'x64',
            probe: async () => GLIBC_MAPS
        });

        assert.equal(strategy.slug, 'linux-x86_64');
    });

    it('fuera de Linux el input no altera la plataforma', async () => {
        const mac = await PlatformFactory.create('musl', { platform: 'darwin', arch: 'arm64' });
        const win = await PlatformFactory.create('musl', { platform: 'win32', arch: 'x64' });

        assert.equal(mac.slug, 'macos-arm64');
        assert.equal(win.slug, 'windows-x86_64');
    });
});
