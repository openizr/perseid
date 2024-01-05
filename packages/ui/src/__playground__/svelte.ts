/* c8 ignore start */

import type { SvelteComponent } from 'svelte';
import Router from '__playground__/pages/Router.svelte';

let app: SvelteComponent;

function main(): void {
  const target = document.querySelector('#root') as unknown as HTMLElement;
  target.innerHTML = '';
  app = new Router({
    hydrate: false,
    target,
  });
}

// Ensures DOM is fully loaded before running app's main logic.
// Loading hasn't finished yet...
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
  // `DOMContentLoaded` has already fired...
} else {
  main();
}

// Ensures subscriptions to Store are correctly cleared when page is left, to prevent "ghost"
// processing, by manually unmounting Svelte components tree.
window.addEventListener('beforeunload', () => {
  app.$destroy();
});
