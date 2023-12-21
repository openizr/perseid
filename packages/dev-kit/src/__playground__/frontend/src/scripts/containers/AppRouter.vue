<!-- App router. -->

<script lang="ts" setup>
import routes from 'scripts/store/routes';
import useCombiner from 'scripts/store/useStore';
import AppLoader from 'scripts/components/AppLoader.vue';
import { type AsyncComponentLoader, type Component, defineAsyncComponent } from 'vue';

const router = useCombiner('router', (newState) => ({ ...newState, route: (newState as { route: unknown; }).route }) as unknown) as { route: string; };
const lazyComponents = Object.keys(routes).reduce((components, currentRoute) => ({
  ...components,
  [currentRoute]: defineAsyncComponent({
    loader: routes[currentRoute] as AsyncComponentLoader<Component>,
    loadingComponent: AppLoader as Component,
    delay: 200,
    timeout: 5000,
  }),
}), {}) as Record<string, string>;
</script>

<template>
  <component
    :is="lazyComponents[router.route]"
    v-if="routes[router.route] !== undefined"
    :locale="{ LABEL_TEST: 'TEST' }"
  />
</template>
