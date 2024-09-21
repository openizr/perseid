/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UITooltip from 'scripts/svelte/Tooltip.svelte';
import { render, fireEvent } from '@testing-library/svelte';
import TestUITooltip from 'scripts/svelte/__mocks__/TestTooltip.svelte';
import TestUITooltip2 from 'scripts/svelte/__mocks__/TestTooltip2.svelte';

describe('svelte/UITooltip', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('basic', () => {
    const { container } = render(UITooltip, { label: 'Test' });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('basic 2', async () => {
    const { container } = render(TestUITooltip2);
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.keyPress(button);
    expect(container.firstChild).toMatchSnapshot();
    await fireEvent.focusOut(button);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('with id', async () => {
    const { container, rerender } = render(UITooltip, { label: 'Test', id: 'test' });
    expect(container.firstChild).toMatchSnapshot();
    await rerender({ id: undefined });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('with modifiers', async () => {
    const { container, rerender } = render(UITooltip, { label: 'Test', modifiers: 'top' });
    expect(container.firstChild).toMatchSnapshot();
    await rerender({ modifiers: undefined });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('with description', async () => {
    const { container } = render(UITooltip, { label: 'Test', description: 'Test description' });
    const div = container.getElementsByTagName('div')[0];
    expect(container.firstChild).toMatchSnapshot();
    await fireEvent.click(div);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('with children', async () => {
    const { container } = render(TestUITooltip);
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.keyPress(button);
    expect(container.firstChild).toMatchSnapshot();
    await fireEvent.focusOut(button);
    expect(container.firstChild).toMatchSnapshot();
  });
});
