/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import ErrorWrapper from 'scripts/react/components/ErrorWrapper';

describe('react/components/ErrorWrapper', () => {
  function TestComponent(): JSX.Element {
    return <div id="test" />;
  }
  function FallbackComponent(): JSX.Element {
    return <div id="fallback" />;
  }

  test('renders correctly - no error', () => {
    const { container } = render(
      <ErrorWrapper>
        <TestComponent />
      </ErrorWrapper>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - error', () => {
    const onError = vi.fn();
    const error = new Error('Test Error');
    ErrorWrapper.getDerivedStateFromError();
    const component = new ErrorWrapper({ fallback: <FallbackComponent />, onError });
    component.componentDidCatch(error, { componentStack: '' });
    (component.state as { hasError: boolean; }).hasError = true;
    expect(component.render()).toMatchSnapshot();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
  });
});
