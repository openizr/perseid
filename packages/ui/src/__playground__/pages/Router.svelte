/* c8 ignore start */

<script lang="ts">
  import { routes, store } from '__playground__/store';
  import { onDestroy, SvelteComponent } from 'svelte';
  import connect from '@perseid/store/connectors/svelte';
  import type { RoutingContext } from '@perseid/store/extensions/router';

  let component: SvelteComponent | null = null;
  const useSubscription = connect(store);
  const router = useSubscription<RoutingContext>('router');
  const unsubscribe = router.subscribe((state: RoutingContext) => {
    const currentRoute = state.route ?? '';
    if (routes[currentRoute] as unknown !== undefined) {
      routes[currentRoute]().then((response) => {
        component = response as SvelteComponent;
      }).catch(() => null);
    } else {
      component = null;
    }
  });

  onDestroy(unsubscribe);
</script>

{#if component !== null}
  <svelte:component this={component.default} />
{/if}
