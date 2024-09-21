<!--
  App modal.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Modal.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { buildClass } from '@perseid/ui/vue';
import type BaseModel from 'scripts/core/services/Model';
import type BaseStore from 'scripts/core/services/Store';
import { type ModalState } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import { onMounted, onUnmounted, type DefineComponent } from 'vue';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { I18n as BaseI18n, type DefaultDataModel } from '@perseid/core';

/**
 * Modal props.
 */
export interface ModalProps<
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
}

const props = defineProps<ModalProps>();
const modal = props.services.store.useSubscription<ModalState>('modal');

const closeModal = () => {
  props.services.store.mutate('modal', 'HIDE');
};

// Handles special keys like Escape to control modal.
const handleKeyUp = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && props.components[modal.value.component] !== undefined) {
    closeModal();
  }
};

onMounted(() => {
  window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
  window.removeEventListener('keyup', handleKeyUp);
});
</script>

<template>
  <div :class="buildClass('modal', `${modal.modifiers} ${modal.show ? 'visible' : ''}`)">
    <div class="modal__dimmer" role="presentation" :onClick="closeModal" />
    <div class="modal__content">
      <component
        :is="components[modal.component]"
        v-if="components[modal.component]"
        :services="services"
        :components="components"
        v-bind="modal.componentProps"
      />
    </div>
  </div>
</template>
