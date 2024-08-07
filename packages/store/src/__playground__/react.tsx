/* c8 ignore start */

import * as React from 'react';
import store from '__playground__/store';
import connect from 'scripts/connectors/react';
import { createRoot, type Root } from 'react-dom/client';
import { type RoutingContext } from 'scripts/extensions/router';

let app: Root;

const useSubscription = connect(store);

const goToTestPage = (): void => {
  store.mutate('router', 'NAVIGATE', '/test');
};

const goToHomePage = (): void => {
  store.mutate('router', 'NAVIGATE', '/');
};

function Component(): React.JSX.Element {
  const routingContext = useSubscription('router', (newState: RoutingContext) => ({
    route: newState.route,
    query: {},
  }));
  return (
    <section>
      {<p>{`You are here: ${String(routingContext.route)}`}</p> as unknown as React.ReactNode}
      {(routingContext.route === '/')
        ? (
          <button type="button" onClick={goToTestPage}>
            Go to /test page
          </button>
        ) as unknown as React.ReactNode
        : (
          <button type="button" onClick={goToHomePage}>
            Go to / page
          </button>
        ) as unknown as React.ReactNode}
    </section>
  );
}

function main(): void {
  app = createRoot(document.querySelector('#root') as unknown as HTMLElement);
  app.render(
    <React.StrictMode>
      <Component />
    </React.StrictMode> as unknown as React.ReactNode,
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
// processing, by manually unmounting Vue components tree.
window.addEventListener('beforeunload', () => {
  app.unmount();
});
