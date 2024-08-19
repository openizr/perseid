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
  type I18n as BaseI18n,
  type DataModelMetadata,
} from '@perseid/core';
import * as React from 'react';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import DefaultLoader from 'scripts/react/components/Loader';
import { type ListPageData } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import DefaultFieldValue from 'scripts/react/components/FieldValue';
import DefaultFieldLabel from 'scripts/react/components/FieldLabel';
import DefaultPageLayout from 'scripts/react/components/PageLayout';
import DefaultPagination from 'scripts/react/components/Pagination';
import { buildClass, UITextfield, UITitle } from '@perseid/ui/react';
import DefaultTable, { type TableRow } from 'scripts/react/components/Table';

/**
 * Resources list page props.
 */
export interface ListProps<
  DataModel extends DefaultDataModel = DefaultDataModel,
  I18n extends BaseI18n = BaseI18n,
  Store extends BaseStore<DataModel> = BaseStore<DataModel>,
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
  ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
> extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
  /** Name of the resource resource. */
  resource: keyof DataModel & string;
}

/**
 * Resources list page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/List.tsx
 */
function List({
  services,
  resource,
  components,
}: ListProps): JSX.Element {
  const prefix = `PAGES.${toSnakeCase(String(resource))}.LIST`;
  const registry = services.store.useSubscription<Registry<DefaultDataModel>>('registry');
  const pageData = services.store.useSubscription<ListPageData<DefaultDataModel>>('page');
  const resourceViewRoute = services.store.getRoute(`${String(resource)}.view`);
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
    const { search } = pageData as unknown as Exclude<ListPageData<DefaultDataModel>, null>;
    await services.store.listOrSearch(resource, search, { ...pageData, sorting: newSorting });
  }, [services, pageData, resource]);

  const goToPage = React.useCallback((newPage: number) => async (): Promise<void> => {
    const data = pageData as unknown as Exclude<ListPageData<DefaultDataModel>, null>;
    await services.store.goToPage({ ...data, page: newPage });
  }, [services, pageData]);

  const handleSearch = React.useCallback(async (query: string) => {
    const { searchFields } = pageData as unknown as Exclude<ListPageData<DefaultDataModel>, null>;
    const searchBody = { query: { on: searchFields, text: query }, filters: null };
    await services.store.listOrSearch(resource, searchBody, { ...pageData });
  }, [services, pageData, resource]);

  // Page is still loading...
  if (pageData?.results === null || pageData === null) {
    return <Loader services={services} components={components} />;
  }

  return (
    <main className={buildClass('list-page', String(resource))}>
      <PageLayout
        page="LIST"
        services={services}
        resource={resource}
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
              (registry[resource][String(id)] as unknown === undefined)
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
                        resource={resource}
                        components={components}
                        loading={pageData.loading}
                      />
                    ),
                  }), {}),
                  onClick: (resourceViewRoute !== null)
                    ? services.store.navigate(resourceViewRoute.replace(':id', String(id)))
                    : undefined,
                })
            ), [])}
            columns={pageData.fields.map((field) => {
              const columnModel = services.model.get(`${String(resource)}.${field}`);
              return {
                path: field,
                isSortable: (columnModel as DataModelMetadata<StringSchema>).schema.isIndexed,
                component: (
                  <FieldLabel
                    page="LIST"
                    field={field}
                    services={services}
                    resource={resource}
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
            resource={resource}
            currentPage={pageData.page}
            itemsPerPage={pageData.limit}
          />
        </div>
      </PageLayout>
    </main>
  );
}

export default React.memo(List);
