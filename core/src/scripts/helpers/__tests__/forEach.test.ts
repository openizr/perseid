/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import forEach from 'scripts/helpers/forEach';

describe('helpers/forEach', () => {
  test('correctly iterates asynchronously over each item', async () => {
    const callback = vi.fn();
    await forEach([
      'one',
      'two',
      'three',
    ], async (message) => {
      callback(message);
      await new Promise((resolve) => { setTimeout(resolve, 50); });
    });

    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenNthCalledWith(1, 'one');
    expect(callback).toHaveBeenNthCalledWith(2, 'two');
    expect(callback).toHaveBeenNthCalledWith(3, 'three');
  });
});
