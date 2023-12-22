/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Engine from 'scripts/core/Engine';
import loaderDisplayer from 'scripts/plugins/loaderDisplayer';

type Hook = (data: unknown, done: (_: null) => Promise<unknown>) => Promise<void>;

describe('plugins/loaderDisplayer', () => {
  vi.useFakeTimers();

  const toggleLoader = vi.fn();
  const next = vi.fn(async (data: unknown) => {
    await Promise.resolve();
    return (process.env.NULL_NEXT_DATA === 'true' ? null : data);
  });
  const hooks: Record<string, Hook[]> = {
    step: [],
    submit: [],
    afterStep: [],
    userAction: [],
  };

  const engine = {
    toggleLoader,
    getSteps: vi.fn(() => [{
      path: 'root.0',
      status: 'progress',
      fields: [],
    }]),
    createStep: vi.fn(),
    getConfiguration: vi.fn((path) => (path === 'root.0.submit' ? { submit: true } : {})),
    on: (eventName: string, callback: Hook): void => {
      hooks[eventName].push(callback);
    },
    trigger: async (eventName: string, data: unknown): Promise<void> => {
      await hooks[eventName][0](data, next);
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NULL_NEXT_DATA;
    loaderDisplayer()(engine as unknown as Engine);
  });

  describe('userAction hook', () => {
    test('input on non-submitting step field', async () => {
      await engine.trigger('userAction', { path: 'root.0.wrong', type: 'input' });
      expect(engine.toggleLoader).not.toHaveBeenCalled();
    });

    test('input on submitting step field', async () => {
      await engine.trigger('userAction', { path: 'root.0.submit', type: 'input' });
      expect(engine.toggleLoader).toHaveBeenCalledTimes(1);
      expect(engine.toggleLoader).toHaveBeenCalledWith(true);
    });

    test('input on last step field with hooks interruption', async () => {
      process.env.NULL_NEXT_DATA = 'true';
      await engine.trigger('userAction', { path: 'root.0.submit', type: 'input' });
      expect(engine.toggleLoader).toHaveBeenCalledTimes(2);
      expect(engine.toggleLoader).toHaveBeenCalledWith(true);
      expect(engine.toggleLoader).toHaveBeenCalledWith(false);
    });
  });

  describe('step hook', () => {
    test('normal behaviour', async () => {
      await engine.trigger('userAction', null);
      const result = engine.trigger('step', null);
      await vi.runAllTimersAsync();
      await result;
      expect(engine.toggleLoader).not.toHaveBeenCalled();
    });

    test('hook interruption', async () => {
      await engine.trigger('userAction', { path: 'root.0.submit', type: 'input' });
      const result = engine.trigger('step', null);
      await vi.runAllTimersAsync();
      await result;
      expect(engine.toggleLoader).toHaveBeenCalledTimes(2);
      expect(engine.toggleLoader).toHaveBeenCalledWith(true);
      expect(engine.toggleLoader).toHaveBeenCalledWith(false);
    });
  });

  describe('afterStep hook', () => {
    test('loader still displayed', async () => {
      await engine.trigger('userAction', { path: 'root.0.submit', type: 'input' });
      await engine.trigger('afterStep', {});
      expect(engine.toggleLoader).toHaveBeenCalledTimes(2);
      expect(engine.toggleLoader).toHaveBeenCalledWith(true);
      expect(engine.toggleLoader).toHaveBeenCalledWith(false);
    });

    test('loader not displayed', async () => {
      await engine.trigger('userAction', { path: 'root.0.submit', type: 'input' });
      await engine.trigger('afterStep', {});
      expect(engine.toggleLoader).toHaveBeenCalledTimes(2);
      expect(engine.toggleLoader).toHaveBeenCalledWith(true);
      expect(engine.toggleLoader).toHaveBeenCalledWith(false);
    });
  });
});
