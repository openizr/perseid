/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import type Engine from '@perseid/form';
import { render } from '@testing-library/react';
import OptionalField from 'scripts/react/components/OptionalField';

function SubField(): JSX.Element {
  return <div id="field" />;
}

describe('react/components/OptionalField', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');

  const engine = { userAction: vi.fn() } as unknown as Engine;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - hidden, object', () => {
    const { container } = render(
      <OptionalField
        engine={engine}
        path="root.0.field"
        type="object"
        value={null}
        error="TEST"
        isActive={false}
        isRequired={false}
        status="initial"
        Field={SubField}
        showLabel="SHOW"
        hideLabel="HIDE"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    expect(engine.userAction).toHaveBeenCalledOnce();
    expect(engine.userAction).toHaveBeenCalledWith({ data: {}, path: 'root.0.field', type: 'input' });
  });

  test('renders correctly - hidden, array', () => {
    const { container } = render(
      <OptionalField
        engine={engine}
        path="root.0.field"
        type="array"
        value={null}
        error="TEST"
        isActive={false}
        isRequired={false}
        status="initial"
        Field={SubField}
        showLabel="SHOW"
        hideLabel="HIDE"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    expect(engine.userAction).toHaveBeenCalledOnce();
    expect(engine.userAction).toHaveBeenCalledWith({ data: [], path: 'root.0.field', type: 'input' });
  });

  test('renders correctly - displayed', () => {
    const { container } = render(
      <OptionalField
        engine={engine}
        path="root.0.field"
        type="null"
        error="TEST"
        value="test"
        isActive={false}
        isRequired={false}
        status="initial"
        Field={SubField}
        showLabel="SHOW"
        hideLabel="HIDE"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    expect(engine.userAction).toHaveBeenCalledOnce();
    expect(engine.userAction).toHaveBeenCalledWith({ data: null, path: 'root.0.field', type: 'input' });
  });
});
