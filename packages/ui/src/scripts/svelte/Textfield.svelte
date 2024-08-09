<!-- Text field. -->
<script lang="ts">
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { tick } from 'svelte';
import UIIcon from 'scripts/svelte/Icon.svelte';
import markdown from 'scripts/core/markdown';
import buildClass from 'scripts/core/buildClass';
import generateRandomId from 'scripts/core/generateRandomId';

type KeyType = 'default' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey';
type AllowedKeys = Partial<Record<KeyType, RegExp>>;
type Transform = (value: string, selectionStart: number) => [string, number?];

const defaultTransform: Transform = (newValue) => [newValue];
const keyTypes: KeyType[] = ['default', 'ctrlKey', 'altKey', 'shiftKey', 'metaKey'];
const specialKeysRegexp = /Tab|Control|Shift|Meta|ContextMenu|Alt|Escape|Insert|Home|End|AltGraph|NumLock|Backspace|Delete|Enter|ArrowRight|ArrowLeft|ArrowDown|ArrowUp/;

export let name: string;
export let modifiers = '';
export let readonly = false;
export let autofocus = false;
export let debounceTimeout = 50;
export let value: string | number = '';
export let allowedKeys: AllowedKeys = {};
export let autocomplete: 'on' | 'off' = 'off';
export let id: string | undefined = undefined;
export let min: number | undefined = undefined;
export let max: number | undefined = undefined;
export let step: number | undefined = undefined;
export let size: number | undefined = undefined;
export let icon: string | undefined = undefined;
export let label: string | undefined = undefined;
export let disabled: boolean | undefined = false;
export let helper: string | undefined = undefined;
export let iconPosition: 'left' | 'right' = 'left';
export let maxlength: number | undefined = undefined;
export let placeholder: string | undefined = undefined;
export let transform: Transform | undefined = defaultTransform;
export let type: 'text' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'url' = 'text';
export let onFocus: ((newValue: string, event: FocusEvent) => void) | undefined = undefined;
export let onBlur: ((newValue: string, event: FocusEvent) => void) | undefined = undefined;
export let onPaste: ((newValue: string, event: ClipboardEvent) => void) | undefined = undefined;
export let onChange: ((newValue: string, event: InputEvent) => void) | undefined = undefined;
export let onKeyDown: ((newValue: string, event: KeyboardEvent) => void) | undefined = undefined;
export let onIconKeyDown: ((event: KeyboardEvent) => void) | undefined = undefined;
export let onIconClick: ((event: MouseEvent) => void) | undefined = undefined;

let userIsTyping = false;
const randomId = generateRandomId();
let timeout: number | null = null;
let cursorPosition: number | null = null;
let inputRef: HTMLInputElement | null = null;
let currentValue = (transform as unknown as Transform)(String(value), 0)[0];

// Enforces props default values.
$: transform = transform ?? defaultTransform;
$: value = (value as string | undefined) ?? '';
$: type = (type as 'text' | undefined) ?? 'text';
$: modifiers = (modifiers as string | undefined) ?? '';
$: readonly = (readonly as boolean | undefined) ?? false;
$: autofocus = (autofocus as boolean | undefined) ?? false;
$: autocomplete = (autocomplete as 'on' | undefined) ?? 'on';
$: allowedKeys = (allowedKeys as AllowedKeys | undefined) ?? {};
$: debounceTimeout = (debounceTimeout as number | undefined) ?? 0;
$: iconPosition = (iconPosition as 'right' | 'left' | undefined) ?? 'left';

$: tabIndex = disabled ? -1 : 0;
$: className = buildClass('ui-textfield', `${modifiers}${disabled ? ' disabled' : ''}`);
// Memoizes global version of allowed keys RegExps (required for filtering out a whole text).
$: globalAllowedKeys = keyTypes.reduce<AllowedKeys>((allAllowedKeys, keyType) => {
  const allowedKeysForType = allowedKeys[keyType];
  return {
    ...allAllowedKeys,
    [keyType]: (allowedKeysForType !== undefined)
      ? new RegExp(allowedKeysForType.source, `${allowedKeysForType.flags}g`)
      : null,
  };
}, {});

// -------------------------------------------------------------------------------------------------
// CALLBACKS DECLARATION.
// -------------------------------------------------------------------------------------------------

// Re-positions cursor at the right place when using transform function.
const updateCursorPosition = async () => {
  await tick();
  if (/^(url|text|tel|search|password)$/.test(type) && inputRef as unknown !== null) {
    (inputRef as HTMLInputElement).selectionStart = cursorPosition;
    (inputRef as HTMLInputElement).selectionEnd = cursorPosition;
  }
};

