/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import isPlainObject from 'scripts/helpers/isPlainObject';

/** HTTP request settings. */
export interface RequestSettings {
  /** HTTP method to use. */
  method: 'GET' | 'PATCH' | 'DELETE' | 'PUT' | 'POST' | 'HEAD' | 'OPTIONS';

  /** Request URL. */
  url: string;

  /** Request body. */
  body?: string | FormData | Record<string, unknown>;

  /** Request headers. */
  headers?: Record<string, string>;
}

/**
 * Class to use as a base for all services that need to perform HTTP requests.
 * Provides a cleaner `fetch` API with better error handling.
 */
export default class HttpClient {
  /** Maximum request duration (in ms) before generating a timeout. */
  protected connectTimeout: number;

  /**
   * Performs a new HTTP request with `settings`.
   * Automatically handles request body serialization and `Content-Type` headers.
   *
   * @param settings Request settings (URL, method, body, ...).
   *
   * @returns Raw HTTP response.
   *
   * @throws If request fails, either because of a network error, or if HTTP status is >= 400.
   */
  protected async rawRequest(settings: RequestSettings): Promise<Response> {
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
      signal: AbortSignal.timeout(this.connectTimeout),
    });

    if (response.status >= 400) {
      const data = ((response.headers.get('content-type')?.includes('application/json'))
        ? await response.json()
        : await response.text()) as Response;
      // Spreading error doesn't work, we need to explicitly list all its properties.
      throw {
        body: data,
        ok: response.ok,
        url: response.url,
        type: response.type,
        status: response.status,
        headers: response.headers,
        statusText: response.statusText,
        redirected: response.redirected,
      } as unknown as Error;
    }

    return response;
  }

  /**
   * Performs a new HTTP request with `settings`.
   * Automatically handles request body serialization, `Content-Type` headers and response body
   * parsing.
   *
   * @param settings Request settings (URL, method, body, ...).
   *
   * @returns Parsed HTTP response.
   */
  protected async request<Response>(settings: RequestSettings): Promise<Response> {
    const response = await this.rawRequest(settings);

    const data = ((response.headers.get('content-type')?.includes('application/json'))
      ? await response.json()
      : await response.text()) as Response;

    return data;
  }

  /**
   * Class constructor.
   *
   * @param connectTimeout Maximum request duration (in ms) before generating a timeout.
   */
  public constructor(connectTimeout: number) {
    this.connectTimeout = connectTimeout;
  }
}
