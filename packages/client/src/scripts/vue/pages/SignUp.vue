<!--
  Sign-up page.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/SignUp.vue
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
import type { DefineComponent } from 'vue';
import { UILink, UITitle } from '@perseid/ui/vue';
import Form from 'scripts/vue/components/form/Form.vue';
import type BaseModel from 'scripts/core/services/Model';
import type BaseStore from 'scripts/core/services/Store';
import FormField from 'scripts/vue/components/FormField.vue';
import DefaultLoader from 'scripts/vue/components/Loader.vue';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { I18n as BaseI18n, type DefaultDataModel } from '@perseid/core';
import type { FormFieldProps } from 'scripts/vue/components/form/DefaultField.vue';

/**
 * SignUp page props.
 */
export interface SignUpProps<
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

const props = defineProps<SignUpProps>();
const prefix = 'PAGES.SIGN_UP';
const Loader = props.components.Loader ?? DefaultLoader;
const signInRoute = props.services.store.getRoute('auth.signIn');
const pageData = props.services.store.useSubscription<FormDefinition | null>('page');
</script>

<template>
  <!-- Page is still loading... -->
  <Loader v-if="pageData === null" :services="services" :components="components" />
  <main v-else class="sign-up-page">
    <div class="sign-up-page__card">
      <UITitle :label="services.i18n.t('PAGES.SIGN_UP.TITLE')" />
      <Form
        :Field="FormField as DefineComponent<FormFieldProps<Engine>>"
        :configuration="pageData.configuration as unknown as Record<string, unknown>"
        :additional-props="{ fieldProps: pageData.fieldProps, context: { prefix, services } }"
      />
      <div>
        <UILink
          v-if="signInRoute !== null"
          :href="signInRoute"
          :label="services.i18n.t('PAGES.SIGN_UP.SIGN_IN')"
          :onClick="services.store.navigate(signInRoute)"
        />
      </div>
    </div>
  </main>
</template>
