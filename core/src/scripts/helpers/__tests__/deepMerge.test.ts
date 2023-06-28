/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import deepMerge from 'scripts/helpers/deepMerge';

describe('helpers/deepMerge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('one parameter is a primitive', () => {
    const firstObject = 3;
    const secondObject = {
      firstKey: {
        a: 'test new',
        b: 'ok',
        c: { a: 'test' },
      },
      secondKey: 14,
      thirdKey: [{ a: 'new' }],
    };
    const result = deepMerge(firstObject, secondObject);
    expect(result).toEqual(secondObject);
    expect(result).not.toBe(secondObject);
  });

  test('second variable is undefined', () => {
    const result = deepMerge(3, undefined);
    expect(result).toBe(3);
  });

  test('both parameters are plain objects', () => {
    const firstObject = {
      firstKey: {
        a: 'test',
        b: {
          c: 'test',
        },
      },
      secondKey: 14,
      thirdKey: [{ a: 'test', b: 'test2' }, { a: 'otherTest' }, 3],
    };
    const secondObject = {
      firstKey: {
        a: 'test new',
        b: 'ok',
        c: { a: 'test' },
      },
      secondKey: 15,
      thirdKey: [{ a: 'new' }],
    };
    expect(deepMerge(firstObject, secondObject)).toEqual({
      firstKey: {
        a: 'test new',
        b: 'ok',
        c: { a: 'test' },
      },
      secondKey: 15,
      thirdKey: [{ a: 'new', b: 'test2' }, { a: 'otherTest' }, 3],
    });
  });
});
