/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UITextarea from 'scripts/svelte/Textarea.svelte';
import { render, fireEvent } from '@testing-library/svelte';

describe('svelte/UITextarea', () => {
  vi.mock('scripts/core/generateRandomId');
  vi.useFakeTimers();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(UITextarea, { props: { name: 'test', modifiers: 'large' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(UITextarea, { props: { name: 'test', id: 'my-id' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with autofocus', () => {
    const { container } = render(UITextarea, { props: { name: 'test', autofocus: true } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with cols and rows', () => {
    const { container } = render(UITextarea, { props: { name: 'test', cols: 10, rows: 50 } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with autoresize', async () => {
    const { container } = render(UITextarea, { props: { name: 'test', autoresize: true } });
    const textarea = container.getElementsByTagName('textarea')[0];
    await fireEvent.input(textarea, { target: { value: 'new\nvalue' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with placeholder', () => {
    const { container } = render(UITextarea, { props: { name: 'test', placeholder: 'test...' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with label', () => {
    const { container } = render(UITextarea, { props: { name: 'test', label: '*Label*' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with helper', () => {
    const { container } = render(UITextarea, { props: { name: 'test', helper: '*Helper*' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with value', () => {
    const { container } = render(UITextarea, { props: { name: 'test', value: 'my value' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - disabled', async () => {
    const onChange = vi.fn();
    const { container } = render(UITextarea, { props: { name: 'test', disabled: true, onChange } });
    const textarea = container.getElementsByTagName('textarea')[0];
    await fireEvent.input(textarea, { value: 'new value' });
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('renders correctly - autocomplete off', () => {
    const { container } = render(UITextarea, { props: { name: 'test', autocomplete: 'off' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - readonly', async () => {
    const onChange = vi.fn();
    const { container } = render(UITextarea, { props: { name: 'test', readonly: true, onChange } });
    const textarea = container.getElementsByTagName('textarea')[0];
    await fireEvent.input(textarea, { value: 'new value' });
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('renders correctly - with listeners and debounce', async () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const onChange = vi.fn();
    const onPaste = vi.fn();
    const onKeyDown = vi.fn();
    const { container } = render(UITextarea, {
      props: {
        name: 'test',
        onBlur,
        onFocus,
        onPaste,
        onChange,
        onKeyDown,
        debounceTimeout: 250,
      },
    });
    const textarea = container.getElementsByTagName('textarea')[0];
    await fireEvent.focus(textarea);
    await fireEvent.blur(textarea);
    await fireEvent.keyDown(textarea, { key: 'a' });
    await fireEvent.input(textarea, { target: { value: 'new 015 test' } });
    vi.runAllTimers();
    await fireEvent.paste(textarea, { clipboardData: { getData: vi.fn(() => 'and 89 OKOK') } });
    vi.runAllTimers();
    expect(container.firstChild).toMatchSnapshot();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith('', expect.any(Object));
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledWith('', expect.any(Object));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('new 015 test', expect.any(Object));
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledWith('', expect.any(Object));
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledWith('new 015 test', expect.any(Object));
  });
});
