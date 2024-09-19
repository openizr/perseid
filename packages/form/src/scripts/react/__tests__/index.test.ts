/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as exports from 'scripts/react/index';

describe('react', () => {
  vi.mock('scripts/react/Form');
  vi.mock('scripts/core/Engine');
  vi.mock('scripts/react/DefaultStep');
  vi.mock('scripts/react/DefaultField');
  vi.mock('scripts/react/DefaultLoader');
  vi.mock('scripts/react/DefaultLayout');

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
    expect(vi.isMockFunction((Form as unknown as { type: () => void; }).type)).toBe(true);
  });
});
