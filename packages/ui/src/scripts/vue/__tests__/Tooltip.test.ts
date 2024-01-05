/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UITooltip from 'scripts/vue/UITooltip.vue';
import { render, fireEvent } from '@testing-library/vue';

describe('vue/UITooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(UITooltip, { props: { label: 'Test' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with modifiers', () => {
    const { container } = render(UITooltip, { props: { label: 'Test', modifiers: 'top' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with description', async () => {
    const { container } = render(UITooltip, {
      props: { label: 'Test', modifiers: 'top', description: 'More details' },
      slots: { default: '<button>i</button>' },
    });
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.keyPress(button);
    expect(container.firstChild).toMatchSnapshot();
    await fireEvent.focusOut(button);
    expect(container.firstChild).toMatchSnapshot();
  });
});
