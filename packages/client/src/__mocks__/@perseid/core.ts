/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `@perseid/core` mock.
 */

export class HttpClient {
  protected mock = vi.fn();

  protected async request(): Promise<void> {
    await this.mock();
  }
}
export class Model { protected mocked = vi.fn(); }
export class Logger { protected mocked = vi.fn(); }
export class Id { public toString = vi.fn(() => '000000000000000000000001'); }
export const toSnakeCase = vi.fn((variable: string) => `TO_SNAKE_CASE_${variable}`);
export const deepMerge = vi.fn((_: unknown, variable: unknown): unknown => variable);
export const deepCopy = vi.fn((variable: unknown): unknown => (typeof variable === 'object' ? { ...variable } : variable));
export const isPlainObject = vi.fn((variable: unknown): boolean => typeof variable === 'object' && !Array.isArray(variable) && !(variable instanceof Id));
