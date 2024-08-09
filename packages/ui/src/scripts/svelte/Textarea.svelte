<!-- Text area. -->
<script lang="ts">
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import markdown from 'scripts/core/markdown';
import buildClass from 'scripts/core/buildClass';
import generateRandomId from 'scripts/core/generateRandomId';

export let name: string;
export let modifiers = '';
export let readonly = false;
export let autofocus = false;
export let autoresize = false;
export let debounceTimeout = 50;
export let value: string | number = '';
export let autocomplete: 'on' | 'off' = 'off';
export let id: string | undefined = undefined;
export let cols: number | undefined = undefined;
export let rows: number | undefined = undefined;
export let label: string | undefined = undefined;
export let disabled: boolean | undefined = false;
export let helper: string | undefined = undefined;
export let maxlength: number | undefined = undefined;
export let placeholder: string | undefined = undefined;
export let onFocus: ((newValue: string, event: FocusEvent) => void) | undefined = undefined;
export let onBlur: ((newValue: string, event: FocusEvent) => void) | undefined = undefined;
export let onPaste: ((newValue: string, event: ClipboardEvent) => void) | undefined = undefined;
export let onChange: ((newValue: string, event: InputEvent) => void) | undefined = undefined;
export let onKeyDown: ((newValue: string, event: KeyboardEvent) => void) | undefined = undefined;

let currentValue = String(value);
let isUserTyping = false;
let timeout: number | null = null;
const randomId = generateRandomId();

// Enforces props default values.
$: value = (value as string | undefined) ?? '';
$: modifiers = (modifiers as string | undefined) ?? '';
$: readonly = (readonly as boolean | undefined) ?? false;
$: autofocus = (autofocus as boolean | undefined) ?? false;
$: autoresize = (autoresize as boolean | undefined) ?? false;
$: autocomplete = (autocomplete as 'on' | undefined) ?? 'on';
$: debounceTimeout = (debounceTimeout as number | undefined) ?? 0;

$: tabIndex = disabled ? -1 : 0;
$: className = buildClass('ui-textarea', `${modifiers}${disabled ? ' disabled' : ''}`);

// -------------------------------------------------------------------------------------------------
// CALLBACKS DECLARATION.
// -------------------------------------------------------------------------------------------------

const handleChange = (event: Event): void => {
  if (!disabled && !readonly) {
    clearTimeout(timeout as unknown as number);
    isUserTyping = true;
    const newValue = (event.target as HTMLTextAreaElement).value;
    currentValue = newValue;
    // This debounce system prevents triggering `onChange` callback too many times when user is
    // still typing to save performance and make the UI more reactive on low-perfomance devices.
    timeout = setTimeout(() => {
      isUserTyping = false;
      if (onChange !== undefined) {
        onChange(newValue, event as InputEvent);
      }
    }, debounceTimeout) as unknown as number;
  }
};

const handlePaste = (event: ClipboardEvent): void => {
  if (onPaste !== undefined && !disabled && !readonly) {
    onPaste(currentValue, event);
  }
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (onKeyDown !== undefined && !disabled && !readonly) {
    onKeyDown(currentValue, event);
  }
};

const handleBlur = (event: FocusEvent): void => {
  if (onBlur !== undefined && !disabled) {
    onBlur(currentValue, event);
  }
};

const handleFocus = (event: FocusEvent): void => {
  if (onFocus !== undefined && !disabled) {
    onFocus(currentValue, event);
  }
};

// -------------------------------------------------------------------------------------------------
// PROPS REACTIVITY MANAGEMENT.
// -------------------------------------------------------------------------------------------------

// Updates current value whenever `value` prop changes.
$: {
  // Do not update current value immediatly while user is typing something else.
  if (!isUserTyping) {
    currentValue = String(value);
  }
}
$: actualRows = (autoresize && rows === undefined) ? Math.max(1, currentValue.split('\n').length) : rows;
</script>

<!-- svelte-ignore a11y-autofocus -->
<div
  id={id}
  class={className}
>
  {#if label !== undefined}
    <label for={randomId} class="ui-textarea__label">
      {@html markdown(label)}
    </label>
  {/if}
  <div class="ui-textarea__wrapper">
    <textarea
      name={name}
      cols={cols}
      id={randomId}
      rows={actualRows}
      tabindex={tabIndex}
      readonly={readonly}
      on:blur={handleBlur}
      value={currentValue}
      maxlength={maxlength}
      autofocus={autofocus}
      disabled={disabled}
      on:focus={handleFocus}
      placeholder={placeholder}
      autocomplete={autocomplete}
      class="ui-textarea__wrapper__field"
      on:paste={handlePaste}
      on:input={handleChange}
      on:keydown={handleKeyDown}
    />
  </div>
  {#if helper !== undefined}
    <span class="ui-textarea__helper">
      {@html markdown(helper)}
    </span>
  {/if}
</div>
