/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import toSnakeCase from 'scripts/helpers/toSnakeCase';

describe('helpers/toSnakeCase', () => {
  test('value contains uppercase letters', () => {
    expect(toSnakeCase('testCollection')).toBe('TEST_COLLECTION');
  });

  test('value contains only lowercase letters', () => {
    expect(toSnakeCase('collection')).toBe('COLLECTION');
  });
});
