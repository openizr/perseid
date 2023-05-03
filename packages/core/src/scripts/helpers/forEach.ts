/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Implementation of JS `Array.forEach` method, adapted to asynchronous callbacks.
 *
 * @param items Items to iterate on.
 *
 * @param callback Asynchronous function to execute for each item.
 */
export default async function forEach<T>(
  items: T[],
  callback: (item: T, index: number) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < items.length; index += 1) {
    await callback(items[index], index);
  }
}
