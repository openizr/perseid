/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import Loader from 'scripts/react/components/Loader';

type Services = ReactCommonProps['services'];

describe('react/components/Loader', () => {
  vi.mock('@perseid/core');

  const components = {};
  const createServices = (): Services => ({
    apiClient: {},
    model: {},
    store: {},
    i18n: { t: vi.fn((label: string) => label) },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const { container } = render(
      <Loader
        resource="users"
        components={components}
        services={createServices()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
