/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import deepCopy from 'scripts/helpers/deepCopy';

describe('helpers/deepCopy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('default', () => {
    const source = {
      firstKey: {
        a: 'test',
        b: {
          c: 'test',
        },
      },
      secondKey: 14,
      thirdKey: [{ a: 'test' }],
    };
    const copy = deepCopy(source);
    expect(copy).toEqual(source);
    expect(copy).not.toBe(source);
    expect(copy.firstKey).toEqual(source.firstKey);
    expect(copy.firstKey).not.toBe(source.firstKey);
    expect(copy.firstKey.b).toEqual(source.firstKey.b);
    expect(copy.firstKey.b).not.toBe(source.firstKey.b);
    expect(copy.thirdKey).toEqual(source.thirdKey);
    expect(copy.thirdKey).not.toBe(source.thirdKey);
    expect(copy.thirdKey[0]).toEqual(source.thirdKey[0]);
    expect(copy.thirdKey[0]).not.toBe(source.thirdKey[0]);
  });
});
