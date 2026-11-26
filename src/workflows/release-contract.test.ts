import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * Contrato de los workflows de release y CI.
 *
 * No hay runner que ejecute un workflow en las pruebas, así que lo que se puede
 * fijar acá es la forma de la que dependen las garantías: quién crea el release,
 * en qué orden corren las dos fases, y qué build del CLI se instala. Cada
 * aserción corresponde a un fallo que ya ocurrió de verdad o que el flujo hace
 * imposible por construcción.
 *
 * Las pruebas leen los archivos del repositorio tal como se publican.
 */

const ROOT = join(import.meta.dirname, '..', '..');

const read = (relativePath: string): string => readFileSync(join(ROOT, relativePath), 'utf8');

const releaseWorkflow = (): string => read('.github/workflows/release.yml');
const ciWorkflow = (): string => read('.github/workflows/ci.yml');
const cutverConfig = (): string => read('cutver.toml');

/** Devuelve la posición de `needle`, fallando con un mensaje que nombra lo que falta. */
function positionOf(haystack: string, needle: string): number {
    const index = haystack.indexOf(needle);
    assert.ok(index >= 0, `el workflow no contiene ${needle}`);
    return index;
}

/** Recorta el bloque de un paso o job desde su encabezado hasta el siguiente. */
function blockOf(document: string, header: string, nextHeader: RegExp): string {
    const rest = document.slice(positionOf(document, header));
    const match = nextHeader.exec(rest.slice(header.length));

    return match ? rest.slice(0, header.length + match.index) : rest;
}

describe('el release lo corta cutver, no la action deprecada', () => {
    it('no invoca cutver/release ni un segundo creador del release', () => {
        const workflow = releaseWorkflow();

        assert.doesNotMatch(workflow, /cutver\/release@/);
        assert.doesNotMatch(workflow, /softprops\/action-gh-release/);
        assert.doesNotMatch(workflow, /gh release create/);
    });

    it('solo promueve un release que ya existe, y únicamente después de publicarlo', () => {
        const workflow = releaseWorkflow();
        const step = blockOf(workflow, 'name: Promote the release', /\n      - /);

        const publish = positionOf(workflow, 'cutver publish --tag');
        const promote = positionOf(workflow, 'gh release edit');
        const guard = step.indexOf('gh release view "$TAG" --json isDraft');
        const edit = step.indexOf('gh release edit "$TAG"');

        assert.ok(publish < promote, 'la promoción del draft tiene que ir después de publicar');
        assert.ok(guard >= 0, 'la promoción tiene que verificar que el draft exista');
        assert.ok(guard < edit, 'el guard de existencia va antes del edit');
        assert.match(step, /--draft=false --prerelease=false --latest=true/);
    });
});

