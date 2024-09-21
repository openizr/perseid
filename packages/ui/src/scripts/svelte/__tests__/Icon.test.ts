/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UIIcon from 'scripts/svelte/Icon.svelte';
import { render } from '@testing-library/svelte';

describe('svelte/UIIcon', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(UIIcon, { name: 'star', modifiers: 'large' });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', async () => {
    const { container, rerender } = render(UIIcon, { name: 'star', id: 'test' });
    expect(container.firstChild).toMatchSnapshot();
    await rerender({ id: undefined, modifiers: undefined });
    expect(container.firstChild).toMatchSnapshot();
  });
});
