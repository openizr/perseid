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
  type User,
  type IdSchema,
  type DefaultDataModel,
} from '@perseid/core';
import Model from 'scripts/core/services/Model';
import Logger from 'scripts/core/services/Logger';
import ApiClient from 'scripts/core/services/ApiClient';
import Engine, { type Configuration } from '@perseid/form';
import FormBuilder from 'scripts/core/services/FormBuilder';
import { type RoutingContext } from '@perseid/store/extensions/router';
import Store, { type NotifierState, type AuthState } from 'scripts/core/services/Store';

type TestStore = Store & {
  user: Store['user'];
  pages: Store['pages'];
  authModule: Store['authModule'];
  pageModule: Store['pageModule'];
  errorModule: Store['errorModule'];
  catchErrors: Store['catchErrors'];
  modalModule: Store['modalModule'];
  getPageData: Store['getPageData'];
  formatOutput: Store['formatOutput'];
  registryModule: Store['registryModule'];
  notifierModule: Store['notifierModule'];
  computeSorting: Store['computeSorting'];
  normalizeResources: Store['normalizeResources'];
  errorNotifierPlugin: Store['errorNotifierPlugin'];
  redirectToSignInPage: Store['redirectToSignInPage'];
};

describe('core/services/Store', () => {
  vi.mock('biuty');
  vi.mock('@perseid/core');
  vi.mock('@perseid/form');
  vi.mock('@perseid/store');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');
  vi.mock('scripts/core/services/ApiClient');
  vi.mock('@perseid/store/extensions/router');
  vi.mock('scripts/core/services/FormBuilder');

  let store: TestStore;
  const model = new Model();
  const logger = new Logger({ logLevel: 'debug' });
  const formBuilder = new FormBuilder(model, logger);
  const apiClient = new ApiClient(model, logger, {
    baseUrl: '',
    mockedResponses: {},
    endpoints: { auth: {}, collections: {} },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FORBIDDEN;
    store = new Store(model, logger, apiClient, formBuilder, {
      fallbackPageRoute: '/',
      pages: {
        auth: {
          signIn: { route: '/sign-in' },
          signUp: { route: '/sign-up' },
          updateUser: { route: '/users/me' },
          resetPassword: { route: '/reset-password' },
        },
        collections: {
          roles: { view: { route: '/roles/:id' } },
          users: {
            create: { route: '/users/create' },
            view: { route: '/users/:id', pageProps: { fields: ['_id'] } },
            update: { route: '/users/:id/edit', pageProps: { fields: ['email'] } },
            list: { route: '/users', pageProps: { fields: ['_id'], searchFields: ['email'] } },
          },
        },
      },
    }) as TestStore;
  });

  test('[errorNotifierPlugin]', () => {
    vi.spyOn(store, 'notify');
    store.errorNotifierPlugin({
      on: vi.fn((_, callback: (data: unknown, next: () => void) => void) => {
        callback({}, vi.fn());
      }),
    } as unknown as Engine);
    expect(logger.error).toHaveBeenCalledOnce();
    expect(store.notify).toHaveBeenCalledOnce();
  });

  test('[errorModule]', () => {
    expect(store.errorModule.mutations.SET?.({ id: 'error', state: null }, null)).toEqual(null);
    expect(store.errorModule.mutations.RESET?.({ id: 'error', state: null })).toEqual(null);
  });

  test('[registryModule]', () => {
    expect(store.registryModule.mutations.DELETE?.({ id: 'registry', state: {} }, {})).toEqual({});
    expect(store.registryModule.mutations.REMOVE?.({ id: 'registry', state: {} }, {})).toEqual({});
    expect(store.registryModule.mutations.REFRESH?.({ id: 'registry', state: {} }, {})).toEqual({});
  });

  test('[pageModule]', () => {
    const id = new Id();
    expect(store.pageModule.mutations.UPDATE?.({ id: 'page', state: null }, null)).toBeNull();
    expect(store.pageModule.mutations.UPDATE?.({ id: 'page', state: null }, {
      id,
      fields: [],
      loading: false,
    })).toEqual({
      id,
      fields: [],
      loading: false,
    });
  });

  test('[authModule]', async () => {
    const actionApi = {
      id: 'auth',
      combine: vi.fn(),
      mutate: vi.fn(),
      register: vi.fn(),
      dispatch: vi.fn(),
      uncombine: vi.fn(),
      unregister: vi.fn(),
    };
    const state = { status: 'INITIAL' as const, user: null };
    expect(store.authModule.mutations.UPDATE_STATUS?.({ id: 'auth', state }, 'PENDING')).toEqual({
      user: null,
      status: 'PENDING',
    });
    expect(store.authModule.mutations.SIGN_IN?.({ id: 'auth', state }, {})).toEqual({
      user: {},
      status: 'SUCCESS',
    });
    expect(store.authModule.mutations.SIGN_OUT?.({ id: 'auth', state })).toEqual({
      user: null,
      status: 'ERROR',
    });
    await store.authModule.actions?.signIn?.(actionApi, {});
    expect(apiClient.signIn).toHaveBeenCalledOnce();
    await store.authModule.actions?.signOut?.(actionApi, {});
    expect(apiClient.signOut).toHaveBeenCalledOnce();
    await store.authModule.actions?.signUp?.(actionApi, {});
    expect(apiClient.signUp).toHaveBeenCalledOnce();
    await store.authModule.actions?.resetPassword?.(actionApi, {});
    expect(apiClient.resetPassword).toHaveBeenCalledOnce();
    await store.authModule.actions?.verifyEmail?.(actionApi, {});
    expect(apiClient.verifyEmail).toHaveBeenCalledOnce();
    await store.authModule.actions?.requestEmailVerification?.(actionApi, {});
    expect(apiClient.requestEmailVerification).toHaveBeenCalledOnce();
    await store.authModule.actions?.requestPasswordReset?.(actionApi, {});
    expect(apiClient.requestPasswordReset).toHaveBeenCalledOnce();
    await store.authModule.actions?.updateUser?.(actionApi, {});
    expect(apiClient.update).toHaveBeenCalledOnce();
    await store.authModule.actions?.getUser?.(actionApi, {});
    expect(apiClient.view).toHaveBeenCalledOnce();
  });

  test('[notifierModule]', () => {
    const state: NotifierState = [{
      id: '1',
      message: '',
      closable: true,
      timer: { duration: 5000, startedAt: 1672531200000, id: 3 },
    }];
    vi.setSystemTime(new Date('2023/01/01'));
    expect(store.notifierModule.mutations.PUSH?.({ id: 'notifier', state }, {})).toEqual([
      {
        id: '1',
        message: '',
        closable: true,
        timer: { duration: 5000, startedAt: 1672531200000, id: 3 },
      },
      {
        closable: true,
        id: '18972182',
        modifiers: '',
        timer: {
          duration: 5000,
          startedAt: 1672531200000,
          id: expect.any(Object) as NodeJS.Timeout,
        },
      }]);
    expect(store.notifierModule.mutations.PAUSE?.({ id: 'notifier', state }, '1')).toEqual([{
      timer: { duration: 5000 },
    }]);
    expect(store.notifierModule.mutations.RESUME?.({ id: 'notifier', state }, '1')).toEqual([{
      timer: { startedAt: 1672531200000, id: expect.any(Object) as NodeJS.Timeout },
    }]);
    expect(store.notifierModule.mutations.REMOVE?.({ id: 'notifier', state }, '1')).toEqual([]);
    expect(store.notifierModule.mutations.PAUSE?.({ id: 'notifier', state }, '2')).toEqual({
      0: {
        id: '1',
        message: '',
        closable: true,
        timer: { startedAt: 1672531200000, id: 3, duration: 5000 },
      },
    });
    expect(store.notifierModule.mutations.RESUME?.({ id: 'notifier', state }, '2')).toEqual({
      0: {
        id: '1',
        message: '',
        closable: true,
        timer: { startedAt: 1672531200000, id: 3, duration: 5000 },
      },
    });
    expect(store.notifierModule.mutations.REMOVE?.({ id: 'notifier', state }, '2')).toEqual({
      0: {
        id: '1',
        message: '',
        closable: true,
        timer: { startedAt: 1672531200000, id: 3, duration: 5000 },
      },
    });
  });

  test('[modalModule]', () => {
    const state = {
      show: false,
      modifiers: '',
      component: '',
      componentProps: {},
    };
    expect(store.modalModule.mutations.SHOW?.({ id: 'modal', state }, {})).toEqual({
      show: true,
      modifiers: '',
      component: '',
      componentProps: {},
    });
    expect(store.modalModule.mutations.HIDE?.({ id: 'modal', state }, {})).toEqual({
      show: false,
      modifiers: '',
      component: '',
      componentProps: {},
    });
  });

  test('[computeSorting]', () => {
    expect(store.computeSorting('', '')).toEqual({});
    expect(store.computeSorting('email', '1')).toEqual({ email: 1 });
    expect(store.computeSorting('email', '-1')).toEqual({ email: -1 });
  });

  test('[catchErrors]', async () => {
    let promise = (): Promise<void> => Promise.reject({ status: 401 });
    await store.catchErrors(promise(), true);
    expect(store.mutate).toHaveBeenCalledWith('auth', 'SIGN_OUT');
    promise = (): Promise<void> => Promise.reject({ status: 403, body: { error: { code: 'NOT_VERIFIED' } } });
    await store.catchErrors(promise(), true);
    expect(store.mutate).toHaveBeenCalledWith('error', 'SET', { status: 403 });
    store = new Store(model, logger, apiClient, formBuilder, {
      fallbackPageRoute: '/',
      pages: { auth: { verifyEmail: { route: '/verify-email' } }, collections: {} },
    }) as TestStore;
    promise = (): Promise<void> => Promise.reject({ status: 403, body: { error: { code: 'NOT_VERIFIED' } } });
    await store.catchErrors(promise(), true);
    expect(store.mutate).toHaveBeenCalledWith('router', 'NAVIGATE', '/verify-email');
    promise = (): Promise<void> => Promise.reject({ status: 404 });
    await store.catchErrors(promise(), true);
    expect(store.mutate).toHaveBeenCalledWith('error', 'SET', { status: 404 });
    promise = (): Promise<void> => Promise.reject({ body: { error: { code: 'RESOURCE_EXISTS' } } });
    await store.catchErrors(promise(), false);
    promise = (): Promise<void> => Promise.reject({ body: { error: { code: 'RESOURCE_REFERENCED' } } });
    await store.catchErrors(promise(), false);
    promise = (): Promise<void> => Promise.reject({ body: { error: { code: 'RESOURCE_REFERENCED' } } });
    await store.catchErrors(promise(), false);
    promise = (): Promise<void> => Promise.reject({ status: 403 });
    await store.catchErrors(promise(), false);
    promise = (): Promise<void> => Promise.reject({ status: 404 });
    await store.catchErrors(promise(), false);
    promise = (): Promise<void> => Promise.reject(new Error());
    await expect(() => store.catchErrors(promise(), false)).rejects.toEqual(new Error());
  });

  test('[formatOutput]', () => {
    expect(store.formatOutput(null as unknown as User, { type: 'null' }, {})).toBeNull();
    expect(store.formatOutput(['test'] as unknown as User, {
      type: 'array',
      fields: { type: 'string' },
    }, {})).toEqual(['test']);
    expect(store.formatOutput({ key: 'test' } as unknown as User, {
      type: 'object',
      fields: { key: { type: 'string' } },
    }, {})).toEqual({ key: 'test' });
    expect(store.formatOutput('123456789012345678901234' as unknown as User, {
      type: 'id',
      relation: 'users',
    }, {})).toEqual('123456789012345678901234');
    expect(store.formatOutput({ _id: '123456789012345678901234' } as unknown as User, {
      type: 'id',
      relation: 'users',
    }, {})).toEqual('123456789012345678901234');
  });

  test('[getPageData] - unexisting page', async () => {
    expect(await store.getPageData([
      { route: null, params: {}, query: {} } as RoutingContext,
      {} as AuthState,
    ])).toBeNull();
  });

  test('[getPageData] - authentication needed', async () => {
    expect(await store.getPageData([
      { route: '/users/:id', params: {}, query: {} } as RoutingContext,
      { status: 'INITIAL' } as AuthState,
    ])).toBeNull();
    expect(store.dispatch).toHaveBeenCalledOnce();
    expect(store.dispatch).toHaveBeenCalledWith('auth', 'getUser', true);
  });

  test('[getPageData] - authentication in progress', async () => {
    expect(await store.getPageData([
      { route: '/users/:id', params: {}, query: {} } as RoutingContext,
      { status: 'PENDING' } as AuthState,
    ])).toBeNull();
  });

  test('[getPageData] - authentication failed', async () => {
    vi.spyOn(store, 'redirectToSignInPage');
    expect(await store.getPageData([
      {
        query: {},
        params: {},
        path: '/users/me',
        route: '/users/:id',
      } as RoutingContext,
      { status: 'ERROR' } as AuthState,
    ])).toBeNull();
    expect(store.redirectToSignInPage).toHaveBeenCalledOnce();
    expect(store.redirectToSignInPage).toHaveBeenCalledWith('/users/me');
  });

  test('[getPageData] - authentication unecessary', async () => {
    vi.spyOn(store, 'navigate');
    store.pages['/test'] = { visibility: 'PUBLIC_ONLY', pageProps: {} };
    expect(await store.getPageData([
      {
        query: {},
        params: {},
        path: '/test',
        route: '/test',
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ])).toBeNull();
    expect(store.navigate).toHaveBeenCalledOnce();
    expect(store.navigate).toHaveBeenCalledWith('/');
  });

  test('[getPageData] - invalid resource id', async () => {
    expect(await store.getPageData([
      {
        query: {},
        params: {},
        path: '/users/me',
        route: '/users/:id',
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ])).toBeNull();
    expect(store.mutate).toHaveBeenCalledOnce();
    expect(store.mutate).toHaveBeenCalledWith('error', 'SET', { status: 404 });
  });

  test('[getPageData] - missing permissions', async () => {
    vi.spyOn(store, 'canAccessField').mockImplementation(() => false);
    expect(await store.getPageData([
      {
        query: {},
        protocol: 'http',
        host: 'localhost',
        path: '/users/me',
        route: '/users/:id',
        params: { id: '123456789012345678901234' },
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ])).toBeNull();
    expect(store.mutate).toHaveBeenCalledOnce();
    expect(store.mutate).toHaveBeenCalledWith('error', 'SET', { status: 403 });
  });

  test('[getPageData] - view page', async () => {
    vi.spyOn(store, 'view').mockImplementation(() => Promise.resolve({
      _id: '123456789012345678901234',
    } as unknown as User));
    vi.spyOn(store, 'canAccessField').mockImplementation(() => true);
    expect(await store.getPageData([
      {
        query: {},
        protocol: 'http',
        host: 'localhost',
        path: '/users/me',
        route: '/users/:id',
        params: { id: '123456789012345678901234' },
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ])).toEqual({ fields: ['_id'], id: expect.any(Id) as Id, loading: false });
    expect(store.mutate).toHaveBeenCalledOnce();
    expect(store.mutate).toHaveBeenCalledWith('page', 'UPDATE', {
      fields: ['_id'],
      id: expect.any(Id) as Id,
      loading: true,
    });
  });

  test('[getPageData] - list page', async () => {
    vi.spyOn(store, 'list').mockImplementation(() => Promise.resolve({
      total: 1,
      results: [{
        _id: '123456789012345678901234',
      } as unknown as User],
    }));
    vi.spyOn(store, 'search').mockImplementation(() => Promise.resolve({
      total: 1,
      results: [{
        _id: '123456789012345678901234',
      } as unknown as User],
    }));
    vi.spyOn(store, 'canAccessField').mockImplementation(() => true);
    expect(await store.getPageData([
      {
        query: {},
        params: {},
        protocol: 'http',
        host: 'localhost',
        path: '/users',
        route: '/users',
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ])).toEqual({
      page: 1,
      total: 1,
      limit: 20,
      sorting: {},
      search: null,
      loading: false,
      fields: ['_id'],
      collection: 'users',
      searchFields: ['email'],
      results: ['123456789012345678901234'],
    });
    expect(store.mutate).toHaveBeenCalledOnce();
    expect(store.mutate).toHaveBeenCalledWith('page', 'UPDATE', {
      page: 1,
      total: 0,
      limit: 20,
      sorting: {},
      search: null,
      loading: true,
      results: null,
      fields: ['_id'],
      collection: 'users',
      searchFields: ['email'],
    });
    delete (store.pages['/users'] as { pageProps: Record<string, string>; }).pageProps.searchFields;
    expect(await store.getPageData([
      {
        params: {},
        protocol: 'http',
        host: 'localhost',
        path: '/users',
        route: '/users',
        query: { page: '2', query: 'test' },
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ])).toEqual({
      page: 2,
      total: 1,
      limit: 20,
      sorting: {},
      loading: false,
      fields: ['_id'],
      searchFields: [],
      collection: 'users',
      results: ['123456789012345678901234'],
      search: { query: { on: [], text: 'test' }, filters: null },
    });
    expect(store.mutate).toHaveBeenCalledTimes(2);
    expect(store.mutate).toHaveBeenCalledWith('page', 'UPDATE', {
      page: 2,
      total: 0,
      limit: 20,
      sorting: {},
      loading: true,
      results: null,
      fields: ['_id'],
      searchFields: [],
      collection: 'users',
      search: { query: { on: [], text: 'test' }, filters: null },
    });
  });

  test('[getPageData] - create/update page', async () => {
    vi.spyOn(store, 'create').mockImplementation(() => Promise.resolve({
      _id: '123456789012345678901234',
    } as unknown as User));
    vi.spyOn(store, 'update').mockImplementation(() => Promise.resolve({
      _id: '123456789012345678901234',
    } as unknown as User));
    vi.spyOn(store, 'canAccessField').mockImplementation(() => true);
    vi.spyOn(store, 'normalizeResources').mockImplementation(() => [
      { email: 'test@test.test' } as unknown as User,
    ]);
    let pageData = await store.getPageData([
      {
        query: {},
        protocol: 'http',
        host: 'localhost',
        path: '/users/:id/edit',
        route: '/users/:id/edit',
        params: { id: '123456789012345678901234' },
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ]);
    (pageData as { configuration: Configuration; }).configuration.plugins?.[1]({
      userAction: vi.fn(),
      setInitialValues: vi.fn(),
      on: vi.fn((_, callback: (data: unknown, next: () => void) => void) => {
        callback({ path: 'root.0.resetPassword' }, vi.fn());
      }),
    } as unknown as Engine);
    expect(pageData).toEqual({
      fieldProps: {},
      loading: false,
      id: expect.any(Id) as Id,
      configuration: {
        initialValues: { email: 'test@test.test' },
        plugins: [expect.any(Function), expect.any(Function)],
      },
    });
    expect(store.update).toHaveBeenCalledTimes(1);
    vi.spyOn(store, 'getRoute').mockImplementation(() => null);
    pageData = await store.getPageData([
      {
        query: {},
        params: {},
        protocol: 'http',
        host: 'localhost',
        path: '/users/create',
        route: '/users/create',
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ]);
    (pageData as { configuration: Configuration; }).configuration.plugins?.[1]({
      userAction: vi.fn(),
      setInitialValues: vi.fn(),
      on: vi.fn((_, callback: (data: unknown, next: () => void) => void) => {
        callback({ path: 'root.0.resetPassword' }, vi.fn());
      }),
    } as unknown as Engine);
    expect(store.create).toHaveBeenCalledTimes(1);
    expect(pageData).toEqual({
      fieldProps: {},
      loading: false,
      configuration: {
        plugins: [expect.any(Function), expect.any(Function)],
      },
    });
    vi.spyOn(store, 'canAccessField').mockImplementation(() => false);
    process.env.FORBIDDEN = 'true';
    expect(await store.getPageData([
      {
        query: {},
        protocol: 'http',
        host: 'localhost',
        path: '/users/:id/edit',
        route: '/users/:id/edit',
        params: { id: '123456789012345678901234' },
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ])).toBeNull();
    expect(store.mutate).toHaveBeenCalledTimes(2);
    expect(store.mutate).toHaveBeenCalledWith('error', 'SET', { status: 403 });
  });

  test('[getPageData] - user update page', async () => {
    const pageData = await store.getPageData([
      {
        query: {},
        params: {},
        protocol: 'http',
        host: 'localhost',
        path: '/users/me',
        route: '/users/me',
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ]);
    (pageData as { configuration: Configuration; }).configuration.plugins?.[0]({
      userAction: vi.fn(),
      setInitialValues: vi.fn(),
      on: vi.fn((_, callback: (data: unknown, next: () => void) => void) => {
        callback({ path: 'root.0.resetPassword' }, vi.fn());
      }),
    } as unknown as Engine);
    vi.spyOn(store, 'dispatch').mockImplementation(() => Promise.resolve());
    await (pageData as { configuration: Configuration; }).configuration.onSubmit?.({}, {});
    vi.spyOn(store, 'dispatch').mockImplementation(() => Promise.reject(new Error()));
    await (pageData as { configuration: Configuration; }).configuration.onSubmit?.({}, {})
      .catch(() => null);
    vi.spyOn(store, 'dispatch').mockImplementation(() => Promise.reject({
      body: { error: { code: 'RESOURCE_EXISTS' } },
    }));
    await (pageData as { configuration: Configuration; }).configuration.onSubmit?.({}, {});
  });

  test('[getPageData] - password reset page', async () => {
    await store.getPageData([
      {
        params: {},
        protocol: 'http',
        host: 'localhost',
        path: '/reset-password',
        route: '/reset-password',
        query: { resetToken: '123456789012345678901234' },
      } as RoutingContext,
      { status: 'ERROR' } as AuthState,
    ]);
    const pageData = await store.getPageData([
      {
        query: {},
        params: {},
        protocol: 'http',
        host: 'localhost',
        path: '/reset-password',
        route: '/reset-password',
      } as RoutingContext,
      { status: 'ERROR' } as AuthState,
    ]);
    vi.spyOn(store, 'dispatch').mockImplementation(() => Promise.resolve());
    await (pageData as { configuration: Configuration; }).configuration.onSubmit?.({}, {});
    vi.spyOn(store, 'dispatch').mockImplementation(() => Promise.reject(new Error()));
    await (pageData as { configuration: Configuration; }).configuration.onSubmit?.({}, {})
      .catch(() => null);
    vi.spyOn(store, 'dispatch').mockImplementation(() => Promise.reject({
      body: { error: { code: 'INVALID_RESET_TOKEN' } },
    }));
    await (pageData as { configuration: Configuration; }).configuration.onSubmit?.({}, {});
  });

  test('[getPageData] - sign-in page', async () => {
    vi.spyOn(store, 'dispatch').mockImplementation(() => Promise.reject(new Error()));
    const pageData = await store.getPageData([
      {
        query: {},
        params: {},
        protocol: 'http',
        host: 'localhost',
        path: '/sign-in',
        route: '/sign-in',
      } as RoutingContext,
      { status: 'ERROR' } as AuthState,
    ]);
    await (pageData as { configuration: Configuration; }).configuration.onSubmit?.({}, {});
  });

  test('[getPageData] - sign-up page', async () => {
    vi.spyOn(store, 'dispatch').mockImplementation(() => Promise.reject(new Error()));
    const pageData = await store.getPageData([
      {
        query: {},
        params: {},
        protocol: 'http',
        host: 'localhost',
        path: '/sign-up',
        route: '/sign-up',
      } as RoutingContext,
      { status: 'ERROR' } as AuthState,
    ]);
    await (pageData as { configuration: Configuration; }).configuration.onSubmit?.({}, {})
      .catch(() => null);
    vi.spyOn(store, 'dispatch').mockImplementation(() => Promise.reject({
      body: { error: { code: 'RESOURCE_EXISTS' } },
    }));
    await (pageData as { configuration: Configuration; }).configuration.onSubmit?.({}, {});
  });

  test('[getPageData] - other page', async () => {
    store.pages['/test'] = { visibility: 'PRIVATE', pageProps: {} };
    expect(await store.getPageData([
      {
        query: {},
        protocol: 'http',
        host: 'localhost',
        path: '/test',
        route: '/test',
        params: { id: '123456789012345678901234' },
      } as RoutingContext,
      { status: 'SUCCESS' } as AuthState,
    ])).toBeNull();
  });

  test('[constructor]', () => {
    vi.spyOn(window, 'addEventListener').mockImplementation((_, callback) => {
      (callback as unknown as () => void)();
    });
    store = new Store(model, logger, apiClient, formBuilder, {
      fallbackPageRoute: '/',
      pages: {
        collections: {},
        auth: { verifyEmail: { route: '/verify-email' } },
      },
    }) as TestStore;
    expect(store.mutate).toHaveBeenCalledTimes(2);
    expect(store.mutate).toHaveBeenCalledWith('error', 'SET', undefined);
  });

  test('[canAccessField] - unexisting field', () => {
    expect(() => {
      store.canAccessField('users', 'invalid', 'CREATE');
    }).toThrow(new Error('Requested field "users.invalid" does not exist.'));
  });

  test('[canAccessField] - null user', () => {
    expect(store.canAccessField('users', '_id', 'CREATE')).toBe(false);
  });

  test('[canAccessField] - non-null user', () => {
    store.user = { _permissions: new Set() } as unknown as User;
    expect(store.canAccessField('users', '_id', 'CREATE')).toBe(false);
    store.user = { _permissions: new Set(['TO_SNAKE_CASE_users_VIEW']) } as unknown as User;
    expect(store.canAccessField('users', '_id', 'CREATE')).toBe(false);
    store.user = { _permissions: new Set(['TO_SNAKE_CASE_users_VIEW', 'TO_SNAKE_CASE_users_CREATE']) } as unknown as User;
    expect(store.canAccessField('users', '_verifiedAt', 'CREATE')).toBe(false);
    expect(store.canAccessField('users', 'password', 'VIEW')).toBe(false);
    expect(store.canAccessField('users', 'roles', 'VIEW')).toBe(false);
    expect(store.canAccessField('users', '_id', 'CREATE')).toBe(true);
  });

  test('[getValue]', () => {
    vi.spyOn(model, 'get').mockImplementationOnce(() => ({
      canonicalPath: [],
      schema: { type: 'id', relation: 'users' } as unknown as IdSchema<DefaultDataModel>,
    }));
    const id = '123456789012345678901234' as unknown as Id;
    const relationId = new Id();
    const registry = {
      users: {
        '123456789012345678901234': {
          _id: '123456789012345678901234',
          array: [{ key: 'test' }],
          test: 1,
          relation: relationId,
        } as unknown as User,
      },
    };
    expect(store.getValue('users', id, '_id', registry, '')).toBeNull();
    expect(store.getValue('users', id, '_id', registry)).toEqual('123456789012345678901234');
    expect(store.getValue('users', id, 'test', registry, 'field', [], 1)).toEqual(1);
    expect(store.getValue('users', id, 'test', registry, 'field', [], undefined)).toBeNull();
    expect(store.getValue('users', id, 'test', registry, 'field', [], [{ key: 'test' }])).toEqual([null]);
    expect(store.getValue('users', id, 'relation._id', registry, 'field', [], relationId)).toEqual(null);
  });

  test('[view]', async () => {
    expect(await store.view('users', new Id(), {})).toEqual({ _id: '123456789012345678901234' });
  });

  test('[delete]', async () => {
    const id = new Id();
    vi.spyOn(store, 'mutate');
    await store.delete('users', id);
    expect(store.mutate).toHaveBeenCalledOnce();
    expect(store.mutate).toHaveBeenCalledWith('registry', 'REMOVE', { collection: 'users', id });
  });

  test('[update]', async () => {
    expect(await store.update('users', new Id(), {})).toEqual({ _id: '123456789012345678901234' });
  });

  test('[create]', async () => {
    expect(await store.create('users', {})).toEqual({ _id: '123456789012345678901234' });
  });

  test('[search]', async () => {
    expect(await store.search('users', { query: null, filters: null })).toEqual({
      total: 1,
      results: [{ _id: '123456789012345678901234' }],
    });
  });

  test('[list]', async () => {
    expect(await store.list('users', {})).toEqual({
      total: 1,
      results: [{ _id: '123456789012345678901234' }],
    });
  });

  test('[listOrSearch]', async () => {
    vi.spyOn(store, 'mutate');
    vi.spyOn(window.history, 'replaceState');
    vi.spyOn(store, 'list').mockImplementation(() => Promise.resolve({
      total: 1,
      results: [{
        _id: '123456789012345678901234',
      } as unknown as User],
    }));
    vi.spyOn(store, 'search').mockImplementation(() => Promise.resolve({
      total: 1,
      results: [{
        _id: '123456789012345678901234',
      } as unknown as User],
    }));
    await store.listOrSearch('users', { filters: null, query: { on: ['email'], text: 'test ' } }, {});
    expect(window.history.replaceState).toHaveBeenCalledOnce();
    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/BUILT_QUERY');
    expect(store.search).toHaveBeenCalledOnce();
    expect(store.search).toHaveBeenCalledWith('users', { filters: null, query: { on: ['email'], text: 'test ' } }, {
      limit: 20,
      sortBy: [],
      sortOrder: [],
    });
    expect(store.mutate).toHaveBeenCalledOnce();
    expect(store.mutate).toHaveBeenCalledWith('page', 'UPDATE', { total: 1, results: ['123456789012345678901234'] });
    await store.listOrSearch('users', null, {});
    expect(window.history.replaceState).toHaveBeenCalledTimes(2);
    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/BUILT_QUERYBUILT_QUERY');
    expect(store.list).toHaveBeenCalledOnce();
    expect(store.list).toHaveBeenCalledWith('users', {
      limit: 20,
      sortBy: [],
      sortOrder: [],
    });
    expect(store.mutate).toHaveBeenCalledTimes(2);
    expect(store.mutate).toHaveBeenCalledWith('page', 'UPDATE', { total: 1, results: ['123456789012345678901234'] });
  });

  test('[goToPage]', async () => {
    vi.spyOn(window.history, 'pushState');
    vi.spyOn(store, 'listOrSearch').mockImplementation(() => Promise.resolve());
    await store.goToPage({
      collection: 'users',
      fields: [],
      limit: 10,
      loading: false,
      page: 1,
      results: [],
      searchFields: [],
      sorting: {},
      total: 0,
      search: { query: { on: ['email'], text: 'test' }, filters: null },
    });
    expect(window.history.pushState).toHaveBeenCalledOnce();
    expect(window.history.pushState).toHaveBeenCalledWith({}, '', '/BUILT_QUERYBUILT_QUERYBUILT_QUERY');
    expect(store.listOrSearch).toHaveBeenCalledOnce();
    expect(store.listOrSearch).toHaveBeenCalledWith('users', { query: { on: ['email'], text: 'test' }, filters: null }, {
      collection: 'users',
      fields: [],
      limit: 10,
      loading: false,
      offset: 0,
      page: 1,
      results: [],
      search: { query: { on: ['email'], text: 'test' }, filters: null },
      searchFields: [],
      sorting: {},
      total: 0,
    });
  });

  test('[createRoutes]', () => {
    const sub = ((_: unknown, callback: (data: unknown) => void) => {
      callback({});
    }) as unknown as () => Promise<string>;
    const cmb = ((_: unknown, __: unknown, callback: (data: unknown) => void) => {
      callback({});
    }) as unknown as () => Promise<string>;
    vi.spyOn(store, 'mutate');
    vi.spyOn(store, 'register');
    vi.spyOn(store, 'combine').mockImplementation(cmb);
    vi.spyOn(store, 'getPageData').mockImplementation(() => null as unknown as Promise<unknown>);
    vi.spyOn(store, 'subscribe').mockImplementation(sub);
    store.createRoutes();
    expect(store.register).toHaveBeenCalledOnce();
    expect(store.register).toHaveBeenCalledWith('router', undefined);
    expect(store.mutate).toHaveBeenCalledTimes(2);
    expect(store.mutate).toHaveBeenCalledWith('error', 'RESET');
    expect(store.mutate).toHaveBeenCalledWith('page', 'UPDATE', null);
  });

  test('[createRoute]', () => {
    store.createRoute('/test', {
      pageProps: {},
      type: 'CREATE',
      layoutProps: {},
      component: 'Test',
      collection: 'users',
      visibility: 'PRIVATE',
    });
    expect(store.pages['/test']).toEqual({
      pageProps: {},
      type: 'CREATE',
      layoutProps: {},
      component: 'Test',
      collection: 'users',
      visibility: 'PRIVATE',
    });
  });

  test('[updateModel]', async () => {
    await store.updateModel('users');
    await store.updateModel('users');
    expect(apiClient.getModel).toHaveBeenCalledOnce();
    expect(apiClient.getModel).toHaveBeenCalledWith('users');
  });

  test('[navigate]', () => {
    vi.spyOn(store, 'mutate');
    vi.spyOn(window, 'open').mockImplementation(vi.fn(() => null));
    const event = { preventDefault: vi.fn() } as unknown as MouseEvent;
    store.navigate('/404')(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(store.mutate).toHaveBeenCalledTimes(2);
    expect(store.mutate).toHaveBeenCalledWith('error', 'RESET');
    expect(store.mutate).toHaveBeenCalledWith('router', 'NAVIGATE', '/404');
    store.navigate('/404')({ preventDefault: vi.fn(), ctrlKey: true } as unknown as MouseEvent);
    expect(window.open).toHaveBeenCalledOnce();
    expect(window.open).toHaveBeenCalledWith('/404', '_blank');
  });

  test('[getRoute]', () => {
    expect(store.getRoute('/404')).toBeNull();
    expect(store.getRoute('roles.create')).toBeNull();
    expect(store.getRoute('auth.verifyEmail')).toBeNull();
    expect(store.getRoute('auth.signIn')).toEqual('/sign-in');
  });

  test('[getCollectionRoutes]', () => {
    expect(store.getCollectionRoutes()).toEqual([{
      collection: 'users',
      route: '/users',
    }]);
  });

  test('[getAllRoutes]', () => {
    expect(store.getAllRoutes()).toEqual([
      '/sign-in',
      '/sign-up',
      '/users/me',
      '/reset-password',
      '/roles/:id',
      '/users/create',
      '/users',
      '/users/:id/edit',
      '/users/:id',
    ]);
  });

  test('[getPage]', () => {
    expect(store.getPage('/404')).toBeNull();
  });

  test('[getFallbackPageRoute]', () => {
    expect(store.getFallbackPageRoute()).toBe('/');
  });

  test('[notify]', () => {
    vi.spyOn(store, 'mutate');
    store.notify('NOTIFICATION');
    expect(store.mutate).toHaveBeenCalledOnce();
    expect(store.mutate).toHaveBeenCalledWith('notifier', 'PUSH', { message: 'NOTIFICATION' });
  });

  test('[confirm]', () => {
    vi.spyOn(store, 'mutate');
    store.confirm({
      title: 'TITLE',
      cancel: 'CANCEL',
      confirm: 'CONFIRM',
      subTitle: 'SUBTITLE',
    });
    expect(store.mutate).toHaveBeenCalledOnce();
    expect(store.mutate).toHaveBeenCalledWith('modal', 'SHOW', {
      component: 'ConfirmationModal',
      componentProps: {
        cancel: 'CANCEL',
        confirm: 'CONFIRM',
        subTitle: 'SUBTITLE',
        title: 'TITLE',
      },
    });
  });

  test('[goBack] - no history', () => {
    const navigate = vi.fn(() => (): null => null);
    vi.spyOn(store, 'navigate').mockImplementation(navigate);
    store.goBack();
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  test('[goBack] - user history', () => {
    vi.spyOn(window.history, 'back');
    window.history.pushState({}, '', '/');
    window.history.pushState({}, '', '/');
    store.goBack();
    expect(window.history.back).toHaveBeenCalledOnce();
  });
});
