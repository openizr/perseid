<!--
  Error page.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/Error.vue
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
import type BaseModel from 'scripts/core/services/Model';
import type BaseStore from 'scripts/core/services/Store';
import DefaultLayout from 'scripts/vue/components/Layout.vue';
import { UITitle, UILink, buildClass } from '@perseid/ui/vue';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Error page props.
 */
export interface ErrorPageProps<
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

  /** Additional modifiers to apply to the error page. */
  modifiers?: string;

  /** Error to display. */
  error?: Error | Response | null;
}

const props = defineProps<ErrorPageProps>();
const { i18n } = props.services;
const Layout = props.components.Layout ?? DefaultLayout;
const fallbackRoute = props.services.store.getFallbackPageRoute();
</script>

<template>
  <!-- Forbidden. -->
  <Layout
    v-if="(error as Response | null)?.status === 403"
    :services="services"
    :components="components"
  >
    <main :class="buildClass('error-page', `${modifiers} forbidden`)">
      <UITitle :label="i18n.t('PAGES.ERROR.FORBIDDEN.TITLE')" />
      <UITitle level="2" :label="i18n.t('PAGES.ERROR.FORBIDDEN.SUBTITLE')" />
      <UILink
        modifiers="button"
        :href="fallbackRoute"
        :label="i18n.t('PAGES.ERROR.FORBIDDEN.CTA')"
      />
    </main>
  </Layout>

  <!-- Not Found - router. -->
  <Layout
    v-else-if="(error as Error | null)?.message === 'NOT_FOUND'"
    :display="false"
    :services="services"
    :components="components"
  >
    <main :class="buildClass('error-page', `${modifiers} not-found`)">
      <UITitle :label="i18n.t('PAGES.ERROR.NOT_FOUND.TITLE')" />
      <UITitle level="2" :label="i18n.t('PAGES.ERROR.NOT_FOUND.SUBTITLE')" />
      <UILink
        modifiers="button"
        :href="fallbackRoute"
        :label="i18n.t('PAGES.ERROR.NOT_FOUND.CTA')"
      />
    </main>
  </Layout>

  <!-- Not Found - API. -->
  <Layout
    v-else-if="(error as Response | null)?.status === 404"
    :services="services"
    :components="components"
  >
    <main :class="buildClass('error-page', `${modifiers} resource-not-found`)">
      <UITitle :label="i18n.t('PAGES.ERROR.NOT_FOUND.TITLE')" />
      <UITitle level="2" :label="i18n.t('PAGES.ERROR.NOT_FOUND.SUBTITLE')" />
      <UILink
        modifiers="button"
        :href="fallbackRoute"
        :label="i18n.t('PAGES.ERROR.NOT_FOUND.CTA')"
      />
    </main>
  </Layout>

  <!-- Uncaught / unknown. We don't use Layout here, as if the error comes from the store, we might
  fall into an infinite loop while subscribing to modal / notifications / ... modules. -->
  <div v-else class="layout">
    <div class="layout__content">
      <main :class="buildClass('error-page', `${modifiers} generic`)">
        <UITitle :label="i18n.t('PAGES.ERROR.GENERIC.TITLE')" />
        <UITitle level="2" :label="i18n.t('PAGES.ERROR.GENERIC.SUBTITLE')" />
        <UILink
          modifiers="button"
          :href="fallbackRoute"
          :label="i18n.t('PAGES.ERROR.GENERIC.CTA')"
        />
      </main>
    </div>
  </div>
</template>
