/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `@opentelemetry/api` mock.
 */

const setStatus = vi.fn();

export const SpanKind = {
  SERVER: 1,
  CLIENT: 2,
  CONSUMER: 3,
  PRODUCER: 4,
  INTERNAL: 0,
};

export const SpanStatusCode = {
  OK: 1,
  UNSET: 0,
  ERROR: 2,
};

export const createTraceState = vi.fn((state?: string) => state);

export const context = {
  active: vi.fn(() => ({})),
};

export const trace = {
  getSpan: vi.fn(() => ({ setStatus })),
  setSpan: vi.fn((ctx: unknown) => ctx),
  setSpanContext: vi.fn((ctx: unknown) => ctx),
};
