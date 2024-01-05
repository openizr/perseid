/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import * as entry from 'scripts/react/index';

describe('react', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('exports everything correctly', () => {
    expect(entry.markdown).not.toBe(undefined);
  });
});
