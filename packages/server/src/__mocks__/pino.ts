/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `pino` mock.
 */

const debug = vi.fn();
const info = vi.fn();
const warn = vi.fn();
const error = vi.fn();
const fatal = vi.fn();
const flushSync = vi.fn();
const on = vi.fn((_event, callback: () => null) => callback());
const destination = vi.fn(() => ({ flushSync, on }));

export const test = true;

export const pino = vi.fn(() => ({
  debug,
  info,
  warn,
  error,
  fatal,
}));

(pino as unknown as { destination: unknown; }).destination = destination;
