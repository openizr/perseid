/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import defaultExport from 'scripts/express/index';

describe('express', () => {
  vi.mock('scripts/express/services/ExpressController');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly exports library', () => {
    expect(defaultExport).toBeDefined();
  });
});
