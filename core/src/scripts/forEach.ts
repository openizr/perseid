/**
 * Copyright (c) Selfcity Inc.
 * All rights reserved.
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
    await callback(items[index], index); // eslint-disable-line no-await-in-loop
  }
}
