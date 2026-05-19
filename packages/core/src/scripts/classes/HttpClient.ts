/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import HttpError from 'scripts/classes/HttpError';
import type Telemetry from 'scripts/classes/Telemetry';
import isPlainObject from 'scripts/helpers/isPlainObject';

/**
 * HTTP client settings.
 */
export interface HttpClientSettings {
  /**
   * Default maximum request duration (in ms) before generating a timeout.
   */
  requestTimeout: number;

  /**
   * Default maximum number of retries.
   */
  maxRetries?: number;

  /**
   * Default function to calculate the delay for a retry.
   */
  calculateDelay?: (retryCount: number) => number;

  /**
   * Default function to determine if a request should be retried.
   */
  shouldRetry?: (error: Error, retryCount: number) => boolean;
}

/**
 * HTTP request settings.
 */
export interface RequestSettings {
  /**
   * HTTP method to use.
   */
  method: 'GET' | 'PATCH' | 'DELETE' | 'PUT' | 'POST' | 'HEAD' | 'OPTIONS';

  /**
   * Request URL.
   */
  url: string;

  /**
   * Request body.
   */
  body?: string | FormData | Record<string, unknown>;

  /**
   * Request headers.
   */
  headers?: Record<string, string>;

  /**
   * Maximum number of retries.
   */
  maxRetries?: number;

  /**
   * Abort signal to cancel the request.
   */
  signal?: AbortSignal;

  /**
   * Function to calculate the delay for a retry.
   */
  calculateDelay?: (retryCount: number) => number;

  /**
   * Function to determine if a request should be retried.
   */
  shouldRetry?: (error: Error, retryCount: number) => boolean;
}

/**
 * Class to use as a base for all services that need to perform HTTP requests.
 * Provides a cleaner `fetch` API with better error handling.
 */
export default class HttpClient {
  /**
   * Telemetry system.
   */
  protected telemetry: Telemetry;

  /**
   * Default maximum request duration (in ms) before generating a timeout.
   */
  protected defaultRequestTimeout: number;

  /**
   * Calculates the delay for a retry.
   *
   * @param retryCount Retry count.
   *
   * @returns Delay in ms.
   */
  protected defaultCalculateDelay: (retryCount: number) => number;

  /**
   * Determines if a request should be retried.
   *
   * @param error Last request error.
   *
   * @param retryCount Retry count.
   *
   * @returns Whether to retry the request.
   */
  protected defaultShouldRetry: (error: Error, retryCount: number) => boolean;

  /**
   * Performs a new raw HTTP request with `settings` while handling retries if necessary.
   *
   * @param settings Request settings.
   *
   * @param retryCount Retry count. Defaults to `0`.
   *
   * @returns Raw HTTP response.
   *
   * @throws If maximum number of retries has been reached.
   */
  protected async handleRetries(settings: RequestSettings, retryCount = 0): Promise<Response> {
    const shouldRetry = settings.shouldRetry ?? this.defaultShouldRetry;
    const calculateDelay = settings.calculateDelay ?? this.defaultCalculateDelay;

    try {
      return await this.rawRequest(settings, retryCount);
    } catch (error) {
      if (!shouldRetry(error as Error, retryCount)) {
        throw error;
      }
      await new Promise((resolve) => { setTimeout(resolve, calculateDelay(retryCount)); });
      return this.handleRetries(settings, retryCount + 1);
    }
  }

