/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import Modal from 'scripts/react/components/Modal';

type Services = CommonProps['services'];

describe('react/components/Modal', () => {
  vi.mock('@perseid/ui/react');

  const mutate = vi.fn();
  const createServices = (modalState: unknown): Services => ({
    apiClient: {},
    model: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      mutate,
      useSubscription: vi.fn(() => modalState),
    },
  }) as unknown as Services;

  function Component(): JSX.Element {
    return <div>Mock Component</div>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - component exists', () => {
    const components = { Component };
    vi.spyOn(window, 'addEventListener').mockImplementation((_: string, callback: unknown) => {
      (callback as (event: Event) => void)({ key: 'Escape' } as unknown as Event);
    });
    const { container } = render(
      <Modal
        components={components}
        services={createServices({
          show: true,
          component: 'Component',
          modifiers: 'example',
          componentProps: {},
        })}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - component does not exist', () => {
    const components = {};
    const { container } = render(
      <Modal
        components={components}
        services={createServices({
          show: false,
          component: 'Component',
          modifiers: 'example',
          componentProps: {},
        })}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
