/* c8 ignore start */
<script lang="ts" setup>

import store from '__playground__/store';
import connect from 'scripts/connectors/vue';
import { type RoutingContext } from 'scripts/extensions/router';

const useCombiner = connect(store);
const router = useCombiner<RoutingContext>('router');

function goToTestPage(): void {
  store.mutate('router', 'NAVIGATE', '/test');
}
function goToHomePage(): void {
  store.mutate('router', 'NAVIGATE', '/');
}
</script>

<template>
  <section>
    <p>You are here: {{ `${router.route}` }}</p>
    <button
      v-if="router.route === '/'"
      @click="goToTestPage"
    >
      Go to /test page
    </button>
    <button
      v-else
      @click="goToHomePage"
    >
      Go to / page
    </button>
  </section>
</template>
