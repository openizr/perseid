/* c8 ignore start */
<script lang="ts">
  import store from '__playground__/store';
  import connect from 'scripts/connectors/svelte';
  import { RoutingContext } from 'scripts/extensions/router';

  const useSubscription = connect(store);
  const router = useSubscription('router', (newState: RoutingContext) => ({
    test: newState.route,
  }));

  function goToTestPage(): void {
    store.mutate('router', 'NAVIGATE', '/test');
  }
  function goToHomePage(): void {
    store.mutate('router', 'NAVIGATE', '/');
  }
</script>

<section>
  <p>You are here: {`${$router.test}`}</p>
  {#if $router.test === '/'}
    <button on:click={goToTestPage}> Go to /test page </button>
  {:else}
    <button on:click={goToHomePage}> Go to / page </button>
  {/if}
</section>
