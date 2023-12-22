/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { type SvelteComponent } from 'svelte';
import { render } from '@testing-library/svelte';
import DefaultLayout from 'scripts/svelte/DefaultLayout.svelte';
import DefaultLoader from 'scripts/svelte/DefaultLoader.svelte';

describe('svelte/DefaultLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const { container } = render(DefaultLayout, {
      props: {
        activeStep: 'root',
        Loader: DefaultLoader as unknown as typeof SvelteComponent,
        setActiveStep: vi.fn(),
        useSubscription: vi.fn(),
        state: {
          steps: [],
          loading: true,
          variables: {},
          userInputs: { full: {}, partial: {} },
        },
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });
});
