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
import Menu from 'scripts/react/components/Menu';
import { type DefaultDataModel } from '@perseid/core';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/components/Menu', () => {
  vi.mock('biuty/react');
  vi.mock('@perseid/core');

  const components = {};
  const dispatch = vi.fn();
  const navigate = vi.fn(() => (): null => null);
  const createServices = (
    _permissions: Set<string>,
    route: string,
    updateUserRoute: string | null,
    collectionRoutes: { route: string, collection: string }[],
  ): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      navigate,
      dispatch,
      getCollectionRoutes: vi.fn(() => collectionRoutes),
      getRoute: vi.fn((path) => (path === 'auth.updateUser' ? updateUserRoute : null)),
      useSubscription: vi.fn((subscription) => ((subscription === 'auth') ? { user: { _permissions } } : route)),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - available routes', () => {
    const permissions = new Set(['TO_SNAKE_CASE_users_LIST']);
    const collectionRoutes = [{ route: '/users', collection: 'users' }];
    const { container, rerender } = render(
      <Menu
        components={components}
        services={createServices(permissions, '/users/me', '/users/me', collectionRoutes)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    rerender(
      <Menu
        components={components}
        services={createServices(permissions, '/users', '/users/me', collectionRoutes)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - no routes', () => {
    const { container } = render(
      <Menu
        components={components}
        services={createServices(new Set<string>(), '/users', null, [])}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
