/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `node:async_hooks` mock.
 */

export const test = true;
export class AsyncLocalStorage {
  protected store: unknown;

  public getStore(): unknown {
    return { span: this.store };
  }

  public run<T>(store: unknown, callback: () => T): T {
    const previousStore = this.store;
    this.store = store;
    try {
      const result = callback();
      if (result instanceof Promise) {
        return result.finally(() => {
          this.store = previousStore;
        }) as T;
      }
      this.store = previousStore;
      return result;
    } catch (error) {
      this.store = previousStore;
      throw error;
    }
  }
}
