/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import { type DefaultDataModel } from '@perseid/core';
import PageLayout from 'scripts/react/components/PageLayout';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/components/PageLayout', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');
  vi.mock('scripts/react/components/ActionsWrapper');

  const components = {};
  const goBack = vi.fn();
  const navigate = vi.fn();
  const createServices = (permissions: Set<string>, route: string | null): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      goBack,
      navigate,
      getRoute: vi.fn(() => route),
      useSubscription: vi.fn(() => permissions),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - VIEW page', () => {
    const { container } = render(
      <PageLayout
        page="VIEW"
        resource="users"
        components={components}
        services={createServices(new Set(), null)}
      >
        <div id="content" />
      </PageLayout>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - LIST page, create route available', () => {
    const { container } = render(
      <PageLayout
        page="LIST"
        resource="users"
        components={components}
        services={createServices(new Set(['create_TO_SNAKE_CASE_users']), '/users/create')}
      >
        <div id="content" />
      </PageLayout>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - CREATE/UPDATE page', () => {
    const { container } = render(
      <PageLayout
        page="CREATE"
        resource="users"
        components={components}
        services={createServices(new Set(), null)}
      >
        <div id="content" />
      </PageLayout>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
