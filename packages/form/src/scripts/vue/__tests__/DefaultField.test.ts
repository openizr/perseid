/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { type DefineComponent } from 'vue';
import type Engine from 'scripts/core/Engine';
import { render } from '@testing-library/vue';
import DefaultField from 'scripts/vue/DefaultField.vue';

describe('vue/DefaultField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - non-binary field', () => {
    const { container } = render(DefaultField, {
      props: {
        error: null,
        value: null,
        active: false,
        required: true,
        type: 'string',
        status: 'initial',
        fields: undefined,
        path: 'root.0.test',
        useSubscription: vi.fn(),
        engine: {} as unknown as Engine,
        field: {} as unknown as DefineComponent,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - binary field', () => {
    const { container } = render(DefaultField, {
      props: {
        error: null,
        value: null,
        active: false,
        required: true,
        type: 'binary',
        status: 'initial',
        fields: undefined,
        path: 'root.0.test',
        useSubscription: vi.fn(),
        engine: {} as unknown as Engine,
        field: {} as unknown as DefineComponent,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });
});
