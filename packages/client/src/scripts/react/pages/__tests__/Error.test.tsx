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
import ErrorPage from 'scripts/react/pages/Error';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/pages/Error', () => {
  vi.mock('biuty/react');
  vi.mock('@perseid/core');
  vi.mock('scripts/react/components/Layout');

  const components = {};
  const createServices = (): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      getFallbackPageRoute: vi.fn(() => '/fallback-route'),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - forbidden error', () => {
    const { container } = render(
      <ErrorPage
        components={components}
        services={createServices()}
        error={{ status: 403 } as Response}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - not found error (router)', () => {
    const { container } = render(
      <ErrorPage
        components={components}
        services={createServices()}
        error={new Error('NOT_FOUND')}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - not found error (API)', () => {
    const { container } = render(
      <ErrorPage
        components={components}
        services={createServices()}
        error={{ status: 404 } as Response}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - generic error', () => {
    const { container } = render(
      <ErrorPage
        components={components}
        services={createServices()}
        error={null}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
