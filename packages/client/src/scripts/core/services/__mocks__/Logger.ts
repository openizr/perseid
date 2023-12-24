/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/core/services/Logger` mock.
 */

export default class Logger {
  public debug = vi.fn();

  public error = vi.fn();
}
