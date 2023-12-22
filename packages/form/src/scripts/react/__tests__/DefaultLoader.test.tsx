/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import DefaultLoader from 'scripts/react/DefaultLoader';

describe('react/DefaultLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const { container } = render(<DefaultLoader />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
