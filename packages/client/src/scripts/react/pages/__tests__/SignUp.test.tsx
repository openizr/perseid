/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import SignUp from 'scripts/react/pages/SignUp';
import { render } from '@testing-library/react';
import { type DefaultDataModel } from '@perseid/core';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/pages/SignUp', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');
  vi.mock('@perseid/form/react');
  vi.mock('scripts/react/components/Loader');
  vi.mock('scripts/react/components/FormField');

  const components = {};
  const navigate = vi.fn();
  const createServices = (state: unknown, signInRoute: string | null): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      navigate,
      getRoute: vi.fn(() => signInRoute),
      useSubscription: vi.fn(() => state),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - loading page', () => {
    const { container } = render(
      <SignUp
        components={components}
        services={createServices(null, null)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - loaded page', () => {
    const { container } = render(
      <SignUp
        components={components}
        services={createServices({
          configuration: { root: 'root', fields: {}, steps: {} },
          fieldProps: { 'root.0.test': { component: 'Test', componentProps: { modifiers: 'primary' } } },
        }, '/sign-in')}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
