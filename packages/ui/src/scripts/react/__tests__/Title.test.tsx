/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UITitle from 'scripts/react/Title';
import { render } from '@testing-library/react';

describe('react/UITitle', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(<UITitle label="Test" modifiers="large" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(<UITitle label="Test" id="test" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - modifier different than level', () => {
    const { container } = render(<UITitle label="Test" level="1" modifiers="5 large" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with itemProp', () => {
    const { container } = render(<UITitle label="Test" itemProp="name" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
