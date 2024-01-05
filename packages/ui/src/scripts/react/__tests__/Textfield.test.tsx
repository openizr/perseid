/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import UITextfield from 'scripts/react/Textfield';
import { render, fireEvent } from '@testing-library/react';

vi.useFakeTimers();
vi.mock('scripts/core/generateRandomId');

describe('react/UITextfield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(
      <UITextfield
        name="test"
        modifiers="large"
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(<UITextfield name="test" id="my-id" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with type number', () => {
    const { container } = render(<UITextfield name="test" type="number" min={0} max={30} step={10} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with left icon', () => {
    const { container } = render(<UITextfield name="test" icon="star" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with right icon', () => {
    const { container } = render(<UITextfield name="test" icon="star" iconPosition="right" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with placeholder', () => {
    const { container } = render(<UITextfield name="test" placeholder="test..." />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with label', () => {
    const { container } = render(<UITextfield name="test" label="*Label*" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with helper', () => {
    const { container } = render(<UITextfield name="test" helper="*Helper*" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with value', () => {
    const { container } = render(<UITextfield name="test" value="my value" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with disabled', () => {
    const onChange = vi.fn();
    const { container } = render(<UITextfield name="test" disabled />);
    const input = container.getElementsByTagName('input')[0];
    fireEvent.change(input, { value: 'new value' });
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('renders correctly - autocomplete off', () => {
    const { container } = render(<UITextfield name="test" autocomplete="off" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - readonly', () => {
    const onChange = vi.fn();
    const { container } = render(<UITextfield name="test" readonly onChange={onChange} />);
    const input = container.getElementsByTagName('input')[0];
    fireEvent.keyDown(input, { key: 'A' });
    fireEvent.keyDown(input, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'a', shiftKey: true });
    fireEvent.keyDown(input, { key: 'a', altKey: true });
    fireEvent.keyDown(input, { key: 'a', metaKey: true });
    fireEvent.change(input, { value: 'new value' });
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('renders correctly - with transform and allowedKeys', () => {
    const onChange = vi.fn();
    const onKeyDown = vi.fn();
    const onPaste = vi.fn();
    const transform = (value: string): [string, number?] => [value.toUpperCase()];
    const { container, rerender } = render(<UITextfield
      name="test"
      size={10}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      transform={transform}
      allowedKeys={{
        default: /[a-z]/i,
        altKey: /[a-z]/i,
        shiftKey: /[a-z]/i,
        metaKey: /[a-z]/i,
        ctrlKey: /[a-z]/i,
      }}
    />);
    const input = container.getElementsByTagName('input')[0];
    fireEvent.keyDown(input, { key: 'A' });
    fireEvent.keyDown(input, { key: '0' });
    fireEvent.keyDown(input, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'a', shiftKey: true });
    fireEvent.keyDown(input, { key: 'a', altKey: true });
    fireEvent.keyDown(input, { key: 'a', metaKey: true });
    fireEvent.change(input, { target: { value: 'new 015 test', selectionStart: 100 } });
    fireEvent.paste(input, { clipboardData: { getData: vi.fn(() => 'and 89') } });
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalledTimes(5);
    expect(onKeyDown).toHaveBeenCalledWith('', expect.any(Object));
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledWith('NEWTEST', expect.any(Object));
    rerender(<UITextfield
      name="test"
      size={10}
      allowedKeys={{
        default: /z/i,
      }}
    />);
    fireEvent.change(input, { target: { value: 'new 015 test', selectionStart: 100 } });
    fireEvent.paste(input, { clipboardData: { getData: vi.fn(() => 'and 89') } });
    rerender(<UITextfield name="test" size={10} />);
    fireEvent.keyDown(input, { key: '0' });
    fireEvent.keyDown(input, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'a', shiftKey: true });
    fireEvent.keyDown(input, { key: 'a', altKey: true });
    fireEvent.keyDown(input, { key: 'a', metaKey: true });
  });

  test('renders correctly - with listeners and debounce', () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const onChange = vi.fn();
    const onIconClick = vi.fn();
    const onIconKeyDown = vi.fn();
    const transform = (value: string): [string, number?] => [value.toUpperCase(), 1];
    const { container } = render(<UITextfield
      name="test"
      icon="star"
      onBlur={onBlur}
      onFocus={onFocus}
      onChange={onChange}
      onIconClick={onIconClick}
      transform={transform}
      debounceTimeout={250}
      onIconKeyDown={onIconKeyDown}
    />);
    const input = container.getElementsByTagName('input')[0];
    const icon = container.getElementsByTagName('i')[0];
    fireEvent.focus(input);
    fireEvent.blur(input);
    fireEvent.keyDown(icon);
    fireEvent.click(icon);
    fireEvent.change(input, { target: { value: 'new 015 test', selectionStart: 100 } });
    vi.runAllTimers();
    fireEvent.paste(input, { clipboardData: { getData: vi.fn(() => 'and 89 OKOK') } });
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
    expect(onChange).toHaveBeenCalledWith('NAND 89 OKOKEW 015 TEST', expect.any(Object));
    Object.defineProperty(HTMLInputElement.prototype, 'selectionStart', { get() { return null; } });
    Object.defineProperty(HTMLInputElement.prototype, 'selectionEnd', { get() { return null; } });
    fireEvent.paste(input, { clipboardData: { getData: vi.fn(() => 'and 89 OKOK') } });
  });
});
