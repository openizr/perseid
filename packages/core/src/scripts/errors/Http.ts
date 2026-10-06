/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import PerseidError from 'scripts/errors/Perseid';

/**
 * HTTP error.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/core/src/scripts/errors/Http.ts
 */
export default class HttpError extends PerseidError {
  /**
   * HTTP status code.
   */
  public readonly status: number;

  /**
   * Class constructor.
   *
   * @param status HTTP status code.
   *
   * @param details Error details.
   */
  constructor(status: number, details?: Record<string, unknown>) {
    super(`HTTP_ERROR_${String(status)}`, details ?? {});
    this.status = status;
  }
}
