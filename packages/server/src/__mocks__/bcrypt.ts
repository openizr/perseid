/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `bcrypt` mock.
 */

export default {
  compare: vi.fn((a, b) => Promise.resolve(a === b)),
  hash: vi.fn((text: string) => `HASHED_TEXT_${text}`),
};
