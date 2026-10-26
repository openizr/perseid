/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import deepCopy from 'scripts/helpers/deepCopy';
import isPlainObject from 'scripts/helpers/isPlainObject';

/**
 * Performs a deep merge of `firstVariable` and `secondVariable`.
 * - For plain objects, every key of the first object is deeply merged with the corresponding key of
 * the second object.
 * - For arrays with `mergeArrays` set to `true`, every element of the first array is deeply merged
 * with the corresponding element of the second array. In case the second array contains more
 * elements than the first array, the additional elements are appended to the end of the first
 * array. In case the first array contains more elements than the second array, the additional
 * elements are kept as-is in the final array, and elements in the second array are deeply merged
 * with the corresponding elements in the first array.
 * - For arrays with `mergeArrays` set to `false`, the second array is returned if it is defined.
 * - In any other case, `secondVariable` is returned if it is defined.
 *
 * @param firstVariable First object.
 *
 * @param secondVariable Second object.
 *
 * @param mergeArrays Whether to deeply merge arrays as well, or simply return the `secondVariable`
 * array if it is defined. Defaults to `false`.
 *
 * @returns Variables deep merge.
 */
export default function deepMerge<T1, T2>(
  firstVariable: T1,
  secondVariable: T2,
  mergeArrays = false,
): T1 & T2 {
  if (mergeArrays && Array.isArray(firstVariable) && Array.isArray(secondVariable)) {
    const newArray = [];
    const maxLength = Math.max(firstVariable.length, secondVariable.length);
    for (let index = 0; index < maxLength; index += 1) {
      newArray[index] = deepMerge(
        firstVariable[index] as Record<string, T1>,
        secondVariable[index] as Record<string, T2>,
      );
    }
    return newArray as T1 & T2;
  }

  if (isPlainObject(firstVariable) && isPlainObject(secondVariable)) {
    const keys = Object.keys(secondVariable as Record<string, unknown>);
    const newObject = deepCopy(firstVariable) as Record<string, unknown>;
    for (let index = 0, { length } = keys; index < length; index += 1) {
      newObject[keys[index]] = deepMerge(
        (firstVariable as Record<string, unknown>)[keys[index]],
        (secondVariable as Record<string, unknown>)[keys[index]],
      );
    }
    return newObject as T1 & T2;
  }

  return (secondVariable !== undefined)
    ? deepCopy(secondVariable) as T1 & T2
    : deepCopy(firstVariable) as T1 & T2;
}
