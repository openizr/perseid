/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import {
  Id,
  HttpClient,
  type ResourceSchema,
  type DefaultDataModel,
  type DataModelMetadata,
} from '@perseid/core';
import * as idb from 'idb-keyval';
import Model from 'scripts/core/services/Model';
import HttpError from 'scripts/core/errors/Http';
import Logger from 'scripts/core/services/Logger';
import ApiClient from 'scripts/core/services/ApiClient';

type TestApiClient = ApiClient & {
  request: ApiClient['request'];
  endpoints: ApiClient['endpoints'];
  buildQuery: ApiClient['buildQuery'];
  formatInput: ApiClient['formatInput'];
  formatOutput: ApiClient['formatOutput'];
  refreshToken: ApiClient['refreshToken'];
  loadedResources: ApiClient['loadedResources'];
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

  const model = new Model();
  let apiClient: TestApiClient;
  let httpClientRequest: () => void;
  const logger = new Logger({ logLevel: 'debug' });
  const mockedGetDataModel = (): Promise<DataModelMetadata<ResourceSchema<DefaultDataModel>>> => (
    Promise.resolve({ schema: { fields: {} }, canonicalPath: [] })
  );

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = new ApiClient(model, logger, {
      connectTimeout: 0,
      baseUrl: 'https://test.test',
      mockedResponses: {
        'GET /test': {},
        'PUT /test': { codes: [500] },
      },
      endpoints: {
        auth: {
          viewMe: { route: '/me' },
          signIn: { route: '/sign-in' },
          signUp: { route: '/sign-up' },
          signOut: { route: '/sign-out' },
          verifyEmail: { route: '/verify-email' },
          refreshToken: { route: '/refresh-token' },
          resetPassword: { route: '/reset-password' },
          requestPasswordReset: { route: '/reset-password' },
          requestEmailVerification: { route: '/verify-email' },
        },
        resources: {
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
    const prototype = Object.getPrototypeOf(Object.getPrototypeOf(apiClient) as HttpClient) as {
      request: () => void;
    };
    vi.spyOn(prototype, 'request');
    httpClientRequest = prototype.request;
  });

  test.only('[formatInput]', async () => {
    expect(await apiClient.formatInput('test')).toBe('test');
    expect(await apiClient.formatInput(new Uint8Array())).toBe('');
    expect(await apiClient.formatInput(['test'])).toEqual(['test']);
    expect(await apiClient.formatInput(new Id())).toEqual('000000000000000000000001');
    expect(await apiClient.formatInput(new Date('2023/01/01'))).toBe('2023-01-01T00:00:00.000Z');
    expect(await apiClient.formatInput({ key: { subKey: 'test' } })).toEqual({ key: { subKey: 'test' } });
    expect(await apiClient.formatInput(new File([], 'test.png'))).toBe('data:application/octet-stream;base64,');
    // Covers errors thrown by FileReader.
    vi.useFakeTimers();
    Object.assign(window, { FileReader: MockedFileReader });
    const promise = apiClient.formatInput(new File([], 'test.png')).catch(() => null);
    vi.runAllTimers();
    expect(await promise).toBe('');
    vi.useRealTimers();
    Object.assign(window, { FileReader });
  });

  test.only('[formatOutput]', () => {
    expect(apiClient.formatOutput(null, { type: 'string' })).toBeNull();
    expect(apiClient.formatOutput('test', { type: 'string' })).toBe('test');
    expect(apiClient.formatOutput('', { type: 'binary' })).toEqual((new TextEncoder()).encode());
    expect(apiClient.formatOutput('000000000000000000000001', { type: 'id' })).toBeInstanceOf(Id);
    expect(apiClient.formatOutput(['test'], { type: 'array', fields: { type: 'string' } })).toEqual(['test']);
    expect(apiClient.formatOutput('2023-01-01T00:00:00.000Z', { type: 'date' })).toEqual(new Date('2023/01/01'));
    expect(apiClient.formatOutput({ key: 'test' }, { type: 'object', fields: { key: { type: 'string' } } })).toEqual({ key: 'test' });
    expect(apiClient.formatOutput({ _id: '000000000000000000000001' }, { type: 'id', relation: 'users' })).toEqual({ _id: expect.any(Id) as Id });
  });

  test.only('[buildQuery]', () => {
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

  describe.only('[request]', () => {
    test('real HTTP request with authentication, expired token', async () => {
      vi.setSystemTime(new Date('2023/01/02'));
      vi.spyOn(apiClient, 'refreshToken').mockImplementation(() => Promise.resolve({
        expiresIn: 1200,
        expiration: 1672532400000,
        deviceId: '000000000000000000000001',
        refreshToken: '17ccb9807475814d733812b9',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
      }));
      await apiClient.request({
        body: {},
        headers: {},
        method: 'POST',
        endpoint: '/test',
      }, true);
      expect(apiClient.refreshToken).toHaveBeenCalledOnce();
      expect(httpClientRequest).toHaveBeenCalledOnce();
      expect(httpClientRequest).toHaveBeenCalledWith({
        body: {},
        method: 'POST',
        url: 'https://test.test/test',
        headers: {
          Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
          'X-Device-Id': '000000000000000000000001',
        },
      });
      vi.useRealTimers();
    });

    test('real HTTP, no authentication', async () => {
      vi.spyOn(apiClient, 'refreshToken').mockImplementation(vi.fn());
      await apiClient.request({
        method: 'POST',
        endpoint: '/test',
      }, false);
      expect(apiClient.refreshToken).not.toHaveBeenCalled();
      expect(httpClientRequest).toHaveBeenCalledOnce();
      expect(httpClientRequest).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://test.test/test',
      });
    });

    test('mocked HTTP request, no error', async () => {
      vi.useFakeTimers();
      const promise = apiClient.request({
        headers: {},
        method: 'GET',
        endpoint: '/test',
      }, false);
      await vi.runAllTimersAsync();
      const response = await promise;
      vi.useRealTimers();
      expect(logger.debug).toHaveBeenCalledTimes(5);
      expect(logger.debug).toHaveBeenCalledWith("[API CLIENT] Calling GET '/test' API endpoint...");
      expect(logger.debug).toHaveBeenCalledWith({});
      expect(logger.debug).toHaveBeenCalledWith(undefined);
      expect(logger.debug).toHaveBeenCalledWith('[API CLIENT] HTTP status code: 200, HTTP response: ');
      expect(logger.debug).toHaveBeenCalledWith('');
      expect(response).toEqual('');
    });

    test('mocked HTTP request, error', async () => {
      await expect(async () => {
        const promise = apiClient.request({
          headers: {},
          method: 'PUT',
          endpoint: '/test',
        }, false);
        await promise;
      }).rejects.toThrow(new HttpError({ data: '', status: 500 }));
    });
  });

  test.only('[getDataModel]', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
    const response = await apiClient.getDataModel('users');
    expect(apiClient.request).toHaveBeenCalledOnce();
    expect(apiClient.request).toHaveBeenCalledWith({
      method: 'GET',
      endpoint: '/_model?resource=users',
    });
    expect(model.update).toHaveBeenCalledOnce();
    expect(apiClient.loadedResources).toEqual(new Set(['users']));
    expect(response).toEqual({
      schema: {
        fields: {
          _id: { type: 'id' },
          roles: {
            type: 'array',
            fields: { type: 'id' },
          },
        },
      },
    });
  });

  describe.only('[refreshToken]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.auth = {};
      await expect(() => (
        apiClient.refreshToken()
      )).rejects.toThrow(new Error('auth.refreshToken endpoint does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.setSystemTime(new Date('2023/01/01'));
      vi.spyOn(apiClient, 'request').mockImplementation(vi.fn(() => Promise.resolve({
        expiresIn: 1200,
        deviceId: '000000000000000000000001',
        refreshToken: '17ccb9807475814d733812b9',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
      })));
      await apiClient.refreshToken();
      expect(idb.get).toHaveBeenCalledOnce();
      expect(idb.get).toHaveBeenCalledWith('credentials');
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        body: { refreshToken: 'AAA1234567890' },
        endpoint: '/refresh-token',
        method: 'POST',
      });
      expect(idb.set).toHaveBeenCalledOnce();
      expect(idb.set).toHaveBeenCalledWith('credentials', {
        expiration: 1672532400000,
        deviceId: '000000000000000000000001',
        refreshToken: '17ccb9807475814d733812b9',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
      });
      vi.useRealTimers();
    });
  });

  describe.only('[signOut]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.auth = {};
      await expect(() => (
        apiClient.signOut()
      )).rejects.toThrow(new Error('auth.signOut endpoint does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
      await apiClient.signOut();
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/sign-out',
      });
    });
  });

  describe.only('[signIn]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.auth = {};
      await expect(() => (
        apiClient.signIn('', '')
      )).rejects.toThrow(new Error('auth.signIn endpoint does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.setSystemTime(new Date('2023/01/01'));
      vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve({}));
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({
        expiresIn: 1200,
        deviceId: '000000000000000000000001',
        refreshToken: '17ccb9807475814d733812b9',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
      }));
      await apiClient.signIn('test@test.test', 'Hello123!');
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        body: {},
        method: 'POST',
        endpoint: '/sign-in',
      }, false);
      expect(idb.set).toHaveBeenCalledOnce();
      expect(idb.set).toHaveBeenCalledWith('credentials', {
        expiration: 1672532400000,
        deviceId: '000000000000000000000001',
        refreshToken: '17ccb9807475814d733812b9',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
      });
    });
  });

  describe.only('[signUp]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.auth = {};
      await expect(() => (
        apiClient.signUp('', '', '')
      )).rejects.toThrow(new Error('auth.signUp endpoint does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.setSystemTime(new Date('2023/01/01'));
      vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve({}));
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({
        expiresIn: 1200,
        deviceId: '000000000000000000000001',
        refreshToken: '17ccb9807475814d733812b9',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
      }));
      await apiClient.signUp('test@test.test', 'Hello123!', 'Hello123!');
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        body: {},
        method: 'POST',
        endpoint: '/sign-up',
      }, false);
      expect(idb.set).toHaveBeenCalledOnce();
      expect(idb.set).toHaveBeenCalledWith('credentials', {
        expiration: 1672532400000,
        deviceId: '000000000000000000000001',
        refreshToken: '17ccb9807475814d733812b9',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM1ODUyMjcsImV4cCI6M',
      });
    });
  });

  describe.only('[resetPassword]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.auth = {};
      await expect(() => (
        apiClient.resetPassword('', '', '')
      )).rejects.toThrow(new Error('auth.resetPassword endpoint does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
      vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve({}));
      await apiClient.resetPassword('resetToken', 'Hello123!', 'Hello123!');
      expect(apiClient.formatInput).toHaveBeenCalledOnce();
      expect(apiClient.formatInput).toHaveBeenCalledWith({
        password: 'Hello123!',
        passwordConfirmation: 'Hello123!',
        resetToken: 'resetToken',
      });
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        body: {},
        method: 'PUT',
        endpoint: '/reset-password',
      }, false);
    });
  });

  describe.only('[requestPasswordReset]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.auth = {};
      await expect(() => (
        apiClient.requestPasswordReset('')
      )).rejects.toThrow(new Error('auth.requestPasswordReset endpoint does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
      vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve({}));
      await apiClient.requestPasswordReset('test@test.test');
      expect(apiClient.formatInput).toHaveBeenCalledOnce();
      expect(apiClient.formatInput).toHaveBeenCalledWith({ email: 'test@test.test' });
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        body: {},
        method: 'POST',
        endpoint: '/reset-password',
      }, false);
    });
  });

  describe.only('[verifyEmail]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.auth = {};
      await expect(() => (
        apiClient.verifyEmail('')
      )).rejects.toThrow(new Error('auth.verifyEmail endpoint does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
      vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve({}));
      await apiClient.verifyEmail('verificationToken');
      expect(apiClient.formatInput).toHaveBeenCalledOnce();
      expect(apiClient.formatInput).toHaveBeenCalledWith({ verificationToken: 'verificationToken' });
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        body: {},
        method: 'PUT',
        endpoint: '/verify-email',
      });
    });
  });

  describe.only('[requestEmailVerification]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.auth = {};
      await expect(() => (
        apiClient.requestEmailVerification()
      )).rejects.toThrow(new Error('auth.requestEmailVerification endpoint does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
      await apiClient.requestEmailVerification();
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/verify-email',
      });
    });
  });

  describe.only('[viewMe]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.auth = {};
      await expect(() => (
        apiClient.viewMe()
      )).rejects.toThrow(new Error('auth.viewMe endpoint does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'formatOutput').mockImplementation(() => ({}));
      vi.spyOn(apiClient, 'getDataModel').mockImplementation(mockedGetDataModel);
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({}));
      const response = await apiClient.viewMe();
      expect(apiClient.getDataModel).toHaveBeenCalledOnce();
      expect(apiClient.getDataModel).toHaveBeenCalledWith('users');
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/me',
      });
      expect(response).toEqual({});
    });
  });

  describe.only('[view]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.resources = {};
      await expect(() => (
        apiClient.view('users', new Id('000000000000000000000001'))
      )).rejects.toThrow(new Error('View endpoint for users does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
      vi.spyOn(apiClient, 'formatOutput').mockImplementation(() => ({}));
      vi.spyOn(apiClient, 'getDataModel').mockImplementation(mockedGetDataModel);
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({}));
      const response = await apiClient.view('users', new Id('000000000000000000000001'));
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users/000000000000000000000001',
      });
      expect(apiClient.getDataModel).toHaveBeenCalledOnce();
      expect(apiClient.getDataModel).toHaveBeenCalledWith('users');
      expect(apiClient.buildQuery).toHaveBeenCalledOnce();
      expect(apiClient.buildQuery).toHaveBeenCalledWith({});
      expect(response).toEqual({});
    });
  });

  describe.only('[delete]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.resources = {};
      await expect(() => (
        apiClient.delete('users', new Id('000000000000000000000001'))
      )).rejects.toThrow(new Error('Delete endpoint for users does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
      await apiClient.delete('users', new Id('000000000000000000000001'));
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'DELETE',
        endpoint: '/users/000000000000000000000001',
      });
    });
  });

  describe.only('[create]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.resources = {};
      await expect(() => (
        apiClient.create('users', { email: 'test@test.test' })
      )).rejects.toThrow(new Error('Create endpoint for users does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
      vi.spyOn(apiClient, 'formatOutput').mockImplementation(() => ({}));
      vi.spyOn(apiClient, 'getDataModel').mockImplementation(mockedGetDataModel);
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
      vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve({}));
      const response = await apiClient.create('users', { email: 'test@test.test' });
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        body: {},
        method: 'POST',
        endpoint: '/users',
      });
      expect(apiClient.getDataModel).toHaveBeenCalledOnce();
      expect(apiClient.getDataModel).toHaveBeenCalledWith('users');
      expect(apiClient.buildQuery).toHaveBeenCalledOnce();
      expect(apiClient.buildQuery).toHaveBeenCalledWith({});
      expect(response).toEqual({});
    });
  });

  describe.only('[update]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.resources = {};
      await expect(() => (
        apiClient.update('users', new Id('000000000000000000000001'), { email: 'test@test.test' })
      )).rejects.toThrow(new Error('Update endpoint for users does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
      vi.spyOn(apiClient, 'formatOutput').mockImplementation(() => ({}));
      vi.spyOn(apiClient, 'getDataModel').mockImplementation(mockedGetDataModel);
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve());
      vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve({}));
      const response = await apiClient.update('users', new Id('000000000000000000000001'), {
        email: 'test@test.test',
      });
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        body: {},
        method: 'PUT',
        endpoint: '/users/000000000000000000000001',
      });
      expect(apiClient.getDataModel).toHaveBeenCalledOnce();
      expect(apiClient.getDataModel).toHaveBeenCalledWith('users');
      expect(apiClient.buildQuery).toHaveBeenCalledOnce();
      expect(apiClient.buildQuery).toHaveBeenCalledWith({});
      expect(response).toEqual({});
    });
  });

  describe.only('[list]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.resources = {};
      await expect(() => (
        apiClient.list('users')
      )).rejects.toThrow(new Error('List endpoint for users does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
      vi.spyOn(apiClient, 'getDataModel').mockImplementation(mockedGetDataModel);
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({ total: 0, results: [] }));
      const response = await apiClient.list('users');
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
      });
      expect(apiClient.getDataModel).toHaveBeenCalledOnce();
      expect(apiClient.getDataModel).toHaveBeenCalledWith('users');
      expect(apiClient.buildQuery).toHaveBeenCalledOnce();
      expect(apiClient.buildQuery).toHaveBeenCalledWith({});
      expect(response).toEqual({ total: 0, results: [] });
    });
  });

  describe.only('[search]', () => {
    test('no endpoint error', async () => {
      apiClient.endpoints.resources = {};
      await expect(() => (
        apiClient.search('users', { query: null, filters: null })
      )).rejects.toThrow(new Error('Search endpoint for users does not exist in configuration.'));
    });

    test('no error', async () => {
      vi.spyOn(apiClient, 'buildQuery').mockImplementation(() => '');
      vi.spyOn(apiClient, 'getDataModel').mockImplementation(mockedGetDataModel);
      vi.spyOn(apiClient, 'formatInput').mockImplementation(() => Promise.resolve({}));
      vi.spyOn(apiClient, 'request').mockImplementation(() => Promise.resolve({ total: 0, results: [] }));
      const response = await apiClient.search('users', { query: null, filters: null });
      expect(apiClient.request).toHaveBeenCalledOnce();
      expect(apiClient.request).toHaveBeenCalledWith({
        body: {},
        method: 'POST',
        endpoint: '/users/search',
      });
      expect(apiClient.getDataModel).toHaveBeenCalledOnce();
      expect(apiClient.getDataModel).toHaveBeenCalledWith('users');
      expect(apiClient.buildQuery).toHaveBeenCalledOnce();
      expect(apiClient.buildQuery).toHaveBeenCalledWith({});
      expect(response).toEqual({ total: 0, results: [] });
    });
  });
});
