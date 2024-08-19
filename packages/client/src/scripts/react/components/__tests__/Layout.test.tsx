/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import Layout from 'scripts/react/components/Layout';

type Services = CommonProps['services'];

describe('react/components/Layout', () => {
  vi.mock('scripts/react/components/Modal');
  vi.mock('scripts/react/components/Menu');
  vi.mock('scripts/react/components/Notifier');

  const components = {};
  const services = {
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {},
  } as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const { container } = render(
      <Layout
        services={services}
        components={components}
      >
        <div id="content" />
      </Layout>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
