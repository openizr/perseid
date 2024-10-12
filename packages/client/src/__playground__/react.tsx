/* c8 ignore start */

import {
  Grid,
  Router,
} from 'scripts/react/index';
import {
  i18n,
  model,
  store,
  apiClient,
} from '__playground__/services';
import * as React from 'react';
import '__playground__/style.scss';
import { Store } from 'scripts/core/index';
import { createRoot, type Root } from 'react-dom/client';
import type { UseSubscription } from '@perseid/store/connectors/react';

let app: Root;

function main(): void {
  const container = document.querySelector('#root') as unknown as HTMLElement;
  app = createRoot(container);
  app.render(
    <React.StrictMode>
      <Router<DataModel>
        services={{
          i18n,
          model,
          store: store as Store<DataModel> & { useSubscription: UseSubscription; },
          apiClient,
        }}
        pages={{
          Home: async () => Promise.resolve({ default: () => <div /> }),
        }}
        components={{}}
      />
      <Grid columns={{ mobile: 4, tablet: 8, desktop: 12 }} />
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
