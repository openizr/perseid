<!--
  List of options fetched dynamically using a search bar.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/LazyOptions.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  ref,
  watch,
  computed,
} from 'vue';
import {
  UIOptions,
  buildClass,
  UITextfield,
  generateRandomId,
  type UIOptionsOption,
} from '@perseid/ui/vue';
import type Store from '@perseid/store';
import { type DefaultDataModel } from '@perseid/core';
import { type UseSubscription } from '@perseid/store/connectors/vue';

interface Value {
  value: string;
  label: string;
}

/**
 * Lazy options props.
 */
export interface LazyOptionsProps<DataModel> {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** Perseid store instance. */
  store: Store & { useSubscription: UseSubscription; };
  labelFn: (resource: unknown) => string;
  resource: keyof DataModel & string;

  /** Results loading label. */
  loadingLabel: string;

  /** No result label. */
  noResultLabel: string;

  /**
   * Initial value (pre-selected option).
   * Updating this prop with a new value will replace the current value by the one passed.
   */
  value?: string;

  /** Element's label. Supports light markdown. */
  label: string;

  /** Element's helper. Supports light markdown. */
  helper?: string;

  /**
   * When element is disabled, a special `disabled` modifier is automatically added, and all its
   * user interactions are disabled. Defaults to `false`.
   */
  disabled?: boolean;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** `autofocus` HTML attribute to set to the element. Defaults to `false`. */
  autofocus?: boolean;

  /** Element's placeholder. */
  placeholder?: string;

  /**
   * When `forceSuggestions` is set to `true`, we don't want to rely on any pre-filled value,
   * and enforce the autocompletion to be sure we get a valid value. Defaults to `false`.
   */
  forceSuggestions?: boolean;

  /** Whether to load and display results when user focuses this field. Defaults to `true`. */
  loadResultsOnFocus?: boolean;

  /** Whether to reset results whenever user changes field value. Defaults to `true`. */
  resetResultsOnChange?: boolean;

  /**
   * `change` event handler.
   *
   * @param value New field value.
   */
  onChange?: (newValue: Value | null) => void;

  /**
   * Callback triggered whenever results need to be loaded.
   *
   * @param value User input, used to search results.
   *
   * @returns Results list.
   */
  loadResults: (value: string | null) => Promise<UIOptionsOption[]>;
}

const props = withDefaults(defineProps<LazyOptionsProps<DefaultDataModel>>(), {
  helper: undefined,
  id: undefined,
  modifiers: '',
  placeholder: undefined,
  onChange: undefined,
  value: undefined,
  disabled: false,
  autofocus: false,
  forceSuggestions: false,
  loadResultsOnFocus: true,
  resetResultsOnChange: true,
});

const loadingOption = computed<UIOptionsOption>(() => ({
  type: 'option' as const,
  value: 'null',
  disabled: true,
  label: props.loadingLabel,
}));
const noResultOption = computed<UIOptionsOption>(() => ({
  type: 'option' as const,
  value: 'null',
  disabled: true,
  label: props.noResultLabel,
}));

const selectedValue = ref('');
const showResults = ref(false);
const elementRef = ref<HTMLElement | null>(null);
const currentValue = ref({ value: 'null', label: '' });
const results = ref<UIOptionsOption[]>([loadingOption.value]);
const registry = props.store.useSubscription<Partial<Registry<DefaultDataModel>>>('registry');
const className = computed(() => (
  buildClass('lazy-options', `${props.modifiers} ${showResults.value ? ' visible' : ''}`)
));

const handleBlur = () => {
  currentValue.value = {
    ...currentValue.value,
    label: props.labelFn(registry.value[props.resource]?.[String(currentValue.value.value)]),
  };
};

const loadSuggestions = async (newValue: string | null) => {
  const newResults = await props.loadResults(newValue);
  results.value = ((newResults.length === 0) ? [noResultOption.value] : newResults);
};

const handleFocus = async () => {
  showResults.value = true;
  if (props.loadResultsOnFocus) {
    await loadSuggestions(null);
  }
};

// Automatically focuses the first autocomplete result when user presses the arrow down key.
const handleKeyDown = (_value: string, event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    const domElement = elementRef.value as unknown as HTMLElement;
    const firstOption = domElement.children[1].children[0].children[1].children[0] as HTMLElement;
    firstOption.focus();
  }
};

const searchResults = async (newValue: string) => {
  results.value = [loadingOption.value];
  currentValue.value = { ...currentValue.value, label: newValue };
  await loadSuggestions(newValue);
};

const handleSelectOption = (optionValue: string | string[]) => {
  const newValue = results.value.find((result) => result.value === optionValue) as Value;
  if (props.resetResultsOnChange) {
    results.value = [];
  }
  showResults.value = false;
  currentValue.value = ({
    value: newValue.value,
    label: props.labelFn(registry.value[props.resource]?.[String(newValue.value)]),
  });
  // Resetting options value allows users to re-select their previous choice.
  selectedValue.value = generateRandomId();
  props.onChange?.(newValue);
};

// Whenever `value` changes...
const forceChange = () => {
  const newResource = registry.value[props.resource]?.[String(props.value)] ?? null;
  if (props.value !== undefined && newResource !== null) {
    if (!props.forceSuggestions && props.value !== currentValue.value.value) {
      currentValue.value = { value: props.value, label: props.labelFn(newResource) };
    }
  }
};
forceChange();
watch(() => props.value, forceChange);

// Focuses input field whenever suggestions are loaded to enable keyboard navigation.
watch([results, showResults], () => {
  if (showResults.value && results.value.length > 0) {
    const container = elementRef.value as unknown as HTMLElement;
    const input = container.querySelector('.ui-textfield__wrapper__field') as unknown as HTMLElement;
    input.focus();
  }
});
</script>

<template>
  <div :id="id" ref="elementRef" :class="className">
    <UITextfield
      :label="label"
      :disabled="disabled"
      :onBlur="handleBlur"
      :autofocus="autofocus"
      :debounceTimeout="500"
      :onKeyDown="handleKeyDown"
      :placeholder="placeholder"
      :value="currentValue.label"
      name="lazy-options-textfield"
      :onFocus="handleFocus as () => void"
      :onChange="searchResults"
    />
    <UIOptions
      select
      :helper="helper"
      :options="results as unknown as UIOptionsOption[]"
      :disabled="disabled"
      :value="selectedValue"
      :expanded="showResults"
      name="lazy-options-options"
      :onChange="handleSelectOption"
    />
  </div>
</template>
