/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

type CacheSet = (key: string, data: unknown, duration: number) => Promise<void>;

/**
 * `core/services/CacheClient` mock.
 */

export default class {
  public set = vi.fn<CacheSet>(() => Promise.resolve());

  public get = vi.fn<(key: string) => Promise<string | null>>(() => Promise.resolve('test'));

  public delete = vi.fn<(key: string) => Promise<void>>(() => Promise.resolve());
}
