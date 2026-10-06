# Package managers
  `npm`
  `yarn` 4 (node-modules linker)
  `pnpm`

# Yarn commands
  Work on nodeJS 22+
  `yarn`
  `yarn run dev`
  `yarn run test`
  `yarn run check`
  `yarn run build`

# Test mode
  Code coverage
  Finds mocked node modules in `src`
  Allows testing TS/JS Vue/React/Svelte components

# Development mode
  ES2022+ support
  ESLint Airbnb
  Watch mode
  Sourcemaps support
  Checks TS/Svelte types
  Supports both TS and JS
  Externalizes all dependencies
  Bundle generation (1 per entry)
  Vue/React/Svelte components library creation support
  Keeps `extraPackageJsonKeys` in the generated package.json

# Production mode
  Generates typings in `distPath` when `generateTypings` is true
  ES2022+ support
  ESLint Airbnb
  Optimized bundle
  Transpiles to ES2022
  Sourcemaps support
  Checks TS/Svelte types
  Supports both TS and JS
  Doesn't generate manifest
  Externalizes all dependencies
  Bundle generation (1 per entry)
  Doesn't display performance hints
  Adds a banner on top of each bundled file
  Vue/React/Svelte components library creation support
