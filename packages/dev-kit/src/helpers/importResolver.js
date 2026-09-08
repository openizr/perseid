/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';

const sourceDirectories = new Map();

/** Finds the source directory of the project containing `file` (closest `package.json`). */
const findSourceDirectory = (file) => {
  let directory = path.dirname(file);
  while (!sourceDirectories.has(directory)) {
    const packageJsonPath = path.join(directory, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const { devKitConfig } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      sourceDirectories.set(directory, path.join(directory, devKitConfig?.srcPath ?? 'src'));
      break;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      sourceDirectories.set(directory, null);
      break;
    }
    directory = parent;
  }
  return sourceDirectories.get(directory);
};

/**
 * eslint-plugin-import-x resolver for the dev-kit's absolute imports (`scripts/...`, `styles/...`),
 * resolved from the project's source directory like Vite's aliases and the `tsconfig` `paths`.
 * Unlike the TypeScript resolver, it does not depend on the working directory.
 *
 * @param extensions File extensions to try.
 *
 * @returns Resolver.
 */
export default function createSourceResolver(extensions) {
  return {
    interfaceVersion: 3,
    name: 'dev-kit:source',
    resolve(source, file) {
      if (source.startsWith('.') || source.startsWith('node:') || path.isAbsolute(source)) {
        return { found: false };
      }
      const sourceDirectory = findSourceDirectory(file);
      if (sourceDirectory === null) {
        return { found: false };
      }
      const base = path.join(sourceDirectory, source);
      const candidates = [base]
        .concat(extensions.map((extension) => `${base}${extension}`))
        .concat(extensions.map((extension) => path.join(base, `index${extension}`)));
      const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      return found === undefined ? { found: false } : { found: true, path: found };
    },
  };
}
