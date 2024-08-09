<!-- Set of selectable options. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { ref, computed, watch } from 'vue';
import markdown from 'scripts/core/markdown';
import buildClass from 'scripts/core/buildClass';
import generateRandomId from 'scripts/core/generateRandomId';

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
type FocusEventHandler = (value: string, event: FocusEvent) => void;
type ChangeEventHandler = (value: string | string[], event: Event) => void;

const toArray = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value]);

const props = withDefaults(defineProps<{
  id?: string;
  name: string;
  label?: string;
  helper?: string;
  select?: boolean;
  options: Option[];
  expanded?: boolean;
  multiple?: boolean;
  modifiers?: string;
  disabled?: boolean;
  value?: string | string[];
  selectPosition?: 'top' | 'bottom';
  onFocus?: FocusEventHandler;
  onChange?: ChangeEventHandler;
}>(), {
  select: false,
  modifiers: '',
  id: undefined,
  multiple: false,
  label: undefined,
  helper: undefined,
  disabled: false,
  expanded: false,
  onFocus: undefined,
  onChange: undefined,
  selectPosition: undefined,
  value: [] as unknown as undefined,
});

const mounted = ref(false);
const isDisplayed = ref(false);
const isFocused = ref(false);
const position = ref('bottom');
const focusedOptionIndex = ref(-1);
const randomId = ref(generateRandomId());
const buttonRef = ref<HTMLElement>(null as unknown as HTMLElement);
const wrapperRef = ref<HTMLElement>(null as unknown as HTMLElement);
const currentValue = ref(toArray(props.value as unknown as string));
const className = computed(() => buildClass(
  'ui-options',
  `${props.modifiers}${props.select ? ' select' : ''}${props.multiple ? ' multiple' : ''}${props.disabled ? ' disabled' : ''}`,
));

// Memoizes all options' parsed labels to optimize rendering.
const optionParsedLabels = computed(() => props.options.reduce<Record<string, string>>(
  (mapping, option, index) => {
    if (option.type === 'option') {
      return { ...mapping, [option.value]: markdown(option.label) };
    }
    if (option.type === 'header') {
      return { ...mapping, [`header_${String(index)}`]: markdown(option.label) };
    }
    return mapping;
  },
  {},
));

const filteredOptions = computed(() => props.options.filter((option) => (
  option.type === 'option'
))) as unknown as UIOptionsOption[];

// -------------------------------------------------------------------------------------------------
// CALLBACKS DECLARATION.
// -------------------------------------------------------------------------------------------------

// Updates the `isFocused` ref when blurring options.
const handleBlur = (): void => {
  isFocused.value = false;
};

// In `select` mode only, displays the options list at the right place on the viewport.
const displayList = (): void => {
  if (!props.disabled) {
    if (props.selectPosition !== undefined) {
      position.value = props.selectPosition;
    } else {
      const relativeOffsetTop = (buttonRef.value as unknown as HTMLElement)
        .getBoundingClientRect().top;
      position.value = ((relativeOffsetTop > window.innerHeight / 2) ? 'top' : 'bottom');
    }
    isDisplayed.value = true;
  }
};

// In `select` mode only, hides the options list only if forced or if focus is lost.
const hideList = (event: FocusEvent | null, force = false): void => {
  // We first ensure that the newly focused element is not an option of the list.
  const focusIsOutsideList = (event !== null && wrapperRef.value as unknown !== null)
    ? !(wrapperRef.value as unknown as HTMLElement).contains(event.relatedTarget as Node)
    : true;
  if (focusIsOutsideList && (force || !props.multiple)) {
    handleBlur();
    isDisplayed.value = props.expanded || false;
  }
};

// Finds the direct previous or next option when navigating with keyboard.
const findSiblingOption = (startIndex: number, direction: number, offset = 1): number => {
  const nextIndex = startIndex + direction * offset;
  if (nextIndex < 0 || nextIndex >= props.options.length) {
    return startIndex;
  }
  const option = props.options[nextIndex];
  return (option.type === 'option' && !option.disabled)
    ? nextIndex
    : findSiblingOption(startIndex, direction, offset + 1);
};

// Automatically triggered when a `focus` event is fired.
const handleFocus = (optionValue: string, optionIndex: number, event: FocusEvent): void => {
  if (!props.disabled) {
    isFocused.value = true;
    focusedOptionIndex.value = optionIndex;
    if (props.onFocus !== undefined) {
      props.onFocus(optionValue, event);
    }
  }
};

