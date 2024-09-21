/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import ActionsWrapper from 'scripts/react/components/ActionsWrapper';

type Services = ReactCommonProps['services'];

describe('react/components/ActionsWrapper', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');
  vi.mock('scripts/core/services/Store');

  const components = {};
  const notify = vi.fn();
  const navigate = vi.fn(() => (): null => null);
  const confirm = vi.fn(({ onConfirm }: { onConfirm: () => void }) => { onConfirm(); });
  const deleteAction = vi.fn();
  const createServices = (
    permissions: Set<string>,
    resourceRoutes: Record<string, string | null>,
  ): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      notify,
      confirm,
      navigate,
      delete: deleteAction,
      useSubscription: vi.fn((subscription) => ((subscription === 'router')
        ? { params: { id: '000000000000000000000011' } }
        : permissions)),
      getFallbackPageRoute: vi.fn(() => '/fallback-route'),
      getRoute: vi.fn((route: string) => resourceRoutes[route]),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - user has all permissions', () => {
    vi.spyOn(window, 'addEventListener').mockImplementation((_, callback) => {
      (callback as (event: Event) => void)({} as Event);
    });
    const permissions = new Set(['DELETE_TO_SNAKE_CASE_users', 'UPDATE_TO_SNAKE_CASE_users']);
    const resourceRoutes = { 'users.update': '/update-route' };
    const { container } = render(
      <ActionsWrapper
        resource="users"
        components={components}
        services={createServices(permissions, resourceRoutes)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - user has only update permission', () => {
    const permissions = new Set(['UPDATE_TO_SNAKE_CASE_users']);
    const resourceRoutes = {
      'users.update': '/update-route',
      'users.list': '/list-route',
    };
    const { container } = render(
      <ActionsWrapper
        resource="users"
        components={components}
        services={createServices(permissions, resourceRoutes)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
