/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import CreateOrUpdate from 'scripts/react/pages/CreateOrUpdate';

type Services = ReactCommonProps['services'];

describe('react/pages/CreateOrUpdate', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');
  vi.mock('@perseid/form/react');
  vi.mock('scripts/react/components/Loader');
  vi.mock('scripts/react/components/FormField');
  vi.mock('scripts/react/components/PageLayout');

  const components = {};
  const createServices = (state: unknown): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: { useSubscription: vi.fn(() => state) },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - loading page', () => {
    const { container } = render(
      <CreateOrUpdate
        resource="users"
        components={components}
        services={createServices(null)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - update mode', () => {
    const { container } = render(
      <CreateOrUpdate
        resource="users"
        components={components}
        services={createServices({
          id: '000000000000000000000011',
          configuration: { root: 'root', fields: {}, steps: {} },
          fieldProps: { 'root.0.test': { component: 'Test', componentProps: { modifiers: 'primary' } } },
        })}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - create mode', () => {
    const { container } = render(
      <CreateOrUpdate
        resource="users"
        components={components}
        services={createServices({
          configuration: { root: 'root', fields: {}, steps: {} },
          fieldProps: { 'root.0.test': { component: 'Test', componentProps: { modifiers: 'primary' } } },
        })}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