// Manually triggered, used to simulate `focus` events (`select` mode).
const focusOption = (optionIndex: number): void => {
  const refNode = wrapperRef.value;
  // Vue sometimes adds an empty textNode between elements...
  const children = [...refNode.childNodes].filter((childNode) => childNode.nodeName !== '#text');
  if (refNode as unknown !== null && optionIndex < children.length && optionIndex >= 0) {
    (children[optionIndex] as unknown as HTMLElement).focus();
  }
};

// Automatically triggered when a `change` event is fired.
const handleChange = (event: Event): void => {
  if (!props.disabled) {
    const selectedIndex = currentValue.value.indexOf((event.target as HTMLInputElement).value);
    let newValue = [(event.target as HTMLInputElement).value];
    if (props.multiple) {
      newValue = (selectedIndex >= 0)
        ? currentValue.value.slice(0, selectedIndex)
          .concat(currentValue.value.slice(selectedIndex + 1))
        : currentValue.value.concat([(event.target as HTMLInputElement).value]);
    }
    // If the value hasn't changed, we don't trigger anything.
    if (props.multiple || newValue[0] !== currentValue.value[0]) {
      currentValue.value = newValue;
      if (props.onChange !== undefined) {
        props.onChange(props.multiple ? newValue : newValue[0], event);
      }
    }
  }
};

// Manually triggered, used to simulate `change` events (`select` mode).
const changeOption = (optionIndex: number): void => {
  if (!props.disabled) {
    focusedOptionIndex.value = optionIndex;
    const optionValue = (props.options[optionIndex] as UIOptionsOption).value;
    handleChange({ target: { value: optionValue } } as unknown as InputEvent);
    if (props.select) {
      hideList(null);
    }
  }
};

// -------------------------------------------------------------------------------------------------
// KEYBOARD NAVIGATION.
// -------------------------------------------------------------------------------------------------

// Handles keyboard navigation amongst options.
const handleKeydown = (event: KeyboardEvent): void => {
  if (!props.disabled) {
    const { key } = event;
    const navigationControls: Record<string, () => number> = {
      ArrowUp: () => findSiblingOption(focusedOptionIndex.value, -1),
      ArrowLeft: () => findSiblingOption(focusedOptionIndex.value, -1),
      ArrowDown: () => findSiblingOption(focusedOptionIndex.value, +1),
      ArrowRight: () => findSiblingOption(focusedOptionIndex.value, +1),
      PageUp: () => Math.max(0, findSiblingOption(-1, +1)),
      Home: () => Math.max(0, findSiblingOption(-1, +1)),
      PageDown: () => Math.min(
        props.options.length - 1,
        findSiblingOption(props.options.length, -1),
      ),
      End: () => Math.min(props.options.length - 1, findSiblingOption(props.options.length, -1)),
    };

    const siblingOption = navigationControls[key];
    if (siblingOption as unknown !== undefined) {
      // User is navigating through options...
      if (isDisplayed.value || !props.select) {
        focusOption(siblingOption());
      } else {
        changeOption(siblingOption());
      }
      // `event.preventDefault` is not called globally to avoid overriding `Tab` behaviour.
      event.preventDefault();
    } else if (key === ' ' || key === 'Enter') {
      // User wants to select / unselect an option...
      if (!isDisplayed.value && props.select) {
        isDisplayed.value = true;
      } else {
        changeOption(focusedOptionIndex.value);
      }
      event.preventDefault();
    } else if (key === 'Escape') {
      // User wants to hide list (`select` mode)...
      hideList(null, true);
      event.preventDefault();
    }
  }
};

// -------------------------------------------------------------------------------------------------
// PROPS REACTIVITY MANAGEMENT.
// -------------------------------------------------------------------------------------------------

// Updates `firstSelectedOption` ref whenever `currentValue` changes.
const firstSelectedOption = computed(() => {
  if (currentValue.value.length === 0) {
    return findSiblingOption(-1, 1);
  }
  return Math.max(0, props.options.findIndex(
    (option) => option.type === 'option' && currentValue.value.includes(option.value),
  ));
});

// Updates current value whenever `value` property changes.
watch(() => props.value, () => {
  const newValue = toArray(props.value as string);
  currentValue.value = newValue;
});

// Updates current value whenever `multiple` property changes.
watch(() => props.multiple, () => {
  currentValue.value = (props.multiple || currentValue.value.length === 0)
    ? currentValue.value
    : [currentValue.value[0]];
});

// Updates select visibility whenever `expanded` property changes.
watch(() => props.expanded, () => {
  isDisplayed.value = props.expanded;
});

// Re-focuses the right option whenever `options` property changes, to avoid out of range focus.
watch(() => props.options, () => {
  if (isFocused.value) {
    focusOption(firstSelectedOption.value);
  }
});

