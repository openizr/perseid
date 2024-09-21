<!-- Set of selectable options. -->
<script lang="ts">
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { markdown, buildClass, generateRandomId } from 'scripts/core/index';

interface UIOptionsOption {
  type: 'option';
  value: string;
  label: string;
  disabled?: boolean;
  modifiers?: string;
}

interface UIOptionsHeader {
  type: 'header';
  label: string;
  modifiers?: string;
}

interface UIOptionsDivider {
  type: 'divider';
  modifiers?: string;
}

type Option = UIOptionsDivider | UIOptionsOption | UIOptionsHeader;
type ChangeEventHandler = (value: string | string[], event: InputEvent) => void;

const toArray = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value]);

export let name: string;
export let modifiers = '';
export let select = false;
export let multiple = false;
export let expanded = false;
export let options: Option[];
export let placeholder = '';
export let value: string | string[] = [];
export let id: string | undefined = undefined;
export let label: string | undefined = undefined;
export let helper: string | undefined = undefined;
export let disabled: boolean | undefined = false;
export let selectPosition: 'top' | 'bottom' | undefined = undefined;
export let onFocus: ((newValue: string, event: FocusEvent) => void) | undefined = undefined;
export let onChange: ChangeEventHandler | undefined = undefined;

let mounted = false;
let isFocused = false;
let position = 'bottom';
let isDisplayed = false;
let focusedOptionIndex = -1;
let currentValue = toArray(value);
const randomId = generateRandomId();
let buttonRef: HTMLElement | null;
let wrapperRef: HTMLElement | null;

// Enforces props default values.
$: value = (value as string[] | undefined) ?? [];
$: select = (select as boolean | undefined) ?? false;
$: modifiers = (modifiers as string | undefined) ?? '';
$: multiple = (multiple as boolean | undefined) ?? false;

$: className = buildClass(
  'ui-options',
  `${modifiers}${select ? ' select' : ''}${multiple ? ' multiple' : ''}${disabled ? ' disabled' : ''}`,
);
// Memoizes all options' parsed labels to optimize rendering.
$: optionParsedLabels = options.reduce<Record<string, string>>((mapping, option, index) => {
  if (option.type === 'option') {
    return { ...mapping, [option.value]: markdown(option.label) };
  }
  if (option.type === 'header') {
    return { ...mapping, [`header_${String(index)}`]: markdown(option.label) };
  }
  return mapping;
}, {});

// -----------------------------------------------------------------------------------------------
// CALLBACKS DECLARATION.
// -----------------------------------------------------------------------------------------------

// Updates the `isFocused` ref when blurring options.
const handleBlur = (): void => {
  isFocused = false;
};

// In `select` mode only, displays the options list at the right place on the viewport.
const displayList = (): void => {
  if (buttonRef !== null && !disabled) {
    if (selectPosition !== undefined) {
      position = selectPosition;
    } else {
      const relativeOffsetTop = buttonRef.getBoundingClientRect().top;
      position = relativeOffsetTop > window.innerHeight / 2 ? 'top' : 'bottom';
    }
    isDisplayed = true;
  }
};

// In `select` mode only, hides the options list only if forced or if focus is lost.
const hideList = (force = false) => (event: FocusEvent | null): void => {
  // We first ensure that the newly focused element is not an option of the list.
  const focusIsOutsideList = event !== null && wrapperRef !== null
    ? !wrapperRef.contains(event.relatedTarget as Node)
    : true;
  if (focusIsOutsideList && (force || !multiple)) {
    handleBlur();
    isDisplayed = expanded || false;
  }
};

// Finds the direct previous or next option when navigating with keyboard.
const findSiblingOption = (
  startIndex: number,
  direction: number,
  offset = 1,
): number => {
  const nextIndex = startIndex + direction * offset;
  if (nextIndex < 0 || nextIndex >= options.length) {
    return startIndex;
  }
  const option = options[nextIndex];
  return option.type === 'option' && !option.disabled
    ? nextIndex
    : findSiblingOption(startIndex, direction, offset + 1);
};

// Automatically triggered when a `focus` event is fired.
const handleFocus = (optionValue: string, optionIndex: number) => (event: FocusEvent): void => {
  if (!disabled) {
    isFocused = true;
    focusedOptionIndex = optionIndex;
    if (onFocus !== undefined) {
      onFocus(optionValue, event);
    }
  }
};

