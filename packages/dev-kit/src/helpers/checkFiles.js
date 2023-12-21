/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import '../config/env.js';
import path from 'path';
import chokidar from 'chokidar';
import { ESLint } from 'eslint';
import colors from 'picocolors';
import { spawn } from 'child_process';

const { log, error } = console;

/**
 * Runs linter & type-checkers on source files.
 *
 * @param projectRootPath Absolute path to the project's root directory.
 *
 * @param packageJson Parsed `package.json`.
 *
 * @param srcPath Absolute path to the project's source directory.
 *
 * @param watchMode Wether to use watch mode.
 *
 * @param fixMode Wether to use fix mode.
 */
export default async function checkFiles(
  projectRootPath,
  packageJson,
  srcPath,
  watchMode,
  fixMode,
) {
  const runSvelteChecker = !!packageJson.dependencies?.svelte || !!packageJson.peerDependencies?.svelte;
  const tsConfigFilePath = path.join(projectRootPath, 'tsconfig.json');
  const cliArguments = watchMode ? ['--watch'] : [];

  // Running ESlint...
  const cacheLocation = path.join(projectRootPath, 'node_modules/.eslintcache');
  const eslint = new ESLint({ cache: true, cacheLocation, fix: fixMode });

  const lint = async () => {
    process.stdout.write('\x1Bc');
    log(colors.magenta(colors.bold('Checking files...')));
    const result = await eslint.lintFiles(srcPath);
    const formatter = await eslint.loadFormatter('stylish');
    const output = await formatter.format(result);
    const totalErrors = result.reduce((errors, file) => errors + file.errorCount, 0);
    log(output);

    // Depending on the mode, we want the command either to be blocking and stop the whole process
    // on errors, or to be non-blocking and keep running on errors.
    if (!watchMode && totalErrors > 0) {
      process.exit(1);
    }
  };

  if (packageJson.eslintConfig !== undefined) {
    await lint();
    if (watchMode) {
      const patterns = ['js', 'jsx', 'ts', 'tsx', 'svelte', 'vue'].map((extension) => `${srcPath}/**/*.${extension}`);
      const watcher = chokidar.watch(patterns, { ignoreInitial: true });
      watcher.on('add', lint);
      watcher.on('change', lint);
      watcher.on('unlink', lint);
      watcher.on('addDir', lint);
      watcher.on('unlinkDir', lint);
    }
  }

  // Running TypeScript type-checker...
  const tscPromise = new Promise((resolve) => {
    const typeChecker = spawn(path.join(projectRootPath, 'node_modules/typescript/bin/tsc'), cliArguments.concat(['--project', tsConfigFilePath]));
    typeChecker.stdout.on('data', (data) => {
      // Prevents `tsc` from automatically clearing terminal.
      const message = data.toString().trim().replace('\x1Bc', '');
      if (message !== '') {
        log(colors[(/error TS/.test(message)) ? 'red' : 'cyan'](`${colors.bold('[tsc]:\n') + message}\n`));
      }
    });
    typeChecker.stderr.on('data', (data) => {
      error(colors.red(colors.bold('✖ [tsc]:\n')));
      error(colors.red(`${data.toString().trim()}\n`));
    });
    typeChecker.on('error', (...args) => {
      error(colors.red(colors.bold('✖ [tsc]:\n')));
      error(colors.red(args[0]));
      error('');
    });

    // Depending on the mode, we want the command either to be blocking and stop the whole process
    // on errors, or to be non-blocking and keep running on errors.
    if (watchMode) {
      resolve();
    } else {
      typeChecker.on('exit', (code) => {
        if (code !== 0) {
          process.exit(1);
        }
        resolve();
      });
    }
  });

  // Running svelte type-checker if necessary...
  const svelteCheckPromise = (!runSvelteChecker)
    ? Promise.resolve()
    : new Promise((resolve) => {
      const svelteChecker = spawn(
        path.join(projectRootPath, 'node_modules/svelte-check/bin/svelte-check'),
        cliArguments.concat([
          '--workspace',
          srcPath,
          '--tsconfig',
          path.join(projectRootPath, 'tsconfig.json'),
        ]),
      );
      svelteChecker.stdout.on('data', (data) => {
        const message = data.toString().trim();
        if (message !== '') {
          let color = 'blue';
          if (/Error:/.test(message)) {
            color = 'red';
          } else if (/Hint:/.test(message)) {
            color = 'yellow';
          }
          log(colors[color](`${colors.bold('[svelte-check]:\n') + message}\n`));
        }
      });
      svelteChecker.stderr.on('data', (data) => {
        error(colors.red(colors.bold('✖ [svelte-check]:\n')));
        error(colors.red(`${data.toString().trim()}\n`));
      });
      svelteChecker.on('error', (...args) => {
        error(colors.red(colors.bold('✖ [svelte-check]:\n')));
        error(colors.red(args[0]));
        error('');
      });

      // Depending on the mode, we want the command either to be blocking and stop the whole process
      // on errors, or to be non-blocking and keep running on errors.
      if (watchMode) {
        resolve();
      } else {
        svelteChecker.on('exit', (code) => {
          if (code !== 0) {
            process.exit(1);
          }
          resolve();
        });
      }
    });

  await Promise.all([tscPromise, svelteCheckPromise]);
}
