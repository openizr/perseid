/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render, fireEvent } from '@testing-library/svelte';
import UITooltip from 'scripts/svelte/Tooltip.svelte';
import TestUITooltip from 'scripts/svelte/__tests__/TestTooltip.svelte';
import TestUITooltip2 from 'scripts/svelte/__tests__/TestTooltip2.svelte';

describe('svelte/UITooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(UITooltip, { props: { label: 'Test', modifiers: 'top' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - basic 2', async () => {
    const { container } = render(TestUITooltip2);
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.keyPress(button);
    expect(container.firstChild).toMatchSnapshot();
    await fireEvent.focusOut(button);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with description', async () => {
    const { container } = render(TestUITooltip);
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.keyPress(button);
    expect(container.firstChild).toMatchSnapshot();
    await fireEvent.focusOut(button);
    expect(container.firstChild).toMatchSnapshot();
  });
});
