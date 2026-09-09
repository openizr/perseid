/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import { ESLint } from 'eslint';
import colors from 'picocolors';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import {
  isInstalled,
  resolveBin,
  projectRootPath,
  getDevKitConfig,
  findProjectConfig,
} from './project.js';

const { log, error } = console;
const srcPath = path.join(projectRootPath, getDevKitConfig().srcPath);
const tsConfigPath = path.join(projectRootPath, 'tsconfig.json');

/**
 * Spawns a checker, prefixing its output. Blocking (exits on failure) unless in watch mode.
 *
 * @param name Checker's display name.
 *
 * @param args Node arguments (executable first).
 *
 * @param colorize Picks the color of a stdout message.
 *
 * @param watchMode Whether to keep running on errors.
 */
const runChecker = (name, args, colorize, watchMode) => new Promise((resolve) => {
  const checker = spawn(process.execPath, args);
  checker.stdout.on('data', (data) => {
    // Prevents checkers from clearing the terminal.
    const message = data.toString().trim().replace('\x1Bc', '');
    if (message !== '') {
      log(colors[colorize(message)](`${colors.bold(`[${name}]:\n`)}${message}\n`));
    }
  });
  checker.stderr.on('data', (data) => error(colors.red(`${colors.bold(`✖ [${name}]:\n`)}${data.toString().trim()}\n`)));
  checker.on('error', (err) => {
    error(colors.red(`${colors.bold(`✖ [${name}]:\n`)}${err}\n`));
    if (!watchMode) process.exit(1);
  });
  if (watchMode) {
    resolve();
  } else {
    checker.on('close', (code) => (code === 0 ? resolve() : process.exit(1)));
  }
});

/**
 * Runs linter & type-checkers on source files. Each check is opt-in: no `eslint.config.*` means
 * no linting, no `tsconfig.json` means no type-checking.
 *
 * @param watchMode Whether to keep running on changes and errors.
 *
 * @param fixMode Whether to apply ESLint fixes.
 */
export default async function checkFiles(watchMode, fixMode) {
  const hasEslintConfig = findProjectConfig('eslint') !== undefined;
  const hasTsConfig = fs.existsSync(tsConfigPath);
  const cliArguments = watchMode ? ['--watch'] : [];
  if (!hasEslintConfig) {
    log(colors.cyan('No eslint.config.js in this project: linting disabled.\n'));
  }
  if (!hasTsConfig) {
    log(colors.cyan('No tsconfig.json in this project: type-checking disabled.\n'));
  }

  if (hasEslintConfig) {
    // ESLint's cache ignores tsconfig changes, so they are part of the cache name.
    const tsConfigHash = createHash('sha256').update(hasTsConfig ? fs.readFileSync(tsConfigPath) : '').digest('hex').slice(0, 8);
    const cacheDirectory = path.join(projectRootPath, 'node_modules');
    fs.readdirSync(cacheDirectory).forEach((file) => {
      if (file.startsWith('.eslintcache-') && file !== `.eslintcache-${tsConfigHash}`) {
        fs.rmSync(path.join(cacheDirectory, file));
      }
    });
    const eslint = new ESLint({
      cache: true,
      fix: fixMode,
      cwd: projectRootPath,
      cacheLocation: path.join(cacheDirectory, `.eslintcache-${tsConfigHash}`),
    });
    const lint = async () => {
      process.stdout.write('\x1Bc');
      log(colors.magenta(colors.bold('Checking files...')));
      const results = await eslint.lintFiles(srcPath);
      if (fixMode) {
        await ESLint.outputFixes(results);
      }
      log((await eslint.loadFormatter('stylish')).format(results));
      if (!watchMode && results.some((result) => result.errorCount > 0)) {
        process.exit(1);
      }
    };
    await lint();
    if (watchMode) {
      // Events come in bursts (editors write several times), hence the debounce. A change during a
      // run queues one more run instead of overlapping outputs.
      let timeout = null;
      let running = false;
      let pending = false;
      const scheduleLint = async () => {
        if (running) {
          pending = true;
          return;
        }
        running = true;
        do {
          pending = false;
          await lint();
        } while (pending);
        running = false;
      };
      fs.watch(srcPath, { recursive: true }, (_event, filename) => {
        if (filename === null || /\.([cm]?[jt]s|jsx|tsx|svelte|vue)$/.test(filename)) {
          clearTimeout(timeout);
          timeout = setTimeout(scheduleLint, 100);
        }
      });
    }
  }

  if (hasTsConfig) {
    // Native TypeScript 7 for type-checking. typescript-eslint still needs the TypeScript 6 JS API
    // (none in 7.0): revisit dropping `typescript@6` once TypeScript 7.1 ships it.
    const checkers = [runChecker('tsc', [resolveBin('typescript-native', 'tsc'), ...cliArguments, '--project', tsConfigPath], (message) => (/error TS/.test(message) ? 'red' : 'cyan'), watchMode)];
    if (isInstalled('svelte')) {
      checkers.push(runChecker('svelte-check', [resolveBin('svelte-check'), ...cliArguments, '--workspace', srcPath, '--tsconfig', tsConfigPath], (message) => {
        if (/Error:/.test(message)) return 'red';
        return /Hint:/.test(message) ? 'yellow' : 'blue';
      }, watchMode));
    }
    await Promise.all(checkers);
  }
}
