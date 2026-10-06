import { defineConfig } from '@perseid/dev-kit/vite.config.js';

// Overrides are deep-merged onto the dev-kit defaults (arrays are concatenated).
export default defineConfig({
  test: {
    coverage: {
      exclude: ['**/store/routes.ts'],
    },
  },
});
