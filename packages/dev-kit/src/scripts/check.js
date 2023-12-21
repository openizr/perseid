/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import '../config/env.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import checkFiles from '../helpers/checkFiles.js';

const fixMode = process.argv.indexOf('-f') >= 0;
const watchMode = process.argv.indexOf('-w') >= 0;
const projectRootPath = path.resolve(path.dirname(fileURLToPath(new URL(import.meta.url))), '../../../../');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRootPath, 'package.json')));
const { devKitConfig } = packageJson;
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);

/**
 * Runs `check` CLI command's script.
 */
async function run() {
  await checkFiles(projectRootPath, packageJson, srcPath, watchMode, fixMode);
}

run();
