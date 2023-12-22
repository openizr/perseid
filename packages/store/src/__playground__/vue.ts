/* c8 ignore start */

import App from '__playground__/App.vue';
import { Component, createApp } from 'vue';

let app: unknown;

function main(): void {
  app = createApp(App as unknown as Component);
  (app as { mount: (root: string) => void; }).mount('#root');
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
  (app as { unmount: () => void; }).unmount();
});
