/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import UITextarea from 'scripts/react/Textarea';
import { render, fireEvent } from '@testing-library/react';

vi.useFakeTimers();
vi.mock('scripts/core/generateRandomId');

describe('react/UITextarea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(<UITextarea name="test" modifiers="large" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(<UITextarea name="test" id="my-id" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with cols and rows', () => {
    const { container } = render(<UITextarea name="test" cols={10} rows={50} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with autoresize', () => {
    const { container } = render(<UITextarea name="test" autoresize />);
    const textarea = container.getElementsByTagName('textarea')[0];
    fireEvent.change(textarea, { target: { value: 'new\nvalue' } });
    vi.runAllTimers();
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with placeholder', () => {
    const { container } = render(<UITextarea name="test" placeholder="test..." />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with label', () => {
    const { container } = render(<UITextarea name="test" label="*Label*" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with helper', () => {
    const { container } = render(<UITextarea name="test" helper="*Helper*" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with value', () => {
    const { container } = render(<UITextarea name="test" value="my value" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - disabled', () => {
    const onChange = vi.fn();
    const { container } = render(<UITextarea name="test" disabled />);
    const textarea = container.getElementsByTagName('textarea')[0];
    fireEvent.change(textarea, { target: { value: 'new value' } });
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('renders correctly - autocomplete off', () => {
    const { container } = render(<UITextarea name="test" autocomplete="off" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - readonly', () => {
    const onChange = vi.fn();
    const { container } = render(<UITextarea name="test" readonly onChange={onChange} />);
    const textarea = container.getElementsByTagName('textarea')[0];
    fireEvent.change(textarea, { target: { value: 'new value' } });
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('renders correctly - with listeners and debounce', () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const onChange = vi.fn();
    const onPaste = vi.fn();
    const onKeyDown = vi.fn();
    const { container } = render(<UITextarea
      name="test"
      onBlur={onBlur}
      onFocus={onFocus}
      onPaste={onPaste}
      onChange={onChange}
      onKeyDown={onKeyDown}
      debounceTimeout={250}
    />);
    const textarea = container.getElementsByTagName('textarea')[0];
    fireEvent.focus(textarea);
    fireEvent.blur(textarea);
    fireEvent.keyDown(textarea, { key: 'a' });
    fireEvent.change(textarea, { target: { value: 'new 015 test', selectionStart: 100 } });
    fireEvent.paste(textarea, { clipboardData: { getData: vi.fn(() => 'and 89 OKOK') } });
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
