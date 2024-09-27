/* c8 ignore start */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

import { SvelteComponent } from 'svelte';
import Engine from 'scripts/core/Engine';
import Form from 'scripts/svelte/Form.svelte';
import Field from '__playground__/Field.svelte';

let app: Form;
const { log } = console;

function main(): void {
  app = new Form({
    props: {
      Field: Field as typeof SvelteComponent | null | undefined,
      configuration: {
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
          (engine: Engine): void => {
            engine.on('userAction', (data, next) => {
              log(data);
              return next(data);
            });
          },
        ],
      },
    },
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
  (app as { $destroy: () => void; }).$destroy();
});
