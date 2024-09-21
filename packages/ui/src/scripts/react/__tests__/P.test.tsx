/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UIP from 'scripts/react/P';
import { render } from '@testing-library/react';

describe('react/UIP', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(<UIP label="Test" modifiers="large" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(<UIP label="Test" id="test" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with itemProp', () => {
    const { container } = render(<UIP label="Test" itemProp="description" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
