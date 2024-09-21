<!--
   Displays a specific resource field label.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/FieldLabel.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { computed } from 'vue';
import { type DefineComponent } from 'vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { toSnakeCase, type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Field label props.
 */
export interface FieldLabelProps<
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

  /** Field to display. */
  field: string;

  /** Which page is being displayed. */
  page: 'LIST' | 'VIEW';

  /** Data model resource, if any. */
  resource?: keyof DataModel & string;
}

const props = defineProps<FieldLabelProps>();
const label = computed(() => {
  const path = toSnakeCase(props.field.replace(/\./g, '__'));
  return props.services.i18n.t(`PAGES.${toSnakeCase(String(props.resource))}.${props.page}.FIELDS.${path}.LABEL`);
});
</script>

<template>
  <span class="field-label">{{ label }}</span>
</template>