// Manually triggered, used to simulate `focus` events (`select` mode).
const focusOption = (optionIndex: number): void => {
  const refNode = wrapperRef;
  if (
    refNode !== null
    && optionIndex < refNode.childNodes.length
    && optionIndex >= 0
  ) {
    (refNode.childNodes[optionIndex] as HTMLElement).focus();
  }
};

// Automatically triggered when a `change` event is fired.
const handleChange = (event: Event): void => {
  if (!disabled) {
    const target = (event.target as HTMLInputElement);
    const selectedIndex = currentValue.indexOf(target.value);
    let newValue = [target.value];
    if (multiple) {
      newValue = selectedIndex >= 0
        ? currentValue
          .slice(0, selectedIndex)
          .concat(currentValue.slice(selectedIndex + 1))
        : currentValue.concat([target.value]);
    }
    // If the value hasn't changed, we don't trigger anything.
    if (multiple || newValue[0] !== currentValue[0]) {
      currentValue = newValue;
      if (onChange !== undefined) {
        onChange(multiple ? newValue : newValue[0], event as InputEvent);
      }
    }
  }
};

// Manually triggered, used to simulate `change` events (`select` mode).
const changeOption = (optionIndex: number) => (): void => {
  if (!disabled) {
    focusedOptionIndex = optionIndex;
    const optionValue = (options[optionIndex] as UIOptionsOption).value;
    handleChange({ target: { value: optionValue } } as unknown as InputEvent);
    if (select) {
      hideList()(null);
    }
  }
};

// -----------------------------------------------------------------------------------------------
// KEYBOARD NAVIGATION.
// -----------------------------------------------------------------------------------------------

// Handles keyboard navigation amongst options.
const handleKeydown = (event: KeyboardEvent): void => {
  if (!disabled) {
    const { key } = event;
    const navigationControls: Record<string, () => number> = {
      ArrowUp: () => findSiblingOption(focusedOptionIndex, -1),
      ArrowLeft: () => findSiblingOption(focusedOptionIndex, -1),
      ArrowDown: () => findSiblingOption(focusedOptionIndex, +1),
      ArrowRight: () => findSiblingOption(focusedOptionIndex, +1),
      PageUp: () => Math.max(0, findSiblingOption(-1, +1)),
      Home: () => Math.max(0, findSiblingOption(-1, +1)),
      PageDown: () => Math.min(options.length - 1, findSiblingOption(options.length, -1)),
      End: () => Math.min(options.length - 1, findSiblingOption(options.length, -1)),
    };

    const siblingOption = navigationControls[key];
    if (siblingOption as unknown !== undefined) {
      // User is navigating through options...
      if (isDisplayed || !select) {
        focusOption(siblingOption());
      } else {
        changeOption(siblingOption())();
      }
      // `event.preventDefault` is not called globally to avoid overriding `Tab` behaviour.
      event.preventDefault();
    } else if (key === ' ' || key === 'Enter') {
      // User wants to select / unselect an option...
      if (!isDisplayed && select) {
        isDisplayed = true;
      } else {
        changeOption(focusedOptionIndex)();
      }
      event.preventDefault();
    } else if (key === 'Escape') {
      // User wants to hide list (`select` mode)...
      hideList(true)(null);
      event.preventDefault();
    }
  }
};

// -----------------------------------------------------------------------------------------------
// PROPS REACTIVITY MANAGEMENT.
// -----------------------------------------------------------------------------------------------

// Updates `firstSelectedOption` ref whenever `currentValue` changes.
let firstSelectedOption = -1;
$: {
  if (currentValue.length === 0) {
    firstSelectedOption = findSiblingOption(-1, 1);
  }
  firstSelectedOption = Math.max(
    0,
    options.findIndex((option) => option.type === 'option' && currentValue.includes(option.value)),
  );
}

// Updates current value whenever `value` property changes.
$: currentValue = toArray(value);

// Updates select visibility whenever `expanded` property changes.
$: isDisplayed = expanded;

// Updates current value whenever `multiple` property changes.
const updateCurrentValue = (newMultiple: boolean) => {
  currentValue = (newMultiple || currentValue.length === 0)
    ? currentValue
    : [currentValue[0]];
};
$: updateCurrentValue(multiple);

// Re-focuses the right option whenever `options` property changes, to avoid out of range focus.
const updateFocus = (newOptions: Option[]): void => {
  if (isFocused && newOptions as unknown) {
    focusOption(firstSelectedOption);
  }
};
$: updateFocus(options);

