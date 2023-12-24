/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import * as idb from 'idb-keyval';
import { Id, type User } from '@perseid/core';
import Model from 'scripts/core/services/Model';
import HttpError from 'scripts/core/errors/Http';
import Logger from 'scripts/core/services/Logger';
import ApiClient from 'scripts/core/services/ApiClient';

type TestApiClient = ApiClient & {
  request: ApiClient['request'];
  getModel: ApiClient['getModel'];
  buildQuery: ApiClient['buildQuery'];
  formatInput: ApiClient['formatInput'];
  formatOutput: ApiClient['formatOutput'];
  refreshToken: ApiClient['refreshToken'];
};

describe('core/services/ApiClient', () => {
  vi.mock('idb-keyval');
  vi.mock('@perseid/core');
  vi.mock('scripts/core/errors/Http');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');

  class MockedFileReader {
    public onload = vi.fn();

    public onerror = vi.fn();

    public readAsDataURL = vi.fn(() => {
      setTimeout(() => {
        this.onload();
        this.onerror(new Error('ERROR'));
      }, 10);
      return ({ result: null });
    });
  }

  let apiClient: TestApiClient;
  const model = new Model();
  const logger = new Logger({ logLevel: 'debug' });

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = new ApiClient(model, logger, {
      baseUrl: 'https://test.test',
      mockedResponses: {
        'GET /test': {},
        'PUT /test': { codes: [500] },
      },
      endpoints: {
        auth: { refreshToken: { route: '/refresh-token' } },
        collections: {
          users: {
            list: { route: '/users' },
            create: { route: '/users' },
            view: { route: '/users/:id' },
            update: { route: '/users/:id' },
            delete: { route: '/users/:id' },
            search: { route: '/users/search' },
          },
        },
      },
    }) as TestApiClient;
  });

  test('[formatInput]', async () => {
    expect(await apiClient.formatInput('test', false)).toBe('test');
    expect(await apiClient.formatInput(new Uint8Array(), false)).toBe('');
    expect(await apiClient.formatInput(['test'], false)).toEqual(['test']);
    expect(await apiClient.formatInput(new Id(), false)).toEqual('123456789012345678901234');
    expect(await apiClient.formatInput(new Date('2023/01/01'), false)).toBe('2023-01-01T00:00:00.000Z');
    expect(await apiClient.formatInput({ key: { subKey: 'test' } })).toEqual('{"key":{"subKey":"test"}}');
    expect(await apiClient.formatInput(new File([], 'test.png'), false)).toBe('data:application/octet-stream;base64,');
    // Covers errors thrown by FileReader.
    vi.useFakeTimers();
    Object.assign(window, { FileReader: MockedFileReader });
    const promise = apiClient.formatInput(new File([], 'test.png'), false).catch(() => null);
    vi.runAllTimers();
    expect(await promise).toBe('');
    vi.useRealTimers();
    Object.assign(window, { FileReader });
  });

  test('[formatOutput]', () => {
    expect(apiClient.formatOutput(null, { type: 'string' })).toBeNull();
    expect(apiClient.formatOutput('test', { type: 'string' })).toBe('test');
    expect(apiClient.formatOutput('', { type: 'binary' })).toEqual((new TextEncoder()).encode());
    expect(apiClient.formatOutput('123456789012345678901234', { type: 'id' })).toBeInstanceOf(Id);
    expect(apiClient.formatOutput(['test'], { type: 'array', fields: { type: 'string' } })).toEqual(['test']);
    expect(apiClient.formatOutput('2023-01-01T00:00:00.000Z', { type: 'date' })).toEqual(new Date('2023/01/01'));
    expect(apiClient.formatOutput({ key: 'test' }, { type: 'object', fields: { key: { type: 'string' } } })).toEqual({ key: 'test' });
    expect(apiClient.formatOutput({ _id: '123456789012345678901234' }, { type: 'id', relation: 'users' })).toEqual({ _id: expect.any(Id) as Id });
  });

  test('[refreshToken]', async () => {
    vi.setSystemTime(new Date('2023/01/01'));
    vi.spyOn(apiClient, 'request').mockImplementation(vi.fn(() => Promise.resolve({
      expiresIn: 1200,
      deviceId: '123456789012345678901234',
      refreshToken: '17ccb9807475814d733812b9',
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
    })));
    await apiClient.refreshToken();
    expect(idb.get).toHaveBeenCalledOnce();
    expect(idb.get).toHaveBeenCalledWith('credentials');
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      body: '{"refreshToken":"AAA1234567890"}',
      endpoint: '/auth/refresh-token',
      method: 'POST',
    });
    expect(idb.set).toHaveBeenCalledOnce();
    expect(idb.set).toHaveBeenCalledWith('credentials', {
      expiration: 1672532400000,
      deviceId: '123456789012345678901234',
      refreshToken: '17ccb9807475814d733812b9',
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
    });
    vi.useRealTimers();
  });

  test('[request] real HTTP request with authentication, expired token', async () => {
    const response = {
      status: 200,
      text: vi.fn(),
      json: vi.fn(),
      headers: { get: vi.fn() },
    } as unknown as Response;
    vi.spyOn(apiClient, 'refreshToken').mockImplementation(() => Promise.resolve({
      expiresIn: 1200,
      expiration: 1672532400000,
      deviceId: '123456789012345678901234',
      refreshToken: '17ccb9807475814d733812b9',
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
    }));
    vi.spyOn(window, 'fetch').mockImplementationOnce(() => Promise.resolve(response));
    await apiClient.request({
      body: '{}',
      headers: {},
      method: 'POST',
      endpoint: '/test',
    }, true);
    expect(apiClient.refreshToken).toHaveBeenCalledOnce();
    expect(response.text).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('https://test.test/test', {
      body: '{}',
      method: 'POST',
      endpoint: '/test',
      headers: {
        Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
        'Content-Type': 'application/json',
        'X-Device-Id': '123456789012345678901234',
      },
    });
  });

  test('[request] real HTTP, no authentication', async () => {
    const response = {
      status: 200,
      text: vi.fn(),
      json: vi.fn(),
      headers: { get: vi.fn(() => 'application/json') },
    } as unknown as Response;
    vi.spyOn(window, 'fetch').mockImplementationOnce(() => Promise.resolve(response));
    await apiClient.request({
      method: 'POST',
      endpoint: '/test',
    }, false);
    expect(response.json).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('https://test.test/test', {
      method: 'POST',
      endpoint: '/test',
      headers: { 'X-Device-Id': undefined },
    });
  });

  test('[request] real HTTP, error', async () => {
    const response = {
      status: 500,
      text: vi.fn(),
      json: vi.fn(),
      headers: { get: vi.fn() },
    } as unknown as Response;
    vi.spyOn(window, 'fetch').mockImplementationOnce(() => Promise.resolve(response));
    await expect(async () => {
      await apiClient.request({
        method: 'POST',
        endpoint: '/test',
      }, false);
    }).rejects.toThrow();
    vi.spyOn(window, 'fetch').mockImplementationOnce(() => Promise.resolve(new Response(null, {
      status: 500,
    })));
    await expect(async () => {
      await apiClient.request({
        method: 'POST',
        endpoint: '/test',
      }, false);
    }).rejects.toThrow();
  });

  test('[request] mocked HTTP request, no error', async () => {
    vi.useFakeTimers();
    const promise = apiClient.request({
      headers: {},
      method: 'GET',
      endpoint: '/test',
    }, false);
    await vi.runAllTimersAsync();
    const response = await promise;
    vi.useRealTimers();
    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith("[API CLIENT] Calling GET '/test' API endpoint...", {
      'X-Device-Id': undefined,
    }, '');
    expect(logger.debug).toHaveBeenCalledWith('[API CLIENT] HTTP status code: 200, HTTP response: ', '');
    expect(response).toEqual('');
  });

  test('[request] mocked HTTP request, error', async () => {
    await expect(async () => {
      const promise = apiClient.request({
        headers: {},
        method: 'PUT',
        endpoint: '/test',
      }, false);
      await promise;
    }).rejects.toThrow(new HttpError({ data: '', status: 500 }));
  });

  test('[buildQuery]', () => {
    expect(apiClient.buildQuery({})).toEqual('');
    expect(apiClient.buildQuery({
      page: 2,
      limit: 20,
      offset: 20,
      query: 'test',
      sortOrder: [1],
      sortBy: ['field1'],
      fields: ['field1'],
      filters: { field1: true },
    })).toEqual('?page=2&limit=20&offset=20&fields=field1&query=test&sortBy=field1&sortOrder=1');
  });

  test('[getModel]', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    await apiClient.getModel('users');
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      method: 'GET',
      endpoint: '/_model?collection=users',
    });
    expect(model.update).toHaveBeenCalledOnce();
  });

  test('[signOut]', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    await apiClient.signOut();
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      method: 'POST',
      endpoint: '/auth/sign-out',
    });
  });

  test('[signIn]', async () => {
    vi.setSystemTime(new Date('2023/01/01'));
    vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve(''));
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({
      expiresIn: 1200,
      deviceId: '123456789012345678901234',
      refreshToken: '17ccb9807475814d733812b9',
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
    }));
    await apiClient.signIn('test@test.test', 'Hello123!');
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      body: '',
      method: 'POST',
      endpoint: '/auth/sign-in',
    }, false);
    expect(idb.set).toHaveBeenCalledOnce();
    expect(idb.set).toHaveBeenCalledWith('credentials', {
      expiration: 1672532400000,
      deviceId: '123456789012345678901234',
      refreshToken: '17ccb9807475814d733812b9',
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
    });
  });

  test('[signUp]', async () => {
    vi.setSystemTime(new Date('2023/01/01'));
    vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve(''));
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({
      expiresIn: 1200,
      deviceId: '123456789012345678901234',
      refreshToken: '17ccb9807475814d733812b9',
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
    }));
    await apiClient.signUp('test@test.test', 'Hello123!', 'Hello123!');
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      body: '',
      method: 'POST',
      endpoint: '/auth/sign-up',
    }, false);
    expect(idb.set).toHaveBeenCalledOnce();
    expect(idb.set).toHaveBeenCalledWith('credentials', {
      expiration: 1672532400000,
      deviceId: '123456789012345678901234',
      refreshToken: '17ccb9807475814d733812b9',
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
    });
  });

  test('[resetPassword]', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve(''));
    await apiClient.resetPassword('resetToken', 'Hello123!', 'Hello123!');
    expect(apiClient.formatInput).toHaveBeenCalledOnce();
    expect(apiClient.formatInput).toHaveBeenCalledWith({
      password: 'Hello123!',
      passwordConfirmation: 'Hello123!',
      resetToken: 'resetToken',
    });
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      body: '',
      method: 'PUT',
      endpoint: '/auth/reset-password',
    }, false);
  });

  test('[requestPasswordReset]', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve(''));
    await apiClient.requestPasswordReset('test@test.test');
    expect(apiClient.formatInput).toHaveBeenCalledOnce();
    expect(apiClient.formatInput).toHaveBeenCalledWith({ email: 'test@test.test' });
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      body: '',
      method: 'POST',
      endpoint: '/auth/reset-password',
    }, false);
  });

  test('[verifyEmail]', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve(''));
    await apiClient.verifyEmail('verificationToken');
    expect(apiClient.formatInput).toHaveBeenCalledOnce();
    expect(apiClient.formatInput).toHaveBeenCalledWith({ verificationToken: 'verificationToken' });
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      body: '',
      method: 'PUT',
      endpoint: '/auth/verify-email',
    });
  });

  test('[requestEmailVerification]', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    await apiClient.requestEmailVerification();
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      method: 'POST',
      endpoint: '/auth/verify-email',
    });
  });

  test('[view]', async () => {
    vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
    vi.spyOn(apiClient, 'formatOutput').mockImplementation(() => ({}) as User);
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    await apiClient.view('users', 'me');
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      method: 'GET',
      endpoint: '/users/me',
    });
    expect(apiClient.buildQuery).toHaveBeenCalledOnce();
    expect(apiClient.buildQuery).toHaveBeenCalledWith({});
  });

  test('[delete]', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    await apiClient.delete('users', new Id('123456789012345678901234'));
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      method: 'DELETE',
      endpoint: '/users/123456789012345678901234',
    });
  });

  test('[create]', async () => {
    vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    vi.spyOn(apiClient, 'formatOutput').mockImplementation(() => ({}) as User);
    vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve(''));
    await apiClient.create('users', { email: 'test@test.test' });
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      body: '',
      method: 'POST',
      endpoint: '/users',
    });
    expect(apiClient.buildQuery).toHaveBeenCalledOnce();
    expect(apiClient.buildQuery).toHaveBeenCalledWith({});
  });

  test('[update]', async () => {
    vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    vi.spyOn(apiClient, 'formatOutput').mockImplementation(() => ({}) as User);
    vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve(''));
    await apiClient.update('users', 'me', { email: 'test@test.test' });
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      body: '',
      method: 'PUT',
      endpoint: '/users/me',
    });
    expect(apiClient.buildQuery).toHaveBeenCalledOnce();
    expect(apiClient.buildQuery).toHaveBeenCalledWith({});
  });

  test('[list]', async () => {
    vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({
      total: 0,
      results: [{}],
    }));
    vi.spyOn(apiClient, 'formatOutput').mockImplementation(() => ({}) as User);
    vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve(''));
    await apiClient.list('users');
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      method: 'GET',
      endpoint: '/users',
    });
    expect(apiClient.buildQuery).toHaveBeenCalledOnce();
    expect(apiClient.buildQuery).toHaveBeenCalledWith({});
  });

  test('[search]', async () => {
    vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({
      total: 0,
      results: [{}],
    }));
    vi.spyOn(apiClient, 'formatOutput').mockImplementation(() => ({}) as User);
    vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve(''));
    await apiClient.search('users', { filters: null, query: { on: ['email'], text: 'test' } });
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      body: '',
      method: 'POST',
      endpoint: '/users/search',
    });
    expect(apiClient.buildQuery).toHaveBeenCalledOnce();
    expect(apiClient.buildQuery).toHaveBeenCalledWith({});
  });
});
