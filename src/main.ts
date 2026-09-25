import * as core from '@actions/core';
import { PlatformFactory } from './factory/platform-factory';
import { CutverInstaller } from './services/installer';

async function run(): Promise<void> {
    try {
        const rawVersion = core.getInput('version') || 'latest';
        const token = core.getInput('github-token');

        const strategy = PlatformFactory.create();

        const installer = new CutverInstaller('Row0902', 'cutver', strategy);

        const installedPath = await installer.install(rawVersion, token);

        core.addPath(installedPath);
        core.setOutput('installed-version', rawVersion);

        core.info('cutver configurado con éxito en el runner.');
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
    }
}

run();