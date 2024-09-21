<!--
  Page layout.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/PageLayout.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { UIButton } from '@perseid/ui/vue';
import type { DefineComponent } from 'vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import { type AuthState } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import DefaultActionsWrapper from 'scripts/vue/components/ActionsWrapper.vue';
import { toSnakeCase, type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Page layout props.
 */
export interface PageLayoutProps<
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

  /** Page to wrap. */
  page: 'UPDATE' | 'CREATE' | 'VIEW' | 'LIST';
}

const props = defineProps<PageLayoutProps>();
const ActionsWrapper = props.components.ActionsWrapper ?? DefaultActionsWrapper;
const permissions = props.services.store.useSubscription('auth', (newState: AuthState) => newState.user?._permissions);
</script>

<template>
  <template v-if="page === 'VIEW'">
    <UIButton
      modifiers="secondary"
      :onClick="services.store.goBack"
      :label="services.i18n.t('NAVIGATION.GO_BACK')"
    />
    <slot />
    <ActionsWrapper
      :services="services"
      :components="components"
      :resource="resource"
    />
  </template>
  <template v-else-if="page === 'LIST'">
    <slot />
    <UIButton
      v-if="(
        services.store.getRoute(`${String(resource)}.create`) !== null
        && permissions?.has(toSnakeCase(`create_${String(resource)}`))
      )"
      icon="plus"
      modifiers="primary floating"
      :onClick="services.store.navigate(
        services.store.getRoute(`${String(resource)}.create`)as unknown as string
      )"
    />
  </template>
  <template v-else>
    <UIButton
      modifiers="secondary"
      :onClick="services.store.goBack"
      :label="services.i18n.t('NAVIGATION.GO_BACK')"
    />
    <slot />
  </template>
</template>
