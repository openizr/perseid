<!--
  App router. Handles redirects, not founds, and pages loading.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Router.vue
-->
<script lang="ts" setup>
import {
  onMounted,
  type Component,
  type DefineComponent,
  defineAsyncComponent,
} from 'vue';
import connect from '@perseid/store/connectors/vue';
import type BaseModel from 'scripts/core/services/Model';
import type BaseStore from 'scripts/core/services/Store';
import DefaultErrorPage from 'scripts/vue/pages/Error.vue';
import DefaultLoader from 'scripts/vue/components/Loader.vue';
import DefaultLayout from 'scripts/vue/components/Layout.vue';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import ErrorWrapper from 'scripts/vue/components/ErrorWrapper.vue';
import type { UseSubscription } from '@perseid/store/connectors/vue';
import { type RoutingContext } from '@perseid/store/extensions/router';
import type { I18n as BaseI18n, DefaultDataModel } from '@perseid/core';
import ConfirmationModal from 'scripts/vue/components/ConfirmationModal.vue';

// Do not import all built-in components in this default list as it breaks tree shaking!
const resizeEventOptions = { capture: true };
const defaultComponents = { ConfirmationModal };
const defaultPages = {
  View: (): Promise<unknown> => import('scripts/vue/pages/View.vue'),
  List: (): Promise<unknown> => import('scripts/vue/pages/List.vue'),
  SignIn: (): Promise<unknown> => import('scripts/vue/pages/SignIn.vue'),
  SignUp: (): Promise<unknown> => import('scripts/vue/pages/SignUp.vue'),
  Update: (): Promise<unknown> => import('scripts/vue/pages/CreateOrUpdate.vue'),
  Create: (): Promise<unknown> => import('scripts/vue/pages/CreateOrUpdate.vue'),
  UpdateUser: (): Promise<unknown> => import('scripts/vue/pages/UpdateUser.vue'),
  VerifyEmail: (): Promise<unknown> => import('scripts/vue/pages/VerifyEmail.vue'),
  ResetPassword: (): Promise<unknown> => import('scripts/vue/pages/ResetPassword.vue'),
};

/**
 * Router props.
 */
export interface RouterProps<
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

  /** App DOM container. Automatic dimensionning is enabled only if this prop is specified. */
  container?: HTMLElement;

  /** Custom components declaration. */
  components?: Partial<Record<string, DefineComponent>>;

  /** Custom pages components declaration. */
  pages?: Partial<Record<string, (() => Promise<{
    default: DefineComponent;
  }>)>>;
}

const props = defineProps<RouterProps>();
const allComponents = {
  ...defaultComponents,
  ...props.components,
} as VueCustomComponents;
const { store } = props.services;
const allRoutes = store.getAllRoutes();
store.useSubscription = connect(props.services.store);
const error = store.useSubscription('error');
const router = store.useSubscription<RoutingContext>('router');
const Layout = allComponents.Layout ?? DefaultLayout;
const Loader = allComponents.Loader ?? DefaultLoader;
const ErrorPage = allComponents.ErrorPage ?? DefaultErrorPage;
const pages = { ...defaultPages, ...props.pages } as Exclude<RouterProps['pages'], undefined>;
const allPages = allRoutes.reduce<Record<string, Component | null>>((finalRoutes, route) => {
  const pageConfiguration = store.getPage(route);
  const page = pages[String(pageConfiguration?.component)] ?? null;
  return ({
    ...finalRoutes,
    [route]: (page === null) ? null : defineAsyncComponent({
      loader: page,
      loadingComponent: Loader,
    }),
  });
}, {});

// Adapts application dimensions to provide a unified UX accross devices.
onMounted(() => {
  const parent = props.container;
  // For some reason, resizing on mobile always happens in 2 times (first, available width and
  // height are updated, then inner height). Thus, we need a memoization mechanism to trigger
  // container resizing at the right moment.
  let shouldResize = true;
  let currentViewportHeight = window.innerHeight;
  let currentViewportAvailableWidth = window.screen.availWidth;
  const setHeight = (): void => {
    const innerHeightDifference = Math.abs(window.innerHeight - currentViewportHeight);
    if (
      // Most likely a desktop device...
      navigator.maxTouchPoints <= 1
      // Available screen width big modification means portrait/landscape switching on mobile.
      || Math.abs(currentViewportAvailableWidth - window.screen.availWidth) > 50
      // Big height difference on resize most likely means virtual keyboard was opened.
      || (innerHeightDifference > 0 && innerHeightDifference <= 50)
    ) {
      shouldResize = true;
      currentViewportHeight = window.innerHeight;
      currentViewportAvailableWidth = window.screen.availWidth;
    } else if (parent !== undefined && shouldResize) {
      shouldResize = false;
      requestAnimationFrame(() => { parent.style.height = `${String(window.innerHeight)}px`; });
    }
  };
  setHeight();
  window.addEventListener('resize', setHeight, { capture: true });
  return (): void => { window.removeEventListener('resize', setHeight, resizeEventOptions); };
});
</script>

<template>
  <!--
    We need to wrap all components including Router inside the error handler at the highest
    level, to be able to cleanly handle as many errors as possible, including store errors.
  -->
  <!-- TODO onError => services.logger.error -->
  <ErrorWrapper :onError="console.error">
    <!-- Error... -->
    <ErrorPage
      v-if="error !== null || router.route === null"
      :services="services"
      :components="allComponents"
      :error="(router.route === null) ? new Error('NOT_FOUND') : error as Error"
    />
    <!-- Success... -->
    <Layout
      v-else
      :services="services"
      :components="allComponents"
      v-bind="store.getPage(router.route)?.layoutProps"
    >
      <component
        :is="allPages[router.route]"
        v-if="allPages[router.route] !== null"
        :services="services"
        :components="allComponents"
        :resource="store.getPage(router.route)?.resource"
        v-bind="store.getPage(router.route)?.pageProps"
      />
    </Layout>
    <template #fallback>
      <ErrorPage :services="services" :components="allComponents" />
    </template>
  </ErrorWrapper>
</template>
