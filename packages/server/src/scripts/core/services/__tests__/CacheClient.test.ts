/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { promises } from 'fs';
import CacheClient from 'scripts/core/services/CacheClient';

describe('core/services/CacheClient', () => {
  vi.mock('fs');
  vi.mock('crypto');
  vi.mock('@perseid/core');
  vi.setSystemTime(1624108129052);

  const cacheClient = new CacheClient({ cachePath: '/.cache', connectTimeout: 3000 });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FS_ERROR;
    delete process.env.FS_NO_FILE;
    delete process.env.EXPIRATION;
  });

  describe('[set]', () => {
    test('with expiration', async () => {
      const path = '/.cache/abcde8997';
      const stringifiedPayload = '{"data":"{\\"data\\":\\"test\\"}","expiration":1624111729052}';
      await cacheClient.set('test', JSON.stringify({ data: 'test' }), 3600);
      expect(promises.writeFile).toHaveBeenCalledOnce();
      expect(promises.writeFile).toHaveBeenCalledWith(path, stringifiedPayload);
    });

    test('with no expiration', async () => {
      const path = '/.cache/abcde8997';
      const stringifiedPayload = '{"data":"{\\"data\\":\\"test\\"}","expiration":-1}';
      await cacheClient.set('test', JSON.stringify({ data: 'test' }), -1);
      expect(promises.writeFile).toHaveBeenCalledOnce();
      expect(promises.writeFile).toHaveBeenCalledWith(path, stringifiedPayload);
    });
  });

  test('delete', async () => {
    await cacheClient.delete('test');
    expect(promises.unlink).toHaveBeenCalledOnce();
    expect(promises.unlink).toHaveBeenCalledWith('/.cache/abcde8997');
  });

  describe('[get]', () => {
    test('cache does not exist', async () => {
      process.env.FS_NO_FILE = 'true';
      await cacheClient.get('notfound');
      expect(promises.readFile).not.toHaveBeenCalled();
    });

    test('cache exists, fs error', async () => {
      process.env.FS_ERROR = 'true';
      await expect(async () => cacheClient.get('test')).rejects.toEqual(new Error('fs_error'));
      expect(promises.readFile).toHaveBeenCalledOnce();
    });

    test('cache exists, no expiration', async () => {
      process.env.EXPIRATION = '-1';
      const data = await cacheClient.get('test');
      expect(promises.readFile).toHaveBeenCalledOnce();
      expect(data).toBe('{"data":"test"}');
    });

    test('cache exists, data expired', async () => {
      const data = await cacheClient.get('test');
      expect(promises.readFile).toHaveBeenCalledOnce();
      expect(data).toBe(null);
    });
  });
});
