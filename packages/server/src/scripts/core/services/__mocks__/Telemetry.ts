/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `core/services/Telemetry` mock.
 */

export default class {
  public silent = vi.fn();

  public debug = vi.fn();

  public info = vi.fn();

  public warn = vi.fn();

  public error = vi.fn();

  public fatal = vi.fn();

  public child = vi.fn();

  public now = vi.fn(() => [0, 0]);

  public duration = vi.fn(() => 0.5);

  public measure = vi.fn();

  public createCounter = vi.fn();

  public createHistogram = vi.fn();

  public createUpDownCounter = vi.fn();

  public span = vi.fn((
    _name: string,
    _options: unknown,
    callback: (span: unknown) => unknown,
  ) => callback({ setStatus: vi.fn(), setAttributes: vi.fn() }));
}
