import devKit from '@perseid/dev-kit/eslint.config.js';

export default [
  ...(await devKit),
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
    },
  },
];
