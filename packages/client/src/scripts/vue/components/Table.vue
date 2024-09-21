<!--
  Generic table.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Table.vue
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
  computed, ref, watch, type DefineComponent,
} from 'vue';
import { buildClass, generateRandomId } from '@perseid/ui/vue';

/**
 * Table column.
 */
export interface TableColumn {
  /** Field path for that column. */
  path: string;

  /** Whether field can be sorted. */
  isSortable?: boolean;

  /** Component to display for that column. */
  component: DefineComponent;

  componentProps: Record<string, unknown>;
}

/**
 * Table row.
 */
export interface TableRow {
  /** List of columns values for this row. */
  value: Record<string, {
    component: DefineComponent;

    componentProps: Record<string, unknown>;
  }>;

  /** Callback triggered when clicking on this row. */
  onClick?: () => void;
}

/**
 * Generic table props.
 */
export interface TableProps {
  /** Sorting options */
  sorting?: Record<string, 1 | -1>;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** Callback triggered when changing table sorting. */
  onSort?: (newSorting: Record<string, 1 | -1>) => void;

  /** List of table rows. Defaults to `null`. */
  rows?: TableRow[] | null;

  /** List of table columns. */
  columns: TableColumn[];

  /** Table labels. */
  labels: {
    loading?: string;
    noResult?: string;
    fallback?: string;
  };
}

const sortingModifiers: Record<string, 'ascending' | 'descending' | 'none'> = {
  1: 'ascending',
  '-1': 'descending',
};

const props = withDefaults(defineProps<TableProps>(), {
  rows: null,
  modifiers: '',
  sorting: () => ({}),
  onSort: () => () => { /* No-op. */ },
});

const rowKeys = (props.rows?.map(generateRandomId) ?? []);
const currentSorting = ref<Sorting>(props.sorting);
const className = computed(() => (
  buildClass('table', `${props.modifiers} ${props.rows === null ? 'loading' : ''} ${props.rows?.length === 0 ? 'no-result' : ''}`)));

const sortBy = (column: string) => (): void => {
  const { [column]: columnValue, ...rest } = currentSorting.value;
  if (columnValue as unknown === undefined) {
    currentSorting.value = { ...currentSorting.value, [column]: 1 };
  } else if (columnValue === 1) {
    currentSorting.value = { ...currentSorting.value, [column]: -1 };
  } else {
    currentSorting.value = { ...rest };
  }
  props.onSort(currentSorting.value);
};

const keySortBy = (column: string) => (
  (event: React.KeyboardEvent<HTMLTableCellElement>): void => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Space') {
      sortBy(column)();
    }
  }
);

// Updates sorting whenever `sorting` prop is updated.
watch(props.sorting, () => {
  currentSorting.value = props.sorting;
});
</script>

<template>
  <div :class="className">
    <table>
      <thead class="table__headers">
        <tr>
          <!-- TODO currentSorting[column.path] may be undefined -->
          <!-- TODO move sorting handling in column heading component? -->
          <th
            v-for="column in columns"
            :key="column.path"
            :class="buildClass(
              'table__headers__column',
              `${sortingModifiers[String(currentSorting[column.path])]} ${column.path} ${column
                .isSortable ? 'sortable' : ''}`
            )"
            :tabIndex="column.isSortable ? 0 : -1"
            :aria-sort="column.isSortable
              ? sortingModifiers[String(currentSorting[column.path])] : undefined"
            :onClick="column.isSortable ? sortBy(column.path) : undefined"
            :onKeyUp="column.isSortable ? keySortBy(column.path) : undefined"
          >
            <component
              :is="column.component"
              v-bind="column.componentProps"
            />
          </th>
        </tr>
      </thead>
      <tbody class="table__values">
        <tr
          v-for="(row, index) in rows"
          :key="rowKeys[index]"
          class="table__values__row"
          :onClick="row.onClick"
        >
          <td
            v-for="column in columns"
            :key="column.path"
            :class="buildClass('table__values__row__cell')"
          >
            <component
              :is="row.value[column.path].component"
              v-bind="row.value[column.path].componentProps"
            />
          </td>
        </tr>
      </tbody>
    </table>
    <div class="table__loading">
      {{ labels.loading }}
    </div>
    <div class="table__no-result">
      {{ labels.noResult }}
    </div>
  </div>
</template>
