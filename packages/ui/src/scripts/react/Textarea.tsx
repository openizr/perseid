/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import markdown from 'scripts/core/markdown';
import buildClass from 'scripts/core/buildClass';
import generateRandomId from 'scripts/core/generateRandomId';

/**
 * Text area.
 */
function UITextarea(props: UITextareaProps): JSX.Element {
  let { rows } = props;
  const { name } = props;
  const { readonly = false, cols } = props;
  const { id, modifiers = '', label } = props;
  const { onBlur, maxlength, onPaste } = props;
  const { helper, onChange, value = '' } = props;
  const { autoresize = false, disabled = false } = props;
  const { onFocus, debounceTimeout = 50, placeholder } = props;
  const { autofocus = false, autocomplete = 'off', onKeyDown } = props;

  const isUserTyping = React.useRef(false);
  const [randomId] = React.useState(generateRandomId);
  const timeout = React.useRef<NodeJS.Timeout | null>(null);
  const [currentValue, setCurrentValue] = React.useState(`${value}`);
  const className = buildClass('ui-textarea', `${modifiers}${disabled ? ' disabled' : ''}`);
  rows = (autoresize && rows === undefined) ? Math.max(1, currentValue.split('\n').length) : rows;

  // -----------------------------------------------------------------------------------------------
  // CALLBACKS DECLARATION.
  // -----------------------------------------------------------------------------------------------

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    if (!disabled) {
      clearTimeout(timeout.current as unknown as NodeJS.Timeout);
      isUserTyping.current = true;
      const newValue = event.target.value;
      setCurrentValue(newValue);
      // This debounce system prevents triggering `onChange` callback too many times when user is
      // still typing to save performance and make the UI more reactive on low-perfomance devices.
      timeout.current = setTimeout(() => {
        isUserTyping.current = false;
        if (onChange !== undefined) {
          onChange(newValue, event as unknown as InputEvent);
        }
      }, debounceTimeout);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>): void => {
    if (onBlur !== undefined && !disabled) {
      onBlur(currentValue, event as unknown as FocusEvent);
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLTextAreaElement>): void => {
    if (onFocus !== undefined && !disabled) {
      onFocus(currentValue, event as unknown as FocusEvent);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    if (onPaste !== undefined && !disabled) {
      onPaste(currentValue, event as unknown as ClipboardEvent);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (onKeyDown !== undefined && !disabled) {
      onKeyDown(currentValue, event as unknown as KeyboardEvent);
    }
  };

  // -----------------------------------------------------------------------------------------------
  // PROPS REACTIVITY MANAGEMENT.
  // -----------------------------------------------------------------------------------------------

  // Updates current value whenever `value` prop changes.
  React.useEffect(() => {
    // Do not update current value immediatly while user is typing something else.
    if (!isUserTyping.current) {
      setCurrentValue(`${value}`);
    }
  }, [value]);

  // -----------------------------------------------------------------------------------------------
  // COMPONENT RENDERING.
  // -----------------------------------------------------------------------------------------------

  return (
    <div
      id={id}
      className={className}
    >
      {(label !== undefined) && (
        <label
          className="ui-textarea__label"
          htmlFor={randomId}
          dangerouslySetInnerHTML={{ __html: markdown(label) }}
        />
      )}
      <div className="ui-textarea__wrapper">
        <textarea
          cols={cols}
          rows={rows}
          name={name}
          id={randomId}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={disabled}
          maxLength={maxlength}
          value={currentValue}
          readOnly={readonly}
          autoFocus={autofocus}
          placeholder={placeholder}
          autoComplete={autocomplete}
          tabIndex={disabled ? -1 : 0}
          className="ui-textarea__wrapper__field"
          onPaste={!readonly ? handlePaste : undefined}
          onChange={!readonly ? handleChange : undefined}
          onKeyDown={!readonly ? handleKeyDown : undefined}
        />
      </div>
      {(helper !== undefined) && (
        <span
          className="ui-textarea__helper"
          dangerouslySetInnerHTML={{ __html: markdown(helper) }}
        />
      )}
    </div>
  );
}

export default React.memo(UITextarea);
