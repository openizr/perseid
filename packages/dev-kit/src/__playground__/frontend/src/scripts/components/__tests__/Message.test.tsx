/**
 * @vitest-environment jsdom
 */

import Message from 'scripts/components/Message';
import { render } from '@testing-library/react';

describe('react/Message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(<Message label="Test" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
