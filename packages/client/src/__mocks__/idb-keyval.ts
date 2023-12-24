/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `idb-keyval` mock.
 */

export const set = vi.fn();
export const del = vi.fn();
export const get = vi.fn(() => ({
  expiration: 1672531100000,
  refreshToken: 'AAA1234567890',
}));
