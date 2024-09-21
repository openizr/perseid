<!-- File picker. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { ref, computed, watch } from 'vue';
import UIIcon from 'scripts/vue/UIIcon.vue';
import { markdown, buildClass, generateRandomId } from 'scripts/core/index';

type FocusEventHandler = (value: File | File[], event: FocusEvent) => void;
type ChangeEventHandler = (value: File | File[], event: InputEvent) => void;

const toArray = (newValue: File | File[]): File[] => (Array.isArray(newValue)
  ? newValue
  : [newValue]);

const props = withDefaults(defineProps<{
  id?: string;
  name: string;
  accept?: string;
  icon?: string;
  multiple?: boolean;
  iconPosition?: 'left' | 'right';
  value?: File | File[];
  label?: string;
  helper?: string;
  modifiers?: string;
  disabled?: boolean;
  placeholder?: string;
  onBlur?: FocusEventHandler;
  onFocus?: FocusEventHandler;
  onChange?: ChangeEventHandler;
}>(), {
  modifiers: '',
  id: undefined,
  icon: undefined,
  value: () => [],
  disabled: false,
  label: undefined,
  accept: undefined,
  helper: undefined,
  iconPosition: 'left',
  placeholder: undefined,
  onBlur: undefined,
  onFocus: undefined,
  onChange: undefined,
});

const randomId = ref(generateRandomId());
const currentValue = ref(toArray(props.value));
const className = computed(() => buildClass('ui-file-picker', `${props.modifiers}${props.multiple ? ' multiple' : ''}${props.disabled ? ' disabled' : ''}`));
const currentPlaceholder = computed(() => ((currentValue.value.length > 0)
  ? currentValue.value.map((file) => file.name).join(', ')
  : props.placeholder));

// -------------------------------------------------------------------------------------------------
// CALLBACKS DECLARATION.
// -------------------------------------------------------------------------------------------------

const handleChange = (event: Event): void => {
  if (!props.disabled) {
    const files = [];
    const target = event.target as HTMLInputElement;
    const numberOfFiles = (target.files as unknown as FileList).length;
    for (let index = 0; index < numberOfFiles; index += 1) {
      files.push((target.files as unknown as FileList)[index]);
    }
    currentValue.value = files;
    if (props.onChange !== undefined) {
      props.onChange(props.multiple ? files : files[0], event as InputEvent);
    }
  }
};

const handleFocus = (event: FocusEvent): void => {
  if (props.onFocus !== undefined && !props.disabled) {
    props.onFocus(props.multiple ? currentValue.value : currentValue.value[0], event);
  }
};

const handleBlur = (event: FocusEvent): void => {
  if (props.onBlur !== undefined && !props.disabled) {
    props.onBlur(props.multiple ? currentValue.value : currentValue.value[0], event);
  }
};

// -------------------------------------------------------------------------------------------------
// PROPS REACTIVITY MANAGEMENT.
// -------------------------------------------------------------------------------------------------

// Updates current value whenever `value` prop changes.
watch(() => props.value, () => {
  currentValue.value = toArray(props.value);
});
</script>

<template>
  <div
    :id="id"
    :class="className"
  >
    <label
      v-if="label !== undefined"
      :for="randomId"
      class="ui-file-picker__label"
      v-html="markdown(label)"
    />
    <div class="ui-file-picker__wrapper">
      <UIIcon
        v-if="icon !== undefined && iconPosition !== 'right'"
        :name="icon"
      />
      <input
        :id="randomId"
        type="file"
        :name="name"
        :accept="accept"
        :multiple="multiple"
        class="ui-file-picker__wrapper__field"
        :tabindex="disabled ? -1 : 0"
        @change="handleChange"
        @blur="handleBlur"
        @focus="handleFocus"
      >
      <UIIcon
        v-if="icon !== undefined && iconPosition === 'right'"
        :name="icon"
      />
      <span class="ui-file-picker__wrapper__placeholder">
        {{ currentPlaceholder }}
      </span>
    </div>
    <span
      v-if="helper !== undefined"
      class="ui-file-picker__helper"
      v-html="markdown(helper)"
    />
  </div>
</template>
