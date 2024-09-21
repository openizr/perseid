/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import ConfirmationModal from 'scripts/react/components/ConfirmationModal';

type Services = ReactCommonProps['services'];

describe('react/components/ConfirmationModal', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');

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
    const onConfirm = vi.fn();
    const { container } = render(
      <ConfirmationModal
        title="CONFIRMATION.TITLE"
        subTitle="CONFIRMATION.SUBTITLE"
        confirm="CONFIRMATION.CONFIRM"
        cancel="CONFIRMATION.CANCEL"
        services={createServices()}
        onConfirm={onConfirm}
        components={components}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
