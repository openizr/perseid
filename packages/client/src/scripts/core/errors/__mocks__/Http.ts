/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/core/errors/Http` mock.
 */

export default class Http extends Error {
  constructor() {
    super('HTTP Error');
  }
}
