/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UIOptions from 'scripts/vue/UIOptions.vue';
import { render, fireEvent } from '@testing-library/vue';

vi.mock('scripts/core/generateRandomId');

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

const nextTick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 50); });

describe('vue/UIOptions', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('basic select', async () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test', modifiers: 'large', select: true, options: selectOptions,
      },
    });
    await fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    await fireEvent.mouseDown(container.getElementsByTagName('li')[0]);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with id', () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test', id: 'test', select: true, options: selectOptions,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with label', () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test', label: 'test', select: true, options: selectOptions,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with helper', () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test',
        select: true,
        helper: 'test',
        placeholder: 'test2',
        options: selectOptions,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with value', () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test', value: ['option1', 'option3'], select: true, options: selectOptions,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select disabled', () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test', disabled: true, select: true, options: selectOptions,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with option disabled', async () => {
    const onChange = vi.fn();
    const { container } = render(UIOptions, {
      props: {
        name: 'test',
        select: true,
        options: [{
          type: 'option',
          value: 'option5',
          label: 'Option 5',
          disabled: true,
        }],
        onChange,
      },
    });
    await fireEvent.change(container.getElementsByTagName('button')[0]);
    expect(onChange).not.toHaveBeenCalled();
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select expanded', async () => {
    const { container } = render(UIOptions, { props: { name: 'test', select: true, options: selectOptions } });
    await fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select expanded with selectPosition', async () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test', select: true, selectPosition: 'top', options: selectOptions,
      },
    });
    await fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select changing options', async () => {
    const { container } = render(UIOptions, { props: { name: 'test', select: true, options: selectOptions } });
    await fireEvent.keyDown(container.getElementsByTagName('button')[0], { key: 'End' });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select expanded with no option and small viewport', async () => {
    Object.assign(window, { innerHeight: -1 });
    const { container } = render(UIOptions, { props: { name: 'test', select: true, options: [] } });
    await fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    expect(container.firstChild).toMatchSnapshot();
    Object.assign(window, { innerHeight: 768 });
  });

  test('select expanded with value', async () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test', select: true, options: selectOptions, value: ['option1'],
      },
    });
    await fireEvent.mouseDown(container.getElementsByTagName('button')[0]);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('correctly handles select keyboard navigation', async () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test', select: true, options: selectOptions, value: ['option1'],
      },
    });
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.focus(button);
    await fireEvent.keyDown(button, { key: 'ArrowUp' });
    await fireEvent.keyDown(button, { key: 'ArrowDown' });
    await fireEvent.keyDown(button, { key: 'PageDown' });
    await fireEvent.keyDown(button, { key: 'End' });
    await fireEvent.keyDown(button, { key: 'ArrowDown' });
    await fireEvent.keyDown(button, { key: 'PageUp' });
    await fireEvent.keyDown(button, { key: 'Home' });
    await fireEvent.keyDown(button, { key: ' ' });
    await fireEvent.keyDown(button, { key: 'Enter' });
    await fireEvent.keyDown(button, { key: 'Escape' });
    await fireEvent.keyDown(button, { key: 'Enter' });
    await fireEvent.keyDown(button, { key: 'A' });
    await fireEvent.keyDown(button, { key: 'Enter' });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('select with listeners', async () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    const { container } = render(UIOptions, {
      props: {
        name: 'test', select: true, options: selectOptions, value: 'option2', onChange, onFocus,
      },
    });
    const li = container.getElementsByTagName('li')[0];
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.focus(button);
    await nextTick();
    await fireEvent.mouseDown(button);
    await nextTick();
    await fireEvent.mouseDown(li);
    await nextTick();
    expect(container.firstChild).toMatchSnapshot();
    expect(onFocus).toHaveBeenCalledTimes(3);
    expect(onFocus).toHaveBeenNthCalledWith(1, '', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(2, 'option2', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(3, '', expect.any(Object));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('option1', expect.any(Object));
  });

  test('select with default value', () => {
    const defaultOptions: UIOptionsOption[] = [{ type: 'option', value: 'test', label: 'Test' }];
    const { container } = render(UIOptions, {
      props: {
        name: 'test', select: true, options: defaultOptions, value: undefined,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('multiple select with listeners', async () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    const { container } = render(UIOptions, {
      props: {
        name: 'test', select: true, options: selectOptions, value: 'option2', onChange, onFocus, multiple: true,
      },
    });
    const li = container.getElementsByTagName('li')[0];
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.focus(button);
    await fireEvent.mouseDown(button);
    await nextTick();
    await fireEvent.mouseDown(li);
    expect(container.firstChild).toMatchSnapshot();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenNthCalledWith(1, ['option2', 'option1'], expect.any(Object));
    await fireEvent.mouseDown(li);
    expect(onFocus).toHaveBeenCalledTimes(2);
    expect(onFocus).toHaveBeenNthCalledWith(1, '', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(2, 'option2', expect.any(Object));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(2, ['option2'], expect.any(Object));
  });

  test('select correctly focuses last available option when narrowing options down', async () => {
    const onFocus = vi.fn();
    const { container, rerender } = render(UIOptions, {
      props: {
        name: 'test', select: true, options: selectOptions, value: 'option3', onFocus, multiple: true,
      },
    });
    const li = container.getElementsByTagName('li')[3];
    const button = container.getElementsByTagName('button')[0];
    await fireEvent.focus(button);
    await nextTick();
    await fireEvent.mouseDown(button);
    await nextTick();
    await fireEvent.focus(li);
    await nextTick();
    await rerender({
      name: 'test', select: true, options: selectOptions.slice(0, 2), value: 'option3', onFocus, multiple: true,
    });
    expect(container.firstChild).toMatchSnapshot();
    expect(onFocus).toHaveBeenCalledTimes(4);
    expect(onFocus).toHaveBeenNthCalledWith(1, '', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(2, 'option3', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(3, 'option3', expect.any(Object));
    expect(onFocus).toHaveBeenNthCalledWith(4, 'option1', expect.any(Object));
    await rerender({ value: [], options: [] });
    await rerender({ value: 'option1', options: selectOptions });
  });

  test('select correctly updates current value when changing value, expanded and multiple props', async () => {
    const { container, rerender } = render(UIOptions, {
      props: {
        name: 'test',
        select: true,
        multiple: true,
        value: ['option3'],
        options: selectOptions,
      },
    });
    await rerender({
      name: 'test',
      select: true,
      multiple: true,
      options: selectOptions,
      value: ['option1', 'option2'],
    });
    await nextTick();
    expect(container.firstChild).toMatchSnapshot();
    await rerender({
      name: 'test',
      select: true,
      multiple: false,
      value: ['option1'],
      options: selectOptions,
    });
    await nextTick();
    expect(container.firstChild).toMatchSnapshot();
    await rerender({
      name: 'test',
      select: true,
      multiple: true,
      value: undefined,
      options: selectOptions,
    });
    await nextTick();
    expect(container.firstChild).toMatchSnapshot();
    await rerender({
      name: 'test',
      select: true,
      expanded: true,
      options: selectOptions,
    });
    await nextTick();
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio basic', () => {
    const { container } = render(UIOptions, { props: { name: 'test', options, modifiers: 'large' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with id', () => {
    const { container } = render(UIOptions, { props: { name: 'test', id: 'test', options } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with label', () => {
    const { container } = render(UIOptions, { props: { name: 'test', label: 'test', options } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with helper', () => {
    const { container } = render(UIOptions, { props: { name: 'test', helper: 'test', options } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with value', () => {
    const { container } = render(UIOptions, { props: { name: 'test', options, value: ['option1'] } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio disabled', () => {
    const { container } = render(UIOptions, { props: { name: 'test', options, disabled: true } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio with option disabled', () => {
    const { container } = render(UIOptions, {
      props: {
        name: 'test',
        options: [{
          type: 'option',
          value: 'option5',
          label: 'Option 5',
          disabled: true,
        }],
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('radio  with listeners', async () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    const { container } = render(UIOptions, {
      props: {
        name: 'test', options, onChange, onFocus,
      },
    });
    const input = container.getElementsByTagName('input')[2];
    await fireEvent.focus(input);
    await fireEvent.click(input);
    expect(container.firstChild).toMatchSnapshot();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith('option3', expect.any(Object));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('option3', expect.any(Object));
  });

  test('correctly handles checkboxes keyboard navigation', async () => {
    const { container } = render(UIOptions, { props: { name: 'test', multiple: true, options } });
    const input = container.getElementsByTagName('input')[1];
    await fireEvent.keyDown(input, { key: 'ArrowLeft' });
    await fireEvent.keyDown(input, { key: 'ArrowRight' });
    await fireEvent.focus(container.getElementsByTagName('input')[0]);
    await fireEvent.keyDown(input, { key: ' ' });
    expect(container.firstChild).toMatchSnapshot();
  });
});
