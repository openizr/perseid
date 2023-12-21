/**
 * @vitest-environment jsdom
 */

import * as React from 'react';
import store from 'scripts/store/index';
import Router from 'scripts/containers/Router';
import { render } from '@testing-library/react';

type Misc = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// Useful mocks allowing us to easily test React lazy components and Suspense.
vi.mock('react', async () => {
  const MockedReact = await vi.importActual<typeof import('react')>('react');
  // (MockedReact as any).Suspense = ({ children, fallback }: Misc): Misc => {
  //   return (
  //     process.env.LOADING === 'true' ? fallback : children
  //   );
  // };
  // MockedReact.lazy = (callback: Misc): Misc => callback();
  return MockedReact;
});

vi.mock('scripts/store/routes', () => ({
  default: {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    '/': (): Misc => import('scripts/pages/Home'),
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    '/js': (): Misc => import('scripts/pages/HomeJS'),
  },
}));

describe('react/Router', () => {
  beforeEach(() => {
    process.env.LOADING = 'false';
    vi.clearAllMocks();
  });

  test('renders correctly - loading page', () => {
    process.env.LOADING = 'true';
    const { container } = render(<Router locale={{}} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - found page', () => {
    store.mutate('router', 'NAVIGATE', '/');
    const { container } = render(<Router locale={{}} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - not found page', () => {
    store.mutate('router', 'NAVIGATE', '/404');
    const { container } = render(<Router locale={{}} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
