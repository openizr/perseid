/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `crypto` mock.
 */

export const randomBytes = vi.fn(() => '12345azerty');
export const createHash = vi.fn(() => ({ update: vi.fn(() => ({ digest: vi.fn(() => 'abcde8997') })) }));
