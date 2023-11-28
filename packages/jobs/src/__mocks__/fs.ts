/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/** `fs` mock. */

export const promises = {
  unlink: vi.fn(() => {
    if (process.env.FS_ERROR === 'true') {
      throw new Error('FS_ERROR');
    }
  }),
};

export const createReadStream = vi.fn((path: string) => path);
