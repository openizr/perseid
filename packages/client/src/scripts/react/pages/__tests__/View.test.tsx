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
import View from 'scripts/react/pages/View';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/pages/View', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');
  vi.mock('scripts/react/components/Loader');
  vi.mock('scripts/react/components/PageLayout');
  vi.mock('scripts/react/components/FieldValue');
  vi.mock('scripts/react/components/FieldLabel');

  const components = {};
  const createServices = (pageData: unknown, registryData: unknown): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      useSubscription: vi.fn((subscription) => ((subscription === 'page')
        ? pageData
        : registryData)),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - loading page', () => {
    const { container } = render(
      <View
        resource="users"
        components={components}
        services={createServices(null, null)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - loaded page', () => {
    const { container } = render(
      <View
        resource="users"
        components={components}
        services={createServices({
          fields: ['field1', 'field2'],
          id: '000000000000000000000011',
          loading: false,
        }, {
          field1: 'Value 1',
          field2: 'Value 2',
        })}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