  /**
   * Performs a new HTTP request with `settings`.
   * Automatically handles request body serialization and `Content-Type` headers.
   *
   * @param settings Request settings (URL, method, body, ...).
   *
   * @param retryCount Retry count, for telemetry purposes. Defaults to `0`.
   *
   * @returns Raw HTTP response.
   *
   * @throws If request fails, either because of a network error, or if HTTP status is >= 400.
   */
  protected async rawRequest(settings: RequestSettings, retryCount = 0): Promise<Response> {
    const parsedUrl = new URL(settings.url);
    const spanStartTime = this.telemetry.now();
    return this.telemetry.span(settings.method, {
      attributes: {
        'url.full': settings.url,
        'server.port': parsedUrl.port,
        'url.scheme': parsedUrl.protocol,
        'server.address': parsedUrl.hostname,
        'http.request.method': settings.method,
        'http.request.resend_count': (retryCount > 0) ? retryCount : undefined,
      },
    }, async (span) => {
      let { body } = settings;
      const headers = { ...settings.headers };

      if (settings.body instanceof FormData) {
        headers['Content-Type'] = 'multipart/form-data';
      } else if (isPlainObject(settings.body)) {
        body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(settings.url, {
        redirect: 'manual',
        body: body as BodyInit,
        method: settings.method,
        headers: headers as HeadersInit,
        signal: settings.signal ?? AbortSignal.timeout(this.defaultRequestTimeout),
      });

      span.setAttributes({ 'http.response.status_code': response.status });

      const attributes = {
        'server.port': parsedUrl.port,
        'url.scheme': parsedUrl.protocol,
        'server.address': parsedUrl.hostname,
        'http.request.method': settings.method,
      };

      this.telemetry.measure('http.client.active_requests', 1, attributes);

      if (response.status >= 400) {
        const data = ((response.headers.get('content-type')?.includes('application/json'))
          ? await response.json()
          : await response.text()) as Response;

        this.telemetry.measure('http.client.request.duration', this.telemetry.duration(spanStartTime), {
          ...attributes,
          'http.response.status_code': response.status,
          'error.type': (data as { error?: { code?: string; }; }).error?.code,
        });

        throw new HttpError(response.status, data);
      }

      this.telemetry.measure('http.client.request.duration', this.telemetry.duration(spanStartTime), {
        ...attributes,
        'http.response.status_code': response.status,
      });

      return response;
    });
  }

  /**
   * Performs a new HTTP request with `settings`.
   * Automatically handles response body parsing.
   *
   * @param settings Request settings (URL, method, body, ...).
   *
   * @returns Parsed HTTP response.
   */
  protected async request<Response>(settings: RequestSettings): Promise<Response> {
    return this.telemetry.span(`${this.constructor.name}.request`, {}, async () => {
      const response = await this.handleRetries(settings);

      if (response.body === null) {
        return null as unknown as Response;
      }

      const data = ((response.headers.get('content-type')?.includes('application/json'))
        ? await response.json()
        : await response.text()) as Response;

      return data;
    });
  }

  /**
   * Class constructor.
   *
   * @param telemetry Telemetry system to use.
   *
   * @param settings HTTP client settings.
   */
  public constructor(telemetry: Telemetry, settings: HttpClientSettings) {
    this.telemetry = telemetry;
    this.defaultRequestTimeout = settings.requestTimeout;
    this.defaultCalculateDelay = settings.calculateDelay ?? HttpClient.exponentialBackoffDelay(
      1000,
      30 * 1000,
      2,
    );
    this.defaultShouldRetry = settings.shouldRetry ?? ((error, retryCount): boolean => (
      (retryCount < (settings.maxRetries ?? 3)) && (
        error instanceof TypeError
        || (error instanceof HttpError && error.status >= 500)
        || (error instanceof DOMException && error.name !== 'AbortError')
      )
    ));
    this.telemetry.createUpDownCounter('http.client.active_requests', {
      valueType: 1, // DOUBLE
      unit: '{request}',
      description: 'Number of active HTTP requests.',
    });
    this.telemetry.createHistogram('http.client.request.duration', {
      description: 'Duration of HTTP client requests.',
      unit: 's',
      advice: {
        explicitBucketBoundaries: [
          0.005,
          0.01,
          0.025,
          0.05,
          0.075,
          0.1,
          0.25,
          0.5,
          0.75,
          1,
          2.5,
          5,
          7.5,
          10,
        ],
      },
    });
  }

  /**
   * Generates the exponential backoff delay function.
   *
   * @param baseDelayBetweenRetries Base delay between retries (in ms).
   *
   * @param maxDelayBetweenRetries Maximum delay between retries (in ms).
   *
   * @param retryFactor Factor to apply to the delay between retries.
   *
   * @returns Exponential backoff delay function.
   */
  public static exponentialBackoffDelay(
    baseDelayBetweenRetries: number,
    maxDelayBetweenRetries: number,
    retryFactor: number,
  ) {
    return (retryCount: number): number => Math.min(
      baseDelayBetweenRetries * retryFactor ** retryCount,
      maxDelayBetweenRetries,
    );
  }
}
