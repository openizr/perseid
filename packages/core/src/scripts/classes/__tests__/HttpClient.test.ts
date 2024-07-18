/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import HttpClient from 'scripts/classes/HttpClient';

type TestHttpClient = HttpClient & {
  request: HttpClient['request'];
  rawRequest: HttpClient['rawRequest'];
  connectTimeout: HttpClient['connectTimeout'];
};

describe('classes/HttpClient', () => {
  vi.mock('scripts/helpers/isPlainObject', () => ({
    default: (variable: unknown): boolean => (
      typeof variable === 'object'
    ),
  }));

  const httpClient = new HttpClient(3000) as TestHttpClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('[rawRequest]', () => {
    test('JSON HTTP error', async () => {
      const json = vi.fn(() => 'BODY');
      vi.spyOn(global, 'fetch').mockImplementation(() => ({
        json,
        ok: false,
        status: 500,
        type: 'GET',
        redirected: false,
        url: 'https://test.test',
        statusText: 'Internal Server Error',
        headers: { get: vi.fn(() => 'application/json') },
      }) as unknown as Promise<Response>);
      await expect(async () => {
        await httpClient.rawRequest({
          method: 'GET',
          url: 'https://test.test',
        });
      }).rejects.toEqual({
        ok: false,
        type: 'GET',
        status: 500,
        body: 'BODY',
        redirected: false,
        url: 'https://test.test',
        statusText: 'Internal Server Error',
        headers: { get: expect.any(Function) as () => void },
      } as unknown as Error);
    });

    test('Text HTTP error', async () => {
      const text = vi.fn(() => 'BODY');
      vi.spyOn(global, 'fetch').mockImplementation(() => ({
        text,
        ok: false,
        status: 500,
        type: 'GET',
        redirected: false,
        url: 'https://test.test',
        statusText: 'Internal Server Error',
        headers: { get: vi.fn(() => 'text/plain') },
      }) as unknown as Promise<Response>);
      await expect(async () => {
        await httpClient.rawRequest({
          method: 'GET',
          url: 'https://test.test',
        });
      }).rejects.toEqual({
        ok: false,
        type: 'GET',
        status: 500,
        body: 'BODY',
        redirected: false,
        url: 'https://test.test',
        statusText: 'Internal Server Error',
        headers: { get: expect.any(Function) as () => void },
      } as unknown as Error);
    });

    test('no error, JSON body', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(vi.fn(() => ({}) as unknown as Promise<Response>));
      await httpClient.rawRequest({
        method: 'GET',
        url: 'https://test.test',
        body: { test: 'test' },
      });
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith('https://test.test', {
        method: 'GET',
        redirect: 'manual',
        body: '{"test":"test"}',
        signal: expect.any(AbortSignal) as AbortSignal,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    test('no error, FormData body', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(vi.fn(() => ({}) as unknown as Promise<Response>));
      await httpClient.rawRequest({
        method: 'GET',
        url: 'https://test.test',
        body: new FormData(),
      });
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith('https://test.test', {
        method: 'GET',
        redirect: 'manual',
        body: new FormData(),
        signal: expect.any(AbortSignal) as AbortSignal,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });
  });

  describe('[request]', () => {
    test('JSON response type', async () => {
      const json = vi.fn();
      vi.spyOn(httpClient, 'rawRequest').mockImplementation(() => ({
        json,
        headers: { get: vi.fn(() => 'application/json') },
      }) as unknown as Promise<Response>);
      await httpClient.request({
        method: 'GET',
        url: 'https://test.test',
      });
      expect(json).toHaveBeenCalledOnce();
    });

    test('unknown response type', async () => {
      const text = vi.fn();
      vi.spyOn(httpClient, 'rawRequest').mockImplementation(() => ({
        text,
        headers: { get: vi.fn(() => 'text/plain') },
      }) as unknown as Promise<Response>);
      await httpClient.request({
        method: 'GET',
        url: 'https://test.test',
      });
      expect(text).toHaveBeenCalledOnce();
    });
  });

  test('[constructor]', () => {
    expect(httpClient.connectTimeout).toBe(3000);
  });
});
