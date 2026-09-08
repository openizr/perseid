/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import '../config/env.js';
import fs from 'fs';
import path from 'path';
import { ESLint } from 'eslint';
import colors from 'picocolors';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { resolveBin } from './paths.js';

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

  // Checks are opt-in: no `eslint.config.*` means no linting, no `tsconfig.json` means no type-checking.
  const hasEslintConfig = fs.readdirSync(projectRootPath).some((file) => /^eslint\.config\.[cm]?[jt]s$/.test(file));
  const hasTsConfig = fs.existsSync(tsConfigFilePath);

  // Running ESlint...
  // ESLint's cache ignores tsconfig changes, so they are part of the cache name.
  const tsConfigHash = createHash('sha256').update(hasTsConfig ? fs.readFileSync(tsConfigFilePath) : '').digest('hex').slice(0, 8);
  const cacheLocation = path.join(projectRootPath, `node_modules/.eslintcache-${tsConfigHash}`);
  const eslint = new ESLint({
    cache: true,
    cacheLocation,
    fix: fixMode,
    cwd: projectRootPath,
  });

  const lint = async () => {
    process.stdout.write('\x1Bc');
    log(colors.magenta(colors.bold('Checking files...')));
    const result = await eslint.lintFiles(srcPath);
    if (fixMode) {
      await ESLint.outputFixes(result);
    }
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

  if (hasEslintConfig) {
    await lint();
    if (watchMode) {
      // Events come in bursts (editors write several times), hence the debounce.
      let timeout = null;
      fs.watch(srcPath, { recursive: true }, (_event, filename) => {
        if (filename === null || /\.(js|jsx|ts|tsx|svelte|vue)$/.test(filename)) {
          clearTimeout(timeout);
          timeout = setTimeout(lint, 100);
        }
      });
    }
  }

  // Running TypeScript type-checker with native TypeScript 7. typescript-eslint still needs the
  // TypeScript 6 JS API (none in 7.0): revisit dropping `typescript@6` once TypeScript 7.1 ships it.
  const tscPromise = (!hasTsConfig) ? Promise.resolve() : new Promise((resolve) => {
    const typeChecker = spawn(process.execPath, [resolveBin('typescript-native', 'tsc')].concat(cliArguments, ['--project', tsConfigFilePath]));
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
  const svelteCheckPromise = (!runSvelteChecker || !hasTsConfig)
    ? Promise.resolve()
    : new Promise((resolve) => {
      const svelteChecker = spawn(
        process.execPath,
        [resolveBin('svelte-check')].concat(cliArguments, [
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
