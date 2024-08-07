/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import router, { type RoutingContext } from 'scripts/extensions/router';

vi.mock('path-to-regexp');

describe('extensions/router', () => {
  const state: RoutingContext = {
    host: '',
    path: '',
    route: '',
    query: {},
    params: {},
    protocol: '',
  };

  beforeAll(() => {
    window.addEventListener = vi.fn((_event, callback) => { (callback as () => void)(); });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MATCH = '0';
  });

  test('[setup]', () => {
    const module = router(['/home', '/user/:id']);
    const mutate = vi.fn();
    const dispatch = vi.fn();
    const register = vi.fn();
    const unregister = vi.fn();
    const combine = vi.fn();
    const uncombine = vi.fn();
    module.setup?.({
      id: 'router',
      mutate,
      register,
      uncombine,
      unregister,
      dispatch,
      combine,
    });
    expect(module.state).toEqual({
      host: 'localhost:3000',
      params: {},
      path: '/',
      protocol: 'http',
      query: {},
      route: null,
    });
    expect(window.addEventListener).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith('router', 'POP_STATE');
  });

  test('[NAVIGATE] query string format is not valid', () => {
    const consle = console;
    consle.warn = vi.fn();
    const module = router(['/home', '/user/:id']);
    const newState = module.mutations.NAVIGATE?.({ id: 'router', state }, '/user/125?qazdzad&azdzad');
    expect((newState as { query: unknown; }).query).toEqual({});
    expect(consle.warn).toHaveBeenCalledWith('Invalid query string "?qazdzad&azdzad".');
  });

  test('[NAVIGATE] same route', () => {
    const module = router(['/']);
    const historySpy = vi.spyOn(window.history, 'pushState');
    historySpy.mockImplementation(vi.fn);
    const newState = { ...state, path: '/?q=ok' };
    expect(module.mutations.NAVIGATE?.({ id: 'router', state: newState }, '/?q=ok')).toBe(newState);
    expect(window.history.pushState).toBeCalledTimes(0);
    historySpy.mockRestore();
  });

  test('[NAVIGATE] different route', () => {
    process.env.MATCH = '1';
    const module = router(['/user/:id', '/home']);
    const newState = module.mutations.NAVIGATE?.({ id: 'router', state }, '/user/125?q=ok');
    expect(newState).toEqual({
      host: 'localhost:3000',
      params: { id: '125' },
      path: '/user/125?q=ok',
      protocol: 'http',
      query: { q: 'ok' },
      route: '/user/:id',
    });
  });

  test('[POP_STATE]', () => {
    process.env.MATCH = '3';
    const module = router(['/home', '/user/:id']);
    module.mutations.NAVIGATE?.({ id: 'router', state }, '/home');
    process.env.MATCH = '2';
    module.mutations.NAVIGATE?.({ id: 'router', state }, '/home');
    const newState = module.mutations.POP_STATE?.({ id: 'router', state });
    expect(newState).toEqual({
      host: 'localhost:3000',
      params: {},
      path: '/home',
      protocol: 'http',
      query: {},
      route: '/home',
    });
  });
});
