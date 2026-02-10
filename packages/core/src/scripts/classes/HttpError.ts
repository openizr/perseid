/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * HTTP error.
 */
export default class HttpError extends Error {
  /**
   * HTTP status code.
   */
  public readonly status: number;

  /**
   * HTTP response body.
   */
  public readonly body: unknown;

  /**
   * Class constructor.
   *
   * @param response Mocked HTTP response.
   */
  constructor(status: number, body: unknown) {
    super('HTTP Error');
    this.status = status;
    this.body = body;
  }
}
