/* c8 ignore start */

<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { defineAsyncComponent } from 'vue';
import connect from '@perseid/store/connectors/vue';
import { store, routes } from '__playground__/store';
import { RoutingContext } from '@perseid/store/extensions/router';

const useCombiner = connect(store);
const router = useCombiner<RoutingContext>('router', (newState: RoutingContext) => ({
  ...newState,
  route: newState.route ?? '',
}));
const lazyComponents = Object.keys(routes).reduce((components, currentRoute) => ({
  ...components,
  [currentRoute]: defineAsyncComponent({
    loader: routes[currentRoute],
    delay: 200,
    timeout: 5000,
  }),
}), {});
</script>

<template>
  <component
    :is="lazyComponents[router.route as string]"
    v-if="routes[router.route] !== undefined"
  />
</template>
