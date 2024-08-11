/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { readable } from 'svelte/store';
import Engine from 'scripts/core/Engine';
import { type SvelteComponent } from 'svelte';
import Form from 'scripts/svelte/Form.svelte';
import Step from 'scripts/svelte/__mocks__/Step.svelte';
import { render, fireEvent, createEvent } from '@testing-library/svelte';
import DefaultField from 'scripts/svelte/DefaultField.svelte';
import DefaultLayout from 'scripts/svelte/DefaultLayout.svelte';
import DefaultLoader from 'scripts/svelte/DefaultLoader.svelte';

describe('svelte/Form', () => {
  vi.mock('scripts/core/Engine', () => ({
    default: vi.fn(() => ({
      getStore: vi.fn(),
    })),
  }));
  vi.mock('@perseid/store/connectors/svelte', () => ({
    default: vi.fn(() => (): unknown => {
      const state = {
        loading: process.env.LOADING === 'true',
        steps: process.env.LOADING === 'true' ? [] : [
          { path: 'start', fields: [] },
          { path: 'end', fields: [] },
        ],
      };
      return readable(state, (set) => {
        set(state);
      });
    }),
  }));

  class CustomEngine {
    public getStore = vi.fn();
  }

  const configuration: Configuration = {
    id: 'test',
    root: 'start',
    fields: { test: { type: 'string' } },
    steps: { root: { fields: ['test'] } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
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
        Step,
        Field: DefaultField,
        Layout: DefaultLayout,
        engineClass: CustomEngine as unknown as typeof Engine,
        Loader: DefaultLoader as unknown as typeof SvelteComponent,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
    const step = container.querySelector('#step');
    await fireEvent.focus(step as HTMLElement);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('prevents native form submission', async () => {
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
    const form = container.getElementsByTagName('form')[0];
    const event = createEvent.submit(form);
    event.preventDefault = vi.fn();
    await fireEvent(form, event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
