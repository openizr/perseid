/* c8 ignore start */

import App from '__playground__/App.svelte';

let app: App;

function main(): void {
  app = new App({
    target: document.getElementById('root') as unknown as HTMLElement,
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
// processing, by manually unmounting Vue components tree.
window.addEventListener('beforeunload', () => {
  app.$destroy();
});
