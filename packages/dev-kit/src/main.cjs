/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

const path = require('path');
const packageJson = require('../../../package.json');

let svelteExtends = [];
let svelteOverrides = [];
const projectRootPath = path.resolve(__dirname, '../../../');

try {
  require('svelte/compiler');
  svelteExtends = ['plugin:svelte/recommended'];
  svelteOverrides = [{
    files: ['*.svelte'],
    parser: 'svelte-eslint-parser',
    rules: {
      'no-labels': 'off',
      'import/first': 'off',
      'import/no-mutable-exports': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'import/prefer-default-export': 'off',
      'no-multiple-empty-lines': ['error', { max: 2, maxBOF: 2, maxEOF: 0 }],
      'no-restricted-syntax': ['error', 'ForInStatement', 'ForOfStatement', 'WithStatement'],
    },
  }];
} catch (e) {
  // No-op.
}

module.exports = {
  parser: 'vue-eslint-parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'airbnb',
    'plugin:vue/vue3-recommended',
    'plugin:react-hooks/recommended',
    'plugin:vitest-globals/recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
  ].concat(svelteExtends),
  parserOptions: {
    parser: '@typescript-eslint/parser',
    extraFileExtensions: ['.svelte', '.vue'],
    project: path.join(projectRootPath, 'tsconfig.json'),
  },
  rules: {
    'no-underscore-dangle': 'off',
    '@typescript-eslint/no-floating-promises': [
      'error',
      { ignoreIIFE: true },
    ],
    'react/require-default-props': 'off',
    '@typescript-eslint/no-use-before-define': 2,
    '@typescript-eslint/no-shadow': ['error'],
    'react/jsx-filename-extension': [
      'error',
      {
        extensions: ['.tsx', '.jsx'],
      },
    ],
    'vue/max-attributes-per-line': [
      'error',
      {
        singleline: 10,
        multiline: 1,
      },
    ],
    'import/extensions': [
      'error',
      'always',
      {
        js: 'never',
        ts: 'never',
        jsx: 'never',
        tsx: 'never',
        vue: 'always',
        svelte: 'always',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: ['./*', '../*'],
      },
    ],
    'arrow-parens': ['error', 'always'],
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'react/jsx-uses-react': 'off',
        'react/react-in-jsx-scope': 'off',
        '@typescript-eslint/explicit-function-return-type': ['warn'],
        '@typescript-eslint/explicit-module-boundary-types': ['warn'],
      },
    },
    {
      files: ['*.js', '*.jsx'],
      rules: {
        'react/jsx-uses-react': 'off',
        'react/react-in-jsx-scope': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unnecessary-condition': 'off',
      },
    },
    {
      files: ['*.vue'],
      rules: {
        'react-hooks/rules-of-hooks': 'off',
      },
    },
  ].concat(svelteOverrides),
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts', '.d.ts', '.jsx', '.tsx', '.vue', '.svelte', '.json'],
        paths: [path.join(projectRootPath, packageJson.devKitConfig.srcPath)],
      },
      'import/extensions': ['.js', '.ts', '.d.ts', '.jsx', '.tsx', '.vue', '.svelte'],
    },
  },
  env: {
    browser: true,
    'vitest-globals/env': true,
    'vue/setup-compiler-macros': true,
  },
};
