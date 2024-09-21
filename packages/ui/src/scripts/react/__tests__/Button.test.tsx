/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UIButton from 'scripts/react/Button';
import { render, fireEvent } from '@testing-library/react';

describe('react/UIButton', () => {
  vi.mock('scripts/core/index');
  vi.mock('scripts/react/Icon');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(<UIButton label="Test" modifiers="large" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(<UIButton label="Test" id="test" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - no label', () => {
    const { container } = render(<UIButton />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - label with icon', () => {
    const { container } = render(<UIButton label="Test" icon="star" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - default type', () => {
    const { container } = render(<UIButton type={null as unknown as undefined} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - type submit', () => {
    const { container } = render(<UIButton type="submit" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - icon only', () => {
    const { container } = render(<UIButton icon="star" iconPosition={null as unknown as undefined} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - icon only', () => {
    const { container } = render(<UIButton icon="star" iconPosition="right" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - disabled', () => {
    const { container } = render(<UIButton disabled />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with listeners', () => {
    const onFocus = vi.fn();
    const onClick = vi.fn();
    const { container } = render(<UIButton onFocus={onFocus} onClick={onClick} />);
    const button = container.getElementsByTagName('button')[0];
    fireEvent.focus(button);
    fireEvent.click(button);
    expect(container.firstChild).toMatchSnapshot();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith(expect.any(Object));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(expect.any(Object));
  });
});
