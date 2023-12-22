/* c8 ignore start */

import * as React from 'react';
import Form from 'scripts/react/Form';
import { createRoot, Root } from 'react-dom/client';

let app: Root;
const { log } = console;

function main(): void {
  app = createRoot(document.querySelector('#root') as unknown as HTMLElement);
  app.render(
    <React.StrictMode>
      <Form
        configuration={{
          root: 'root',
          fields: {
            test: { type: 'string', required: true },
          },
          steps: {
            root: {
              fields: ['test'],
            },
          },
          plugins: [
            (engine): void => {
              engine.on('userAction', (data, next) => {
                log(data);
                return next(data);
              });
            },
          ],
        }}
        Field={(props): JSX.Element | null => {
          if (props.path === 'root.0.test') {
            return (
              <input onBlur={(event: React.ChangeEvent) => {
                props.engine.userAction({ type: 'input', data: (event.target as HTMLInputElement).value, path: props.path });
              }}
              />
            );
          }
          return null;
        }}
      />
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
