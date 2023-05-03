/**
 * @vitest-environment jsdom
 */

import store from 'scripts/store/index';
import { render, act } from '@testing-library/svelte';
import Router from 'scripts/containers/Router.svelte';

type Misc = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// Useful mocks allowing us to easily test Vue lazy components.
vi.mock('scripts/store/routes', () => ({
  default: {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    '/': (): Misc => import('scripts/pages/Home.svelte'),
  },
}));

describe('svelte/Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - loading page', () => {
    const { container } = render(Router, { props: { locale: { LABEL_TEST: 'Test' } } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - page found', async () => {
    store.mutate('router', 'NAVIGATE', '/');
    const { container } = render(Router, { props: { locale: { LABEL_TEST: 'Test' } } });
    await act(() => new Promise((resolve) => {
      setTimeout(resolve, 100);
    }));
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - page not found', () => {
    store.mutate('router', 'NAVIGATE', '/404');
    const { container } = render(Router, { props: { locale: { LABEL_TEST: 'Test' } } });
    expect(container.firstChild).toMatchSnapshot();
  });
});
