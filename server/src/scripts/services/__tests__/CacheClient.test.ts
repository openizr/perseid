/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { promises } from 'fs';
import CacheClient from 'scripts/services/CacheClient';

vi.mock('fs');
Date.now = vi.fn(() => 1624108129052);

describe('lib/CacheClient', () => {
  const cacheClient = new CacheClient({ cachePath: '/var/www/html/node_modules/.cache' });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FS_ERROR;
    delete process.env.EXPIRATION;
  });

  test('set - with expiration', async () => {
    await cacheClient.set('test', JSON.stringify({ data: 'test' }), 3600);
    expect(promises.writeFile).toHaveBeenCalledTimes(1);
    expect(promises.writeFile).toHaveBeenCalledWith('/var/www/html/node_modules/.cache/test', '{"data":"{\\"data\\":\\"test\\"}","expiration":1624111729052}');
  });

  test('set - with no expiration', async () => {
    await cacheClient.set('test', JSON.stringify({ data: 'test' }), -1);
    expect(promises.writeFile).toHaveBeenCalledTimes(1);
    expect(promises.writeFile).toHaveBeenCalledWith('/var/www/html/node_modules/.cache/test', '{"data":"{\\"data\\":\\"test\\"}","expiration":-1}');
  });

  test('delete', async () => {
    await cacheClient.delete('test');
    expect(promises.unlink).toHaveBeenCalledTimes(1);
    expect(promises.unlink).toHaveBeenCalledWith('/var/www/html/node_modules/.cache/test');
  });

  test('get - cache does not exist', async () => {
    await cacheClient.get('notfound');
    expect(promises.readFile).not.toHaveBeenCalled();
  });

  test('get - cache exists, fs error', async () => {
    process.env.FS_ERROR = 'true';
    await expect(async () => cacheClient.get('test')).rejects.toEqual(new Error('fs_error'));
    expect(promises.readFile).toHaveBeenCalledTimes(1);
  });

  test('get - cache exists, no expiration', async () => {
    process.env.EXPIRATION = '-1';
    const data = await cacheClient.get('test');
    expect(promises.readFile).toHaveBeenCalledTimes(1);
    expect(data).toBe('{"data":"test"}');
  });

  test('get - cache exists, data expired', async () => {
    const data = await cacheClient.get('test');
    expect(promises.readFile).toHaveBeenCalledTimes(1);
    expect(data).toBe(null);
  });
});