// HTML elements with `display: none` can't be focused. Thus, we need to wait for the HTML list to
// be displayed before actually focusing it (`select` mode).
const updateSelectFocus = (newMounted: boolean, newIsDisplayed: boolean): void => {
  if (newMounted) {
    setTimeout(() => {
      if (wrapperRef as unknown !== undefined && select && newIsDisplayed && !expanded) {
        focusOption(firstSelectedOption);
      } else if (!newIsDisplayed && buttonRef !== null && !expanded) {
        buttonRef.focus();
      }
    }, 10);
  }
  mounted = true;
};
$: updateSelectFocus(mounted, isDisplayed);
$: onlyOptions = options.filter((option) => option.type === 'option');
</script>

{#if select}
  <div {id} class={className}>
    {#if label !== undefined}
      <label for={randomId} class="ui-options__label">
        {@html markdown(label)}
      </label>
    {/if}
    <div class="ui-options__wrapper">
      <button
        id={randomId}
        bind:this={buttonRef}
        {name}
        type="button"
        aria-haspopup="listbox"
        tabindex={disabled ? -1 : 0}
        class="ui-options__wrapper__button"
        aria-labelledby={`${randomId} ${randomId}`}
        on:keydown={handleKeydown}
        on:mousedown={displayList}
        on:focus={handleFocus('', firstSelectedOption)}
      >
        {@html (currentValue.length === 0)
          ? placeholder
          : currentValue.map((optionValue) => optionParsedLabels[optionValue]).join(', ')
        }
      </button>
      <svelte:element
        this={'ul'}
        bind:this={wrapperRef}
        tabindex="-1"
        role="listbox"
        aria-labelledby={randomId}
        aria-expanded={isDisplayed}
        aria-multiselectable={multiple}
        aria-activedescendant={`${randomId}${String(focusedOptionIndex)}`}
        class={buildClass('ui-options__wrapper__list', isDisplayed ? `${position} expanded` : position)}
        on:keydown={handleKeydown}
      >
        {#each options as option, index (`${randomId}${String(index)}`)}
          <li
            id={`${randomId}${String(index)}`}
            tabindex="-1"
            role={option.type === 'option' ? 'option' : undefined}
            aria-selected={option.type === 'option' && currentValue.includes(option.value)}
            class={buildClass(
              `ui-options__wrapper__list__${option.type}`,
              `${option.modifiers ?? ''}${option.type === 'option' && option.disabled
                ? ' disabled' : ''}${(option.type === 'option' && currentValue.includes(option.value)) ? ' checked' : ''}`,
            )}
            on:blur={hideList(true)}
            on:mousedown={(option.type === 'option' && !option.disabled) ? changeOption(index) : undefined}
            on:focus={(option.type === 'option' && !option.disabled) ? handleFocus(option.value, index) : undefined}
          >
            {@html option.type === 'divider' ? '' : optionParsedLabels[option.type === 'option' ? option.value : `header_${String(index)}`]}
          </li>
        {/each}
      </svelte:element>
    </div>
    {#if helper !== undefined}
      <span class="ui-options__helper">
        {@html markdown(helper)}
      </span>
    {/if}
  </div>
{:else}
  <div {id} class={className}>
    {#if label !== undefined}
      <label for={`${randomId}_${String(Math.max(firstSelectedOption, 0))}`} class="ui-options__label">
        {@html markdown(label)}
      </label>
    {/if}
    <div bind:this={wrapperRef} class="ui-options__wrapper">
      {#each onlyOptions as option, index (`${randomId}${String(index)}`)}
        <label
          class={buildClass(
            'ui-options__wrapper__option',
            `${option.modifiers ?? ''}${option.disabled
              ? ' disabled' : ''}${currentValue.includes(option.value) ? ' checked' : ''}`,
          )}
        >
          <input
            id={`${randomId}_${String(index)}`}
            {name}
            checked={currentValue.includes(option.value)}
            type={multiple ? 'checkbox' : 'radio'}
            value={option.value}
            disabled={option.disabled}
            class="ui-options__wrapper__option__field"
            on:blur={handleBlur}
            on:change={handleChange}
            on:keydown={handleKeydown}
            on:focus={handleFocus(option.value, index)}
            tabindex={(
              !!option.disabled
              || !!disabled
              || !(((index === 0 || !multiple) && currentValue.length === 0)
              || option.value === currentValue[0]) ? -1 : 0
            )}
          />
          <span class="ui-options__wrapper__option__label">
            {@html optionParsedLabels[option.value]}
          </span>
        </label>
      {/each}
    </div>
    {#if helper !== undefined}
      <span class="ui-options__helper">
        {@html markdown(helper)}
      </span>
    {/if}
  </div>
{/if}
