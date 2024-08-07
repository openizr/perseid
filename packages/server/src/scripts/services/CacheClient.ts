/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { createHash } from 'crypto';
import { existsSync, promises } from 'fs';
import { HttpClient } from '@perseid/core';

/**
 * Cache client settings.
 */
export interface CacheClientSettings {
  /** Path to the cache directory on file system. */
  cachePath: string;

  /** Maximum request duration (in ms) before generating a timeout. */
  connectTimeout: number;
}

/**
 * Handles data caching for faster access.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/CacheClient.ts
 */
export default class CacheClient extends HttpClient {
  /** Cache file path. */
  protected cachePath: string;

  /**
   * Class constructor.
   *
   * @param settings Cache client settings.
   */
  constructor(settings: CacheClientSettings) {
    super(settings.connectTimeout);
    this.cachePath = settings.cachePath;
  }

  /**
   * Deletes cached data stored at `key`.
   *
   * @param key Key containing cached data.
   */
  public async delete(key: string): Promise<void> {
    const cacheKey = createHash('sha1').update(key).digest('hex');
    if (existsSync(`${this.cachePath}/${cacheKey}`)) {
      await promises.unlink(`${this.cachePath}/${cacheKey}`);
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
    const cacheKey = createHash('sha1').update(key).digest('hex');
    if (existsSync(`${this.cachePath}/${cacheKey}`)) {
      const content = await promises.readFile(`${this.cachePath}/${cacheKey}`);
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
    const cacheKey = createHash('sha1').update(key).digest('hex');
    return promises.writeFile(`${this.cachePath}/${cacheKey}`, JSON.stringify({
      data,
      expiration: (duration === -1) ? -1 : Date.now() + duration * 1000,
    }));
  }
}
