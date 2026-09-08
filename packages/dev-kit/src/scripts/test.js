/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { resolveBin } from '../helpers/paths.js';

const watchMode = process.argv.indexOf('-w') >= 0;
const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../config/vite.config.js');

/**
 * Runs `test` CLI command's script.
 */
function run() {
  const vitest = spawn(process.execPath, [
    resolveBin('vitest'),
    watchMode ? 'watch' : 'run',
    '--passWithNoTests',
    `--config=${configPath}`,
    '--coverage',
  ], {
    stdio: 'inherit',
    env: { ...process.env, ENV: 'test', NODE_ENV: 'test' },
  });
  vitest.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

run();
