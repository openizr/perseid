/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import type { SvelteComponent } from 'svelte';
import type Engine from 'scripts/core/Engine';
import { render } from '@testing-library/svelte';
import DefaultField from 'scripts/svelte/DefaultField.svelte';

describe('svelte/DefaultField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - non-binary field', () => {
    const { container } = render(DefaultField, {
      props: {
        error: null,
        value: null,
        isActive: false,
        isRequired: true,
        type: 'string',
        status: 'initial',
        fields: undefined,
        path: 'root.0.test',
        activeStep: 'root.0',
        setActiveStep: vi.fn(),
        useSubscription: vi.fn(),
        engine: {} as unknown as Engine,
        Field: {} as unknown as SvelteComponent,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - binary field', () => {
    const { container } = render(DefaultField, {
      props: {
        error: null,
        value: null,
        isActive: false,
        isRequired: true,
        type: 'binary',
        status: 'initial',
        fields: undefined,
        path: 'root.0.test',
        activeStep: 'root.0',
        setActiveStep: vi.fn(),
        useSubscription: vi.fn(),
        engine: {} as unknown as Engine,
        Field: {} as unknown as SvelteComponent,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });
});
