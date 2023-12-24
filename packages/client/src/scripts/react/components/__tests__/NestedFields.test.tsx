/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import type Engine from '@perseid/form';
import { render } from '@testing-library/react';
import NestedFields from 'scripts/react/components/NestedFields';

function SubField(): JSX.Element {
  return <div id="field" />;
}

describe('react/components/NestedFields', () => {
  vi.mock('biuty/react');

  const engine = { userAction: vi.fn() } as unknown as Engine;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - array, `null` value', () => {
    const { container } = render(
      <NestedFields
        engine={engine}
        path="root.0.field"
        type="array"
        error="TEST"
        label="LABEL"
        active={false}
        helper="HELPER"
        fields={[null]}
        required={false}
        status="initial"
        Field={SubField}
        useSubscription={vi.fn}
        value={null as unknown as unknown[]}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - object', () => {
    const { container } = render(
      <NestedFields
        engine={engine}
        path="root.0.field"
        type="object"
        error="TEST"
        fields={[{
          error: null,
          type: 'string',
          value: 'test1',
          required: true,
          status: 'initial',
          path: 'root.0.field.key',
        }]}
        label="LABEL"
        active={false}
        helper="HELPER"
        required={false}
        status="initial"
        Field={SubField}
        useSubscription={vi.fn}
        value={{ key: 'test1' } as unknown as unknown[]}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - array', () => {
    const { container } = render(
      <NestedFields
        engine={engine}
        path="root.0.field"
        type="array"
        error="TEST"
        fields={[{
          error: null,
          type: 'string',
          value: 'test1',
          required: true,
          status: 'initial',
          path: 'root.0.field.0',
        }]}
        label="LABEL"
        active={false}
        helper="HELPER"
        required={false}
        status="initial"
        Field={SubField}
        useSubscription={vi.fn}
        value={['test1']}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - array, missing items', () => {
    const { container } = render(
      <NestedFields
        engine={engine}
        path="root.0.field"
        type="array"
        error="TEST"
        fields={[]}
        label="LABEL"
        active={false}
        helper="HELPER"
        required={false}
        status="initial"
        Field={SubField}
        useSubscription={vi.fn}
        value={[]}
        minItems={1}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - array, too many items', () => {
    const { container } = render(
      <NestedFields
        engine={engine}
        path="root.0.field"
        type="array"
        error="TEST"
        fields={[]}
        label="LABEL"
        active={false}
        helper="HELPER"
        required={false}
        status="initial"
        Field={SubField}
        useSubscription={vi.fn}
        value={['test1', 'test2']}
        maxItems={1}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
