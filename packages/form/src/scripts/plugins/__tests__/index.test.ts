/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { errorStepDisplayer } from 'scripts/plugins/index';

describe('plugins/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly exports plugins', () => {
    expect(errorStepDisplayer).not.toBe(null);
  });
});
