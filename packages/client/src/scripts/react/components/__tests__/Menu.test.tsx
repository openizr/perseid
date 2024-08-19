/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import Menu from 'scripts/react/components/Menu';
import { type DefaultDataModel } from '@perseid/core';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/components/Menu', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');

  const components = {};
  const dispatch = vi.fn();
  const navigate = vi.fn(() => (): null => null);
  const createServices = (
    _permissions: Set<string>,
    route: string,
    updateUserRoute: string | null,
    resourceRoutes: { route: string, resource: string }[],
  ): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      navigate,
      dispatch,
      getResourceRoutes: vi.fn(() => resourceRoutes),
      getRoute: vi.fn((path) => (path === 'auth.updateUser' ? updateUserRoute : null)),
      useSubscription: vi.fn((subscription) => ((subscription === 'auth') ? { user: { _permissions } } : route)),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - available routes', () => {
    const permissions = new Set(['TO_SNAKE_CASE_users_LIST']);
    const resourceRoutes = [{ route: '/users', resource: 'users' }];
    const { container, rerender } = render(
      <Menu
        components={components}
        services={createServices(permissions, '/users/me', '/users/me', resourceRoutes)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    rerender(
      <Menu
        components={components}
        services={createServices(permissions, '/users', '/users/me', resourceRoutes)}
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
