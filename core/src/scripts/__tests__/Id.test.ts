/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Id from 'scripts/Id';

describe('scripts/Id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Id.uniqueId = null;
    (global as unknown as { window: undefined; }).window = undefined;
  });

  test('correctly generates a new id - node environment', async () => {
    expect(/[a-f0-9]{24}/.test(new Id().toString())).toBeTruthy();
  });

  test('correctly takes an existing id - node environment', async () => {
    expect(new Id('645394d3894e3d9b43dc8825').toString()).toBe('645394d3894e3d9b43dc8825');
  });

  test('correctly generates a new id - browser environment', async () => {
    (global as unknown as { window: { crypto: { getRandomValues: () => string; }; }; }).window = {
      crypto: { getRandomValues: (): string => '6452250df80ff56b436bb919' },
    };
    expect(/^[a-f0-9]{24}$/.test(new Id().toString())).toBeTruthy();
  });

  test('correctly takes an existing id - browser environment', async () => {
    (global as unknown as { window: { crypto: { getRandomValues: () => string; }; }; }).window = {
      crypto: { getRandomValues: (): string => '6452250df80ff56b436bb919' },
    };
    expect(new Id('645394d3894e3d9b43dc8825').toString()).toBe('645394d3894e3d9b43dc8825');
  });
});
