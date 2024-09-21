<!--
  Confirmation modal.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/ConfirmationModal.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { UIButton, UITitle } from '@perseid/ui/vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Confirmation modal props.
 */
export interface ConfirmationModalProps<
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

  /** Confirmation title. */
  title: string;

  /** Confirmation subtitle. */
  subTitle: string;

  /** Confirmation button label. */
  confirm: string;

  /** Cancel button label. */
  cancel: string;

  /** Callback triggered at confirmation. */
  onConfirm?: () => void;
}

const props = defineProps<ConfirmationModalProps>();

const onCancel = () => {
  props.services.store.mutate('modal', 'HIDE');
};

const onConfirm = () => {
  props.onConfirm?.();
  props.services.store.mutate('modal', 'HIDE');
};

</script>

<template>
  <div class="confirmation-modal">
    <UITitle level="3" modifiers="2" :label="services.i18n.t(title)" />
    <UITitle level="4" modifiers="3" :label="services.i18n.t(subTitle)" />
    <div class="confirmation-modal__ctas">
      <UIButton
        modifiers="text"
        :label="services.i18n.t(cancel)"
        :onClick="onCancel"
      />
      <UIButton
        modifiers="primary"
        :label="services.i18n.t(confirm)"
        :onClick="onConfirm"
      />
    </div>
  </div>
</template>
