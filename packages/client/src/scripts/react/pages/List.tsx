/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  toSnakeCase,
  type StringSchema,
  type DefaultDataModel,
  type DataModelMetadata,
} from '@perseid/core';
import * as React from 'react';
import { buildClass, UITextfield, UITitle } from '@perseid/ui/react';
import DefaultLoader from 'scripts/react/components/Loader';
import { type ListPageData } from 'scripts/core/services/Store';
import DefaultFieldValue from 'scripts/react/components/FieldValue';
import DefaultFieldLabel from 'scripts/react/components/FieldLabel';
import DefaultPageLayout from 'scripts/react/components/PageLayout';
import DefaultPagination from 'scripts/react/components/Pagination';
import DefaultTable, { type TableRow } from 'scripts/react/components/Table';

/**
 * Resources list page props.
 */
export interface ListProps<
  DataModel extends DefaultDataModel
> extends ReactCommonProps<DataModel> {
  /** Name of the resource collection. */
  collection: keyof DataModel;
}

/**
 * Resources list page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/pages/List.tsx
 */
function List<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
  collection,
  components,
}: ListProps<DataModel>): JSX.Element {
  const prefix = `PAGES.${toSnakeCase(String(collection))}.LIST`;
  const registry = services.store.useSubscription<Registry<DataModel>>('registry');
  const pageData = services.store.useSubscription<ListPageData<DataModel>>('page');
  const collectionViewRoute = services.store.getRoute(`${String(collection)}.view`);
  const labels = React.useMemo(() => ({
    loading: services.i18n.t(`${prefix}.TABLE.LOADING`),
    actions: services.i18n.t(`${prefix}.TABLE.ACTIONS`),
    noResult: services.i18n.t(`${prefix}.TABLE.NO_RESULT`),
  }), [services, prefix]);

  const Table = components.Table ?? DefaultTable;
  const Loader = components.Loader ?? DefaultLoader;
  const FieldLabel = components.FieldLabel ?? DefaultFieldLabel;
  const FieldValue = components.FieldValue ?? DefaultFieldValue;
  const PageLayout = components.PageLayout ?? DefaultPageLayout;
  const Pagination = components.Pagination ?? DefaultPagination;

  const handleSort = React.useCallback(async (newSorting: Sorting) => {
    const { search } = pageData as unknown as Exclude<ListPageData<DataModel>, null>;
    await services.store.listOrSearch(collection, search, { ...pageData, sorting: newSorting });
  }, [services, pageData, collection]);

  const goToPage = React.useCallback((newPage: number) => async () => {
    const data = pageData as unknown as Exclude<ListPageData<DataModel>, null>;
    await services.store.goToPage({ ...data, page: newPage });
  }, [services, pageData]);

  const handleSearch = React.useCallback(async (query: string) => {
    const { searchFields } = pageData as unknown as Exclude<ListPageData<DataModel>, null>;
    const searchBody = { query: { on: searchFields, text: query }, filters: null };
    await services.store.listOrSearch(collection, searchBody, { ...pageData });
  }, [services, pageData, collection]);

  // Page is still loading...
  if (pageData?.results === null || pageData === null) {
    return <Loader services={services} components={components} />;
  }

  return (
    <main className={buildClass('list-page', String(collection))}>
      <PageLayout
        page="LIST"
        services={services}
        collection={collection}
        components={components}
      >
        <UITitle label={services.i18n.t(`${prefix}.TITLE`)} />
        {(pageData.searchFields.length > 0) && (
          <div className="list-page__search">
            <UITextfield
              autofocus
              name="search"
              maxlength={50}
              id="search-bar"
              autocomplete="off"
              debounceTimeout={250}
              value={pageData.search?.query?.text ?? ''}
              onChange={handleSearch as (query: string) => void}
              placeholder={services.i18n.t(`${prefix}.SEARCH_PLACEHOLDER`)}
            />
          </div>
        )}
        <div className="list-page__content">
          <Table
            labels={labels}
            sorting={pageData.sorting}
            onSort={handleSort as (newSorting: Sorting) => void}
            rows={pageData.results.reduce((finalRows: TableRow[], id) => (
              (registry[collection][String(id)] as unknown === undefined)
                ? finalRows
                : finalRows.concat({
                  value: pageData.fields.reduce((finalValue, column) => ({
                    ...finalValue,
                    [column]: (
                      <FieldValue
                        id={id}
                        page="LIST"
                        field={column}
                        services={services}
                        registry={registry}
                        collection={collection}
                        components={components}
                        loading={pageData.loading}
                      />
                    ),
                  }), {}),
                  onClick: (collectionViewRoute !== null)
                    ? services.store.navigate(collectionViewRoute.replace(':id', String(id)))
                    : undefined,
                })
            ), [])}
            columns={pageData.fields.map((field) => {
              const columnModel = services.model.get(`${String(collection)}.${field}`);
              return {
                path: field,
                isSortable: (columnModel as DataModelMetadata<StringSchema>).schema.index,
                component: (
                  <FieldLabel
                    page="LIST"
                    field={field}
                    services={services}
                    collection={collection}
                    components={components}
                  />
                ),
              };
            })}
          />
          <Pagination
            onClick={goToPage}
            services={services}
            total={pageData.total}
            components={components}
            collection={collection}
            currentPage={pageData.page}
            itemsPerPage={pageData.limit}
          />
        </div>
      </PageLayout>
    </main>
  );
}

export default React.memo(List);
