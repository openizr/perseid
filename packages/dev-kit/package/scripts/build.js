/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';
import fs from 'fs-extra';

process.env.NODE_ENV = 'production';

const { log, error } = console;
const srcPath = path.resolve('src');
const distPath = path.resolve('dist');

// Removing existing `dist` directory...
fs.remove(distPath)
  .then(() => {
    log('Compiling...');
  })
  // Copying the whole `src` directory into `dist`...
  .then(() => fs.copy(srcPath, distPath))
  // Copying `package.json` into `dist`...
  .then(() => fs.copy(path.resolve('package.json'), path.join(distPath, 'package.json')))
  // Copying `README.md` into `dist`...
  .then(() => fs.copy(path.resolve('../README.md'), path.join(distPath, 'README.md')))
  // Copying `LICENSE` into `dist`...
  .then(() => fs.copy(path.resolve('../LICENSE'), path.join(distPath, 'LICENSE')))
  // All went well...
  .then(() => {
    log('Done.');
  })
  // If any error occurs...
  .catch((e) => {
    error(e);
  });
