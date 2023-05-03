/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Id from 'scripts/classes/Id';

describe('scripts/Id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Id.uniqueId = null;
    (global as unknown as { window: undefined; }).window = undefined;
  });

  test('[constructor] node environment, new id', () => {
    expect(/[a-f0-9]{24}/.test(new Id().toString())).toBeTruthy();
  });

  test('[constructor] node environment, existing id', () => {
    expect(new Id('645394d3894e3d9b43dc8825').toString()).toBe('645394d3894e3d9b43dc8825');
  });

  test('[constructor] browser environment, new id', () => {
    (global as unknown as { window: { crypto: { getRandomValues: () => string; }; }; }).window = {
      crypto: { getRandomValues: (): string => '6452250df80ff56b436bb919' },
    };
    expect(/^[a-f0-9]{24}$/.test(new Id().toString())).toBeTruthy();
  });

  test('[constructor] browser environment, existing id', () => {
    (global as unknown as { window: { crypto: { getRandomValues: () => string; }; }; }).window = {
      crypto: { getRandomValues: (): string => '6452250df80ff56b436bb919' },
    };
    expect(new Id('645394d3894e3d9b43dc8825').toString()).toBe('645394d3894e3d9b43dc8825');
  });

  test('[valueOf]', () => {
    expect(new Id('645394d3894e3d9b43dc8825').valueOf()).toBe('645394d3894e3d9b43dc8825');
  });

  test('[toJSON]', () => {
    expect(new Id('645394d3894e3d9b43dc8825').toJSON()).toBe('645394d3894e3d9b43dc8825');
  });
});