const handleChange = (event: Event, filter = true): void => {
  if (!disabled && !readonly) {
    clearTimeout(timeout as unknown as number);
    userIsTyping = true;
    const target = event.target as HTMLInputElement;
    const selectionStart = target.selectionStart as unknown as number;
    const filteredValue = (filter && globalAllowedKeys.default as unknown !== null)
      ? (target.value.match(globalAllowedKeys.default as unknown as string) ?? []).join('')
      : target.value;
    const [newValue, newCursorPosition] = (transform as unknown as Transform)(
      filteredValue,
      selectionStart,
    );
    if (newCursorPosition !== undefined) {
      cursorPosition = newCursorPosition;
    } else {
      const isAtTheEnd = selectionStart >= currentValue.length;
      cursorPosition = isAtTheEnd ? newValue.length : selectionStart;
    }
    // We need to force the input value to prevent the component from getting uncontrolled.
    if (newValue === currentValue) {
      target.value = currentValue;
    } else {
      currentValue = newValue;
    }
    // This debounce system prevents triggering `onChange` callback too many times when user is
    // still typing to improve performance and make UI more reactive on low-perfomance devices.
    timeout = setTimeout(() => {
      userIsTyping = false;
      if (onChange !== undefined) {
        onChange(newValue, event as InputEvent);
      }
    }, debounceTimeout) as unknown as number;
    (updateCursorPosition as unknown as () => void)();
  }
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (!disabled && !readonly) {
    let allowedKeysForEvent = allowedKeys.default;
    if (event.ctrlKey) {
      allowedKeysForEvent = allowedKeys.ctrlKey;
    } else if (event.shiftKey) {
      allowedKeysForEvent = allowedKeys.shiftKey;
    } else if (event.altKey) {
      allowedKeysForEvent = allowedKeys.altKey;
    } else if (event.metaKey) {
      allowedKeysForEvent = allowedKeys.metaKey;
    }
    if (
      allowedKeysForEvent !== undefined
      && !allowedKeysForEvent.test(event.key)
      && !specialKeysRegexp.test(event.key)
    ) {
      event.preventDefault();
    } else if (onKeyDown !== undefined) {
      onKeyDown(currentValue, event);
    }
  }
};

const handlePaste = (event: ClipboardEvent): void => {
  if (!disabled && !readonly) {
    const clipboardData = event.clipboardData as unknown as DataTransfer;
    // `selectionStart` and `selectionEnd` do not exist on inputs with type `number`, so we just
    // want to replace the entire content when pasting something in that case.
    const selectionStart = (event.target as HTMLInputElement).selectionStart as unknown as number;
    const selectionEnd = (event.target as HTMLInputElement).selectionEnd ?? currentValue.length;
    const filteredValue = (globalAllowedKeys.default as unknown !== null)
      ? (clipboardData.getData('text').match(globalAllowedKeys.default as unknown as string) ?? []).join('')
      : clipboardData.getData('text');
    handleChange({
      target: {
        value: `${currentValue.slice(0, selectionStart)}${filteredValue}${currentValue.slice(selectionEnd)}`,
        selectionStart: selectionStart + filteredValue.length,
      },
    } as unknown as InputEvent, false);
    event.preventDefault();
    if (onPaste !== undefined) {
      onPaste(currentValue, event);
    }
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

const handleIconClick = (event: MouseEvent): void => {
  if (onIconClick !== undefined && !disabled) {
    onIconClick(event);
  }
};

const handleIconKeyDown = (event: KeyboardEvent): void => {
  if (onIconKeyDown !== undefined && !disabled) {
    onIconKeyDown(event);
  }
};

// -------------------------------------------------------------------------------------------------
// PROPS REACTIVITY MANAGEMENT.
// -------------------------------------------------------------------------------------------------

// Updates current value whenever `value` and `transform` props change.
const updateValue = (updatedValue: string, updatedTransform: Transform) => {
  // Do not update current value immediatly while user is typing something else.
  if (!userIsTyping) {
    const [newValue] = updatedTransform(String(updatedValue), 0);
    currentValue = newValue;
    (updateCursorPosition as unknown as () => void)();
  }
};
$: updateValue(String(value), transform as unknown as Transform);
</script>

<!-- svelte-ignore a11y-autofocus a11y-interactive-supports-focus -->
<div
id={id}
  class={className}
>
  {#if label !== undefined}
    <label for={randomId} class="ui-textfield__label">
      {@html markdown(label)}
    </label>
  {/if}
  <div class="ui-textfield__wrapper">
    {#if icon !== undefined && iconPosition === 'left'}
      <span
        tabIndex="0"
        role="button"
        class="ui-textfield__wrapper__icon"
        on:click={handleIconClick}
        on:keydown={handleIconKeyDown}
      >
        <UIIcon name={icon} />
      </span>
    {/if}
    <input
      max={max}
      min={min}
      name={name}
      step={step}
      size={size}
      type={type}
      id={randomId}
      readonly={readonly}
      bind:this={inputRef}
      on:blur={handleBlur}
      value={currentValue}
      maxlength={maxlength}
      autofocus={autofocus}
      disabled={disabled}
      tabindex={tabIndex}
      on:focus={handleFocus}
      placeholder={placeholder}
      autocomplete={autocomplete}
      class="ui-textfield__wrapper__field"
      on:paste={handlePaste}
      on:input={handleChange}
      on:keydown={handleKeyDown}
    >
    {#if icon !== undefined && iconPosition === 'right'}
      <span
        tabIndex="0"
        role="button"
        class="ui-textfield__wrapper__icon"
        on:click={handleIconClick}
        on:keydown={handleIconKeyDown}
      >
        <UIIcon name={icon} />
      </span>
    {/if}
  </div>
  {#if helper !== undefined}
    <span class="ui-textfield__helper">
      {@html markdown(helper)}
    </span>
  {/if}
</div>
