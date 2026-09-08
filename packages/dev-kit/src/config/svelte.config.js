/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Svelte 5 handles TypeScript natively: only style languages need Vite's CSS pipeline.
export default {
  preprocess: vitePreprocess(),
};
