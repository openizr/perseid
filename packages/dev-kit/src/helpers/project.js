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
import { createRequire, builtinModules } from 'module';

// Package managers run scripts from the project's root. This file's location would resolve into
// `.pnpm` with pnpm/npm symlinks.
export const projectRootPath = process.cwd();

const projectRequire = createRequire(path.join(projectRootPath, 'package.json'));
const devKitRequire = createRequire(import.meta.url);
const packageJsonPath = path.join(projectRootPath, 'package.json');

// Missing when ESLint runs from an IDE's workspace folder: only scripts need it.
export const packageJson = fs.existsSync(packageJsonPath)
  ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  : {};

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
const isObject = (value) => typeof value === 'object' && value !== null;
const optional = (check) => (value) => value === undefined || check(value);

/** Port number, or the value of the environment variable named by `port`. */
export const resolvePort = (port) => (port === undefined ? undefined : Number(isString(port) ? process.env[port] : port));

// Paths are deleted recursively: they must stay strictly inside the project.
const isSubPath = (value) => {
  const relative = isString(value) ? path.relative(projectRootPath, path.resolve(projectRootPath, value)) : '';
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};
const validators = {
  target: (value) => ['node', 'web'].includes(value),
  srcPath: isSubPath,
  distPath: (value, config) => (
    isSubPath(value)
    && path.resolve(projectRootPath, value) !== path.resolve(projectRootPath, config.srcPath)
  ),
  html: (value, config) => config.target === 'node' || isString(value),
  entries: (value, config) => config.target === 'web' || isObject(value),
  devServer: (value, config) => (
    config.target === 'node'
    || (isString(value?.host) && Number.isInteger(resolvePort(value.port)))
  ),
  publicPath: optional(isString),
  banner: optional(isString),
  runInDev: optional((value) => typeof value === 'boolean' && (!value || isString(packageJson.main))),
  splitChunks: optional((value) => typeof value === 'boolean'),
  extraPackageJsonKeys: optional((value) => Array.isArray(value) && value.every(isString)),
  generateTypings: optional((value) => typeof value === 'boolean'),
  env: optional((value) => isObject(value) && [value.development, value.production].every(optional(isObject))),
};

const fail = (message) => {
  console.error(colors.red(message));
  process.exit(1);
};

let devKitConfig = null;

/**
 * Validated project `devKitConfig`. Misconfigured paths would have bad side effects (directories
 * deletion), so scripts stop early.
 *
 * @returns Project configuration.
 */
export function getDevKitConfig() {
  if (devKitConfig !== null) {
    return devKitConfig;
  }
  const config = packageJson.devKitConfig ?? {};
  Object.entries(validators).forEach(([key, isValid]) => {
    if (!isValid(config[key], config)) {
      fail(`Invalid "devKitConfig.${key}" in package.json.`);
    }
  });
  // Top-level source directories are importable by name (aliases): they must not hide a package.
  fs.readdirSync(path.join(projectRootPath, config.srcPath), { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory() && (builtinModules.includes(entry.name) || isInstalled(entry.name))) {
      fail(`"${config.srcPath}/${entry.name}" hides the "${entry.name}" package: rename it.`);
    }
  });
  devKitConfig = config;
  return config;
}
