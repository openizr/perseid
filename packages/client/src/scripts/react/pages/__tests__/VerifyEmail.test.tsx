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
import { type DefaultDataModel } from '@perseid/core';
import VerifyEmail from 'scripts/react/pages/VerifyEmail';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/pages/VerifyEmail', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');
  vi.mock('scripts/react/components/Loader');

  const components = {};
  const notify = vi.fn();
  const navigate = vi.fn(() => vi.fn());
  const dispatch = vi.fn(() => ((process.env.THROW_DISPATCH_ERROR === 'true')
    ? Promise.reject()
    : Promise.resolve()));
  const createServices = (
    userVerifiedAt: string | null,
    verificationToken: string | undefined,
  ): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      navigate,
      notify,
      dispatch,
      useSubscription: vi.fn((subscription) => ((subscription === 'auth')
        ? { user: { _verifiedAt: userVerifiedAt } }
        : { query: { verificationToken } })),
      getFallbackPageRoute: vi.fn(() => '/fallback-route'),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.THROW_DISPATCH_ERROR;
  });

  test('renders correctly - verifying email', () => {
    process.env.THROW_DISPATCH_ERROR = 'true';
    const { container } = render(
      <VerifyEmail
        components={components}
        services={createServices(null, '000000000000000000000011')}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - email must be verified', () => {
    const { container } = render(
      <VerifyEmail
        components={components}
        services={createServices(null, undefined)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - email already verified', () => {
    process.env.THROW_DISPATCH_ERROR = 'true';
    const { container } = render(
      <VerifyEmail
        components={components}
        services={createServices('2023-01-01', undefined)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
