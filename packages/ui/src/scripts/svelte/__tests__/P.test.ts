/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UIP from 'scripts/svelte/P.svelte';
import { render } from '@testing-library/svelte';

describe('svelte/UIP', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('basic', () => {
    const { container } = render(UIP, { label: 'Test' });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('with modifiers', async () => {
    const { container, rerender } = render(UIP, { label: 'Test', modifiers: 'large' });
    expect(container.firstChild).toMatchSnapshot();
    await rerender({ modifiers: undefined });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('with id', async () => {
    const { container, rerender } = render(UIP, { label: 'Test', id: 'test' });
    expect(container.firstChild).toMatchSnapshot();
    await rerender({ id: undefined });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('with itemProp', () => {
    const { container } = render(UIP, { label: 'Test', itemProp: 'description' });
    expect(container.firstChild).toMatchSnapshot();
  });
});
