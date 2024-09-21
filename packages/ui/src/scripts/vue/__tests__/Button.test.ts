/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UIButton from 'scripts/vue/UIButton.vue';
import { render, fireEvent } from '@testing-library/vue';

describe('vue/UIButton', () => {
  vi.mock('scripts/core/index');
  vi.mock('scripts/vue/UIIcon.vue');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(UIButton, { props: { label: 'Test', modifiers: 'large' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(UIButton, { props: { id: 'test', label: 'Test', modifiers: 'large' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - no label', () => {
    const { container } = render(UIButton, { props: {} });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - label with icon', () => {
    const { container } = render(UIButton, { props: { label: 'Test', icon: 'star' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - type submit', () => {
    const { container } = render(UIButton, { props: { label: 'Test', type: 'submit' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - icon only', () => {
    const { container } = render(UIButton, { props: { icon: 'star' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - right icon', () => {
    const { container } = render(UIButton, { props: { icon: 'star', iconPosition: 'right' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - disabled', () => {
    const { container } = render(UIButton, { props: { disabled: true } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with listener', async () => {
    const onClick = vi.fn();
    const onFocus = vi.fn();
    const { container } = render(UIButton, {
      props: {
        onClick,
        onFocus,
      },
    });
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.click(button);
    await fireEvent.focus(button);
    expect(container.firstChild).toMatchSnapshot();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(expect.any(Object));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith(expect.any(Object));
  });
});
