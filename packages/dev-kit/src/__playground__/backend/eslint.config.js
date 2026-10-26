import { defineConfig } from '@perseid/dev-kit/eslint.config.js';

export default defineConfig({
  files: ['**/*.ts', '**/*.js'],
  rules: {
    '@typescript-eslint/no-floating-promises': 'off',
  },
}, {
  files: ['**/*.js'],
  rules: {
    '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
  },
});
