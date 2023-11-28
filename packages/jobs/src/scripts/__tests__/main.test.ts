/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as jobs from 'scripts/main';

describe('main', () => {
  vi.mock('scripts/services/JobScheduler');
  vi.mock('scripts/services/DatabaseClient');

  test('contains correct exports', () => {
    expect(Object.keys(jobs)).toEqual([
      'JobScheduler',
      'DatabaseClient',
    ]);
  });
});
