/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { ref, markRaw } from 'vue';
import Form from 'scripts/vue/Form.vue';
import DefaultStep from 'scripts/vue/__mocks__/DefaultStep.vue';
import { render, fireEvent, createEvent } from '@testing-library/vue';

describe('vue/Form', () => {
  vi.mock('scripts/core/Engine', () => ({
    default: vi.fn(() => ({
      getStore: vi.fn(),
    })),
  }));
  vi.mock('@perseid/store/connectors/vue', () => ({
    default: vi.fn(() => (_: string, callback: (data: unknown) => unknown): unknown => {
      const state = {
        loading: process.env.LOADING === 'true',
        steps: process.env.LOADING === 'true' ? [] : [
          { path: 'start', fields: [] },
          { path: 'end', fields: [] },
        ],
      };
      return ref(callback(state));
    }),
  }));

  const configuration = {
    id: 'test',
    root: 'start',
    fields: { test: { type: 'string' } },
    steps: { root: { fields: ['test'] } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', async () => {
    vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
      if (event === 'blur') { (callback as () => void)(); }
    });
    const { container, rerender } = render(Form, {
      props: {
        configuration,
        activeStep: 'start',
        engineClass: undefined,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
    await rerender({ activeStep: undefined });
    expect(window.addEventListener).toHaveBeenCalledOnce();
    expect(window.addEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
  });

  test('renders correctly - with active step', () => {
    const { container } = render(Form, {
      props: {
        configuration,
        activeStep: undefined,
        engineClass: undefined,
        stepComponent: markRaw(DefaultStep),
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('prevents native form submission', async () => {
    const { container } = render(Form, {
      props: {
        configuration,
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
