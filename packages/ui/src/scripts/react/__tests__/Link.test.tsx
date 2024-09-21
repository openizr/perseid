/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UILink from 'scripts/react/Link';
import { render, fireEvent } from '@testing-library/react';

describe('react/UILink', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(<UILink label="Test" href="https://test.com" modifiers="large" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - disabled', () => {
    const { container } = render(<UILink label="Test" href="https://test.com" disabled />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(<UILink label="Test" href="https://test.com" id="test" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with target', () => {
    const { container } = render(<UILink label="Test" href="https://test.com" target="_blank" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with rel', () => {
    const { container } = render(<UILink label="Test" href="https://test.com" rel="no referrer" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with itemProp', () => {
    const { container } = render(<UILink label="Test" href="https://test.com" itemProp="name" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with listeners', () => {
    const onClick = vi.fn();
    const { container } = render(<UILink onClick={onClick} label="" href="" />);
    const a = container.getElementsByTagName('a')[0];
    fireEvent.focus(a);
    fireEvent.click(a);
    expect(container.firstChild).toMatchSnapshot();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(expect.any(Object));
  });
});
