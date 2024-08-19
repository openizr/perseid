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
import List from 'scripts/react/pages/List';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/pages/List', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');
  vi.mock('scripts/react/components/Table');
  vi.mock('scripts/react/components/Loader');
  vi.mock('scripts/react/components/FieldValue');
  vi.mock('scripts/react/components/FieldLabel');
  vi.mock('scripts/react/components/PageLayout');
  vi.mock('scripts/react/components/Pagination');

  const components = {};
  const goToPage = vi.fn();
  const listOrSearch = vi.fn();
  const createServices = (
    pageData: unknown,
    registryData: unknown,
    viewRoute: string | null,
  ): Services => ({
    apiClient: {},
    model: { get: vi.fn((path: string) => ({ schema: { isIndexed: path.includes('sortable') } })) },
    i18n: { t: vi.fn((label: string) => label) },
    store: {
      goToPage,
      listOrSearch,
      navigate: vi.fn(),
      getRoute: vi.fn(() => viewRoute),
      useSubscription: vi.fn((subscription) => (
        (subscription === 'registry') ? registryData : pageData
      )),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - loading page', () => {
    const { container } = render(
      <List
        resource="users"
        components={components}
        services={createServices({ results: null }, null, null)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - loaded page, results, view route exists', () => {
    const searchBody = { query: { on: ['searchField'], text: 'test' }, filters: null };
    const { container } = render(
      <List
        resource="users"
        components={components}
        services={createServices({
          page: 1,
          limit: 10,
          total: 20,
          search: null,
          sorting: null,
          loading: false,
          searchFields: ['searchField'],
          fields: ['sortableField', 'nonSortableField'],
          results: ['000000000000000000000011', '123456789012345678901235'],
        }, {
          users: {
            '000000000000000000000011': { sortableField: 'Value 1', nonSortableField: 'Value 2' },
          },
        }, '/view/:id')}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    expect(listOrSearch).toHaveBeenCalledTimes(2);
    expect(listOrSearch).toHaveBeenCalledWith('users', null, {
      page: 1,
      limit: 10,
      total: 20,
      search: null,
      loading: false,
      sorting: { field1: 1 },
      searchFields: ['searchField'],
      fields: ['sortableField', 'nonSortableField'],
      results: ['000000000000000000000011', '123456789012345678901235'],
    });
    expect(listOrSearch).toHaveBeenCalledWith('users', searchBody, {
      page: 1,
      limit: 10,
      total: 20,
      search: null,
      sorting: null,
      loading: false,
      searchFields: ['searchField'],
      fields: ['sortableField', 'nonSortableField'],
      results: ['000000000000000000000011', '123456789012345678901235'],
    });
    expect(goToPage).toHaveBeenCalledTimes(1);
    expect(goToPage).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      total: 20,
      search: null,
      sorting: null,
      loading: false,
      searchFields: ['searchField'],
      fields: ['sortableField', 'nonSortableField'],
      results: ['000000000000000000000011', '123456789012345678901235'],
    });
  });

  test('renders correctly - loaded page, results, view route does not exist', () => {
    const { container } = render(
      <List
        resource="users"
        components={components}
        services={createServices({
          page: 1,
          limit: 10,
          total: 20,
          search: null,
          sorting: null,
          loading: false,
          searchFields: ['searchField'],
          fields: ['sortableField', 'nonSortableField'],
          results: ['000000000000000000000011', '123456789012345678901235'],
        }, {
          users: {
            '000000000000000000000011': { sortableField: 'Value 1', nonSortableField: 'Value 2' },
          },
        }, null)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - loaded page, no results', () => {
    const { container } = render(
      <List
        resource="users"
        components={components}
        services={createServices({
          results: [],
          fields: ['sortableField', 'nonSortableField'],
          searchFields: ['searchField'],
          sorting: null,
          page: 1,
          limit: 10,
          total: 0,
          loading: false,
          search: { query: { text: null } },
        }, {}, null)}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
