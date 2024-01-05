/* c8 ignore start */

import * as React from 'react';
import Router from '__playground__/pages/Router';
import { createRoot, Root } from 'react-dom/client';

let app: Root;

function main(): void {
  app = createRoot(document.querySelector('#root') as unknown as HTMLElement);
  app.render(
    <React.StrictMode>
      <Router />
    </React.StrictMode>,
  );
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
// processing, by manually unmounting React components tree.
window.addEventListener('beforeunload', () => {
  app.unmount();
});
