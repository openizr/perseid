<!--
  Resource view page.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/View.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { buildClass } from '@perseid/ui';
import type { DefineComponent } from 'vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import DefaultLoader from 'scripts/vue/components/Loader.vue';
import { type ViewPageData } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import DefaultPageLayout from 'scripts/vue/components/PageLayout.vue';
import DefaultFieldValue from 'scripts/vue/components/FieldValue.vue';
import DefaultFieldLabel from 'scripts/vue/components/FieldLabel.vue';
import { type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Resource view page props.
 */
export interface ViewProps<
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
}

const props = defineProps<ViewProps>();
const Loader = props.components.Loader ?? DefaultLoader;
const PageLayout = props.components.PageLayout ?? DefaultPageLayout;
const FieldValue = props.components.FieldValue ?? DefaultFieldValue;
const FieldLabel = props.components.FieldLabel ?? DefaultFieldLabel;
const pageData = props.services.store.useSubscription<ViewPageData>('page');
const registry = props.services.store.useSubscription<Registry<DefaultDataModel>>('registry');
</script>

<template>
  <!-- Page is still loading... -->
  <Loader v-if="pageData === null" :services="services" :components="components" />
  <main v-else :class="buildClass('view-page', String(resource))">
    <PageLayout :services="services" :components="components" :resource="resource" page="VIEW">
      <div class="view-page__fields">
        <div v-for="field in pageData.fields" :key="field" class="view-page__fields__field">
          <FieldLabel
            page="VIEW"
            :field="field"
            :services="services"
            :resource="resource"
            :components="components"
          />
          <FieldValue
            :id="pageData.id"
            page="VIEW"
            :field="field"
            :registry="registry"
            :services="services"
            :resource="resource"
            :components="components"
            :loading="pageData.loading"
          />
        </div>
      </div>
    </PageLayout>
  </main>
</template>
