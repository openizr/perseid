/* c8 ignore start */

import { createApp, type App } from 'vue';
import AppRouter from '__playground__/pages/AppRouter.vue';

let app: App;

function main(): void {
  app = createApp(AppRouter as unknown as App);
  app.mount('#root');
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
  app.unmount();
});
