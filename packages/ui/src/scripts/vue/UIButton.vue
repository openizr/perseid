<!-- Button. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { computed } from 'vue';
import UIIcon from 'scripts/vue/UIIcon.vue';
import { buildClass } from 'scripts/core/index';

type MouseEventHandler = (event: MouseEvent) => void;
type FocusEventHandler = (event: FocusEvent) => void;

const props = withDefaults(defineProps<{
  id?: string;
  label?: string;
  icon?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  iconPosition?: 'left' | 'right';
  modifiers?: string;
  onClick?: MouseEventHandler;
  onFocus?: FocusEventHandler;
}>(), {
  modifiers: '',
  id: undefined,
  disabled: false,
  icon: undefined,
  type: 'button',
  label: undefined,
  onClick: undefined,
  onFocus: undefined,
  iconPosition: 'left',
});

const className = computed(() => {
  const iconModifier = (props.icon !== undefined && props.label === undefined) ? ' icon' : '';
  return buildClass('ui-button', `${props.modifiers}${iconModifier}${props.disabled ? ' disabled' : ''}`);
});

// -----------------------------------------------------------------------------------------------
// CALLBACKS DECLARATION.
// -----------------------------------------------------------------------------------------------

const handleFocus = (event: FocusEvent): void => {
  if (props.onFocus !== undefined && !props.disabled) {
    props.onFocus(event);
  }
};

const handleClick = (event: MouseEvent): void => {
  if (props.onClick !== undefined && !props.disabled) {
    props.onClick(event);
  }
};
</script>

<template>
  <button
    :id="id"
    :type="type"
    :class="className"
    :tabIndex="(disabled ? -1 : 0)"
    @click="(handleClick as MouseEventHandler)"
    @focus="(handleFocus as FocusEventHandler)"
  >
    <UIIcon
      v-if="icon !== undefined && iconPosition === 'left'"
      :name="icon"
    />
    <span
      v-if="(label !== undefined)"
      class="ui-button__label"
    >{{ label }}</span>
    <UIIcon
      v-if="icon !== undefined && iconPosition === 'right'"
      :name="icon"
    />
  </button>
</template>
