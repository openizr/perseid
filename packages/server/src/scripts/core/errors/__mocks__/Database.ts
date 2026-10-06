/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `core/errors/Database` mock.
 */

export default class DatabaseError extends Error {
  public code: string;

  public details: Record<string, unknown>;

  constructor(code: string, details?: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.details = details ?? {};
  }
}
