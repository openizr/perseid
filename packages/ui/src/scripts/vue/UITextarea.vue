<!-- Text area. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { computed, ref, watch } from 'vue';
import markdown from 'scripts/core/markdown';
import buildClass from 'scripts/core/buildClass';
import generateRandomId from 'scripts/core/generateRandomId';

type FocusEventHandler = (value: string, event: FocusEvent) => void;
type ChangeEventHandler = (value: string, event: InputEvent) => void;
type KeyboardEventHandler = (value: string, event: KeyboardEvent) => void;
type ClipboardEventHandler = (value: string, event: ClipboardEvent) => void;

const props = withDefaults(defineProps<{
  id?: string;
  cols?: number;
  rows?: number;
  name: string;
  label?: string;
  helper?: string;
  readonly?: boolean;
  maxlength?: number;
  modifiers?: string;
  autofocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  value?: string | number;
  autocomplete?: 'on' | 'off';
  autoresize?: boolean;
  debounceTimeout?: number;
  onFocus?: FocusEventHandler;
  onBlur?: FocusEventHandler;
  onPaste?: ClipboardEventHandler;
  onChange?: ChangeEventHandler;
  onKeyDown?: KeyboardEventHandler;
}>(), {
  value: '',
  modifiers: '',
  id: undefined,
  readonly: false,
  cols: undefined,
  rows: undefined,
  name: undefined,
  autofocus: false,
  disabled: false,
  label: undefined,
  autoresize: false,
  helper: undefined,
  autocomplete: 'off',
  debounceTimeout: 50,
  maxlength: undefined,
  placeholder: undefined,
  onFocus: undefined,
  onBlur: undefined,
  onChange: undefined,
  onPaste: undefined,
  onKeyDown: undefined,
});

const timeout = ref(null);
const isUserTyping = ref(false);
const randomId = ref(generateRandomId());
const currentValue = ref(`${props.value}`);
const actualRows = computed(() => ((props.autoresize && props.rows === undefined)
  ? Math.max(1, currentValue.value.split('\n').length)
  : props.rows));
const className = computed(() => buildClass('ui-textarea', `${props.modifiers}${props.disabled ? ' disabled' : ''}`));

// -------------------------------------------------------------------------------------------------
// CALLBACKS DECLARATION.
// -------------------------------------------------------------------------------------------------

const handleChange = (event: InputEvent): void => {
  if (!props.disabled) {
    clearTimeout(timeout.value);
    isUserTyping.value = true;
    const newValue = (event.target as HTMLTextAreaElement).value;
    currentValue.value = newValue;
    // This debounce system prevents triggering `onChange` callback too many times when user is
    // still typing to save performance and make the UI more reactive on low-perfomance devices.
    timeout.value = setTimeout(() => {
      isUserTyping.value = false;
      if (props.onChange !== undefined) {
        props.onChange(newValue, event);
      }
    }, props.debounceTimeout);
  }
};

// -------------------------------------------------------------------------------------------------
// PROPS REACTIVITY MANAGEMENT.
// -------------------------------------------------------------------------------------------------

// Updates current value whenever `value` prop changes.
watch(() => props.value, () => {
  // Do not update current value immediatly while user is typing something else.
  if (!isUserTyping.value) {
    currentValue.value = `${props.value}`;
  }
});
</script>

<template>
  <div
    :id="id"
    :class="className"
  >
    <label
      v-if="label !== undefined"
      class="ui-textarea__label"
      :for="randomId"
      v-html="markdown(props.label)"
    />
    <div class="ui-textarea__wrapper">
      <textarea
        :id="randomId"
        :value="currentValue"
        :name="name"
        :cols="cols"
        :rows="actualRows"
        :autofocus="autofocus"
        class="ui-textarea__wrapper__field"
        :readonly="readonly"
        :maxlength="maxlength"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :disabled="disabled"
        :tabindex="disabled ? -1 : 0"
        @blur="onBlur !== undefined && !disabled && onBlur(currentValue, $event)"
        @focus="onFocus !== undefined && !disabled && onFocus(currentValue, $event)"
        @input="!readonly ? handleChange($event) : undefined"
        @paste="(!readonly && onPaste !== undefined && !disabled)
          ? onPaste(currentValue, $event) : undefined"
        @keydown="(!readonly && !disabled && onKeyDown !== undefined)
          ? onKeyDown(currentValue, $event) : undefined"
      />
    </div>
    <span
      v-if="helper !== undefined"
      class="ui-textarea__helper"
      v-html="markdown(props.helper)"
    />
  </div>
</template>
