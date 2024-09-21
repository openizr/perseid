/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import PermissionsWrapper from 'scripts/react/components/PermissionsWrapper';

type Services = ReactCommonProps['services'];

describe('react/components/PermissionsWrapper', () => {
  vi.mock('scripts/core/services/Store');

  const components = {};
  const createServices = (permissions: Set<string>): Services => ({
    apiClient: {},
    model: {},
    i18n: {},
    store: { useSubscription: vi.fn(() => ({ user: { _permissions: permissions } })) },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const { container } = render(
      <PermissionsWrapper
        components={components}
        requiredPermissions={['read']}
        services={createServices(new Set(['read', 'write']))}
      >
        <div id="content" />
      </PermissionsWrapper>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
