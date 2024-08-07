/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

type Details = Record<string, unknown>;

/**
 * Database error.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/errors/Database.ts
 */
export default class DatabaseError extends Error {
  /** Error code. */
  public code: string;

  /** Error details. */
  public details: Details;

  /**
   * Class constructor.
   *
   * @param code Error code.
   *
   * @param details Error details.
   */
  constructor(code: string, details?: Details) {
    super(code);
    this.code = code;
    this.details = details ?? {};
  }
}
