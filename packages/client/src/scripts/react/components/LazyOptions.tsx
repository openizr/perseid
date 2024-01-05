/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  UIOptions,
  buildClass,
  UITextfield,
  generateRandomId,
  type UIOptionsOption,
} from '@perseid/ui/react';
import * as React from 'react';
import type Store from '@perseid/store';
import { type DefaultDataModel } from '@perseid/core';
import { type UseSubscription } from '@perseid/store/connectors/react';

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
  labelFn: (resource: Resource | null) => string;
  collection: keyof DataModel;

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
  loadResults: (value: string | null) => Promise<{ type: 'option'; label: string; value: string; }[]>;
}

/**
 * List of options fetched dynamically using a search bar.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/LazyOptions.tsx
 */
function LazyOptions<DataModel extends DefaultDataModel = DefaultDataModel>({
  label,
  value,
  helper,
  store,
  labelFn,
  onChange,
  id: htmlId,
  loadResults,
  placeholder,
  collection,
  loadingLabel,
  noResultLabel,
  modifiers = '',
  disabled = false,
  autofocus = false,
  forceSuggestions = false,
  loadResultsOnFocus = true,
  resetResultsOnChange = true,
}: LazyOptionsProps<DataModel>): JSX.Element {
  const loadingOption = React.useMemo<UIOptionsOption>(() => ({
    type: 'option',
    value: 'null',
    disabled: true,
    label: loadingLabel,
  }), [loadingLabel]);
  const noResultOption = React.useMemo<UIOptionsOption>(() => ({
    type: 'option',
    value: 'null',
    disabled: true,
    label: noResultLabel,
  }), [noResultLabel]);

  const elementRef = React.useRef<HTMLDivElement>(null);
  const [showResults, setShowResults] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState('');
  const [results, setResults] = React.useState<UIOptionsOption[]>([loadingOption]);
  const registry = store.useSubscription<Partial<Registry<DataModel>>>('registry');
  const [currentValue, setCurrentValue] = React.useState<Value>({ value: 'null', label: '' });
  const className = buildClass('lazy-options', `${modifiers} ${showResults ? ' visible' : ''}`);
  const resource = registry[collection]?.[String(currentValue.value)] ?? null;

  const handleBlur = React.useCallback(() => {
    setCurrentValue((previousState) => ({
      ...previousState,
      label: labelFn(resource),
    }));
  }, [labelFn, resource]);

  const loadSuggestions = React.useCallback(async (newValue: string | null) => {
    const newResults = await loadResults(newValue);
    setResults((newResults.length === 0) ? [noResultOption] : newResults);
  }, [loadResults, noResultOption]);

  const handleFocus = React.useCallback(async () => {
    setShowResults(true);
    if (loadResultsOnFocus) {
      await loadSuggestions(null);
    }
  }, [loadSuggestions, loadResultsOnFocus]);

  // Automatically focuses the first autocomplete result when user presses the arrow down key.
  const handleKeyDown = React.useCallback((_value: string, event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' && elementRef.current !== null) {
      const domElement = elementRef.current;
      const firstOption = domElement.children[1].children[0].children[1].children[0] as HTMLElement;
      firstOption.focus();
    }
  }, []);

  const searchResults = React.useCallback(async (newValue: string) => {
    setResults([loadingOption]);
    setCurrentValue((previousState) => ({ ...previousState, label: newValue }));
    await loadSuggestions(newValue);
  }, [loadSuggestions, loadingOption]);

  const handleSelectOption = React.useCallback((optionValue: string | string[]) => {
    const newValue = results.find((result) => result.value === optionValue) as Value;
    if (resetResultsOnChange) {
      setResults([]);
    }
    setShowResults(false);
    setCurrentValue({
      value: newValue.value,
      label: labelFn(resource),
    });
    // Resetting options value allows users to re-select their previous choice.
    setSelectedValue(generateRandomId);
    onChange?.(newValue);
  }, [onChange, results, labelFn, resetResultsOnChange, resource]);

  // Whenever `value` changes...
  React.useEffect(() => {
    const newResource = registry[collection]?.[String(value)] ?? null;
    if (value !== undefined && newResource !== null) {
      setCurrentValue((previousState) => {
        if (!forceSuggestions && value !== previousState.value) {
          return { value, label: labelFn(newResource) };
        }
        return previousState;
      });
    }
  }, [value, loadSuggestions, onChange, labelFn, forceSuggestions, collection, registry]);

  // Focuses input field whenever suggestions are loaded to enable keyboard navigation.
  React.useEffect(() => {
    if (showResults && results.length > 0) {
      const container = elementRef.current as HTMLElement;
      const input = container.querySelector('.ui-textfield__wrapper__field') as unknown as HTMLElement;
      input.focus();
    }
  }, [results, showResults]);

  return (
    <div className={className} id={htmlId} ref={elementRef}>
      <UITextfield
        label={label}
        disabled={disabled}
        onBlur={handleBlur}
        autofocus={autofocus}
        debounceTimeout={500}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={currentValue.label}
        name="lazy-options-textfield"
        onFocus={handleFocus as () => void}
        onChange={searchResults as (newValue: string) => void}
      />
      <UIOptions
        select
        helper={helper}
        options={results}
        disabled={disabled}
        value={selectedValue}
        expanded={showResults}
        name="lazy-options-options"
        onChange={handleSelectOption}
      />
    </div>
  );
}

export default React.memo(LazyOptions);
