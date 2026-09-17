/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import colors from 'picocolors';
import { spawn } from 'child_process';
import { loadViteConfig } from '../vite.config.js';
import { getEsbuildOptions, writeDistFiles } from '../helpers/esbuild.js';
import { send, createServer, createLogger, version } from 'vite';
import { packageJson, projectRootPath, getDevKitConfig } from '../helpers/project.js';

const { log, error } = console;
const devKitConfig = getDevKitConfig();
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);
const distPath = path.join(projectRootPath, devKitConfig.distPath);

/** Serves the project's `index.html` for any page navigation. Post hooks run right before Vite's html middlewares. */
const indexHtmlPlugin = {
  name: 'dev-kit:index-html',
  configureServer(server) {
    return () => server.middlewares.use(async (request, response, next) => {
      const isNavigation = (
        request.headers['sec-fetch-dest'] === 'document'
        || /text\/html/.test(request.headers.accept ?? '')
      );
      if (response.writableEnded || request.method !== 'GET' || !isNavigation) {
        return next();
      }
      try {
        const html = await fs.promises.readFile(path.join(srcPath, devKitConfig.html), 'utf-8');
        return send(request, response, await server.transformIndexHtml(
          request.url,
          html,
          request.originalUrl,
        ), 'html', { headers: server.config.server.headers });
      } catch (e) {
        return next(e);
      }
    });
  },
};

/** Restarts the built entry on each rebuild (e.g. a Node server). */
let nodeProcess = null;
const runMainEntry = (main) => {
  const previous = nodeProcess;
  if (previous !== null && previous.exitCode === null && previous.signalCode === null) {
    // Ports may still be held: the restart waits for the exit.
    previous.removeAllListeners('exit').once('exit', () => runMainEntry(main));
    previous.kill();
    setTimeout(() => previous.kill('SIGKILL'), 2000).unref();
    return;
  }
  nodeProcess = spawn(process.execPath, ['--enable-source-maps', path.join(distPath, main)], { stdio: 'inherit' });
  nodeProcess.on('error', (err) => error(colors.red(colors.bold('✖ Could not run main entry:\n')), err, ''));
};
// Stdio is inherited: the main entry would outlive this script.
process.on('exit', () => nodeProcess?.kill());
['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => process.exit()));

process.env.ENV ??= 'development';
process.env.NODE_ENV ??= 'development';

if (devKitConfig.target === 'web') {
  try {
    const config = await loadViteConfig('serve', 'development');
    const server = await createServer({ ...config, plugins: [...(config.plugins ?? []), indexHtmlPlugin] });
    await server.listen();
    server.config.logger.info(colors.cyan(`\n  vite v${version}`) + colors.green(' dev server running at:\n'), { clear: !server.config.logger.hasWarned });
    server.printUrls();
    server.config.logger.info('');
  } catch (e) {
    createLogger().error(colors.red(`error when starting dev server:\n${e.stack}`), { error: e });
    process.exit(1);
  }
} else {
  let startTimestamp = 0;
  const devKitPlugin = {
    name: 'dev-kit',
    setup(build) {
      build.onStart(() => {
        process.stdout.write('\x1Bc');
        startTimestamp = Date.now();
      });
      build.onEnd((result) => {
        if (result.errors.length === 0) {
          log(colors.green(`${colors.bold('[esbuild]: ')}Successfully built in ${Date.now() - startTimestamp}ms (${result.errors.length} errors, ${result.warnings.length} warnings).\n`));
          // A new version on each build invalidates package managers' caches (real-time package testing).
          writeDistFiles(`0.0.${Date.now()}`);
          if (devKitConfig.runInDev === true) {
            runMainEntry(packageJson.main);
          }
        }
      });
    },
  };
  await (await esbuild.context(await getEsbuildOptions(false, [devKitPlugin]))).watch();
}
