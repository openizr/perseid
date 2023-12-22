/* c8 ignore start */

<script lang="ts" context="module">
  import type Engine from 'scripts/core/Engine';
</script>

<script lang="ts">
  export let path: string;
  export let engine: Engine;

  const onChange = (event: Event) => {
    engine.userAction({ type: 'input', data: (event.target as HTMLInputElement).value, path });
  };
</script>

{#if (path === 'root.0.test')}
  <input on:change={onChange} />
{:else}
  <!---->
{/if}
