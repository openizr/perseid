/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/** `@perseid/core` mock. */

export const Id = String;

export async function forEach<T>(
  items: T[],
  callback: (item: T, index: number) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < items.length; index += 1) {
    await callback(items[index], index);
  }
}
