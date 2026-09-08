/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// Package managers always run scripts from the project's root. Deriving it from this file's
// location would break with pnpm/npm symlinks, which resolve to the real package path.
export const projectRootPath = process.cwd();

// Resolves from the project (its own dependencies, e.g. `react`), not from the dev-kit.
const projectRequire = createRequire(path.join(projectRootPath, 'package.json'));

// Resolves from the dev-kit (its own dependencies, e.g. `vitest`), whatever the node_modules layout.
const devKitRequire = createRequire(import.meta.url);

export const packageJson = JSON.parse(fs.readFileSync(path.join(projectRootPath, 'package.json'), 'utf-8'));

/**
 * Whether the project depends on the given package (optional frameworks support).
 *
 * @param name - The name of the package to check.
 *
 * @return Whether the project depends on the given package.
 */
export const isInstalled = (name) => {
  try {
    projectRequire.resolve(`${name}/package.json`);
    return true;
  } catch {
    return false;
  }
};

/** Whether a package is resolvable from the dev-kit itself (its dependencies and optional peers). */
export const isAvailable = (name) => {
  try {
    devKitRequire.resolve(`${name}/package.json`);
    return true;
  } catch {
    return false;
  }
};

/**
 * Absolute path to a dev-kit dependency's executable (`bin` is rarely exported by packages).
 *
 * @param name The name of the package to resolve the executable for.
 *
 * @param binName The name of the executable to resolve.
 *
 * @return The absolute path to the executable.
 */
export const resolveBin = (name, binName = name) => {
  const packageJsonPath = devKitRequire.resolve(`${name}/package.json`);
  const { bin } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return path.join(path.dirname(packageJsonPath), typeof bin === 'string' ? bin : bin[binName]);
};

/**
 * Absolute path to a dev-kit dependency's package directory.
 *
 * @param name The name of the package to resolve the package directory for.
 *
 * @return The absolute path to the package directory.
 */
export const resolvePackage = (name) => path.dirname(devKitRequire.resolve(`${name}/package.json`));
