/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import type Engine from 'scripts/core/Engine';
import { render } from '@testing-library/react';
import DefaultStep from 'scripts/react/DefaultStep';

function Field(props: unknown): JSX.Element {
  return <div>{JSON.stringify(props)}</div>;
}

describe('react/DefaultStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - active step', () => {
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
    const { container } = render(
      <DefaultStep
        step={step}
        Field={Field}
        onFocus={vi.fn()}
        activeStep="root.0"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
        engine={{} as unknown as Engine}
      />,
    );
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
    const { container } = render(
      <DefaultStep
        step={step}
        Field={Field}
        onFocus={vi.fn()}
        activeStep="root.1"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
        engine={{} as unknown as Engine}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
