/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UITextfield from 'scripts/svelte/Textfield.svelte';
import { render, fireEvent } from '@testing-library/svelte';

describe('svelte/UITextfield', () => {
  vi.mock('scripts/core/generateRandomId');
  vi.useFakeTimers();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(UITextfield, { props: { name: 'test', modifiers: 'large' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(UITextfield, { props: { name: 'test', id: 'my-id' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with autofocus', () => {
    const { container } = render(UITextfield, { props: { name: 'test', autofocus: true } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with type number', () => {
    const { container } = render(UITextfield, {
      props: {
        name: 'test', type: 'number', min: 0, max: 30, step: 10,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with left icon', () => {
    const { container } = render(UITextfield, { props: { name: 'test', icon: 'star' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with right icon', () => {
    const { container } = render(UITextfield, {
      props: {
        name: 'test', icon: 'star', iconPosition: 'right',
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with placeholder', () => {
    const { container } = render(UITextfield, { props: { name: 'test', placeholder: 'test...' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with label', () => {
    const { container } = render(UITextfield, { props: { name: 'test', label: '*Label*' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with helper', () => {
    const { container } = render(UITextfield, { props: { name: 'test', helper: '*Helper*' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with value', () => {
    const { container } = render(UITextfield, { props: { name: 'test', value: 'my value' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with disabled', async () => {
    const onChange = vi.fn();
    const { container } = render(UITextfield, { props: { name: 'test', disabled: true, onChange } });
    const input = container.getElementsByTagName('input')[0];
    await fireEvent.input(input, { value: 'new value' });
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('renders correctly - autocomplete off', () => {
    const { container } = render(UITextfield, { props: { name: 'test', autocomplete: 'off' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - readonly', async () => {
    const onChange = vi.fn();
    const { container } = render(UITextfield, { props: { name: 'test', readonly: true, onChange } });
    const input = container.getElementsByTagName('input')[0];
    await fireEvent.keyDown(input, { key: 'A' });
    await fireEvent.keyDown(input, { key: 'a', ctrlKey: true });
    await fireEvent.keyDown(input, { key: 'a', shiftKey: true });
    await fireEvent.keyDown(input, { key: 'a', altKey: true });
    await fireEvent.keyDown(input, { key: 'a', metaKey: true });
    await fireEvent.input(input, { value: 'new value' });
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('renders correctly - with transform and allowedKeys', async () => {
    const onChange = vi.fn();
    const onKeyDown = vi.fn();
    const onPaste = vi.fn();
    const transform = (value: string): [string, number?] => [value.toUpperCase()];
    const { container, rerender } = render(UITextfield, {
      props: {
        name: 'test',
        size: 10,
        transform,
        onChange,
        onKeyDown,
        onPaste,
        allowedKeys: {
          default: /[a-z]/i,
          altKey: /[a-z]/i,
          shiftKey: /[a-z]/i,
          metaKey: /[a-z]/i,
          ctrlKey: /[a-z]/i,
        },
      },
    });
    let input = container.getElementsByTagName('input')[0];
    await fireEvent.keyDown(input, { key: 'A' });
    await fireEvent.keyDown(input, { key: '0' });
    await fireEvent.keyDown(input, { key: 'a', ctrlKey: true });
    await fireEvent.keyDown(input, { key: 'a', shiftKey: true });
    await fireEvent.keyDown(input, { key: 'a', altKey: true });
    await fireEvent.keyDown(input, { key: 'a', metaKey: true });
    await fireEvent.input(input, { value: 'new 015 test' });
    await fireEvent.paste(input, { clipboardData: { getData: vi.fn(() => 'and 89') } });
    expect(container.firstChild).toMatchSnapshot();
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('AND', expect.any(Object));
    expect(onKeyDown).toHaveBeenCalledTimes(5);
    expect(onKeyDown).toHaveBeenCalledWith('', expect.any(Object));
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledWith('AND', expect.any(Object));
    rerender({
      name: 'test',
      size: 10,
      allowedKeys: { default: /z/i },
    });
    [input] = container.getElementsByTagName('input');
    await fireEvent.input(input, { value: 'zzzzzzzzzzzz' });
    await fireEvent.paste(input, { clipboardData: { getData: vi.fn(() => 'zzz') } });
    await fireEvent.input(input, { value: 'qsdqsd' });
    await fireEvent.paste(input, { clipboardData: { getData: vi.fn(() => 'sqdqsd') } });
    vi.runAllTimers();
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with listeners and debounce', async () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const onChange = vi.fn();
    const onIconClick = vi.fn();
    const onIconKeyDown = vi.fn();
    const { container } = render(UITextfield, {
      props: {
        name: 'test',
        icon: 'star',
        transform: (value: string): [string, number?] => [value.toUpperCase(), 1],
        size: 100,
        onBlur,
        onFocus,
        onChange,
        onIconClick,
        onIconKeyDown,
        debounceTimeout: 250,
      },
    });
    const input = container.getElementsByTagName('input')[0];
    const icon = container.getElementsByTagName('i')[0];
    await fireEvent.focus(input);
    await fireEvent.blur(input);
    await fireEvent.keyDown(icon);
    await fireEvent.click(icon);
    await fireEvent.input(input, { target: { value: 'new 015 test' } });
    vi.runAllTimers();
    await fireEvent.paste(input, { clipboardData: { getData: vi.fn(() => 'and 89 OKOK') }, target: { selectionStart: 100 } });
    vi.runAllTimers();
    expect(container.firstChild).toMatchSnapshot();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith('', expect.any(Object));
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledWith('', expect.any(Object));
    expect(onIconClick).toHaveBeenCalledTimes(1);
    expect(onIconClick).toHaveBeenCalledWith(expect.any(Object));
    expect(onIconKeyDown).toHaveBeenCalledTimes(1);
    expect(onIconKeyDown).toHaveBeenCalledWith(expect.any(Object));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith('NEW 015 TEST', expect.any(Object));
    expect(onChange).toHaveBeenCalledWith('NEW 015 TESTAND 89 OKOK', expect.any(Object));
  });
});
