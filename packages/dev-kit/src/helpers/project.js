/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import colors from 'picocolors';
import { createRequire } from 'module';

// Package managers run scripts from the project's root. This file's location would resolve into
// `.pnpm` with pnpm/npm symlinks.
export const projectRootPath = process.cwd();

const projectRequire = createRequire(path.join(projectRootPath, 'package.json'));
const devKitRequire = createRequire(import.meta.url);
const packageJsonPath = path.join(projectRootPath, 'package.json');

// Missing when ESLint runs from an IDE's workspace folder: only scripts need it.
export const packageJson = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) : {};

const tryResolve = (require, name) => {
  try {
    require.resolve(`${name}/package.json`);
    return true;
  } catch {
    return false;
  }
};

/** Whether the project depends on the given package (optional frameworks). */
export const isInstalled = (name) => tryResolve(projectRequire, name);

/** Whether the dev-kit can resolve the given package (its dependencies and optional peers). */
export const isAvailable = (name) => tryResolve(devKitRequire, name);

/** Path of the project's `<name>.config.*` file, if any. */
export const findProjectConfig = (name) => ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']
  .map((extension) => path.join(projectRootPath, `${name}.config.${extension}`))
  .find((file) => fs.existsSync(file));

/** Absolute path to a dev-kit dependency's executable (`bin` is rarely exported by packages). */
export const resolveBin = (name, binName = name) => {
  const pkgPath = devKitRequire.resolve(`${name}/package.json`);
  const { bin } = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return path.join(path.dirname(pkgPath), typeof bin === 'string' ? bin : bin[binName]);
};

/** Absolute path to a dev-kit dependency's directory. */
export const resolvePackage = (name) => path.dirname(devKitRequire.resolve(`${name}/package.json`));

/** Tells the user which configs are in use. */
export function logConfigSources() {
  if (findProjectConfig('vite') === undefined) {
    console.log(colors.cyan('No vite.config.js in this project: using the dev-kit defaults.\n'));
  }
  if (isInstalled('svelte') && findProjectConfig('svelte') === undefined) {
    console.log(colors.cyan('No svelte.config.js in this project: using the dev-kit defaults (needed by svelte-check and IDEs).\n'));
  }
}

const isString = (value) => typeof value === 'string';
const optional = (check) => (value) => value === undefined || check(value);
const validators = {
  target: (value) => ['node', 'web'].includes(value),
  srcPath: isString,
  distPath: isString,
  html: (value, config) => config.target === 'node' || isString(value),
  entries: (value, config) => config.target === 'web' || typeof value === 'object',
  devServer: (value, config) => config.target === 'node' || (isString(value?.host) && ['number', 'string'].includes(typeof value.port)),
  publicPath: optional(isString),
  banner: optional(isString),
  runInDev: optional((value) => typeof value === 'boolean'),
  splitChunks: optional((value) => typeof value === 'boolean'),
  env: optional((value) => typeof value === 'object' && [value.development, value.production].every(optional((env) => typeof env === 'object'))),
};

/**
 * Validated project `devKitConfig`. Misconfigured paths would have bad side effects (directories
 * deletion), so scripts stop early.
 *
 * @returns Project configuration.
 */
export function getDevKitConfig() {
  const config = packageJson.devKitConfig ?? {};
  Object.entries(validators).forEach(([key, isValid]) => {
    if (!isValid(config[key], config)) {
      console.error(colors.red(`Invalid "devKitConfig.${key}" in package.json.`));
      process.exit(1);
    }
  });
  return config;
}
