/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as exports from 'scripts/vue/index';

describe('vue', () => {
  vi.mock('scripts/core/Engine');
  vi.mock('scripts/vue/Form.vue');
  vi.mock('scripts/vue/DefaultStep.vue');
  vi.mock('scripts/vue/DefaultField.vue');
  vi.mock('scripts/vue/DefaultLoader.vue');
  vi.mock('scripts/vue/DefaultLayout.vue');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly exports library', () => {
    expect(Object.keys(exports)).toEqual([
      'default',
      'Engine',
      'DefaultStep',
      'DefaultField',
      'DefaultLoader',
      'DefaultLayout',
    ]);
    expect(vi.isMockFunction(exports.default.setup)).toBe(true);
  });
});
