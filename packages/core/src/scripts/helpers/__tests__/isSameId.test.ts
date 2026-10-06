/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Id from 'scripts/classes/NodeId';
import isSameId from 'scripts/helpers/isSameId';

describe('helpers/isSameId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns function that compares IDs', () => {
    const compareIds = isSameId(new Id('550e8400-e29b-41d4-a716-446655440000'));
    expect(compareIds(new Id('550e8400-e29b-41d4-a716-446655440000'))).toBe(true);
  });
});
