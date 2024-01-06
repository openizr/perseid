/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/vue';
import DefaultLayout from 'scripts/vue/DefaultLayout.vue';

describe('vue/DefaultLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const { container } = render(DefaultLayout, {
      props: {
        activeStep: 'root',
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
