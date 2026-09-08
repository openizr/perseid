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


## Notes

- Type-checking runs on native TypeScript 7 (`@typescript/native`-style alias `typescript-native`).
  `typescript@6` is still installed because typescript-eslint and svelte-check need its JS API,
  which TypeScript 7.0 does not ship: revisit once TypeScript 7.1 exposes a stable API.
- Works with npm, yarn 4 (node-modules linker) and pnpm. With pnpm 10+, allow or ignore the
  build scripts of `esbuild`, `unrs-resolver`, `@parcel/watcher` in `pnpm-workspace.yaml`.


## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) Openizr. All Rights Reserved.
