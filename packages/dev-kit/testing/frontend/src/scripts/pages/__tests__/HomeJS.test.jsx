/**
 * @vitest-environment jsdom
 */

import React from 'react';
import HomeJS from 'scripts/pages/HomeJS';
import { render } from '@testing-library/react';

describe('react/HomeJS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(<HomeJS translate={(label) => label} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
