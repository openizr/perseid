/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import UIImage from 'scripts/react/Image';
import { render } from '@testing-library/react';

describe('react/UIImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(<UIImage alt="test" src="https://test.com/a.jpg" ratio="square" modifiers="large" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - custom ratio', () => {
    const { container } = render(<UIImage alt="test" src="https://test.com/a.jpg" ratio="25x32" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(<UIImage id="test" alt="test" src="https://test.com/a.jpg" ratio="portrait" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - no lazy', () => {
    const { container } = render(<UIImage alt="test" lazy={false} src="https://test.com/a.jpg" ratio="portrait" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - standard ratio with itemprop', () => {
    const { container } = render(<UIImage itemProp="image" alt="test" src="https://test.com/a.jpg" ratio="landscape" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - custom ratio with itemprop', () => {
    const { container } = render(<UIImage itemProp="image" alt="test" src="https://test.com/a.jpg" ratio="1x5" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - custom ratio no lazy', () => {
    const { container } = render(<UIImage alt="test" lazy={false} src="https://test.com/a.jpg" ratio="1x5" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with panoramic ratio', () => {
    const { container } = render(<UIImage alt="test" src="https://test.com/a.jpg" ratio="panoramic" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
