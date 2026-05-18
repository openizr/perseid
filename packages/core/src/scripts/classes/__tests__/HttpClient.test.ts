/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import HttpError from 'scripts/classes/HttpError';
import HttpClient from 'scripts/classes/HttpClient';

type TestHttpClient = HttpClient & {
  request: HttpClient['request'];
  rawRequest: HttpClient['rawRequest'];
  handleRetries: HttpClient['handleRetries'];
  defaultShouldRetry: HttpClient['defaultShouldRetry'];
  defaultCalculateDelay: HttpClient['defaultCalculateDelay'];
};

describe('classes/HttpClient', () => {
  vi.mock('scripts/classes/HttpError');
  vi.mock('scripts/classes/Telemetry');

  const telemetry = {
    now: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    close: vi.fn(),
    span: vi.fn(),
    measure: vi.fn(),
    duration: vi.fn(),
    createGauge: vi.fn(),
    waitForReady: vi.fn(),
    createCounter: vi.fn(),
    createHistogram: vi.fn(),
    createUpDownCounter: vi.fn(),
  };

  const httpClient = new HttpClient(telemetry, {
    requestTimeout: 3000,
  }) as TestHttpClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('[handleRetries]', () => {
    test('retries on network error', async () => {
      const response = {
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn(() => Promise.resolve({ data: 'success' })),
      } as unknown as Response;

      vi.useFakeTimers();
      vi.spyOn(httpClient, 'rawRequest')
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(response);

      const resultPromise = httpClient.handleRetries({
        method: 'GET',
        url: 'https://test.test',
        maxRetries: 1,
      });

      await vi.advanceTimersByTimeAsync(1000);

      expect(await resultPromise).toEqual(response);
      expect(httpClient.rawRequest).toHaveBeenCalledTimes(2);
      expect(telemetry.warn).toHaveBeenCalledWith('Retrying HTTP request...', {
        method: 'GET',
        url: 'https://test.test',
        retryCount: 1,
      });
    });

    test('throws error after max retries', async () => {
      const networkError = new TypeError('Network error');
      const noRetryClient = new HttpClient(telemetry, {
        requestTimeout: 3000,
        maxRetries: 0,
      }) as TestHttpClient;
      vi.spyOn(noRetryClient, 'rawRequest').mockRejectedValue(networkError);

      await expect(noRetryClient.request({
        method: 'GET',
        url: 'https://test.test',
      })).rejects.toThrow(networkError);

      expect(noRetryClient.rawRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('[rawRequest]', () => {
    test('JSON HTTP error', async () => {
      const json = vi.fn(() => Promise.resolve('BODY'));
      vi.spyOn(global, 'fetch').mockImplementation(() => Promise.resolve({
        json,
        ok: false,
        status: 500,
        type: 'GET',
        redirected: false,
        url: 'https://test.test',
        statusText: 'Internal Server Error',
        headers: { get: vi.fn(() => 'application/json') },
      } as unknown as Response));

      await expect(httpClient.rawRequest({
        method: 'GET',
        url: 'https://test.test',
      })).rejects.toThrow(HttpError);

      expect(json).toHaveBeenCalledOnce();
    });

    test('Text HTTP error', async () => {
      const text = vi.fn(() => Promise.resolve('BODY'));
      vi.spyOn(global, 'fetch').mockImplementation(() => Promise.resolve({
        text,
        ok: false,
        status: 500,
        type: 'GET',
        redirected: false,
        url: 'https://test.test',
        statusText: 'Internal Server Error',
        headers: { get: vi.fn(() => 'text/plain') },
      } as unknown as Response));

      await expect(httpClient.rawRequest({
        method: 'GET',
        url: 'https://test.test',
      })).rejects.toThrow(HttpError);

      expect(text).toHaveBeenCalledOnce();
    });

    test('JSON body', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: vi.fn() },
      } as unknown as Response)));

      await httpClient.rawRequest({
        method: 'POST',
        url: 'https://test.test',
        body: { test: 'test' },
      });

      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith('https://test.test', {
        method: 'POST',
        redirect: 'manual',
        body: '{"test":"test"}',
        signal: expect.any(AbortSignal) as AbortSignal,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    test('FormData body', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: vi.fn() },
      } as unknown as Response)));

      const formData = new FormData();
      await httpClient.rawRequest({
        method: 'POST',
        url: 'https://test.test',
        body: formData,
      });

      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith('https://test.test', {
        method: 'POST',
        redirect: 'manual',
        body: formData,
        signal: expect.any(AbortSignal) as AbortSignal,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });
  });

  describe('[request]', () => {
    test('JSON response type', async () => {
      const json = vi.fn(() => Promise.resolve({ data: 'test' }));
      vi.spyOn(httpClient, 'handleRetries').mockImplementation(() => Promise.resolve({
        json,
        headers: { get: vi.fn(() => 'application/json') },
      } as unknown as Response));

      const result = await httpClient.request({
        method: 'GET',
        url: 'https://test.test',
      });

      expect(json).toHaveBeenCalledOnce();
      expect(result).toEqual({ data: 'test' });
      expect(telemetry.info).toHaveBeenCalledWith('Performing HTTP request...', {
        method: 'GET',
        url: 'https://test.test',
      });
    });

    test('text response type', async () => {
      const text = vi.fn(() => Promise.resolve('plain text response'));
      vi.spyOn(httpClient, 'handleRetries').mockImplementation(() => Promise.resolve({
        text,
        headers: { get: vi.fn(() => 'text/plain') },
      } as unknown as Response));

      const result = await httpClient.request({
        method: 'GET',
        url: 'https://test.test',
      });

      expect(text).toHaveBeenCalledOnce();
      expect(result).toBe('plain text response');
    });
  });

  test('[constructor]', () => {
    expect(httpClient.defaultCalculateDelay(0)).toBe(1000);
    expect(httpClient.defaultShouldRetry(new TypeError(), 0)).toBe(true);
    expect(httpClient.defaultShouldRetry(new DOMException(), 0)).toBe(true);
    expect(httpClient.defaultShouldRetry(new HttpError(500, {}), 0)).toBe(false);
  });

  test('[exponentialBackoffDelay]', () => {
    const calculateDelay = HttpClient.exponentialBackoffDelay(100, 5000, 2);
    expect(calculateDelay(0)).toBe(100);
    expect(calculateDelay(1)).toBe(200);
    expect(calculateDelay(2)).toBe(400);
    expect(calculateDelay(10)).toBe(5000);
  });
});
