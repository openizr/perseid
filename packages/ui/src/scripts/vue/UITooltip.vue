<!-- Tooltip wrapper, for accessibility. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { computed, ref } from 'vue';
import { buildClass } from 'scripts/core/index';

const props = withDefaults(defineProps<{
  id?: string;
  label?: string;
  description?: string;
  modifiers?: string;
}>(), {
  modifiers: '',
  id: undefined,
  label: undefined,
  description: undefined,
});

const isDescriptionVisible = ref(false);

const displayDescription = () => {
  isDescriptionVisible.value = true;
};

const hideDescription = () => {
  isDescriptionVisible.value = false;
};

const className = computed(() => buildClass('ui-tooltip', [props.modifiers, isDescriptionVisible.value ? 'described' : ''].join(' ')));
</script>

<template>
  <div
    :id="id"
    role="tooltip"
    :class="className"
    :aria-label="label"
    @focus="displayDescription"
    @click="displayDescription"
    @focusout="hideDescription"
    @keypress="displayDescription"
  >
    <slot />
    <span
      v-if="isDescriptionVisible && description !== undefined"
      class="ui-tooltip__description"
      role="status"
    >{{ description }}</span>
  </div>
</template>
