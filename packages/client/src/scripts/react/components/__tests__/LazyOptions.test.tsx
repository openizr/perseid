/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import type { UseSubscription } from '@perseid/store/connectors/react';
import {
  act,
  render,
  fireEvent,
  queryByAttribute,
} from '@testing-library/react';
import type Store from 'scripts/core/services/Store';
import LazyOptions from 'scripts/react/components/LazyOptions';

describe('react/components/LazyOptions', () => {
  vi.mock('@perseid/ui/react');

  const labelFn = vi.fn(() => 'LABEL');
  const store = {
    useSubscription: vi.fn(() => ({ users: { test: {} } })),
  } as unknown as Store & { useSubscription: UseSubscription; };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VALUE;
  });

  test('renders correctly - results', async () => {
    process.env.VALUE = 'null';
    let container: HTMLElement = document.createElement('div');
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <LazyOptions
          value="test"
          label="LABEL"
          store={store}
          labelFn={labelFn}
          resource="users"
          loadingLabel="LOADING"
          noResultLabel="NO_RESULT"
          onChange={vi.fn(() => null)}
          loadResults={async () => Promise.resolve([{ value: 'test', label: 'TEST', type: 'option' }])}
        />,
      )).container;
    });
    expect(container.firstChild).toMatchSnapshot();
    await act(async () => {
      const textfield = queryByAttribute('id', container, 'ui-textfield') as unknown as HTMLElement;
      await (fireEvent.focus as unknown as (element: HTMLElement) => Promise<void>)(textfield);
    });
  });

  test('renders correctly - no results', async () => {
    process.env.VALUE = 'null';
    let container: HTMLElement = document.createElement('div');
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <LazyOptions
          label="LABEL"
          store={store}
          labelFn={labelFn}
          resource="users"
          loadingLabel="LOADING"
          noResultLabel="NO_RESULT"
          onChange={vi.fn(() => null)}
          loadResults={async () => Promise.resolve([])}
        />,
      )).container;
    });
    expect(container.firstChild).toMatchSnapshot();
  });
});
