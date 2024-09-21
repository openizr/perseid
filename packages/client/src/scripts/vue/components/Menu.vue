<!--
  App menu.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Menu.vue
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
  toSnakeCase,
  I18n as BaseI18n,
  type DefaultDataModel,
} from '@perseid/core';
import { computed, ref, type Ref } from 'vue';
import type BaseModel from 'scripts/core/services/Model';
import type BaseStore from 'scripts/core/services/Store';
import { type AuthState } from 'scripts/core/services/Store';
import { UILink, UIButton, buildClass } from '@perseid/ui/vue';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { type RoutingContext } from '@perseid/store/extensions/router';

/**
 * Menu props.
 */
export interface MenuProps<
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
}

const isDisplayed = ref(false);
const props = defineProps<MenuProps>();
const { store, i18n } = props.services;
const updateUserRoute = store.getRoute('auth.updateUser');
const auth = props.services.store.useSubscription<AuthState>('auth');
const className = buildClass('menu', isDisplayed.value ? 'visible' : '');
const route = store.useSubscription('router', (newState: RoutingContext) => newState.route);

const signOut = async () => {
  await props.services.store.dispatch('auth', 'signOut');
};

const toggleMenu = () => {
  isDisplayed.value = !isDisplayed.value;
};

const onClick = (url: string) => (
  (event: MouseEvent): void => {
    if (url === route.value) {
      event.preventDefault();
    } else {
      isDisplayed.value = false;
      store.navigate(url)(event);
    }
  }
);

const menuItems = computed(() => {
  const items: { resource: string; route: string; className: string; }[] = [];
  store.getResourceRoutes().forEach((resourceRoute) => {
    const isCurrentRoute = (route as unknown as Ref<string>).value === resourceRoute.route;
    if ((auth as unknown as Ref<AuthState>).value.user?._permissions.has(`LIST_${toSnakeCase(resourceRoute.resource)}`)) {
      items.push({
        route: resourceRoute.route,
        resource: resourceRoute.resource,
        className: buildClass('menu__panel__items__item', isCurrentRoute ? 'active' : ''),
      });
    }
  });
  return items;
});
</script>

<template>
  <!-- role="menu" TODO -->
  <nav :class="className">
    <!-- Burger menu. -->
    <div v-if="menuItems.length > 0 || auth.user !== null" class="menu__top-bar">
      <UIButton
        icon="more"
        :onClick="toggleMenu"
      />
    </div>

    <!-- Menu panel. -->
    <div v-if="menuItems.length > 0 || auth.user !== null" class="menu__panel">
      <UIButton
        icon="close"
        :onClick="toggleMenu"
      />
      <span class="menu__panel__title">{{ i18n.t('MENU.ITEMS.TITLE') }}</span>
      <ul
        v-if="auth.user !== null && updateUserRoute !== null || menuItems.length > 0"
        class="menu__panel__items"
      >
        <li
          v-if="auth.user !== null && updateUserRoute !== null"
          key="updateUser"
          :tabindex="-1"
          role="menuitem"
          :class="buildClass('menu__panel__items__item', updateUserRoute === route ? 'active' : '')"
        >
          <UILink
            :href="updateUserRoute"
            :label="i18n.t('MENU.UPDATE_USER')"
            :onClick="onClick(updateUserRoute)"
          />
        </li>
        <li
          v-for="menuItem of menuItems"
          :key="menuItem.resource"
          :class="menuItem.className"
          :tabindex="-1"
          role="menuitem"
        >
          <UILink
            :href="menuItem.route"
            :label="i18n.t(`MENU.${toSnakeCase(menuItem.resource)}`)"
            :onClick="onClick(menuItem.route)"
          />
        </li>
      </ul>
      <UIButton
        v-if="auth.user !== null"
        icon="signOut"
        :label="i18n.t('MENU.SIGN_OUT')"
        modifiers="outlined secondary"
        :onClick="signOut"
      />
    </div>
  </nav>
</template>
