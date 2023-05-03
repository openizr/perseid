/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import isPlainObject from 'scripts/helpers/isPlainObject';

/**
 * Performs a deep copy of a variable. Only plain objects and arrays are deeply copied.
 *
 * @param variable Variable to deeply copy.
 *
 * @returns variable deep copy.
 */
export default function deepCopy<T>(variable: T): T {
  if (Array.isArray(variable)) {
    const newArray = [];
    for (let index = 0, { length } = variable; index < length; index += 1) {
      newArray[index] = deepCopy(variable[index] as Record<string, T>);
    }
    return newArray as T;
  }
  if (isPlainObject(variable)) {
    const newObject: Record<string, T> = {};
    const keys = Object.keys(variable as Record<string, unknown>);
    for (let index = 0, { length } = keys; index < length; index += 1) {
      newObject[keys[index]] = deepCopy((variable as Record<string, T>)[keys[index]]);
    }
    return newObject as T;
  }
  return variable;
}
