/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import type Engine from 'scripts/core/Engine';
import reCaptchaHandler from 'scripts/plugins/reCaptchaHandler';

type Hook = (data: unknown, done: (_: null) => Promise<unknown>) => Promise<void>;

describe('plugins/reCaptchaHandler', () => {
  const next = vi.fn();
  const hooks: Hook[] = [];

  const engine = {
    createStep: vi.fn(),
    on: (_: null, callback: Hook): void => {
      hooks.push(callback);
    },
    trigger: async (): Promise<void> => { await hooks[0]({}, next); },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    reCaptchaHandler({ siteKey: 'testKey' })(engine as unknown as Engine);
  });

  test('submit hook - reCAPTCHA client not loaded', async () => {
    const element = { onload: vi.fn() };
    const unmockedCreateElement = document.createElement;
    const unmockedGetElementsByTagName = document.getElementsByTagName;
    Object.assign(document, { createElement: vi.fn(() => element) });
    Object.assign(document, {
      getElementsByTagName: vi.fn(() => [{
        appendChild: vi.fn(),
      }]),
    });
    const promise = engine.trigger();
    Object.assign(window, {
      grecaptcha: {
        ready: vi.fn((callback: () => null) => callback()),
        execute: vi.fn(() => Promise.resolve('test_token')),
      },
    });
    element.onload();
    await promise;
    expect(document.createElement).toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith({ reCaptchaToken: 'test_token' });
    document.createElement = unmockedCreateElement;
    document.getElementsByTagName = unmockedGetElementsByTagName;
  });

  test('submit hook - reCAPTCHA client already loaded', async () => {
    Object.assign(window, {
      grecaptcha: {
        ready: vi.fn((callback: () => null) => callback()),
        execute: vi.fn(() => Promise.resolve('test_token')),
      },
    });
    await engine.trigger();
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith({ reCaptchaToken: 'test_token' });
  });
});
