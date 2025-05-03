/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Returns `true` if `variable` is a plain object, `false` otherwise.
 *
 * @param variable Variable to check.
 *
 * @returns `true` if variable is a plain object, `false` otherwise.
 */
export default function isPlainObject(variable: unknown): boolean {
  return (
    variable !== null
    && typeof variable === 'object'
    // Comparing constructor's name instead of the constructor itself prevents wrong results
    // when dealing with iframes or separate windows (`Object` is a different variable).
    && ((variable as { constructor?: unknown; }).constructor === undefined || variable.constructor.name === 'Object')
  );
}
