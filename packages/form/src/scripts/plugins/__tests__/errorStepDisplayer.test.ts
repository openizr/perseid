/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Engine from 'scripts/core/Engine';
import errorStepDisplayer from 'scripts/plugins/errorStepDisplayer';

describe('plugins/errorStepDisplayer', () => {
  const next = vi.fn();
  const hooks: ((data: unknown, done: () => Promise<void>) => void)[] = [];

  const engine = {
    createStep: vi.fn(),
    on: (_: null, callback: (data: unknown, done: () => Promise<void>) => void): void => {
      hooks.push(callback);
    },
    trigger: async (): Promise<void> => { await Promise.resolve(); hooks[0]({}, next); },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly generates error step', async () => {
    const setActiveStep = vi.fn();
    errorStepDisplayer({ stepId: 'error', setActiveStep })(engine as unknown as Engine);
    await engine.trigger();
    expect(setActiveStep).toHaveBeenCalledWith('error');
    expect(engine.createStep).toHaveBeenCalledWith('error');
  });
});
