/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import { type FormState } from 'scripts/core/state';
import DefaultLayout from 'scripts/react/DefaultLayout';

function Loader(): JSX.Element {
  return <div>LOADER</div>;
}

describe('react/DefaultLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const { container } = render(
      <DefaultLayout
        Loader={Loader}
        activeStep="step1"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
        state={{ loading: true } as FormState}
        steps={[<div key="step1">Step 1</div>, <div key="step2">Step 2</div>]}
      />,
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
