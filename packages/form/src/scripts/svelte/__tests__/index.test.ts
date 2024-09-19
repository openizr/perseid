/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as exports from 'scripts/svelte/index';

describe('svelte', () => {
  vi.mock('scripts/core/Engine');
  vi.mock('scripts/svelte/Form.svelte');
  vi.mock('scripts/svelte/DefaultStep.svelte');
  vi.mock('scripts/svelte/DefaultField.svelte');
  vi.mock('scripts/svelte/DefaultLoader.svelte');
  vi.mock('scripts/svelte/DefaultLayout.svelte');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly exports library', () => {
    const { default: Form } = exports;
    expect(Object.keys(exports)).toEqual([
      'default',
      'Engine',
      'DefaultStep',
      'DefaultField',
      'DefaultLoader',
      'DefaultLayout',
    ]);
    expect(vi.isMockFunction((Form as unknown as { render: () => void; }).render)).toBe(true);
  });
});
