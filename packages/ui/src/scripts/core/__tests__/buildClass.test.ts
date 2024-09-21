/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import buildClass from 'scripts/core/buildClass';

describe('core/buildClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly builds a BEM+ class name from given base class and modifiers', () => {
    expect(buildClass('ui-root', 'modifier1     modifier1 modifier2')).toBe('ui-root ui-root--modifier1--modifier2');
  });

  test('only returns base class name when there is no modifier to apply', () => {
    expect(buildClass('ui-root')).toBe('ui-root');
  });
});
