/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import isPlainObject from 'scripts/helpers/isPlainObject';

describe('helpers/isPlainObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('variable type is not an object', () => {
    expect(isPlainObject(2)).toBe(false);
    expect(isPlainObject(/test/)).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(['test'])).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });

  test('variable is a plain JS object', () => {
    expect(isPlainObject({ test: 'test' })).toBe(true);
    expect(isPlainObject(Object.create({}))).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });
});
