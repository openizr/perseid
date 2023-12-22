/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { ref } from 'vue';
import Form from 'scripts/vue/Form.vue';
import { render, fireEvent } from '@testing-library/vue';

describe('vue/Form', () => {
  vi.mock('scripts/core/Engine', () => ({
    default: vi.fn(() => ({
      getStore: vi.fn(),
    })),
  }));
  vi.mock('@perseid/store/connectors/vue', () => ({
    default: vi.fn(() => (): unknown => {
      const state = {
        loading: process.env.LOADING === 'true',
        steps: process.env.LOADING === 'true' ? [] : [
          { path: 'start', fields: [] },
          { path: 'end', fields: [] },
        ],
      };
      return ref(state);
    }),
  }));

  const configuration: Configuration = {
    id: 'test',
    root: 'start',
    fields: { test: { type: 'string' } },
    steps: { root: { fields: ['test'] } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LOADING;
  });

  test('renders correctly - loading next step', () => {
    process.env.LOADING = 'true';
    const { container } = render(Form, {
      props: {
        configuration,
        Step: undefined,
        Field: undefined,
        Layout: undefined,
        Loader: undefined,
        activeStep: undefined,
        engineClass: undefined,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with active step', async () => {
    const { container } = render(Form, {
      props: {
        configuration,
        activeStep: 'start',
        Step: undefined,
        Field: undefined,
        Layout: undefined,
        Loader: undefined,
        engineClass: undefined,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
    const step = container.querySelector('.perseid-form__step');
    await fireEvent.focus(step as HTMLElement);
    expect(container.firstChild).toMatchSnapshot();
  });
});
