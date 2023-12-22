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
import DefaultField from 'scripts/react/DefaultField';

function Field(props: unknown): JSX.Element {
  return <div>{JSON.stringify(props)}</div>;
}

describe('react/DefaultField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - non-binary field', () => {
    const { container } = render(
      <DefaultField
        required
        error={null}
        value={null}
        type="string"
        Field={Field}
        active={false}
        status="initial"
        path="root.0.test"
        useSubscription={vi.fn()}
        engine={{} as unknown as Engine}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - binary field', () => {
    const { container } = render(
      <DefaultField
        required
        error={null}
        value={null}
        type="binary"
        Field={Field}
        active={false}
        status="initial"
        path="root.0.test"
        useSubscription={vi.fn()}
        engine={{} as unknown as Engine}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
