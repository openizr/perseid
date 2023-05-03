/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/vue';
import AppLoader from 'scripts/components/AppLoader.vue';

describe('components/AppLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(AppLoader);
    expect(container.firstChild).toMatchSnapshot();
  });
});
