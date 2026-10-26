/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Iterates over a list of items, executing an asynchronous callback for each item. A new callback
 * is started as soon as any of the running ones completes, so that exactly `batchSize` of them are
 * in flight at any time, until there is no item left.
 *
 * @param items Items to iterate on.
 *
 * @param callback Asynchronous function to execute for each item.
 *
 * @param batchSize Maximum number of callbacks to run at the same time. Defaults to `1`.
 */
export default async function forEach<T>(
  items: T[],
  callback: (item: T, index: number) => Promise<void>,
  batchSize = 1,
): Promise<void> {
  let nextIndex = 0;

  const runNextItem = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await callback(items[currentIndex], currentIndex);
    }
  };

  const size = Math.min(Math.max(Math.floor(batchSize), 1), items.length);
  await Promise.all(new Array(size).fill(null).map(runNextItem));
}
