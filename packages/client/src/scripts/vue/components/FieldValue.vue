<!--
   Displays a specific resource field value.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/FieldValue.vue
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
  type Id,
  isPlainObject,
  type DefaultDataModel,
  type I18n as BaseI18n,
} from '@perseid/core';
import { UIImage } from '@perseid/ui/vue';
import { computed, type DefineComponent } from 'vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';

/**
 * Field value props.
 */

export interface FieldValueProps<
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

  /** Id of the resource to display. */
  id: Id;

  /** Field to display. */
  field: string;

  /** Which page is being displayed. */
  page: 'LIST' | 'VIEW';

  /** Whether resource is still being fetched, which means some values might not be there yet. */
  loading: boolean;

  /** Resources registry. */
  registry: Registry<DataModel>;

  /** Data model resource, if any. */
  resource: keyof DataModel & string;
}

const Binary = Uint8Array;
const textDecoder = new TextDecoder();
const props = defineProps<FieldValueProps>();
const value = computed(() => props.services.store.getValue(
  props.resource,
  props.id,
  props.field,
  props.registry,
));
</script>

<template>
  <div v-if="typeof page !== 'string' || value === null" class="field-value">
    {{ services.i18n.t(loading ? 'FIELD.LOADING.LABEL' : 'FIELD.FALLBACK.LABEL') }}
  </div>
  <div v-else-if="typeof value === 'number'" class="field-value">
    {{ services.i18n.numeric(value) }}
  </div>
  <div v-else-if="value instanceof Date" class="field-value">
    {{ services.i18n.dateTime(value) }}
  </div>
  <div v-else-if="value instanceof Binary" class="field-value">
    <UIImage
      :alt="field"
      ratio="square"
      :src="textDecoder.decode(value)"
    />
  </div>
  <div v-else-if="Array.isArray(value) || isPlainObject(value)" class="field-value">
    {{ JSON.stringify(value) }}
  </div>
  <div v-else class="field-value">
    {{ String(value) }}
  </div>
</template>
