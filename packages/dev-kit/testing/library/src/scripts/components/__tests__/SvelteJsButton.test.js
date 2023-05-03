/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/svelte';
import SvelteTsButton from 'scripts/components/SvelteJsButton.svelte';

describe('svelte/SvelteTsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(SvelteTsButton);
    expect(container.firstChild).toMatchSnapshot();
  });
});
