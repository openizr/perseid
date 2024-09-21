<!--
  Pagination buttons.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Pagination.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { computed, type DefineComponent } from 'vue';
import { UIButton, buildClass } from '@perseid/ui/vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Pagination buttons props.
 */
export interface PaginationProps<
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

  /** Total number of displayed items. */
  total: number;

  /** Current page. */
  currentPage: number;

  /** Number of items per page. */
  itemsPerPage: number;

  /** Callback triggered when clicking on pagination buttons. */
  onClick: (page: number) => () => void;
}

const props = defineProps<PaginationProps>();

const getRange = (currentPage: number, totalPages: number, length: number, min = 1): number[] => {
  // Number of pagination buttons must be bound to maximum number of pages.
  const actualLength = Math.min(length, totalPages);
  let startIndex = currentPage - Math.floor(actualLength / 2);
  // If current page is in the first numbers, pagination must show the first pages.
  startIndex = Math.max(startIndex, min);
  // If current page is in the last numbers, pagination must show the last pages.
  startIndex = Math.min(startIndex, min + totalPages - actualLength);
  return Array.from({ length: actualLength }, (_item, index) => startIndex + index);
};

const totalPages = computed(() => Math.ceil(props.total / props.itemsPerPage));
const pages = computed(() => getRange(props.currentPage, totalPages.value, 5));
</script>

<template>
  <div v-if="pages.length >= 2" class="pagination">
    <UIButton
      iconPosition="left"
      :onClick="onClick(currentPage - 1)"
      :label="services.i18n.t('PAGINATION.PREVIOUS')"
      :modifiers="(currentPage - 1 < 1) ? 'disabled' : ''"
    />
    <div class="none s:flex hgap-2">
      <button
        v-for="pageIndex in pages"
        :key="pageIndex"
        type="button"
        :onClick="onClick(pageIndex)"
        :class="buildClass('pagination__page', currentPage === pageIndex ? 'active' : '')"
      >
        {{ pageIndex }}
      </button>
    </div>
    <UIButton
      iconPosition="right"
      :onClick="onClick(currentPage + 1)"
      :label="services.i18n.t('PAGINATION.NEXT')"
      :modifiers="(currentPage + 1 > totalPages) ? 'disabled' : ''"
    />
  </div>
</template>
