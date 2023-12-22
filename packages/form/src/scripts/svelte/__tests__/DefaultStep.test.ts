/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import type Engine from 'scripts/core/Engine';
import { type SvelteComponent } from 'svelte';
import { render } from '@testing-library/svelte';
import DefaultStep from 'scripts/svelte/DefaultStep.svelte';
import DefaultField from 'scripts/svelte/DefaultField.svelte';

describe('svelte/DefaultStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const step: Step = {
      path: 'root.0',
      status: 'initial',
      fields: [{
        path: 'root.0.test',
        status: 'initial',
        error: null,
        value: null,
        required: false,
        type: 'string',
      }],
    };
    const { container } = render(DefaultStep, {
      props: {
        step,
        active: false,
        useSubscription: vi.fn(),
        engine: {} as unknown as Engine,
        Field: DefaultField as unknown as typeof SvelteComponent,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });
});
