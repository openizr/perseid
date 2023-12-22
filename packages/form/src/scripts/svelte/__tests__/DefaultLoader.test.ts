/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/svelte';
import DefaultLoader from 'scripts/svelte/DefaultLoader.svelte';

describe('svelte/DefaultLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const { container } = render(DefaultLoader);
    expect(container.firstChild).toMatchSnapshot();
  });
});
