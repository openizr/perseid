/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { existsSync, promises } from 'fs';

/**
 * Cache client settings.
 */
export interface CacheClientSettings {
  /** Path to the cache directory on file system. */
  cachePath: string;
}

/**
 * Handles data caching for faster access.
 */
export default class CacheClient {
  /** Cache file path. */
  protected cachePath: string;

  /**
   * Class constructor.
   *
   * @param settings Cache client settings.
   */
  constructor(settings: CacheClientSettings) {
    this.cachePath = settings.cachePath;
  }

  /**
   * Deletes cached data stored at `key`.
   *
   * @param key Key containing cached data.
   */
  public async delete(key: string): Promise<void> {
    if (existsSync(`${this.cachePath}/${key}`)) {
      await promises.unlink(`${this.cachePath}/${key}`);
    }
  }

  /**
   * Fetches cached data stored at `key`.
   *
   * @param key Key containing cached data.
   *
   * @returns Cached data if it exists, `null` otherwise.
   */
  public async get(key: string): Promise<string | null> {
    if (existsSync(`${this.cachePath}/${key}`)) {
      const content = await promises.readFile(`${this.cachePath}/${key}`);
      const cache = JSON.parse(content.toString()) as { expiration: number; data: string; };
      return (cache.expiration === -1 || Date.now() <= cache.expiration)
        ? cache.data
        : null;
    }
    return null;
  }

  /**
   * Stores `data` in cache, at `key`.
   *
   * @param key Key to store data at.
   *
   * @param data Data to store in cache.
   *
   * @param duration Duration, in seconds, for which to keep data in cache.
   */
  public async set(key: string, data: unknown, duration: number): Promise<void> {
    return promises.writeFile(`${this.cachePath}/${key}`, JSON.stringify({
      data,
      expiration: (duration === -1) ? -1 : Date.now() + duration * 1000,
    }));
  }
}
