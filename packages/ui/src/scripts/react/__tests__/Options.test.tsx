/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UIOptions from 'scripts/react/Options';
import { render, fireEvent, act } from '@testing-library/react';

const selectOptions: Option[] = [
  { type: 'option', value: 'option1', label: 'Option 1' },
  { type: 'divider' },
  { type: 'option', value: 'option2', label: 'Option 2' },
  { type: 'option', value: 'option3', label: 'Option 3' },
  { type: 'header', label: 'Group 2' },
  { type: 'option', value: 'option4', label: 'Option 4' },
];

const options: Option[] = [
  { type: 'option', value: 'option1', label: 'Option 1' },
  { type: 'option', value: 'option2', label: 'Option 2' },
  { type: 'option', value: 'option3', label: 'Option 3' },
  { type: 'option', value: 'option4', label: 'Option 4' },
];

describe('react/UIOptions', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('basic select', () => {
    const { container } = render(<UIOptions name="test" modifiers="large" select options={selectOptions} />);
    fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    fireEvent.mouseDown(container.getElementsByTagName('li')[0]);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with id', () => {
    const { container } = render(<UIOptions name="test" id="test" select options={selectOptions} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with label', () => {
    const { container } = render(<UIOptions name="test" label="test" select options={selectOptions} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with helper', () => {
    const { container } = render(
      <UIOptions
        select
        name="test"
        helper="test"
        placeholder="test2"
        options={selectOptions}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with value', () => {
    const { container } = render(<UIOptions name="test" value={['option1', 'option3']} select options={selectOptions} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select disabled', () => {
    const { container } = render(<UIOptions name="test" disabled select options={selectOptions} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with option disabled', () => {
    const onChange = vi.fn();
    const { container } = render(<UIOptions
      name="test"
      select
      options={[{
        type: 'option', value: 'option5', label: 'Option 5', disabled: true,
      }]}
      onChange={onChange}
    />);
    fireEvent.change(container.getElementsByTagName('button')[0]);
    expect(onChange).not.toHaveBeenCalled();
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select expanded', () => {
    const { container } = render(<UIOptions name="test" select options={selectOptions} />);
    fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select expanded with selectPosition', () => {
    const { container } = render(<UIOptions name="test" select selectPosition="top" options={selectOptions} />);
    fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select changing options', () => {
    const { container } = render(<UIOptions name="test" select options={selectOptions} />);
    fireEvent.keyDown(container.getElementsByTagName('button')[0], { key: 'End' });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select expanded with no option and small viewport', () => {
    Object.assign(window, { innerHeight: -1 });
    const { container } = render(<UIOptions name="test" select options={[]} />);
    fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    expect(container.firstChild).toMatchSnapshot();
    Object.assign(window, { innerHeight: 768 });
  });

  test('select expanded with value', () => {
    const { container } = render(<UIOptions name="test" select options={selectOptions} value={['option1']} />);
    fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('correctly handles select keyboard navigation', () => {
    const { container } = render(<UIOptions name="test" select options={selectOptions} value={['option1']} />);
    const button = container.getElementsByTagName('button')[0];
    fireEvent.focus(button);
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'PageDown' });
    fireEvent.keyDown(button, { key: 'End' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'PageUp' });
    fireEvent.keyDown(button, { key: 'Home' });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: 'Escape' });
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: 'A' });
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with listeners', () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    vi.useFakeTimers();
    const { container } = render(<UIOptions name="test" select options={selectOptions} value="option2" onChange={onChange} onFocus={onFocus} />);
    const li = container.getElementsByTagName('li')[0];
    const button = container.getElementsByTagName('button')[0];
    fireEvent.focus(button);
    fireEvent.mouseDown(button);
    act(() => { vi.runAllTimers(); });
    fireEvent.mouseDown(li);
    fireEvent.blur(li);
    expect(container.firstChild).toMatchSnapshot();
    expect(onFocus).toHaveBeenCalledTimes(3);
    expect(onFocus).toHaveBeenNthCalledWith(1, '', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(2, 'option2', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(3, '', expect.any(Object));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('option1', expect.any(Object));
    vi.useRealTimers();
  });

  test('select with default value', () => {
    const defaultOptions = [{ value: 'test', type: 'option' as const, label: '' }];
    const { container } = render(<UIOptions name="test" select options={defaultOptions} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('multiple select with listeners', () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    const { container } = render(
      <UIOptions
        select
        multiple
        name="test"
        value="option2"
        onFocus={onFocus}
        onChange={onChange}
        options={selectOptions}
      />,
    );
    const li = container.getElementsByTagName('li')[0];
    const button = container.getElementsByTagName('button')[0];
    fireEvent.focus(button);
    fireEvent.mouseDown(button);
    fireEvent.focus(li);
    fireEvent.mouseDown(li);
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenNthCalledWith(1, ['option2', 'option1'], expect.any(Object));
    fireEvent.mouseDown(li);
    expect(onFocus).toHaveBeenCalledTimes(2);
    expect(onFocus).toHaveBeenNthCalledWith(1, '', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(2, 'option1', expect.any(Object));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(2, ['option2'], expect.any(Object));
  });

  test('select correctly focuses last available option when narrowing options down', () => {
    const onFocus = vi.fn();
    const { container, rerender } = render(<UIOptions name="test" select options={selectOptions} value="option3" onFocus={onFocus} multiple />);
    const li = container.getElementsByTagName('li')[3];
    const button = container.getElementsByTagName('button')[0];
    fireEvent.focus(button);
    fireEvent.mouseDown(button);
    fireEvent.focus(li);
    rerender(<UIOptions name="test" select options={selectOptions.slice(0, 2)} value="option3" onFocus={onFocus} multiple />);
    expect(container.firstChild).toMatchSnapshot();
    expect(onFocus).toHaveBeenCalledTimes(3);
    expect(onFocus).toHaveBeenNthCalledWith(1, '', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(2, 'option3', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(3, 'option1', expect.any(Object));
  });

  test('select correctly updates current value when changing value and multiple props', () => {
    const { container, rerender } = render(
      <UIOptions
        select
        multiple
        name="test"
        value={['option3']}
        options={selectOptions}
      />,
    );
    rerender(<UIOptions name="test" select options={selectOptions} value={['option1', 'option2']} multiple />);
    expect(container.firstChild).toMatchSnapshot();
    rerender(<UIOptions name="test" select options={selectOptions} value="option1" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio basic', () => {
    const { container } = render(<UIOptions name="test" options={options} modifiers="large" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with id', () => {
    const { container } = render(<UIOptions name="test" id="test" options={options} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with label', () => {
    const { container } = render(<UIOptions name="test" label="test" options={options} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with helper', () => {
    const { container } = render(<UIOptions name="test" helper="test" options={options} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with value', () => {
    const { container } = render(<UIOptions name="test" options={options} value={['option1']} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio disabled', () => {
    const { container } = render(<UIOptions name="test" options={options} disabled />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with option disabled', () => {
    const { container } = render(<UIOptions
      name="test"
      options={[{
        type: 'option',
        value: 'option5',
        label: 'Option 5',
        disabled: true,
      }]}
    />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio  with listeners', () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    const { container } = render(
      <UIOptions
        name="test"
        options={options}
        onFocus={onFocus}
        onChange={onChange}
      />,
    );
    const input = container.getElementsByTagName('input')[2];
    fireEvent.focus(input);
    fireEvent.click(input);
    expect(container.firstChild).toMatchSnapshot();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith('option3', expect.any(Object));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('option3', expect.any(Object));
  });

  test('correctly handles checkboxes keyboard navigation', () => {
    const { container } = render(<UIOptions name="test" multiple options={options} />);
    const input = container.getElementsByTagName('input')[1];
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.focus(container.getElementsByTagName('input')[0]);
    fireEvent.keyDown(input, { key: ' ' });
    expect(container.firstChild).toMatchSnapshot();
  });
});
