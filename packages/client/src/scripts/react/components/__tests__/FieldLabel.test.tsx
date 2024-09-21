/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import FieldLabel from 'scripts/react/components/FieldLabel';

type Services = ReactCommonProps['services'];

describe('react/components/FieldLabel', () => {
  vi.mock('@perseid/core');

  const components = {};
  const mutate = vi.fn();
  const createServices = (): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: { mutate },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    const { container } = render(
      <FieldLabel
        field="test"
        page="LIST"
        resource="users"
        components={components}
        services={createServices()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
