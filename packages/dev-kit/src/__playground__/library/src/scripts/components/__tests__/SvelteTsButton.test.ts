/**
 * @vitest-environment jsdom
 */

import { type SvelteComponent } from 'svelte';
import { render } from '@testing-library/svelte';
import SvelteTsButton from 'scripts/components/SvelteTsButton.svelte';

describe('svelte/SvelteTsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(SvelteTsButton as new () => SvelteComponent);
    expect(container.firstChild).toMatchSnapshot();
  });
});
