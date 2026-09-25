/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import HttpError from 'scripts/errors/Http';

describe('classes/HttpError', () => {
  test('[constructor]', () => {
    const error = new HttpError(404, { error: 'Not found', code: 404 });
    expect(error.status).toBe(404);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.message).toBe('HTTP Error');
    expect(error.details).toEqual({ error: 'Not found', code: 404 });
  });
});
