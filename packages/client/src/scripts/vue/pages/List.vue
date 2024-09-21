<!--
 * Resources list page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/List.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  toSnakeCase,
  type DefaultDataModel,
  type I18n as BaseI18n,
  type DataModelMetadata,
  type StringSchema,
} from '@perseid/core';
import { computed, type DefineComponent } from 'vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import DefaultLoader from 'scripts/vue/components/Loader.vue';
import { type ListPageData } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import { buildClass, UITextfield, UITitle } from '@perseid/ui/vue';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import DefaultFieldValue from 'scripts/vue/components/FieldValue.vue';
import DefaultFieldLabel from 'scripts/vue/components/FieldLabel.vue';
import DefaultPageLayout from 'scripts/vue/components/PageLayout.vue';
import DefaultPagination from 'scripts/vue/components/Pagination.vue';
import DefaultTable, { type TableRow } from 'scripts/vue/components/Table.vue';

/**
 * Resources list page props.
 */
export interface ListProps<
  DataModel extends DefaultDataModel = DefaultDataModel,
  I18n extends BaseI18n = BaseI18n,
  Store extends BaseStore<DataModel> = BaseStore<DataModel>,
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
  ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
> {
  /** Perseid client services instances. */
  services: {
    /** I18n instance. */
    i18n: I18n;

    /** Perseid store instance. */
    store: Store & { useSubscription: UseSubscription; };

    /** Perseid model instance. */
    model: Model;

    /** API client instance. */
    apiClient: ApiClient;
  };

  /** List of custom Vue components to use in pages. */
  components: Partial<Record<string, DefineComponent>>;

  /** Name of the resource resource. */
  resource: keyof DataModel & string;
}

const props = defineProps<ListProps>();
const prefix = `PAGES.${toSnakeCase(String(props.resource))}.LIST`;
const registry = props.services.store.useSubscription<Registry<DefaultDataModel>>('registry');
const pageData = props.services.store.useSubscription<ListPageData<DefaultDataModel>>('page');
const resourceViewRoute = props.services.store.getRoute(`${String(props.resource)}.view`);
const labels = computed(() => ({
  loading: props.services.i18n.t(`${prefix}.TABLE.LOADING`),
  actions: props.services.i18n.t(`${prefix}.TABLE.ACTIONS`),
  noResult: props.services.i18n.t(`${prefix}.TABLE.NO_RESULT`),
}));

const Table = props.components.Table ?? DefaultTable;
const Loader = props.components.Loader ?? DefaultLoader;
const FieldLabel = props.components.FieldLabel ?? DefaultFieldLabel;
const FieldValue = props.components.FieldValue ?? DefaultFieldValue;
const PageLayout = props.components.PageLayout ?? DefaultPageLayout;
const Pagination = props.components.Pagination ?? DefaultPagination;

const handleSort = async (newSorting: Sorting) => {
  const { search } = (pageData as unknown as {
    value: Exclude<ListPageData<DefaultDataModel>, null> }).value;
  await props.services.store.listOrSearch(props.resource, search, {
    ...pageData,
    sorting: newSorting,
  });
};

const goToPage = (newPage: number) => async (): Promise<void> => {
  const data = (pageData as unknown as {
    value: Exclude<ListPageData<DefaultDataModel>, null> }).value;
  await props.services.store.goToPage({ ...data, page: newPage });
};

const handleSearch = async (query: string) => {
  const { searchFields } = (pageData as unknown as {
    value: Exclude<ListPageData<DefaultDataModel>, null> }).value;
  const searchBody = { query: { on: searchFields, text: query }, filters: null };
  await props.services.store.listOrSearch(props.resource, searchBody, { ...pageData.value });
};
</script>

<template>
  <!-- Page is still loading... -->
  <Loader
    v-if="pageData === null || pageData?.results === null"
    :services="services"
    :components="components"
  />
  <main
    v-else
    :class="buildClass('list-page', String(resource))"
  >
    <PageLayout
      page="LIST"
      :services="services"
      :resource="resource"
      :components="components"
    >
      <UITitle :label="services.i18n.t(`${prefix}.TITLE`)" />
      <div v-if="pageData.searchFields.length > 0" class="list-page__search">
        <UITextfield
          id="search-bar"
          autofocus
          name="search"
          :maxlength="50"
          autocomplete="off"
          :debounceTimeout="250"
          :value="pageData.search?.query?.text ?? ''"
          :onChange="handleSearch"
          :placeholder="services.i18n.t(`${prefix}.SEARCH_PLACEHOLDER`)"
        />
      </div>
      <div class="list-page__content">
        <Table
          :labels="labels"
          :onSort="handleSort"
          :sorting="pageData.sorting"
          :rows="pageData.results.reduce((finalRows: TableRow[], id) => (
            (registry[resource][String(id)] as unknown === undefined)
              ? finalRows
              : finalRows.concat({
                value: (pageData as Exclude<ListPageData<DefaultDataModel>, null>)
                  .fields.reduce((finalValue, column) => ({
                    ...finalValue,
                    [column]: {
                      component: FieldValue,
                      componentProps: {
                        id,
                        page: 'LIST',
                        services,
                        field: column,
                        registry,
                        resource,
                        components,
                        loading: (pageData as Exclude<ListPageData<DefaultDataModel>, null>).loading
                      }
                    }
                  }), {}),
                onClick: (resourceViewRoute !== null)
                  ? services.store.navigate(resourceViewRoute.replace(':id', String(id)))
                  : undefined,
              })
          ), [])"
          :columns="pageData.fields.map((field) => {
            const columnModel = services.model.get(`${String(resource)}.${field}`);
            return {
              path: field,
              isSortable: (columnModel as DataModelMetadata<StringSchema>).schema.isIndexed,
              component: FieldLabel,
              componentProps: {
                page: 'LIST',
                field,
                services,
                resource,
                components,
              }
            };
          })"
        />
        <Pagination
          :onClick="goToPage"
          :services="services"
          :total="pageData.total"
          :components="components"
          :resource="resource"
          :currentPage="pageData.page"
          :itemsPerPage="pageData.limit"
        />
      </div>
    </PageLayout>
  </main>
</template>
