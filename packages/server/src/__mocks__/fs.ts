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

const writeFile = vi.fn();

const unlink = vi.fn();

const createWriteStream = vi.fn(() => ({
  end: vi.fn(),
  write: vi.fn(),
  on: vi.fn((eventName, callback: (error?: Error) => void) => {
    if (eventName === 'close') {
      callback();
    }
    setTimeout(() => {
      if (process.env.FS_ERROR_STREAM === 'true') {
        callback(new Error('error'));
      } else {
        callback();
      }
    }, 100);
  }),
}));

const existsSync = vi.fn((path) => (path === '/var/www/html/node_modules/.cache/test'));

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
