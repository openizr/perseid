/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import type Engine from 'scripts/core/Engine';
import DefaultStep from 'scripts/vue/DefaultStep.vue';
import { fireEvent, render } from '@testing-library/vue';

describe('vue/DefaultStep', () => {
  vi.mock('scripts/vue/DefaultField.vue');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - active step', async () => {
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
        activeStep: 'root.0',
        onFocus: vi.fn(),
        setActiveStep: vi.fn(),
        useSubscription: vi.fn(),
        engine: {} as unknown as Engine,
      },
    });
    const domElement = container.querySelector('.perseid-form__step');
    await fireEvent.focus(domElement as HTMLElement);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - inactive step', () => {
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
        activeStep: 'root.1',
        onFocus: vi.fn(),
        setActiveStep: vi.fn(),
        useSubscription: vi.fn(),
        engine: {} as unknown as Engine,
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });
});
