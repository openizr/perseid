/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * HTTP error mock.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/errors/Http.ts
 */
export default class HttpError extends Error {
  /** Mocked HTTP response. */
  public response: { data: unknown; status: number; };

  /**
   * Class constructor.
   *
   * @param response Mocked HTTP response.
   */
  constructor(response: { data: unknown; status: number; }) {
    super('HTTP Error');
    this.response = response;
  }
}
