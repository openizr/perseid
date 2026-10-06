/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import defaultExport from 'scripts/mysql/index';

describe('mysql', () => {
  vi.mock('scripts/mysql/services/MySQLDatabaseClient');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly exports library', () => {
    expect(defaultExport).toBeDefined();
  });
});
