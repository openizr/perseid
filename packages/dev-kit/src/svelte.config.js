/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Svelte 5 handles TypeScript natively: only style languages need Vite's CSS pipeline.
const devKitSvelteConfig = { preprocess: [vitePreprocess()] };

/**
 * Dev-kit defaults merged with project overrides (preprocessors are appended).
 *
 * @param overrides Project-specific Svelte config.
 *
 * @returns Svelte config.
 */
export function defineConfig(overrides = {}) {
  return {
    ...devKitSvelteConfig,
    ...overrides,
    preprocess: devKitSvelteConfig.preprocess.concat(overrides.preprocess ?? []),
  };
}

export default devKitSvelteConfig;
