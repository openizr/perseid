/* c8 ignore start */

import Form from 'scripts/vue/Form.vue';
import Engine from 'scripts/core/Engine';
import Step from 'scripts/vue/DefaultStep.vue';
import { type Component, createApp } from 'vue';

let app: unknown;
const { log } = console;

function main(): void {
  app = createApp(Form as unknown as Component, {
    stepComponent: Step,
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

// Ensures subscriptions to Store are correctly cleared when page is left, to prevent "ghost"
// processing, by manually unmounting Vue components tree.
window.addEventListener('beforeunload', () => {
  (app as { unmount: () => void; }).unmount();
});
