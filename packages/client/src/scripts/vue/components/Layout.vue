<!--
  Application layout.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Layout.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { DefineComponent } from 'vue';
import Modal from 'scripts/vue/components/Modal.vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import DefaultMenu from 'scripts/vue/components/Menu.vue';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import DefaultNotifier from 'scripts/vue/components/Notifier.vue';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Layout props.
 */
export interface LayoutProps<
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

  /** Whether to display layout itself, or only its children. Defaults to `true`. */
  display?: boolean;

  /** List of custom Vue components to use in pages. */
  components: Partial<Record<string, DefineComponent>>;
}

const props = withDefaults(defineProps<LayoutProps>(), {
  display: true,
});
const Notifier = props.components.Notifier ?? DefaultNotifier;
const Menu = (props.components as VueCommonProps['components']).Menu ?? DefaultMenu;
</script>

<template>
  <div class="layout">
    <Modal :services="services" :components="components" />
    <Notifier :services="services" :components="components" />
    <Menu v-if="display" :services="services" :components="components" />
    <div class="layout__content">
      <slot />
    </div>
  </div>
</template>
