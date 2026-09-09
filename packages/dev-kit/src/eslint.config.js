/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import globals from 'globals';
import { createRequire } from 'module';
import tseslint from 'typescript-eslint';
import { fixupPluginRules } from '@eslint/compat';
import { defineConfig as eslintDefineConfig } from 'eslint/config';
import reactPlugin from 'eslint-plugin-react';
import stylisticPlugin from '@stylistic/eslint-plugin';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import confusingBrowserGlobals from 'confusing-browser-globals';
import { isAvailable } from './helpers/project.js';

const extensions = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.d.ts', '.vue', '.svelte', '.json'];

const readDevKitConfig = (packageJsonPath) => {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).devKitConfig;
  } catch {
    return undefined;
  }
};

/**
 * Source directory of the project containing `file`: closest `package.json` with a `devKitConfig`,
 * else closest `package.json` (nested ones, e.g. `{ "type": "commonjs" }`, are skipped). Cached.
 */
const sourceDirectories = new Map();
const findSourceDirectory = (file) => {
  let directory = path.dirname(file);
  let fallback = null;
  while (!sourceDirectories.has(directory)) {
    const packageJsonPath = path.join(directory, 'package.json');
    const parent = path.dirname(directory);
    const devKitConfig = readDevKitConfig(packageJsonPath);
    if (devKitConfig !== undefined) {
      sourceDirectories.set(directory, path.join(directory, devKitConfig.srcPath ?? 'src'));
    } else if (parent === directory) {
      sourceDirectories.set(directory, fallback === null ? null : path.join(fallback, 'src'));
    } else {
      fallback ??= fs.existsSync(packageJsonPath) ? directory : null;
      directory = parent;
    }
  }
  return sourceDirectories.get(directory);
};

// Resolves the dev-kit's absolute imports (`scripts/...`) from the project's source directory, like
// Vite's aliases and the tsconfig `paths`, without depending on the working directory.
const sourceResolver = {
  interfaceVersion: 3,
  name: 'dev-kit:source',
  resolve(source, file) {
    const sourceDirectory = (source.startsWith('.') || source.startsWith('node:') || path.isAbsolute(source)) ? null : findSourceDirectory(file);
    // Packages (`react`, `@scope/x`) are ruled out with one stat on the first path segment.
    const base = (sourceDirectory === null || !fs.existsSync(path.join(sourceDirectory, source.split('/')[0]))) ? null : path.join(sourceDirectory, source);
    const found = base === null ? undefined : [base]
      .concat(extensions.map((extension) => `${base}${extension}`), extensions.map((extension) => path.join(base, `index${extension}`)))
      .find((candidate) => fs.statSync(candidate, { throwIfNoEntry: false })?.isFile());
    return found === undefined ? { found: false } : { found: true, path: found };
  },
};

// React hooks rules make no sense in Vue/Svelte components.
const noReactHooksRules = Object.fromEntries(
  Object.keys(reactHooksPlugin.rules).map((rule) => [`react-hooks/${rule}`, 'off']),
);

/**
 * Builds the dev-kit ESLint flat config. Everything is resolved per linted file (closest
 * `tsconfig.json`) or from the dev-kit's own location (frameworks are optional peers), so it works
 * from any working directory: IDE integrations do not run ESLint from the project's root.
 *
 * @returns ESLint flat config.
 */
