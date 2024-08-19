/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import Table from 'scripts/react/components/Table';
import { fireEvent, queryByAttribute, render } from '@testing-library/react';

describe('react/components/Table', () => {
  vi.mock('@perseid/ui/react');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - no row', () => {
    const { container } = render(
      <Table
        rows={null}
        sorting={{}}
        columns={[{ component: 'Null', path: 'field' }]}
        labels={{ fallback: 'FALLBACK', loading: 'LOADING', noResult: 'NO_RESULT' }}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - empty rows', () => {
    const { container } = render(
      <Table
        rows={[]}
        sorting={{}}
        columns={[{ component: 'Null', path: 'field' }]}
        labels={{ fallback: 'FALLBACK', loading: 'LOADING', noResult: 'NO_RESULT' }}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - multiple rows', () => {
    const { container } = render(
      <Table
        sorting={{}}
        rows={[{ value: { field: 'test', fieldTwo: 'test2' } }]}
        labels={{ fallback: 'FALLBACK', loading: 'LOADING', noResult: 'NO_RESULT' }}
        columns={[{ component: 'Null', path: 'field' }, { component: 'Null', path: 'fieldTwo', isSortable: true }]}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    const column = queryByAttribute('class', container, 'table__headers__column undefined fieldTwo sortable') as unknown as HTMLElement;
    fireEvent.keyUp(column, { key: 'Space' });
    fireEvent.keyUp(column, { key: 'Space' });
    fireEvent.click(column);
  });
});
