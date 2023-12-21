<!-- App router. -->

<script setup>
import { defineAsyncComponent } from 'vue';
import routes from 'scripts/store/routes';
import useCombiner from 'scripts/store/useStore';
import AppLoader from 'scripts/components/AppLoader.vue';

const router = useCombiner('router', (newState) => ({ ...newState, route: newState.route }));  // eslint-disable-line
const lazyComponents = Object.keys(routes).reduce((components, currentRoute) => ({
  ...components,
  [currentRoute]: defineAsyncComponent({
    loader: routes[currentRoute],
    loadingComponent: AppLoader, // eslint-disable-line
    delay: 200,
    timeout: 5000,
  }),
}), {});
</script>

<template>
  <component
    :is="lazyComponents[router.route]"
    v-if="routes[router.route] !== undefined"
    :locale="{ LABEL_TEST: 'TEST' }"
  />
</template>
