<!--
  Displays UI notifications.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Notifier.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { ref, type DefineComponent } from 'vue';
import type BaseModel from 'scripts/core/services/Model';
import type BaseStore from 'scripts/core/services/Store';
import { UIP, UIButton, buildClass } from '@perseid/ui/vue';
import { type NotifierState } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { I18n as BaseI18n, type DefaultDataModel } from '@perseid/core';

/**
 * Notifier props.
 */
export interface NotifierProps<
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

const props = defineProps<NotifierProps>();
const isClosed = ref<Record<string, boolean>>({});
const notifications = props.services.store.useSubscription<NotifierState>('notifier');

const close = (notificationId: string) => () => {
  isClosed.value[notificationId] = true;
  const notification = notifications.value.find((currentNotification) => (
    notificationId === currentNotification.id
  )) as unknown as NotifierState[0];
  setTimeout(() => {
    isClosed.value[notificationId] = undefined as unknown as boolean;
    props.services.store.mutate('notifier', 'REMOVE', notificationId);
  }, notification.timer.duration);
};

const pauseTimer = (notificationId: string) => () => {
  props.services.store.mutate('notifier', 'PAUSE', notificationId);
};

const resumeTimer = (notificationId: string) => () => {
  props.services.store.mutate('notifier', 'RESUME', notificationId);
};
</script>

<template>
  <div v-if="notifications.length > 0" class="notifier">
    <div
      v-for="notification in notifications"
      :key="notification.id"
      :class="buildClass(
        'notification',
        `${(notification.modifiers)}${isClosed[notification.id] ? ' closed' : ''}`
      )"
      @mouseEnter="pauseTimer(notification.id)"
      @mouseLeave="resumeTimer(notification.id)"
    >
      <UIP :label="services.i18n.t(notification.message)" />
      <UIButton v-if="notification.closable" icon="close" :onClick="close(notification.id)" />
    </div>
  </div>
</template>
