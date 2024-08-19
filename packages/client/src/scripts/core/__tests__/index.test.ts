/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as core from 'scripts/core/index';

describe('scripts/core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('contains correct exports', () => {
    expect(Object.keys(core)).toEqual([
      'Logger',
      'Model',
      'Store',
      'HttpError',
      'ApiClient',
      'FormBuilder',
    ]);
  });
});
