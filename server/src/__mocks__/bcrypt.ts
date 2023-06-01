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
  hash: vi.fn((text) => `HASHED_TEXT_${text}`),
  compare: vi.fn(() => process.env.PASSWORDS_MISMATCH !== 'true'),
};
