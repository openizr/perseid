/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as helpers from 'scripts/index.browser';

describe('scripts/index.browser', () => {
  test('correctly exports library', () => {
    expect(Object.keys(helpers)).toEqual([
      'Id',
      'I18n',
      'Model',
      'forEach',
      'deepCopy',
      'deepMerge',
      'Telemetry',
      'HttpClient',
      'toSnakeCase',
      'isPlainObject',
    ]);
  });
});
