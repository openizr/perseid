/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UITooltip from 'scripts/react/Tooltip';
import { render, fireEvent } from '@testing-library/react';

describe('react/UITooltip', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(
      <UITooltip label="Test">
        <button type="button">i</button>
      </UITooltip>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with description', () => {
    const { container } = render(
      <UITooltip label="Test" description="Description">
        <button type="button">i</button>
      </UITooltip>,
    );
    const button = container.getElementsByTagName('button')[0];
    fireEvent.focus(button);
    expect(container.firstChild).toMatchSnapshot();
    fireEvent.blur(button);
    expect(container.firstChild).toMatchSnapshot();
  });
});
