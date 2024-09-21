<!--
  Responsive grid, used for design integration.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Grid.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { buildClass } from '@perseid/ui';
import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Grid props.
 */
export interface GridProps {
  /** Number of columns to display for each resolution. */
  columns: { mobile: number; tablet: number; desktop: number; };
}

const keyDownEventOptions = { capture: true };
const css = `
.design-grid {
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: none;
  z-index: 1000;
  position: fixed;
  pointer-events: none;
  padding: 0 var(--gaps-2);
  column-gap: var(--gaps-1);
}

.design-grid__column {
  display: none;
  flex: 1 1 auto;
  background: rgba(255, 0, 0, 0.1);
}

.design-grid__column[class*=mobile] {
  display: block;
}

.design-grid[class*=visible] {
  display: flex;
}

@media screen and (min-width: 768px) {
  .design-grid {
    padding: 0 var(--gaps-3);
    column-gap: var(--gaps-2);
  }

  .design-grid__column[class*=tablet] {
    display: block;
  }
}

@media screen and (min-width: 992px) {
  .design-grid {
    padding: 0 var(--gaps-4);
    column-gap: var(--gaps-3);
  }

  .design-grid__column[class*=desktop] {
    display: block;
  }
}
`;

defineProps<GridProps>();
const displayGrid = ref(false);

const toggleGrid = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key === 'm') {
    displayGrid.value = !displayGrid.value;
  }
};

onMounted(() => {
  const style = document.createElement('style');
  style.setAttribute('type', 'text/css');
  style.innerHTML = css;
  document.head.appendChild(style);
  window.addEventListener('keydown', toggleGrid, keyDownEventOptions);
});

onUnmounted(() => {
  window.removeEventListener('keydown', toggleGrid, keyDownEventOptions);
});
</script>

<template>
  <div :class="buildClass('design-grid', displayGrid ? 'visible' : '')">
    <div
      v-for="(device, index) in new Array(columns.desktop).fill(null).map((_, index) => {
        let device = 'mobile';
        if (index >= columns.tablet) {
          device = 'desktop';
        } else if (index > columns.mobile) {
          device = 'tablet';
        }
        return device;
      })"
      :key="index"
      :class="buildClass('design-grid__column', device)"
    />;
  </div>
</template>
