/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/svelte';
import Loader from 'scripts/components/Loader.svelte';

describe('svelte/Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(Loader, { props: { locale: { LABEL_TEST: 'Test' } } });
    expect(container.firstChild).toMatchSnapshot();
  });
});
