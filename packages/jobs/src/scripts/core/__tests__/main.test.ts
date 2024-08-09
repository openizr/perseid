/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as exports from 'scripts/core/index';

describe('core', () => {
  vi.mock('scripts/core/services/JobScheduler');

  test('contains correct exports', () => {
    expect(Object.keys(exports)).toEqual([
      'JobScheduler',
      'DatabaseClient',
    ]);
  });
});
