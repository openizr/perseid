/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
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
    const { container } = render(
      <DefaultStep
        step={step}
        Field={Field}
        active={false}
        useSubscription={vi.fn()}
        engine={{} as unknown as Engine}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
