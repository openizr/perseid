<!-- Hyperlink. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { computed } from 'vue';
import { markdown, buildClass } from 'scripts/core/index';

type ClickEventHandler = (event: MouseEvent) => void;

const props = withDefaults(defineProps<{
  id?: string;
  label: string;
  rel?: string;
  target?: string;
  href: string;
  disabled?: boolean;
  modifiers?: string;
  onClick?: ClickEventHandler;
}>(), {
  modifiers: '',
  id: undefined,
  rel: undefined,
  disabled: false,
  target: undefined,
  onClick: undefined,
});

const className = computed(() => buildClass('ui-link', `${props.modifiers}${props.disabled ? ' disabled' : ''}`));

// -----------------------------------------------------------------------------------------------
// CALLBACKS DECLARATION.
// -----------------------------------------------------------------------------------------------

const handleClick = (event: MouseEvent): void => {
  if (props.onClick !== undefined && !props.disabled) {
    props.onClick(event);
  }
};
</script>

<template>
  <a
    :id="id"
    :rel="rel"
    :href="href"
    :class="className"
    :target="target"
    :tabIndex="(disabled ? -1 : 0)"
    @click="handleClick"
    v-html="markdown(props.label)"
  />
</template>
