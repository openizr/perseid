/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { markdown, buildClass, generateRandomId } from 'scripts/core/index';

const toArray = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value]);

const defaultValue: string[] = [];

/**
 * Set of selectable options.
 */
function UIOptions(props: UIOptionsProps): JSX.Element {
  const { id, modifiers = '', label } = props;
  const { multiple, select, onFocus } = props;
  const { options, name, expanded = false } = props;
  const { helper, value = defaultValue, onChange } = props;
  const { selectPosition, disabled = false, placeholder = '' } = props;

  const mounted = React.useRef(false);
  const wrapperRef = React.useRef(null);
  const isFocused = React.useRef(false);
  const firstSelectedOption = React.useRef(-1);
  const [randomId] = React.useState(generateRandomId);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [isDisplayed, setIsDisplayed] = React.useState(false);
  const [focusedOptionIndex, setFocusedOptionIndex] = React.useState(-1);
  const [position, setPosition] = React.useState(selectPosition ?? 'bottom');
  const [currentValue, setCurrentValue] = React.useState<string[]>(toArray(value));
  const className = buildClass('ui-options', `${modifiers}${(select ? ' select' : '')}${(multiple ? ' multiple' : '')}${disabled ? ' disabled' : ''}`);
  // Memoizes all options' parsed labels to optimize rendering.
  const optionParsedLabels = React.useMemo(() => options.reduce<
    Record<string, string>
  >((mapping, option, index) => {
    if (option.type === 'option') {
      return { ...mapping, [option.value]: markdown(option.label) };
    }
    if (option.type === 'header') {
      return { ...mapping, [`header_${String(index)}`]: markdown(option.label) };
    }
    return mapping;
  }, {}), [options]);

  // -----------------------------------------------------------------------------------------------
  // CALLBACKS DECLARATION.
  // -----------------------------------------------------------------------------------------------

  // Updates the `isFocused` ref when blurring options.
  const handleBlur = React.useCallback(() => {
    isFocused.current = false;
  }, []);

  // In `select` mode only, displays the options list at the right place on the viewport.
  const displayList = React.useCallback((): void => {
    if (!disabled) {
      if (selectPosition !== undefined) {
        setPosition(selectPosition);
      } else {
        const relativeOffsetTop = (buttonRef.current as HTMLInputElement)
          .getBoundingClientRect().top;
        setPosition((relativeOffsetTop > window.innerHeight / 2) ? 'top' : 'bottom');
      }
      setIsDisplayed(true);
    }
  }, [selectPosition, disabled]);

  // In `select` mode only, hides the options list only if forced or if focus is lost.
  const hideList = React.useCallback(
    (force = false) => (event: React.FocusEvent<HTMLElement> | null): void => {
      // We first ensure that the newly focused element is not an option of the list.
      const focusIsOutsideList = (event !== null)
        ? !event.currentTarget.contains(event.relatedTarget as Node)
        : true;
      if (focusIsOutsideList && (force || !multiple)) {
        handleBlur();
        setIsDisplayed(expanded || false);
      }
    },
    [multiple, handleBlur, expanded],
  );

  // Finds the direct previous or next option when navigating with keyboard.
  const findSiblingOption = React.useCallback(
    (startIndex: number, direction: number, offset = 1): number => {
      const nextIndex = startIndex + direction * offset;
      if (nextIndex < 0 || nextIndex >= options.length) {
        return startIndex;
      }
      const option = options[nextIndex];
      return (option.type === 'option' && !option.disabled)
        ? nextIndex
        : findSiblingOption(startIndex, direction, offset + 1);
    },
    [options],
  );

  // Automatically triggered when a `focus` event is fired.
  const handleFocus = React.useCallback((optionValue: string, optionIndex: number) => (
    (event: React.FocusEvent<HTMLElement>): void => {
      if (!disabled) {
        isFocused.current = true;
        setFocusedOptionIndex(optionIndex);
        if (onFocus !== undefined) {
          onFocus(optionValue, event as unknown as FocusEvent);
        }
      }
    }), [onFocus, disabled]);

  // Manually triggered, used to simulate `focus` events (`select` mode).
  const focusOption = React.useCallback((optionIndex: number): void => {
    const refNode = (wrapperRef as React.RefObject<HTMLElement>).current;
    if (refNode !== null && optionIndex < refNode.childNodes.length && optionIndex >= 0) {
      (refNode.childNodes[optionIndex] as HTMLElement).focus();
    }
  }, []);

  // Automatically triggered when a `change` event is fired.
  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    if (!disabled) {
      const selectedIndex = currentValue.indexOf(event.target.value);
      let newValue = [event.target.value];
      if (multiple === true) {
        newValue = (selectedIndex >= 0)
          ? currentValue.slice(0, selectedIndex).concat(currentValue.slice(selectedIndex + 1))
          : currentValue.concat([event.target.value]);
      }
      // If the value hasn't changed, we don't trigger anything.
      if (multiple as unknown as boolean || newValue[0] !== currentValue[0]) {
        setCurrentValue(newValue);
        if (onChange !== undefined) {
          onChange((multiple === true) ? newValue : newValue[0], event as unknown as InputEvent);
        }
      }
    }
  }, [onChange, currentValue, multiple, disabled]);

  // Manually triggered, used to simulate `change` events (`select` mode).
  const changeOption = React.useCallback((optionIndex: number) => (): void => {
    if (!disabled) {
      setFocusedOptionIndex(optionIndex);
      const optionValue = (options[optionIndex] as UIOptionsOption).value;
      handleChange({ target: { value: optionValue } } as React.ChangeEvent<HTMLInputElement>);
      if (select === true) {
        hideList()(null);
      }
    }
  }, [handleChange, hideList, options, select, disabled]);

  // -----------------------------------------------------------------------------------------------
  // KEYBOARD NAVIGATION.
  // -----------------------------------------------------------------------------------------------

  // Handles keyboard navigation amongst options.
  const handleKeydown = React.useCallback((event: React.KeyboardEvent<HTMLElement>): void => {
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
          setIsDisplayed(true);
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
  }, [
    focusOption,
    findSiblingOption,
    focusedOptionIndex,
    select,
    hideList,
    isDisplayed,
    changeOption,
    options.length,
    disabled,
  ]);

  // -----------------------------------------------------------------------------------------------
  // PROPS REACTIVITY MANAGEMENT.
  // -----------------------------------------------------------------------------------------------

  // Updates current value whenever `value` property changes.
  React.useEffect(() => {
    const newValue = toArray(value);
    setCurrentValue(newValue);
  }, [value]);

  // Updates select visibility whenever `expanded` property changes.
  React.useEffect(() => {
    setIsDisplayed(expanded);
  }, [expanded]);

  // Updates current value whenever `multiple` property changes.
  React.useEffect(() => {
    setCurrentValue((prevValue) => (
      (multiple as unknown as boolean || prevValue.length === 0) ? prevValue : [prevValue[0]]));
  }, [multiple]);

  // Updates `firstSelectedOption` ref whenever `currentValue` changes.
  React.useEffect(() => {
    if (currentValue.length === 0) {
      firstSelectedOption.current = findSiblingOption(-1, 1);
    }
    firstSelectedOption.current = Math.max(0, options.findIndex(
      (option) => option.type === 'option' && currentValue.includes(option.value),
    ));
  }, [currentValue, options, findSiblingOption]);

  // Re-focuses the right option whenever `options` property changes, to avoid out of range focus.
  React.useEffect(() => {
    if (isFocused.current) {
      focusOption(firstSelectedOption.current);
    }
  }, [options, focusOption]);

  // HTML elements with `display: none` can't be focused. Thus, we need to wait for the HTML list to
  // be displayed before actually focusing it (`select` mode).
  React.useEffect(() => {
    if (!isDisplayed && !expanded && buttonRef.current !== null && mounted.current) {
      buttonRef.current.focus();
    } else if (isDisplayed && !expanded && wrapperRef.current as unknown !== null) {
      setTimeout(() => {
        focusOption(firstSelectedOption.current);
      }, 10);
    }
  }, [isDisplayed, focusOption, expanded]);
  // Prevents focusing the dropdown at component mount in strict mode.
  React.useEffect(() => {
    mounted.current = true;
    return (): void => { mounted.current = false; };
  }, []);

  // -----------------------------------------------------------------------------------------------
  // COMPONENT RENDERING.
  // -----------------------------------------------------------------------------------------------

  const labelComponent = (label !== undefined) && (
    <label
      className="ui-options__label"
      htmlFor={select ? randomId : `${randomId}_${String(Math.max(firstSelectedOption.current, 0))}`}
      dangerouslySetInnerHTML={{ __html: markdown(label) }}
    />
  );

  const helperComponent = (helper !== undefined) && (
    <span
      className="ui-options__helper"
      dangerouslySetInnerHTML={{ __html: markdown(helper) }}
    />
  );

  // Display as select list...
  if (select) {
    return (
      <div
        id={id}
        className={className}
      >
        {labelComponent}
        <div className="ui-options__wrapper">
          <button
            name={name}
            type="button"
            id={randomId}
            ref={buttonRef}
            aria-haspopup="listbox"
            onKeyDown={handleKeydown}
            onMouseDown={displayList}
            tabIndex={disabled ? -1 : 0}
            className="ui-options__wrapper__button"
            aria-labelledby={`${randomId} ${randomId}`}
            onFocus={handleFocus('', firstSelectedOption.current)}
            dangerouslySetInnerHTML={{
              __html: (currentValue.length === 0)
                ? placeholder
                : currentValue.map((optionValue) => optionParsedLabels[optionValue]).join(', '),
            }}
          />
          <ul
            tabIndex={-1}
            role="listbox"
            ref={wrapperRef}
            onBlur={hideList(true)}
            onKeyDown={handleKeydown}
            aria-labelledby={randomId}
            aria-expanded={isDisplayed}
            aria-multiselectable={multiple === true}
            aria-activedescendant={`${randomId}${String(focusedOptionIndex)}`}
            className={buildClass('ui-options__wrapper__list', isDisplayed ? `${position} expanded` : position)}
          >
            {options.map((option, index) => {
              const key = `${randomId}${String(index)}`;
              const isOption = option.type === 'option';
              const isDisabled = isOption && option.disabled;
              let optionModifiers = `${option.modifiers ?? ''}${(isDisabled) ? ' disabled' : ''}`;
              const isChecked = isOption && currentValue.includes(option.value);
              if (isChecked) {
                optionModifiers += ' checked';
              }
              let html = '';
              if (isOption) {
                html = optionParsedLabels[option.value];
              } else if (option.type === 'header') {
                html = optionParsedLabels[`header_${String(index)}`];
              }
              return (
                <li
                  id={key}
                  key={key}
                  tabIndex={-1}
                  onBlur={handleBlur}
                  aria-selected={isChecked}
                  dangerouslySetInnerHTML={{ __html: html }}
                  role={isOption ? 'option' : undefined}
                  onMouseDown={(isOption && !isDisabled) ? changeOption(index) : undefined}
                  onFocus={(isOption && !isDisabled) ? handleFocus(option.value, index) : undefined}
                  className={buildClass(`ui-options__wrapper__list__${option.type}`, optionModifiers)}
                />
              );
            })}
          </ul>
        </div>
        {helperComponent}
      </div>
    );
  }

  // Display as radio buttons / checkboxes...
  return (
    <div
      id={id}
      className={className}
    >
      {labelComponent}
      <div
        ref={wrapperRef}
        className="ui-options__wrapper"
      >
        {options.filter((option) => option.type === 'option').map((option, index) => {
          const realOption = option;
          const optionId = `${randomId}_${String(index)}`;
          const isChecked = currentValue.includes(realOption.value);
          let optionModifiers = `${option.modifiers ?? ''}${realOption.disabled ? ' disabled' : ''}`;
          if (isChecked) {
            optionModifiers += ' checked';
          }
          const optionClassName = buildClass('ui-options__wrapper__option', optionModifiers);
          return (
            <label key={realOption.value} className={optionClassName} htmlFor={optionId}>
              <input
                name={name}
                id={optionId}
                onBlur={handleBlur}
                checked={isChecked}
                value={realOption.value}
                onChange={handleChange}
                onKeyDown={handleKeydown}
                disabled={disabled || realOption.disabled}
                onFocus={handleFocus(realOption.value, index)}
                className="ui-options__wrapper__option__field"
                type={(multiple === true) ? 'checkbox' : 'radio'}
                tabIndex={(
                  disabled
                    || realOption.disabled as unknown as boolean
                    || !(((index === 0 || !multiple) && currentValue.length === 0)
                      || realOption.value === currentValue[0])
                    ? -1 : 0)}
              />
              <span
                className="ui-options__wrapper__option__label"
                dangerouslySetInnerHTML={{ __html: optionParsedLabels[realOption.value] }}
              />
            </label>
          );
        })}
      </div>
      {helperComponent}
    </div>
  );
}

export default React.memo(UIOptions);
