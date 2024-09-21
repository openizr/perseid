<!--
  Resource creation / update page.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/CreateOrUpdate.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Engine from '@perseid/form';
import { buildClass } from '@perseid/ui/vue';
import { computed, type DefineComponent } from 'vue';
import Form from 'scripts/vue/components/form/Form.vue';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import DefaultLoader from 'scripts/vue/components/Loader.vue';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import DefaultPageLayout from 'scripts/vue/components/PageLayout.vue';
import { type UpdateOrCreatePageData } from 'scripts/core/services/Store';
import FormField, { type FormFieldProps } from 'scripts/vue/components/FormField.vue';
import { type DefaultDataModel, toSnakeCase, type I18n as BaseI18n } from '@perseid/core';
/**
 * Resource creation / update page props.
 */
export interface CreateOrUpdateProps<
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

const props = defineProps<CreateOrUpdateProps>();
const Loader = props.components.Loader ?? DefaultLoader;
const PageLayout = props.components.PageLayout ?? DefaultPageLayout;
const pageData = props.services.store.useSubscription<UpdateOrCreatePageData>('page');
const mode = computed(() => ((pageData.value?.id !== undefined) ? 'UPDATE' : 'CREATE'));
const prefix = computed(() => `PAGES.${toSnakeCase(String(props.resource))}.${mode.value}`);
</script>

<template>
  <!-- Page is still loading... -->
  <Loader v-if="pageData === null" :services="services" :components="components" />
  <main v-else :class="buildClass(`${mode.toLowerCase()}-page`, String(resource))">
    <PageLayout :services="services" :components="components" :resource="resource" :page="mode">
      <Form
        :Field="FormField as DefineComponent<FormFieldProps<Engine>>"
        :configuration="pageData.configuration as unknown as Record<string, unknown>"
        :additional-props="{ fieldProps: pageData.fieldProps, context: { prefix, services } }"
      />
    </PageLayout>
  </main>
</template>
