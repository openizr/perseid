/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '*.svelte' {
  import { SvelteComponent } from 'svelte';

  export default SvelteComponent;
}

declare module '*.vue' {
  import Vue from 'vue';

  export default Vue;
}
