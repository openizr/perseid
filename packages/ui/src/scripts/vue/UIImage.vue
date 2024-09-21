<!-- Image. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { computed } from 'vue';
import { buildClass } from 'scripts/core/index';

const props = withDefaults(defineProps<{
  ratio: string;
  src: string;
  alt: string;
  id?: string;
  lazy?: boolean;
  itemProp?: string;
  modifiers?: string;
}>(), {
  lazy: true,
  modifiers: '',
  id: undefined,
  itemProp: undefined,
});

const className = computed(() => buildClass('ui-image', `${props.ratio} ${props.modifiers}`));
const dimensions = computed(() => {
  let newDimensions;
  switch (props.ratio) {
    case 'square':
      return { width: 1, height: 1 };
    case 'portrait':
      return { width: 2, height: 3 };
    case 'landscape':
      return { width: 3, height: 2 };
    case 'panoramic':
      return { width: 16, height: 9 };
    default:
      newDimensions = props.ratio.split('x').map((value) => parseInt(value, 10));
      return { width: newDimensions[0], height: newDimensions[1] };
  }
});
</script>

<template>
  <img
    v-if="/^([0-9]+)x([0-9]+)$/i.test(ratio)"
    :id="id"
    :src="src"
    :alt="alt"
    :class="className"
    :itemprop="itemProp"
    :width="dimensions.width"
    :height="dimensions.height"
    :loading="lazy ? 'lazy' : undefined"
  >
  <div
    v-else
    :id="id"
    :class="className"
  >
    <img
      :src="src"
      :alt="alt"
      :itemprop="itemProp"
      :width="dimensions.width"
      :height="dimensions.height"
      :loading="lazy ? 'lazy' : undefined"
    >
  </div>
</template>
