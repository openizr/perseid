/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import HttpError from 'scripts/core/errors/Http';

describe('core/errors/Http', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('constructor', () => {
    const error = new HttpError({ data: 'test', status: 400 });
    expect(error.name).toBe('Error');
    expect(error.message).toBe('HTTP Error');
    expect(error.response).toEqual({ data: 'test', status: 400 });
  });
});
