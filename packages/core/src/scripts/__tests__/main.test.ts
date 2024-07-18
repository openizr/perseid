/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as helpers from 'scripts/main';

describe('scripts/main', () => {
  test('contains correct exports', () => {
    expect(Object.keys(helpers)).toEqual([
      'Id',
      'I18n',
      'Model',
      'Logger',
      'forEach',
      'deepCopy',
      'deepMerge',
      'HttpClient',
      'toSnakeCase',
      'isPlainObject',
    ]);
  });
});