async function createConfig() {
  const resolve = createRequire(import.meta.url);
  // `detect` relies on `context.getFilename`, removed in ESLint 10: version is read manually.
  const reactVersion = isAvailable('react') ? resolve('react/package.json').version : '19.0.0';

  // Import rules need a native resolver, installed for the current platform only. When dependencies
  // were installed from another OS (Docker), the IDE would get no lint at all: degrade instead.
  let importPlugin = null;
  let createTypeScriptImportResolver = null;
  try {
    importPlugin = (await import('eslint-plugin-import-x')).default;
    ({ createTypeScriptImportResolver } = await import('eslint-import-resolver-typescript'));
  } catch (error) {
    console.warn(`[@perseid/dev-kit] import rules disabled, native resolver unavailable: ${error.message}`);
  }

  const config = [
    {
      plugins: {
        // eslint-plugin-react still relies on context methods removed in ESLint 10.
        react: fixupPluginRules(reactPlugin),
        ...(importPlugin === null ? {} : { import: importPlugin }),
        '@stylistic': stylisticPlugin,
        'jsx-a11y': jsxA11yPlugin,
      },
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: tseslint.parser,
        parserOptions: {
          projectService: true,
          extraFileExtensions: ['.vue', '.svelte'],
          ecmaFeatures: { jsx: true },
        },
        globals: {
          ...globals.browser,
          ...globals.node,
          ...globals.vitest,
        },
      },
      settings: {
        react: { version: reactVersion },
        'import-x/extensions': extensions,
        'import-x/ignore': ['node_modules', '\\.(coffee|scss|css|less|hbs|svg|json)$', '\\.(vue|svelte)$'],
        'import-x/core-modules': [],
        'import-x/external-module-folders': ['node_modules', 'node_modules/@types'],
        'import-x/parsers': { '@typescript-eslint/parser': ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.d.ts'] },
        'import-x/resolver-next': [sourceResolver].concat(
          createTypeScriptImportResolver === null ? [] : [createTypeScriptImportResolver({ extensions })],
        ),
      },
      rules: {
        // Best practices
        'accessor-pairs': 'off',
        'array-callback-return': ['error', { allowImplicit: true }],
        'block-scoped-var': 'error',
        'class-methods-use-this': ['error', { exceptMethods: ['render', 'getInitialState', 'getDefaultProps', 'getChildContext', 'componentWillMount', 'UNSAFE_componentWillMount', 'componentDidMount', 'componentWillReceiveProps', 'UNSAFE_componentWillReceiveProps', 'shouldComponentUpdate', 'componentWillUpdate', 'UNSAFE_componentWillUpdate', 'componentDidUpdate', 'componentWillUnmount', 'componentDidCatch', 'getSnapshotBeforeUpdate'] }],
        complexity: ['off', 20],
        'consistent-return': 'error',
        curly: ['error', 'multi-line'],
        'default-case': ['error', { commentPattern: '^no default$' }],
        'default-case-last': 'error',
        'default-param-last': 'error',
        'dot-notation': ['error', { allowKeywords: true }],
        eqeqeq: ['error', 'always', { null: 'ignore' }],
        'grouped-accessor-pairs': 'error',
        'guard-for-in': 'error',
        'max-classes-per-file': ['error', 1],
        'no-alert': 'warn',
        'no-caller': 'error',
        'no-case-declarations': 'error',
        'no-constructor-return': 'error',
        'no-div-regex': 'off',
        'no-else-return': ['error', { allowElseIf: false }],
        'no-empty-function': ['error', { allow: ['arrowFunctions', 'functions', 'methods'] }],
        'no-empty-pattern': 'error',
        'no-eq-null': 'off',
        'no-eval': 'error',
        'no-extend-native': 'error',
        'no-extra-bind': 'error',
        'no-extra-label': 'error',
        'no-fallthrough': 'error',
        'no-global-assign': ['error', { exceptions: [] }],
        'no-implicit-coercion': ['off', { boolean: false, number: true, string: true, allow: [] }],
        'no-implicit-globals': 'off',
        'no-implied-eval': 'error',
        'no-invalid-this': 'off',
        'no-iterator': 'error',
        'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
        'no-lone-blocks': 'error',
        'no-loop-func': 'error',
        'no-magic-numbers': ['off', { ignore: [], enforceConst: true, detectObjects: false }],
        'no-multi-str': 'error',
        'no-new': 'error',
        'no-new-func': 'error',
        'no-new-wrappers': 'error',
        'no-nonoctal-decimal-escape': 'error',
        'no-object-constructor': 'error',
        'no-octal': 'error',
        'no-octal-escape': 'error',
        'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['acc', 'accumulator', 'e', 'ctx', 'context', 'req', 'request', 'res', 'response', '$scope', 'staticContext'] }],
        'no-proto': 'error',
        'no-redeclare': 'error',
        'no-restricted-properties': ['error',
          { object: 'arguments', property: 'callee', message: 'arguments.callee is deprecated' },
          { object: 'global', property: 'isFinite', message: 'Please use Number.isFinite instead' },
          { object: 'self', property: 'isFinite', message: 'Please use Number.isFinite instead' },
          { object: 'window', property: 'isFinite', message: 'Please use Number.isFinite instead' },
          { object: 'global', property: 'isNaN', message: 'Please use Number.isNaN instead' },
          { object: 'self', property: 'isNaN', message: 'Please use Number.isNaN instead' },
          { object: 'window', property: 'isNaN', message: 'Please use Number.isNaN instead' },
          { property: '__defineGetter__', message: 'Please use Object.defineProperty instead.' },
          { property: '__defineSetter__', message: 'Please use Object.defineProperty instead.' },
          { object: 'Math', property: 'pow', message: 'Use the exponentiation operator (**) instead.' },
        ],
        'no-return-assign': ['error', 'always'],
        'no-script-url': 'error',
        'no-self-assign': ['error', { props: true }],
        'no-self-compare': 'error',
        'no-sequences': 'error',
        'no-throw-literal': 'error',
        'no-unmodified-loop-condition': 'off',
        'no-unused-expressions': ['error', { allowShortCircuit: false, allowTernary: false, allowTaggedTemplates: false }],
        'no-unused-labels': 'error',
        'no-useless-call': 'off',
        'no-useless-catch': 'error',
        'no-useless-concat': 'error',
        'no-useless-escape': 'error',
        'no-useless-return': 'error',
        'no-void': 'error',
        'no-warning-comments': ['off', { terms: ['todo', 'fixme', 'xxx'], location: 'start' }],
        'no-with': 'error',
        'prefer-named-capture-group': 'off',
        'prefer-promise-reject-errors': ['error', { allowEmptyReject: true }],
        'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],
        radix: 'error',
        'require-await': 'off',
        'require-unicode-regexp': 'off',
        'vars-on-top': 'error',
        yoda: 'error',

        // Errors
        'for-direction': 'error',
        'getter-return': ['error', { allowImplicit: true }],
        'no-async-promise-executor': 'error',
        'no-await-in-loop': 'error',
        'no-compare-neg-zero': 'error',
        'no-cond-assign': ['error', 'always'],
        'no-console': 'warn',
        'no-constant-condition': 'warn',
        'no-control-regex': 'error',
        'no-debugger': 'error',
        'no-dupe-args': 'error',
        'no-dupe-else-if': 'error',
        'no-dupe-keys': 'error',
        'no-duplicate-case': 'error',
        'no-empty': 'error',
        'no-empty-character-class': 'error',
        'no-ex-assign': 'error',
        'no-extra-boolean-cast': 'error',
        'no-func-assign': 'error',
        'no-import-assign': 'error',
        'no-inner-declarations': 'error',
        'no-invalid-regexp': 'error',
        'no-irregular-whitespace': 'error',
        'no-loss-of-precision': 'error',
        'no-misleading-character-class': 'error',
        'no-obj-calls': 'error',
        'no-promise-executor-return': 'error',
        'no-prototype-builtins': 'error',
        'no-regex-spaces': 'error',
        'no-setter-return': 'error',
        'no-sparse-arrays': 'error',
        'no-template-curly-in-string': 'error',
        'no-unexpected-multiline': 'error',
        'no-unreachable': 'error',
        'no-unreachable-loop': ['error', { ignore: [] }],
        'no-unsafe-finally': 'error',
        'no-unsafe-negation': 'error',
        'no-unsafe-optional-chaining': ['error', { disallowArithmeticOperators: true }],
        'no-unused-private-class-members': 'off',
        'no-useless-backreference': 'error',
        'require-atomic-updates': 'off',
        'use-isnan': 'error',
        'valid-typeof': ['error', { requireStringLiterals: true }],

        // Node
        'global-require': 'error',
        'no-buffer-constructor': 'error',
        'no-new-require': 'error',
        'no-path-concat': 'error',

        // Strict
        strict: ['error', 'never'],
        'lines-around-directive': ['error', { before: 'always', after: 'always' }],

        // Variables
        'init-declarations': 'off',
        'no-delete-var': 'error',
        'no-label-var': 'error',
        'no-restricted-globals': ['error',
          { name: 'isFinite', message: 'Use Number.isFinite instead' },
          { name: 'isNaN', message: 'Use Number.isNaN' },
        ].concat(confusingBrowserGlobals),
        'no-shadow': 'error',
        'no-shadow-restricted-names': 'error',
        'no-undef': 'error',
        'no-undef-init': 'error',
        'no-undefined': 'off',
        'no-unused-vars': ['error', { vars: 'all', args: 'after-used', ignoreRestSiblings: true }],
        'no-use-before-define': ['error', { functions: true, classes: true, variables: true }],

        // ES6+
        'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
        'constructor-super': 'error',
        'no-class-assign': 'error',
        'no-const-assign': 'error',
        'no-dupe-class-members': 'error',
        'no-duplicate-imports': 'off',
        'no-new-native-nonconstructor': 'error',
        'no-restricted-exports': ['error', { restrictedNamedExports: ['default', 'then'] }],
        'no-restricted-imports': ['error', { patterns: ['./*', '../*'] }],
        'no-this-before-super': 'error',
        'no-useless-computed-key': 'error',
        'no-useless-constructor': 'error',
        'no-useless-rename': ['error', { ignoreDestructuring: false, ignoreImport: false, ignoreExport: false }],
        'no-var': 'error',
        'object-shorthand': ['error', 'always', { ignoreConstructors: false, avoidQuotes: true }],
        'prefer-arrow-callback': ['error', { allowNamedFunctions: false, allowUnboundThis: true }],
        'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: true }],
        'prefer-destructuring': ['error', { VariableDeclarator: { array: false, object: true }, AssignmentExpression: { array: true, object: false } }, { enforceForRenamedProperties: false }],
        'prefer-numeric-literals': 'error',
        'prefer-rest-params': 'error',
        'prefer-spread': 'error',
        'prefer-template': 'error',
        'require-yield': 'error',
        'sort-imports': ['off', { ignoreCase: false, ignoreDeclarationSort: false, ignoreMemberSort: false, memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'] }],
        'symbol-description': 'error',

        // Style
        camelcase: ['error', { properties: 'never', ignoreDestructuring: false, ignoreImports: false }],
        'capitalized-comments': ['off', 'never', { line: { ignorePattern: '.*', ignoreInlineComments: true, ignoreConsecutiveComments: true }, block: { ignorePattern: '.*', ignoreInlineComments: true, ignoreConsecutiveComments: true } }],
        'consistent-this': 'off',
        'func-name-matching': ['off', 'always', { includeCommonJSModuleExports: false, considerPropertyDescriptor: true }],
        'func-names': 'warn',
        'func-style': ['off', 'expression'],
        'id-denylist': 'off',
        'id-length': 'off',
        'id-match': 'off',
        'max-depth': ['off', 4],
        'max-lines': ['off', { max: 300, skipBlankLines: true, skipComments: true }],
        'max-lines-per-function': ['off', { max: 50, skipBlankLines: true, skipComments: true, IIFEs: true }],
        'max-nested-callbacks': 'off',
        'max-params': ['off', 3],
        'max-statements': ['off', 10, { ignoreTopLevelFunctions: true }],
        'new-cap': ['error', { newIsCap: true, newIsCapExceptions: [], capIsNew: false, capIsNewExceptions: ['Immutable.Map', 'Immutable.Set', 'Immutable.List'] }],
        'no-array-constructor': 'error',
        'no-bitwise': 'error',
        'no-continue': 'error',
        'no-inline-comments': 'off',
        'no-lonely-if': 'error',
        'no-multi-assign': ['error'],
        'no-negated-condition': 'off',
        'no-nested-ternary': 'error',
        'no-plusplus': 'error',
        'no-restricted-syntax': ['error',
          { selector: 'ForInStatement', message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.' },
          { selector: 'ForOfStatement', message: 'Loops should be avoided in favor of array iterations (map, forEach, ...).' },
          { selector: 'LabeledStatement', message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.' },
          { selector: 'WithStatement', message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.' },
        ],
        'no-ternary': 'off',
        'no-underscore-dangle': 'off',
        'no-unneeded-ternary': ['error', { defaultAssignment: false }],
        'one-var': ['error', 'never'],
        'operator-assignment': ['error', 'always'],
        'prefer-exponentiation-operator': 'error',
        'prefer-object-spread': 'error',
        'sort-keys': ['off', 'asc', { caseSensitive: false, natural: true }],
        'sort-vars': 'off',
        'unicode-bom': ['error', 'never'],

        // Formatting (ESLint core formatting rules are deprecated, `@stylistic` replaces them)
        '@stylistic/array-bracket-newline': ['off', 'consistent'],
        '@stylistic/array-bracket-spacing': ['error', 'never'],
        '@stylistic/array-element-newline': ['off', { multiline: true, minItems: 3 }],
        '@stylistic/arrow-parens': ['error', 'always'],
        '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
        '@stylistic/block-spacing': ['error', 'always'],
        '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
        '@stylistic/comma-dangle': ['error', { arrays: 'always-multiline', objects: 'always-multiline', imports: 'always-multiline', exports: 'always-multiline', functions: 'always-multiline' }],
        '@stylistic/comma-spacing': ['error', { before: false, after: true }],
        '@stylistic/comma-style': ['error', 'last', { exceptions: { ArrayExpression: false, ArrayPattern: false, ArrowFunctionExpression: false, CallExpression: false, FunctionDeclaration: false, FunctionExpression: false, ImportDeclaration: false, ObjectExpression: false, ObjectPattern: false, VariableDeclaration: false, NewExpression: false } }],
        '@stylistic/computed-property-spacing': ['error', 'never'],
        '@stylistic/dot-location': ['error', 'property'],
        '@stylistic/eol-last': ['error', 'always'],
        '@stylistic/function-call-argument-newline': ['error', 'consistent'],
        '@stylistic/function-call-spacing': ['error', 'never'],
        '@stylistic/function-paren-newline': ['error', 'multiline-arguments'],
        '@stylistic/generator-star-spacing': ['error', { before: false, after: true }],
        '@stylistic/implicit-arrow-linebreak': ['error', 'beside'],
        '@stylistic/indent': ['error', 2, { SwitchCase: 1, VariableDeclarator: 1, outerIIFEBody: 1, FunctionDeclaration: { parameters: 1, body: 1 }, FunctionExpression: { parameters: 1, body: 1 }, CallExpression: { arguments: 1 }, ArrayExpression: 1, ObjectExpression: 1, ImportDeclaration: 1, flatTernaryExpressions: false, ignoreComments: false, ignoredNodes: ['JSXElement', 'JSXElement > *', 'JSXAttribute', 'JSXIdentifier', 'JSXNamespacedName', 'JSXMemberExpression', 'JSXSpreadAttribute', 'JSXExpressionContainer', 'JSXOpeningElement', 'JSXClosingElement', 'JSXFragment', 'JSXOpeningFragment', 'JSXClosingFragment', 'JSXText', 'JSXEmptyExpression', 'JSXSpreadChild'] }],
        '@stylistic/jsx-quotes': ['error', 'prefer-double'],
        '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
        '@stylistic/keyword-spacing': ['error', { before: true, after: true, overrides: { return: { after: true }, throw: { after: true }, case: { after: true } } }],
        '@stylistic/line-comment-position': ['off', { position: 'above', ignorePattern: '', applyDefaultPatterns: true }],
        '@stylistic/linebreak-style': ['error', 'unix'],
        '@stylistic/lines-around-comment': 'off',
        '@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: false }],
        '@stylistic/max-len': ['error', 100, 2, { ignoreUrls: true, ignoreComments: false, ignoreRegExpLiterals: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
        '@stylistic/max-statements-per-line': ['off', { max: 1 }],
        '@stylistic/multiline-comment-style': ['off', 'starred-block'],
        '@stylistic/multiline-ternary': ['off', 'never'],
        '@stylistic/new-parens': 'error',
        '@stylistic/newline-per-chained-call': ['error', { ignoreChainWithDepth: 4 }],
        '@stylistic/no-confusing-arrow': ['error', { allowParens: true }],
        '@stylistic/no-extra-parens': ['off', 'all', { conditionalAssign: true, nestedBinaryExpressions: false, returnAssign: false, ignoreJSX: 'all', enforceForArrowConditionals: false }],
        '@stylistic/no-extra-semi': 'error',
        '@stylistic/no-floating-decimal': 'error',
        '@stylistic/no-mixed-operators': ['error', { groups: [['%', '**'], ['%', '+'], ['%', '-'], ['%', '*'], ['%', '/'], ['/', '*'], ['&', '|', '<<', '>>', '>>>'], ['==', '!=', '===', '!=='], ['&&', '||']], allowSamePrecedence: false }],
        '@stylistic/no-mixed-spaces-and-tabs': 'error',
        '@stylistic/no-multi-spaces': ['error', { ignoreEOLComments: false }],
        '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
        '@stylistic/no-tabs': 'error',
        '@stylistic/no-trailing-spaces': ['error', { skipBlankLines: false, ignoreComments: false }],
        '@stylistic/no-whitespace-before-property': 'error',
        '@stylistic/nonblock-statement-body-position': ['error', 'beside', { overrides: {} }],
        '@stylistic/object-curly-newline': ['error', { ObjectExpression: { minProperties: 4, multiline: true, consistent: true }, ObjectPattern: { minProperties: 4, multiline: true, consistent: true }, ImportDeclaration: { minProperties: 4, multiline: true, consistent: true }, ExportDeclaration: { minProperties: 4, multiline: true, consistent: true } }],
        '@stylistic/object-curly-spacing': ['error', 'always'],
        '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
        '@stylistic/one-var-declaration-per-line': ['error', 'always'],
        '@stylistic/operator-linebreak': ['error', 'before', { overrides: { '=': 'none' } }],
        '@stylistic/padded-blocks': ['error', { blocks: 'never', classes: 'never', switches: 'never' }, { allowSingleLineBlocks: true }],
        '@stylistic/padding-line-between-statements': 'off',
        '@stylistic/quote-props': ['error', 'as-needed', { keywords: false, unnecessary: true, numbers: false }],
        '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
        '@stylistic/rest-spread-spacing': ['error', 'never'],
        '@stylistic/semi': ['error', 'always'],
        '@stylistic/semi-spacing': ['error', { before: false, after: true }],
        '@stylistic/semi-style': ['error', 'last'],
        '@stylistic/space-before-blocks': 'error',
        '@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
        '@stylistic/space-in-parens': ['error', 'never'],
        '@stylistic/space-infix-ops': 'error',
        '@stylistic/space-unary-ops': ['error', { words: true, nonwords: false, overrides: {} }],
        '@stylistic/spaced-comment': ['error', 'always', { line: { exceptions: ['-', '+'], markers: ['=', '!', '/'] }, block: { exceptions: ['-', '+'], markers: ['=', '!', ':', '::'], balanced: true } }],
        '@stylistic/switch-colon-spacing': ['error', { after: true, before: false }],
        '@stylistic/template-curly-spacing': ['error', 'never'],
        '@stylistic/template-tag-spacing': ['error', 'never'],
        '@stylistic/wrap-iife': ['error', 'outside', { functionPrototypeMethods: false }],
        '@stylistic/wrap-regex': 'off',
        '@stylistic/yield-star-spacing': ['error', 'after'],

        // Imports
        'import/default': 'off',
        'import/dynamic-import-chunkname': ['off', { importFunctions: [], webpackChunknameFormat: '[0-9a-zA-Z-_/.]+' }],
        'import/export': 'error',
        'import/extensions': ['error', 'always', { js: 'never', mjs: 'never', jsx: 'never', ts: 'never', tsx: 'never', vue: 'always', svelte: 'always' }],
        'import/first': 'error',
        'import/group-exports': 'off',
        'import/max-dependencies': ['off', { max: 10 }],
        'import/namespace': 'off',
        'import/newline-after-import': 'error',
        'import/no-absolute-path': 'error',
        'import/no-amd': 'error',
        'import/no-anonymous-default-export': ['off', { allowArray: false, allowArrowFunction: false, allowAnonymousClass: false, allowAnonymousFunction: false, allowCallExpression: true, allowLiteral: false, allowObject: false }],
        'import/no-commonjs': 'off',
        'import/no-cycle': ['error', { maxDepth: Infinity, ignoreExternal: true }],
        'import/no-default-export': 'off',
        'import/no-deprecated': 'off',
        'import/no-duplicates': 'error',
        'import/no-dynamic-require': 'error',
        'import/no-extraneous-dependencies': ['error', { devDependencies: ['test/**', 'tests/**', 'spec/**', '**/__tests__/**', '**/__mocks__/**', 'test.{js,jsx,ts,tsx}', 'test-*.{js,jsx,ts,tsx}', '**/*{.,_}{test,spec}.{js,jsx,ts,tsx}', '**/jest.config.js', '**/jest.setup.js', '**/vue.config.js', '**/webpack.config.js', '**/webpack.config.*.js', '**/rollup.config.js', '**/rollup.config.*.js', '**/gulpfile.js', '**/gulpfile.*.js', '**/Gruntfile{,.js}', '**/protractor.conf.js', '**/protractor.conf.*.js', '**/karma.conf.js', '**/.eslintrc.js', '**/vite.config.*', '**/vitest.config.*', '**/eslint.config.*'], optionalDependencies: false }],
        'import/no-import-module-exports': ['error', { exceptions: [] }],
        'import/no-internal-modules': ['off', { allow: [] }],
        'import/no-mutable-exports': 'error',
        'import/no-named-as-default': 'error',
        'import/no-named-as-default-member': 'error',
        'import/no-named-default': 'error',
        'import/no-named-export': 'off',
        'import/no-namespace': 'off',
        'import/no-nodejs-modules': 'off',
        'import/no-relative-packages': 'error',
        'import/no-relative-parent-imports': 'off',
        'import/no-restricted-paths': 'off',
        'import/no-self-import': 'error',
        'import/no-unassigned-import': 'off',
        'import/no-unresolved': ['error', { caseSensitive: true, commonjs: true }],
        'import/no-unused-modules': ['off', { ignoreExports: [], missingExports: true, unusedExports: true }],
        'import/no-useless-path-segments': ['error', { commonjs: true }],
        'import/no-webpack-loader-syntax': 'error',
        'import/order': ['error', { groups: [['builtin', 'external', 'internal']] }],
        'import/prefer-default-export': 'error',
        'import/unambiguous': 'off',

        // React
        'react/boolean-prop-naming': ['off', { propTypeNames: ['bool', 'mutuallyExclusiveTrueProps'], rule: '^(is|has)[A-Z]([A-Za-z0-9]?)+', message: '' }],
        'react/button-has-type': ['error', { button: true, submit: true, reset: false }],
        'react/default-props-match-prop-types': ['error', { allowRequiredDefaults: false }],
        'react/destructuring-assignment': ['error', 'always'],
        'react/display-name': 'off',
        'react/forbid-component-props': ['off', { forbid: [] }],
        'react/forbid-dom-props': ['off', { forbid: [] }],
        'react/forbid-elements': ['off', { forbid: [] }],
        'react/forbid-foreign-prop-types': ['warn', { allowInPropTypes: true }],
        'react/forbid-prop-types': ['error', { forbid: ['any', 'array', 'object'], checkContextTypes: true, checkChildContextTypes: true }],
        'react/function-component-definition': ['error', { namedComponents: ['function-declaration', 'function-expression'], unnamedComponents: 'function-expression' }],
        'react/hook-use-state': 'off',
        'react/iframe-missing-sandbox': 'off',
        'react/jsx-boolean-value': ['error', 'never', { always: [] }],
        'react/jsx-child-element-spacing': 'off',
        'react/jsx-closing-bracket-location': ['error', 'line-aligned'],
        'react/jsx-closing-tag-location': 'error',
        'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
        'react/jsx-curly-newline': ['error', { multiline: 'consistent', singleline: 'consistent' }],
        'react/jsx-curly-spacing': ['error', 'never', { allowMultiline: true }],
        'react/jsx-equals-spacing': ['error', 'never'],
        'react/jsx-filename-extension': ['error', { extensions: ['.tsx', '.jsx'] }],
        'react/jsx-first-prop-new-line': ['error', 'multiline-multiprop'],
        'react/jsx-fragments': ['error', 'syntax'],
        'react/jsx-handler-names': ['off', { eventHandlerPrefix: 'handle', eventHandlerPropPrefix: 'on', checkLocalVariables: false, checkInlineFunction: true }],
        'react/jsx-indent': ['error', 2],
        'react/jsx-indent-props': ['error', 2],
        'react/jsx-key': 'off',
        'react/jsx-max-depth': 'off',
        'react/jsx-max-props-per-line': ['error', { maximum: 1, when: 'multiline' }],
        'react/jsx-newline': 'off',
        'react/jsx-no-bind': ['error', { ignoreRefs: true, allowArrowFunctions: true, allowFunctions: false, allowBind: false, ignoreDOMComponents: true }],
        'react/jsx-no-comment-textnodes': 'error',
        'react/jsx-no-constructed-context-values': 'error',
        'react/jsx-no-duplicate-props': ['error', { ignoreCase: true }],
        'react/jsx-no-literals': ['off', { noStrings: true }],
        'react/jsx-no-script-url': ['error', [{ name: 'Link', props: ['to'] }]],
        'react/jsx-no-target-blank': ['error', { enforceDynamicLinks: 'always' }],
        'react/jsx-no-undef': 'error',
        'react/jsx-no-useless-fragment': 'error',
        'react/jsx-one-expression-per-line': ['error', { allow: 'single-child' }],
        'react/jsx-pascal-case': ['error', { allowAllCaps: true, ignore: [] }],
        'react/jsx-props-no-multi-spaces': 'error',
        'react/jsx-props-no-spreading': ['error', { html: 'enforce', custom: 'enforce', explicitSpread: 'ignore', exceptions: [] }],
        'react/jsx-sort-props': ['off', { ignoreCase: true, callbacksLast: false, shorthandFirst: false, shorthandLast: false, noSortAlphabetically: false, reservedFirst: true }],
        'react/jsx-tag-spacing': ['error', { closingSlash: 'never', beforeSelfClosing: 'always', afterOpening: 'never', beforeClosing: 'never' }],
        'react/jsx-uses-react': 'off',
        'react/jsx-uses-vars': 'error',
        'react/jsx-wrap-multilines': ['error', { declaration: 'parens-new-line', assignment: 'parens-new-line', return: 'parens-new-line', arrow: 'parens-new-line', condition: 'parens-new-line', logical: 'parens-new-line', prop: 'parens-new-line' }],
        'react/no-access-state-in-setstate': 'error',
        'react/no-adjacent-inline-elements': 'off',
        'react/no-array-index-key': 'error',
        'react/no-arrow-function-lifecycle': 'error',
        'react/no-children-prop': 'error',
        'react/no-danger': 'warn',
        'react/no-danger-with-children': 'error',
        'react/no-deprecated': 'error',
        'react/no-did-mount-set-state': 'off',
        'react/no-did-update-set-state': 'error',
        'react/no-direct-mutation-state': 'off',
        'react/no-find-dom-node': 'error',
        'react/no-invalid-html-attribute': 'error',
        'react/no-is-mounted': 'error',
        'react/no-multi-comp': 'off',
        'react/no-namespace': 'error',
        'react/no-redundant-should-component-update': 'error',
        'react/no-render-return-value': 'error',
        'react/no-set-state': 'off',
        'react/no-string-refs': 'error',
        'react/no-this-in-sfc': 'error',
        'react/no-typos': 'error',
        'react/no-unescaped-entities': 'error',
        'react/no-unknown-property': 'error',
        'react/no-unsafe': 'off',
        'react/no-unstable-nested-components': 'error',
        'react/no-unused-class-component-methods': 'error',
        'react/no-unused-prop-types': ['error', { customValidators: [], skipShapeProps: true }],
        'react/no-unused-state': 'error',
        'react/no-will-update-set-state': 'error',
        'react/prefer-es6-class': ['error', 'always'],
        'react/prefer-exact-props': 'error',
        'react/prefer-read-only-props': 'off',
        'react/prefer-stateless-function': ['error', { ignorePureComponents: true }],
        'react/prop-types': ['error', { ignore: [], customValidators: [], skipUndeclared: false }],
        'react/react-in-jsx-scope': 'off',
        'react/require-default-props': 'off',
        'react/require-optimization': ['off', { allowDecorators: [] }],
        'react/require-render-return': 'error',
        'react/self-closing-comp': 'error',
        'react/sort-comp': ['error', { order: ['static-variables', 'static-methods', 'instance-variables', 'lifecycle', '/^handle.+$/', '/^on.+$/', 'getters', 'setters', '/^(get|set)(?!(InitialState$|DefaultProps$|ChildContext$)).+$/', 'instance-methods', 'everything-else', 'rendering'], groups: { lifecycle: ['displayName', 'propTypes', 'contextTypes', 'childContextTypes', 'mixins', 'statics', 'defaultProps', 'constructor', 'getDefaultProps', 'getInitialState', 'state', 'getChildContext', 'getDerivedStateFromProps', 'componentWillMount', 'UNSAFE_componentWillMount', 'componentDidMount', 'componentWillReceiveProps', 'UNSAFE_componentWillReceiveProps', 'shouldComponentUpdate', 'componentWillUpdate', 'UNSAFE_componentWillUpdate', 'getSnapshotBeforeUpdate', 'componentDidUpdate', 'componentDidCatch', 'componentWillUnmount'], rendering: ['/^render.+$/', 'render'] } }],
        'react/sort-prop-types': ['off', { ignoreCase: true, callbacksLast: false, requiredFirst: false, sortShapeProp: true }],
        'react/state-in-constructor': ['error', 'always'],
        'react/static-property-placement': ['error', 'property assignment'],
        'react/style-prop-object': 'error',
        'react/void-dom-elements-no-children': 'error',

        // React a11y
        'jsx-a11y/accessible-emoji': 'off',
        'jsx-a11y/alt-text': ['error', { elements: ['img', 'object', 'area', 'input[type="image"]'], img: [], object: [], area: [], 'input[type="image"]': [] }],
        'jsx-a11y/anchor-ambiguous-text': ['off', { words: ['click', 'tap', 'go', 'here', 'this', 'link'] }],
        'jsx-a11y/anchor-has-content': ['error', { components: [] }],
        'jsx-a11y/anchor-is-valid': ['error', { components: ['Link'], specialLink: ['to'], aspects: ['noHref', 'invalidHref', 'preferButton'] }],
        'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
        'jsx-a11y/aria-props': 'error',
        'jsx-a11y/aria-proptypes': 'error',
        'jsx-a11y/aria-role': ['error', { ignoreNonDOM: false }],
        'jsx-a11y/aria-unsupported-elements': 'error',
        'jsx-a11y/autocomplete-valid': ['off', { inputComponents: [] }],
        'jsx-a11y/click-events-have-key-events': 'error',
        'jsx-a11y/control-has-associated-label': ['error', { labelAttributes: ['label'], controlComponents: [], ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'tr', 'video'], ignoreRoles: ['grid', 'listbox', 'menu', 'menubar', 'radiogroup', 'row', 'tablist', 'toolbar', 'tree', 'treegrid'], depth: 5 }],
        'jsx-a11y/heading-has-content': ['error', { components: [''] }],
        'jsx-a11y/html-has-lang': 'error',
        'jsx-a11y/iframe-has-title': 'error',
        'jsx-a11y/img-redundant-alt': 'error',
        'jsx-a11y/interactive-supports-focus': 'error',
        'jsx-a11y/label-has-associated-control': ['error', { labelComponents: [], labelAttributes: [], controlComponents: [], assert: 'both', depth: 25 }],
        'jsx-a11y/lang': 'error',
        'jsx-a11y/media-has-caption': ['error', { audio: [], video: [], track: [] }],
        'jsx-a11y/mouse-events-have-key-events': 'error',
        'jsx-a11y/no-access-key': 'error',
        'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
        'jsx-a11y/no-distracting-elements': ['error', { elements: ['marquee', 'blink'] }],
        'jsx-a11y/no-interactive-element-to-noninteractive-role': ['error', { tr: ['none', 'presentation'] }],
        'jsx-a11y/no-noninteractive-element-interactions': ['error', { handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'] }],
        'jsx-a11y/no-noninteractive-element-to-interactive-role': ['error', { ul: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'], ol: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'], li: ['menuitem', 'option', 'row', 'tab', 'treeitem'], table: ['grid'], td: ['gridcell'] }],
        'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel'] }],
        'jsx-a11y/no-redundant-roles': 'error',
        'jsx-a11y/no-static-element-interactions': ['error', { handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'] }],
        'jsx-a11y/prefer-tag-over-role': 'off',
        'jsx-a11y/role-has-required-aria-props': 'error',
        'jsx-a11y/role-supports-aria-props': 'error',
        'jsx-a11y/scope': 'error',
        'jsx-a11y/tabindex-no-positive': 'error',
      },
    },

    // TypeScript (type-aware rules run on JS files too, so `allowJs` projects get them).
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      rules: {
        'no-shadow': 'off',
        '@typescript-eslint/no-shadow': 'error',
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': 'error',
        '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],
      },
    },

    // React hooks (includes React Compiler rules).
    reactHooksPlugin.configs.flat.recommended,
    {
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'error',
      },
    },

    // Per file type overrides.
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'warn',
        '@typescript-eslint/explicit-module-boundary-types': 'warn',
      },
    },
    {
      files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
      rules: {
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unnecessary-condition': 'off',
      },
    },
  ];

  // Vue support (only when installed).
  if (isAvailable('vue')) {
    const vuePlugin = (await import('eslint-plugin-vue')).default;
    config.push(...vuePlugin.configs['flat/recommended'], {
      files: ['**/*.vue'],
      languageOptions: {
        parserOptions: { parser: tseslint.parser },
      },
      rules: {
        ...noReactHooksRules,
        'vue/max-attributes-per-line': ['error', { singleline: 10, multiline: 1 }],
      },
    });
  }

  // Svelte support (only when installed).
  if (isAvailable('svelte')) {
    const sveltePlugin = (await import('eslint-plugin-svelte')).default;
    config.push(...sveltePlugin.configs.recommended, {
      files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'],
      languageOptions: {
        parserOptions: { parser: tseslint.parser },
      },
      rules: {
        ...noReactHooksRules,
        'no-labels': 'off',
        'import/first': 'off',
        'import/no-mutable-exports': 'off',
        'import/prefer-default-export': 'off',
        '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxBOF: 2, maxEOF: 0 }],
        'no-restricted-syntax': ['error',
          { selector: 'ForInStatement', message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.' },
          { selector: 'ForOfStatement', message: 'Loops should be avoided in favor of array iterations (map, forEach, ...).' },
          { selector: 'WithStatement', message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.' },
        ],
      },
    });
  }

  if (importPlugin === null) {
    config.forEach((entry) => {
      Object.keys(entry.rules ?? {}).forEach((rule) => {
        if (rule.startsWith('import/')) {
          delete entry.rules[rule];
        }
      });
    });
  }

  return config;
}

const config = createConfig();

/**
 * Dev-kit defaults plus project overrides (flat config objects or arrays), appended last.
 *
 * @param overrides Project-specific config objects.
 *
 * @returns ESLint flat config.
 */
export async function defineConfig(...overrides) {
  return eslintDefineConfig(await config, ...overrides);
}

export default config;
