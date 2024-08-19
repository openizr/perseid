/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import Notifier from 'scripts/react/components/Notifier';
import { render, fireEvent, queryByAttribute } from '@testing-library/react';

type Services = CommonProps['services'];

describe('react/components/Notifier', () => {
  vi.mock('@perseid/ui/react');

  const components = {};
  const mutate = vi.fn();
  const createServices = (notifications: unknown): Services => ({
    model: {},
    apiClient: {},
    i18n: { t: vi.fn((label: string) => label) },
    store: { useSubscription: vi.fn(() => notifications), mutate },
  } as unknown as Services);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  test('renders correctly - no notifications', () => {
    const { container } = render(
      <Notifier
        components={components}
        services={createServices([])}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - notifications', () => {
    const { container } = render(
      <Notifier
        components={components}
        services={createServices([
          {
            id: '1',
            closable: true,
            modifiers: 'info',
            message: 'Test Message 1',
            timer: { duration: 5000 },
          },
          {
            id: '2',
            closable: false,
            modifiers: 'warning',
            message: 'Test Message 2',
            timer: { duration: 3000 },
          },
        ])}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    vi.runAllTimers();
    expect(container.firstChild).toMatchSnapshot();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith('notifier', 'REMOVE', '1');
  });

  test('correctly pauses and resumes notifications', () => {
    const { container } = render(
      <Notifier
        components={components}
        services={createServices([
          {
            id: '1',
            closable: true,
            modifiers: 'info',
            message: 'Test Message 1',
            timer: { duration: 5000 },
          },
        ])}
      />,
    );
    const notification = queryByAttribute('class', container, 'notification info closed') as unknown as HTMLElement;
    fireEvent.mouseEnter(notification);
    vi.runAllTimers();
    expect(mutate).toHaveBeenCalledWith('notifier', 'PAUSE', '1');
    fireEvent.mouseLeave(notification);
    vi.runAllTimers();
    expect(mutate).toHaveBeenCalledWith('notifier', 'RESUME', '1');
    expect(mutate).toHaveBeenCalledWith('notifier', 'REMOVE', '1');
  });
});
