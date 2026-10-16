/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import forEach from 'scripts/helpers/forEach';

describe('helpers/forEach', () => {
  test('iterates over each item, one at a time by default', async () => {
    const callback = vi.fn();
    let running = 0;
    let maximumRunning = 0;

    await forEach(['one', 'two', 'three'], async (item, index) => {
      running += 1;
      maximumRunning = Math.max(maximumRunning, running);
      callback(item, index);
      await new Promise((resolve) => { setTimeout(resolve, 10); });
      running -= 1;
    });

    expect(maximumRunning).toBe(1);
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenNthCalledWith(1, 'one', 0);
    expect(callback).toHaveBeenNthCalledWith(2, 'two', 1);
    expect(callback).toHaveBeenNthCalledWith(3, 'three', 2);
  });

  test('never runs more than `batchSize` callbacks at the same time', async () => {
    const callback = vi.fn();
    let running = 0;
    let maximumRunning = 0;

    await forEach(new Array(10).fill('item'), async (item, index) => {
      running += 1;
      maximumRunning = Math.max(maximumRunning, running);
      callback(item, index);
      await new Promise((resolve) => { setTimeout(resolve, 10); });
      running -= 1;
    }, 3);

    expect(maximumRunning).toBe(3);
    expect(callback).toHaveBeenCalledTimes(10);
  });

  test('does nothing when there is no item to iterate on', async () => {
    const callback = vi.fn();

    await forEach([], callback, 4);

    expect(callback).not.toHaveBeenCalled();
  });
});
