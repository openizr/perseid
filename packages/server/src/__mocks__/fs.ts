/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `fs` mock.
 */

import { Writable } from 'stream';

const writeFile = vi.fn();

const unlink = vi.fn();

/**
 * Receives each chunk written to a file stream, with the file path.
 */
export const writeStream = vi.fn<(path: string, chunk: Buffer) => void>();

const createWriteStream = vi.fn((path: string) => new Writable({
  write(chunk: Buffer, _encoding, callback): void {
    writeStream(path, chunk);
    callback();
  },
}));

const existsSync = vi.fn((path) => (
  process.env.FS_NO_FILE !== 'true'
  && path === '/.cache/abcde8997'
));

const readFile = vi.fn(() => {
  if (process.env.FS_ERROR === 'true') {
    throw new Error('fs_error');
  } if (process.env.EXPIRATION === '-1') {
    return '{"data":"{\\"data\\":\\"test\\"}","expiration":-1}';
  }
  return '{"data":"{\\"data\\":\\"test\\"}","expiration":100000}';
});

export { existsSync, createWriteStream };
export const promises = {
  unlink,
  readFile,
  writeFile,
};
