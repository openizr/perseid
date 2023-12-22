/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export const test = true;
export const match = vi.fn(() => (): unknown => {
  // Route matching with params.
  if (process.env.MATCH === '1') {
    return {
      params: {
        id: '125',
      },
    };
  }
  // Route matching without params.
  if (process.env.MATCH === '2') {
    return {};
  }
  // No route matching - route info undefined.
  if (process.env.MATCH === '3') {
    return undefined;
  }
  // No route matching - route info false.
  return false;
});
