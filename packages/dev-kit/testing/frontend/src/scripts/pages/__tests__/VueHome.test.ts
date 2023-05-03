/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/vue';
import HomePage from 'scripts/pages/HomePage.vue';

describe('pages/HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(HomePage, { props: { locale: { LABEL_TEST: 'Test' } } });
    expect(container.firstChild).toMatchSnapshot();
  });
});
