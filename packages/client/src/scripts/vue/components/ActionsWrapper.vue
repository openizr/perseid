<!--
  Actions wrapper.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/ActionsWrapper.vue
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
  ref,
  watch,
  type Ref,
  onUnmounted,
  useTemplateRef,
  type DefineComponent,
} from 'vue';
import {
  Id,
  toSnakeCase,
  I18n as BaseI18n,
  type DefaultDataModel,
} from '@perseid/core';
import { UIButton, buildClass } from '@perseid/ui/vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import { type AuthState } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { type RoutingContext } from '@perseid/store/extensions/router';

/**
 * Actions wrapper props.
 */
export interface ActionsWrapperProps<
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

  /** "More" button props. */
  moreButtonProps?: ComponentProps;

  /** "Delete" button props. */
  deleteButtonProps?: ComponentProps;

  /** "Edit" button props. */
  updateButtonProps?: ComponentProps;
}

const displayActions = ref(false);
const actionsRef = useTemplateRef('actionsRef');
const props = defineProps<ActionsWrapperProps>();
const snakeCasedResource = toSnakeCase(String(props.resource));
const resourceUpdateRoute = props.services.store.getRoute(`${String(props.resource)}.update`);
const router = props.services.store.useSubscription<RoutingContext>('router') as unknown as Ref<RoutingContext>;
const permissions = props.services.store.useSubscription('auth', (newState: AuthState) => newState.user?._permissions) as unknown as Ref<DefaultDataModel['users']['_permissions'] | undefined>;
const canUserDeleteResource = permissions.value?.has(`DELETE_${snakeCasedResource}`) === true;
const canUserUpdateResource = permissions.value?.has(`UPDATE_${snakeCasedResource}`) && resourceUpdateRoute !== null;

const handleBlur = (event: MouseEvent): void => {
  if (!(actionsRef.value as HTMLElement).contains(event.target as HTMLElement)) {
    displayActions.value = false;
  }
};

const toggleActions = (): void => {
  displayActions.value = !displayActions.value;
};

const deleteResource = async () => {
  const resourceListRoute = props.services.store.getRoute(`${String(props.resource)}.list`);
  await props.services.store.delete(props.resource, new Id(router.value.params.id));
  props.services.store.notify('NOTIFICATIONS.DELETED_RESOURCE');
  props.services.store.navigate(resourceListRoute ?? props.services.store.getFallbackPageRoute())();
};

const confirmDeletion = () => {
  props.services.store.confirm({
    onConfirm: deleteResource as () => void,
    title: `CONFIRM.DELETE.${snakeCasedResource}.TITLE`,
    subTitle: `CONFIRM.DELETE.${snakeCasedResource}.SUBTITLE`,
    confirm: `CONFIRM.DELETE.${snakeCasedResource}.CONFIRM`,
    cancel: `CONFIRM.DELETE.${snakeCasedResource}.CANCEL`,
  });
};

watch(displayActions, () => {
  if (displayActions.value) {
    window.addEventListener('click', handleBlur);
  }
});

onUnmounted(() => {
  window.removeEventListener('click', handleBlur);
});
</script>

<template>
  <div ref="actionsRef" class="actions-wrapper">
    <UIButton
      v-if="canUserDeleteResource || canUserUpdateResource"
      icon="more"
      modifiers="floating primary"
      :onClick="toggleActions"
      v-bind="moreButtonProps"
    />
    <div
      v-if="canUserDeleteResource || canUserUpdateResource"
      :class="buildClass('actions-wrapper__actions', displayActions ? 'visible' : '')"
    >
      <UIButton
        v-if="canUserDeleteResource"
        icon="delete"
        :onClick="confirmDeletion"
        v-bind="deleteButtonProps"
      />
      <UIButton
        v-if="canUserUpdateResource"
        icon="edit"
        :onClick="services.store.navigate(
          String(resourceUpdateRoute).replace(':id', router.params.id)
        )"
        v-bind="updateButtonProps"
      />
    </div>
  </div>
</template>
