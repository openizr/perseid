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
 * Performs a deep merge of `firstVariable` and `secondVariable`. Only plain objects and arrays are
 * deeply merged. In any other case, `secondVariable` is returned if it is defined.
 *
 * @param firstVariable First object.
 *
 * @param secondVariable Second object.
 *
 * @returns Variables deep merge.
 */
export default function deepMerge<T1, T2>(
  firstVariable: T1,
  secondVariable: T2,
): T1 & T2 {
  if (Array.isArray(firstVariable) && Array.isArray(secondVariable)) {
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
