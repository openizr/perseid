# `@perseid/dev-kit`

Everything you need to develop front-end and back-end JavaScript/TypeScript projects with maximum productivity.

[![npm](https://img.shields.io/npm/v/@perseid/dev-kit.svg)](https://www.npmjs.com/package/@perseid/dev-kit)
[![node](https://img.shields.io/node/v/@perseid/dev-kit.svg)](https://nodejs.org)
[![downloads](https://img.shields.io/npm/dm/@perseid/dev-kit.svg?style=flat-square)](https://www.npmjs.com/package/@perseid/dev-kit)


## Installation

```bash
yarn add --dev @perseid/dev-kit
```


### Documentation

See https://perseid.dev/.


## ESLint

Linting runs when the project has an `eslint.config.js`, type-checking when it has a
`tsconfig.json`. Overrides are appended to the dev-kit defaults:

```js
import { defineConfig } from '@perseid/dev-kit/eslint.config.js';

export default defineConfig({ rules: { 'no-console': 'off' } });
```


## Vite / Vitest

Without a `vite.config.js`, the dev-kit defaults are used. To fine-tune them (deep merge):

```js
import { defineConfig } from '@perseid/dev-kit/vite.config.js';

export default defineConfig({ server: { port: 3000 } });
```


## Svelte

svelte-check and the Svelte IDE extension read `svelte.config.js` from the project's root:

```js
export { default } from '@perseid/dev-kit/svelte.config.js';
```

`defineConfig({ /* overrides */ })` is also exported to fine-tune it (preprocessors are appended).


## TypeScript

```json
{ "extends": "./node_modules/@perseid/dev-kit/tsconfig.json" }
```

In VS Code, when the opened folder is not the project itself (monorepo), add to
`.vscode/settings.json`:

```json
{
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact", "vue", "svelte"]
}
```


If dependencies are installed from a container but your IDE runs on the host, native bindings
(`unrs-resolver`, used by import rules) must be installed for both platforms. With yarn, add to
`.yarnrc.yml`: `supportedArchitectures: { os: [current, darwin, linux], cpu: [current, arm64, x64], libc: [current, glibc, musl] }`
(pnpm: same keys in `pnpm-workspace.yaml`). Without them, the dev-kit still lints but skips import rules.


## Notes

- Type-checking runs on native TypeScript 7 (`@typescript/native`-style alias `typescript-native`).
  `typescript@6` is still installed because typescript-eslint and svelte-check need its JS API,
  which TypeScript 7.0 does not ship: revisit once TypeScript 7.1 exposes a stable API.
- Works with npm, yarn 4 (node-modules linker) and pnpm. With pnpm 10+, allow or ignore the
  build scripts of `esbuild`, `unrs-resolver`, `@parcel/watcher` in `pnpm-workspace.yaml`.


## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) Openizr. All Rights Reserved.
