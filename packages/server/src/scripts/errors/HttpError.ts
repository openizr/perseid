/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Generic HTTP error.
 */
export default class HttpError extends Error {
  public code: string | number;

  constructor(code: string | number, message: string) {
    super(message);
    this.code = code;
  }
}
