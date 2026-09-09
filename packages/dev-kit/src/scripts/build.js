/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import { build } from 'vite';
import esbuild from 'esbuild';
import colors from 'picocolors';
import checkFiles from '../helpers/checkFiles.js';
import { loadViteConfig } from '../vite.config.js';
import { getEsbuildOptions, writeDistFiles } from '../helpers/esbuild.js';
import { packageJson, projectRootPath, getDevKitConfig } from '../helpers/project.js';

const { log, error } = console;
const devKitConfig = getDevKitConfig();
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);
const distPath = path.join(projectRootPath, devKitConfig.distPath);

/**
 * Runs `build` CLI command's script.
 */
async function run() {
  process.env.ENV = 'production';
  process.env.NODE_ENV = 'production';
  process.stdout.write('\x1Bc');
  if (!process.argv.includes('--force')) {
    await checkFiles(false, false);
  }
  log(colors.magenta(colors.bold('Building...\n')));
  try {
    if (devKitConfig.target === 'web') {
      // Front-end projects: Vite bundles from a root `index.html`.
      const indexHtmlPath = path.join(projectRootPath, 'index.html');
      const buildPath = path.join(projectRootPath, '__dist__');
      await fs.promises.copyFile(path.resolve(srcPath, devKitConfig.html), indexHtmlPath);
      try {
        await build(await loadViteConfig('build', 'production'));
        await fs.promises.rm(distPath, { recursive: true, force: true });
        await fs.promises.rename(buildPath, distPath);
      } finally {
        await fs.promises.rm(indexHtmlPath, { force: true });
        await fs.promises.rm(buildPath, { recursive: true, force: true });
      }
    } else {
      // Back-end/NPM package projects: esbuild.
      const startTimestamp = Date.now();
      const result = await esbuild.build(await getEsbuildOptions(true));
      log(await esbuild.analyzeMetafile(result.metafile));
      writeDistFiles(packageJson.version);
      log(colors.green(`${colors.bold('\n[esbuild]: ')}Successfully built in ${Date.now() - startTimestamp}ms (${result.errors.length} errors, ${result.warnings.length} warnings).\n`));
    }
  } catch (e) {
    error(colors.red(colors.bold('\n✖ Build failed.\n')));
    // Vite wraps bundling errors into a `BundleError`.
    (e.errors ?? [e]).forEach((err) => error(colors.red(err.message ?? err)));
    process.exit(1);
  }
}

run();
