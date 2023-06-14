/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `services/Logger` mock.
 */

export default class {
  public silent = vi.fn();

  public debug = vi.fn();

  public info = vi.fn();

  public warn = vi.fn();

  public error = vi.fn();

  public fatal = vi.fn();

  public child = vi.fn();
}
