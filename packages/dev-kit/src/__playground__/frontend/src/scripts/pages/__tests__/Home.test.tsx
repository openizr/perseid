/**
 * @vitest-environment jsdom
 */

import React from 'react';
import Home from 'scripts/pages/Home';
import { render } from '@testing-library/react';

describe('react/Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEST = 'true';
  });

  test('renders correctly - basic', () => {
    const { container } = render(<Home translate={(label: string): string => label} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
