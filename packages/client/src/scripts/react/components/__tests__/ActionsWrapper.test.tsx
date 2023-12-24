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
import ActionsWrapper from 'scripts/react/components/ActionsWrapper';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/components/ActionsWrapper', () => {
  vi.mock('biuty/react');
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Store');

  const components = {};
  const notify = vi.fn();
  const navigate = vi.fn(() => (): null => null);
  const confirm = vi.fn(({ onConfirm }: { onConfirm: () => void }) => { onConfirm(); });
  const deleteAction = vi.fn();
  const createServices = (
    permissions: Set<string>,
    collectionRoutes: Record<string, string | null>,
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
        ? { params: { id: '123456789012345678901234' } }
        : permissions)),
      getFallbackPageRoute: vi.fn(() => '/fallback-route'),
      getRoute: vi.fn((route: string) => collectionRoutes[route]),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - user has all permissions', () => {
    vi.spyOn(window, 'addEventListener').mockImplementation((_, callback) => {
      (callback as (event: Event) => void)({} as Event);
    });
    const permissions = new Set(['TO_SNAKE_CASE_users_DELETE', 'TO_SNAKE_CASE_users_UPDATE']);
    const collectionRoutes = { 'users.update': '/update-route' };
    const { container } = render(
      <ActionsWrapper
        collection="users"
        components={components}
        services={createServices(permissions, collectionRoutes)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - user has only update permission', () => {
    const permissions = new Set(['TO_SNAKE_CASE_users_UPDATE']);
    const collectionRoutes = {
      'users.update': '/update-route',
      'users.list': '/list-route',
    };
    const { container } = render(
      <ActionsWrapper
        collection="users"
        components={components}
        services={createServices(permissions, collectionRoutes)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
