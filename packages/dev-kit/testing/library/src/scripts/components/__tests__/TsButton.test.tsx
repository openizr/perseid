/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import TsButton from 'scripts/components/TsButton';

describe('react/TsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(<TsButton label="Test" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
