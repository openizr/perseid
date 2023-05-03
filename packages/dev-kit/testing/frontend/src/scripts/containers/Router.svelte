<script lang="ts">
  import { onDestroy } from 'svelte';
  import routes from 'scripts/store/routes';
  import useCombiner from 'scripts/store/useCombiner';
  import Loader from 'scripts/components/Loader.svelte';

  type Any = any; // eslint-disable-line
  export let locale: Record<string, string>;
  let component: { default: Any; } | null = { default: Loader };
  const router = useCombiner<{ route: string; }>('router', (newState: Any) => newState as unknown);
  const unsubscribe = router.subscribe((newState) => {
    const page = routes[newState.route] as (() => Promise<{ default: unknown; }>) | undefined;
    if (page) {
      page().then((response) => {
        component = response;
      }).catch(() => null);
    } else {
      component = null;
    }
  });
  onDestroy(unsubscribe);
</script>

{#if component !== null}
  <svelte:component this={component.default} {locale} />
{/if}
