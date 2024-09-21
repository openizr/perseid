<!-- `scripts/vue/UIIcon.vue` mock. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

const props = withDefaults(defineProps<{
  id?: string;
  name: string;
  modifiers?: string;
}>(), {
  id: undefined,
  modifiers: '',
});
</script>

<template>
  <i id="icon">{{ JSON.stringify(props) }}</i>
</template>
