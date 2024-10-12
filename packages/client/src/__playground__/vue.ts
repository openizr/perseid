/* c8 ignore start */

import {
  Router,
} from 'scripts/vue/index';
import {
  i18n,
  model,
  store,
  apiClient,
} from '__playground__/services';
import '__playground__/style.scss';
import { type Component, createApp } from 'vue';

function main(): void {
  // Creating Vue root...
  const app = createApp(Router as unknown as Component, {
    container: document.querySelector('#root'),
    services: {
      i18n,
      model,
      store,
      apiClient,
    },
  });
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