// HTML elements with `display: none` can't be focused. Thus, we need to wait for the HTML list to
// be displayed before actually focusing it (`select` mode).
watch([isDisplayed, mounted, () => props.select], () => {
  if (mounted.value) {
    setTimeout(() => {
      if (
        wrapperRef.value as unknown !== null
        && props.select
        && isDisplayed.value
        && !props.expanded
      ) {
        focusOption(firstSelectedOption.value);
      } else if (!isDisplayed.value && buttonRef.value as unknown !== null && !props.expanded) {
        buttonRef.value.focus();
      }
    }, 10);
  }
  mounted.value = true;
});
</script>

<template>
  <div
    v-if="select"
    :id="id"
    :class="className"
  >
    <label
      v-if="label !== undefined"
      class="ui-options__label"
      :for="randomId"
      v-html="markdown(label)"
    />
    <div class="ui-options__wrapper">
      <button
        :id="randomId"
        ref="buttonRef"
        :name="name"
        type="button"
        aria-haspopup="listbox"
        class="ui-options__wrapper__button"
        :aria-labelledby="`${randomId} ${randomId}`"
        :tabindex="disabled ? -1 : 0"
        @keydown="handleKeydown"
        @focus="handleFocus('', firstSelectedOption, $event)"
        @mousedown="displayList"
        v-html="currentValue.map((optionValue) => optionParsedLabels[optionValue]).join(', ')"
      />
      <ul
        ref="wrapperRef"
        tabindex="-1"
        role="listbox"
        :aria-labelledby="randomId"
        :aria-expanded="isDisplayed"
        :aria-multiselectable="multiple"
        :aria-activedescendant="`${randomId}${focusedOptionIndex}`"
        :class="buildClass(
          'ui-options__wrapper__list', isDisplayed ? `${position} expanded` : position
        )"
        @keydown="handleKeydown"
      >
        <li
          v-for="(option, index) in options"
          :id="`${randomId}${index}`"
          :key="`${randomId}${index}`"
          tabindex="-1"
          :aria-selected="option.type === 'option' && currentValue.includes(option.value)"
          :role="(option.type === 'option') ? 'option' : undefined"
          :class="buildClass(
            `ui-options__wrapper__list__${option.type}`,
            `${option.modifiers ?? ''}${option.type === 'option' && option.disabled
              ? ' disabled': ''}${option.type === 'option' && currentValue.includes(option.value)
              ? ' checked' : ''}`)"
          @blur="hideList($event, true)"
          @mousedown="(option.type==='option') && changeOption(index)"
          @focus="(option.type==='option') && handleFocus(option.value, index, $event)"
          v-html="(option.type==='divider') ? '' : optionParsedLabels[(option.type==='option')
            ? option.value : `header_${index}`]"
        />
      </ul>
    </div>
    <span
      v-if="helper !== undefined"
      class="ui-options__helper"
      v-html="markdown(helper)"
    />
  </div>

  <div
    v-else
    :id="id"
    :class="className"
  >
    <label
      v-if="label !== undefined"
      class="ui-options__label"
      :for="`${randomId}_${Math.max(firstSelectedOption, 0)}`"
      v-html="markdown(label)"
    />
    <div
      ref="wrapperRef"
      class="ui-options__wrapper"
    >
      <label
        v-for="(option, index) in filteredOptions"
        :key="option.value"
        :class="buildClass(
          'ui-options__wrapper__option',
          `${option.modifiers ?? ''}${option.disabled
            ? ' disabled': ''}${currentValue.includes(option.value) ? ' checked' : ''}`)"
      >
        <input
          :id="`${randomId}_${index}`"
          :name="name"
          :checked="currentValue.includes(option.value)"
          :type="multiple ? 'checkbox' : 'radio'"
          :value="option.value"
          :disabled="option.disabled"
          class="ui-options__wrapper__option__field"
          :tabindex="(
            option.disabled ||
            disabled ||
            !(
              ((index === 0 || !multiple) && currentValue.length === 0) ||
              option.value === currentValue[0]
            )
              ? -1 : 0)"
          @blur="handleBlur"
          @change="handleChange"
          @keydown="handleKeydown"
          @focus="handleFocus(option.value, index, $event)"
        >
        <span
          class="ui-options__wrapper__option__label"
          v-html="optionParsedLabels[option.value]"
        />
      </label>
    </div>
    <span
      v-if="helper !== undefined"
      class="ui-options__helper"
      v-html="markdown(helper)"
    />
  </div>
</template>
