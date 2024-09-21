<!--
  Handles uncaught errors and displays a generic UI.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/ErrorWrapper.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Error wrapper props.
 */
import { ref, onErrorCaptured } from 'vue';

export interface ErrorWrapperProps {
  /** Callback to trigger when an error occurs. */
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

const hasError = ref(false);
const props = defineProps<ErrorWrapperProps>();
onErrorCaptured((error, _, info) => {
  hasError.value = true;
  props.onError?.(error, { componentStack: info });
  return false;
});
</script>

<template>
  <template v-if="hasError">
    <slot name="fallback" />
  </template>
  <template v-else>
    <slot />
  </template>
</template>
