/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { resolveBin, findProjectConfig, logConfigSources } from '../helpers/project.js';

logConfigSources();
const args = process.argv.slice(2);
const watchMode = args.includes('-w');
const configPath = findProjectConfig('vite') ?? fileURLToPath(new URL('../vite.config.js', import.meta.url));
spawn(process.execPath, [
  resolveBin('vitest'),
  watchMode ? 'watch' : 'run',
  `--config=${configPath}`,
  // Coverage slows down each re-run: opt-in (`-c`) in watch mode.
  ...(!watchMode || args.includes('-c')) ? ['--coverage'] : [],
  ...args.filter((arg) => !['-w', '-c'].includes(arg)),
], { stdio: 'inherit', env: { ...process.env, ENV: 'test', NODE_ENV: 'test' } })
  .on('exit', (code) => process.exit(code ?? 1));
