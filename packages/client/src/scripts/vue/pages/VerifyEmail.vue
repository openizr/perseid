<!--
  Verify email page.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/VerifyEmail.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { UITitle, UIButton } from '@perseid/ui/vue';
import { onMounted, type DefineComponent, type Ref } from 'vue';
import type BaseModel from 'scripts/core/services/Model';
import type BaseStore from 'scripts/core/services/Store';
import { type AuthState } from 'scripts/core/services/Store';
import DefaultLoader from 'scripts/vue/components/Loader.vue';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { type RoutingContext } from '@perseid/store/extensions/router';
import { I18n as BaseI18n, type DefaultDataModel } from '@perseid/core';

/**
 * ViewEmail page props.
 */
export interface ViewEmailProps<
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

const props = defineProps<ViewEmailProps>();
const { store, i18n } = props.services;
const auth = store.useSubscription<AuthState>('auth');
const Loader = props.components.Loader ?? DefaultLoader;
const router = store.useSubscription<RoutingContext>('router');
const { verificationToken } = (router as unknown as Ref<RoutingContext>).value.query;

const requestEmailVerification = async () => {
  await store.dispatch('auth', 'requestEmailVerification');
  store.notify('NOTIFICATIONS.REQUESTED_EMAIL');
};

// Automatically redirects users to the default page if their email is already verified.
onMounted(() => {
  if ((auth as unknown as Ref<AuthState>).value.user?._verifiedAt) {
    store.navigate(store.getFallbackPageRoute())();
  }
});

// Verifies user email when a verification token is passed in the URL.
onMounted(() => {
  if (/^[0-9a-fA-F]{24}$/.test(verificationToken)) {
    store.dispatch('auth', 'verifyEmail', verificationToken).catch(() => {
      store.notify('NOTIFICATIONS.ERRORS.INVALID_VERIFICATION_TOKEN');
    }).finally(() => {
      store.navigate(store.getFallbackPageRoute())();
    });
  } else {
    store.dispatch('auth', 'requestEmailVerification').catch(() => {
      // No-op.
    });
  }
});
</script>

<template>
  <main class="verify-email-page">
    <!-- Verifying email... -->
    <Loader
      v-if="auth.user?._verifiedAt !== null || /^[0-9a-fA-F]{24}$/.test(verificationToken)"
      :services="services"
      :components="components"
    />
    <!-- Email must be verified... -->
    <div v-else>
      <UITitle level="1" :label="i18n.t('PAGES.VERIFY_EMAIL.TITLE')" />
      <UITitle level="2" :label="i18n.t('PAGES.VERIFY_EMAIL.SUBTITLE')" />
      <UIButton
        modifiers="primary"
        :label="i18n.t('PAGES.VERIFY_EMAIL.CTA')"
        :onClick="requestEmailVerification"
      />
    </div>
  </main>
</template>
