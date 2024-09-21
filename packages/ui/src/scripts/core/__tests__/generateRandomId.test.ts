/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import generateRandomId from 'scripts/core/generateRandomId';

describe('core/generateRandomId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.Math.random = vi.fn(() => 0.22068766900273062);
  });

  test('correctly generates a random HTML id', () => {
    expect(generateRandomId()).toBe('_7y0ejf');
  });
});