describe('las dos fases corren en orden sobre un CLI con plugins', () => {
    it('instala el build de plugins antes de restaurar, validar y cortar el release', () => {
        const workflow = releaseWorkflow();

        const install = positionOf(workflow, 'uses: ./');
        const restore = positionOf(workflow, 'cutver plugin restore');
        const doctor = positionOf(workflow, 'cutver doctor --check-changelog');
        const bump = positionOf(workflow, 'cutver bump "$BUMP"');
        const render = positionOf(workflow, 'cutver changelog latest --template');
        const publish = positionOf(workflow, 'cutver publish --tag');

        assert.match(workflow.slice(install, restore), /plugins: "true"/);
        assert.ok(install < restore, 'el CLI tiene que instalarse antes de restaurar plugins');
        assert.ok(restore < doctor, 'los plugins se restauran antes de validar la configuración');
        assert.ok(doctor < bump, 'la validación corre antes de cortar el release');
        assert.ok(bump < render, 'las notas se renderizan sobre el release ya cortado');
        assert.ok(render < publish, 'las notas tienen que existir antes de publicar');
    });

    it('difiere el tag y publica con las notas por stdin', () => {
        const workflow = releaseWorkflow();

        assert.match(workflow, /--defer-publish/);
        assert.match(workflow, /--notes-file -/);
    });

    it('escribe las notas fuera del workspace para no violar require_clean_tree', () => {
        const step = blockOf(releaseWorkflow(), 'name: Render release notes', /\n      - /);

        assert.match(step, /\$RUNNER_TEMP/);
        assert.doesNotMatch(step, />\s*RELEASE_NOTES\.md/);
    });

    it('no ofrece un canal que el CLI instalado no puede ejecutar', () => {
        const workflow = releaseWorkflow();
        const step = blockOf(workflow, 'name: Cut the release commit, or resume a pending one', /\n      - /);

        // La escalera de prereleases llega con cutver 0.22.0 y el CLI estable que la action
        // instala es 0.21.0: un input `channel` fallaría en cada uso, así que no se ofrece.
        assert.doesNotMatch(workflow, /\n      channel:/);
        assert.doesNotMatch(step, /--channel/);
        assert.match(step, /cutver bump "\$BUMP" --defer-publish/);
    });

    it('ofrece una ruta de recuperación que no vuelve a bumpear', () => {
        const step = blockOf(releaseWorkflow(), 'name: Cut the release commit, or resume a pending one', /\n      - /);

        // El bump diferido ya pusheó el commit de release: reintentar choca contra el push,
        // así que la única salida es retomar ese release por tag y commit.
        assert.match(step, /RESUME_TAG/);
        assert.match(step, /RESUME_COMMIT/);
        assert.match(step, /echo "released=true" >> "\$GITHUB_OUTPUT"/);
    });
});

describe('el gate de CI puede correr', () => {
    it('instala el build de plugins, restaura, y recién entonces valida', () => {
        const job = blockOf(ciWorkflow(), '  doctor:', /\n  [a-z-]+:\n/);
        const gate = blockOf(ciWorkflow(), 'name: Verify manifest and changelog sync', /\n      - /);

        assert.match(job, /uses: cutver\/setup@[0-9a-f]{40}/, 'la instalación va pinneada por commit');

        const install = job.indexOf('plugins: "true"');
        const restore = job.indexOf('cutver plugin restore');
        const doctor = job.indexOf('cutver doctor --check-changelog');

        assert.ok(install >= 0, 'el gate necesita el build de plugins o falla cerrado');
        assert.ok(restore >= 0, 'el driver lee su wasm del cache: hay que restaurarlo antes');
        assert.ok(install < restore && restore < doctor, 'restore tiene que ir antes de doctor');
        assert.match(gate, /GITHUB_TOKEN:/, 'el gate corre con el token que el plugin declara');
    });

    it('no corre el gate sobre un checkout que controla el PR', () => {
        const job = blockOf(ciWorkflow(), '  doctor:', /\n  [a-z-]+:\n/);

        // `cutver.toml` viaja en el PR y puede declarar un plugin con grant de GITHUB_TOKEN y
        // red arbitraria: correrlo con el token del repo entregaría el token al autor del PR.
        // Push y dispatch manual arrancan desde una ref confiable; un PR, nunca.
        assert.match(job, /if: github\.event_name != 'pull_request'/);
    });
});

describe('cutver.toml declara lo que el workflow asume', () => {
    it('mantiene los guardas de rama y de árbol limpio', () => {
        const config = cutverConfig();

        assert.match(config, /require_clean_tree = true/);
        assert.match(config, /require_branch = "main"/);
    });

    it('declara el plugin que crea el release como draft, con sus grants', () => {
        const config = cutverConfig();

        assert.match(config, /events = \["on_pre_bump", "on_post_release"\]/);
        assert.match(config, /env = \["GITHUB_TOKEN", "GITHUB_REPOSITORY"\]/);
        assert.match(config, /\ndraft = true/);
    });

    it('verifica el bundle que la action ejecuta antes de taggear', () => {
        assert.match(cutverConfig(), /glob = "dist\/index\.js"\s*\nat_least = 1/);
        assert.ok(existsSync(join(ROOT, 'dist/index.js')), 'dist/index.js tiene que estar commiteado');
    });
});
