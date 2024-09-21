/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import UIIcon from 'scripts/react/Icon';
import { markdown, buildClass, generateRandomId } from 'scripts/core/index';

const defaultValue: File[] = [];
const toArray = (value: File | File[]): File[] => (Array.isArray(value) ? value : [value]);

/**
 * File picker.
 */
function UIFilePicker(props: UIFilePickerProps): JSX.Element {
  const { name } = props;
  const { icon, onChange, multiple } = props;
  const { accept, id, modifiers = '' } = props;
  const { placeholder, disabled = false } = props;
  const { label, helper, iconPosition = 'left' } = props;
  const { value = defaultValue, onBlur, onFocus } = props;

  const [randomId] = React.useState(generateRandomId);
  const [currentValue, setCurrentValue] = React.useState<File[]>(toArray(value));
  const className = buildClass('ui-file-picker', `${modifiers}${(multiple ? ' multiple' : '')}${disabled ? ' disabled' : ''}`);

  // -----------------------------------------------------------------------------------------------
  // CALLBACKS DECLARATION.
  // -----------------------------------------------------------------------------------------------

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (!disabled) {
      const files = [];
      const numberOfFiles = ((event.target.files as unknown as FileList).length);
      for (let index = 0; index < numberOfFiles; index += 1) {
        files.push((event.target.files as unknown as FileList)[index]);
      }
      setCurrentValue(files);
      if (onChange !== undefined) {
        onChange(multiple ? files : files[0], event as unknown as InputEvent);
      }
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>): void => {
    if (onFocus !== undefined && !disabled) {
      onFocus(multiple ? currentValue : currentValue[0], event as unknown as FocusEvent);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>): void => {
    if (onBlur !== undefined && !disabled) {
      onBlur(multiple ? currentValue : currentValue[0], event as unknown as FocusEvent);
    }
  };

  // -----------------------------------------------------------------------------------------------
  // PROPS REACTIVITY MANAGEMENT.
  // -----------------------------------------------------------------------------------------------

  // Updates current value whenever `value` prop changes.
  React.useEffect(() => {
    setCurrentValue(toArray(value));
  }, [value]);

  // -----------------------------------------------------------------------------------------------
  // COMPONENT RENDERING.
  // -----------------------------------------------------------------------------------------------

  const children = [
    (icon !== undefined) ? <UIIcon key="icon" name={icon} /> : null,
    <input
      key="file"
      type="file"
      name={name}
      id={randomId}
      accept={accept}
      multiple={multiple}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onChange={handleChange}
      tabIndex={disabled ? -1 : 0}
      className="ui-file-picker__wrapper__field"
    />,
  ];
  return (
    <div
      id={id}
      className={className}
    >
      {(label !== undefined) && (
        <label
          className="ui-file-picker__label"
          htmlFor={randomId}
          dangerouslySetInnerHTML={{ __html: markdown(label) }}
        />
      )}
      <div className="ui-file-picker__wrapper">
        {(iconPosition === 'left') ? children : children.reverse()}
        <span className="ui-file-picker__wrapper__placeholder">
          {(currentValue.length === 0) ? placeholder : currentValue.map((file) => file.name).join(', ')}
        </span>
      </div>
      {(helper !== undefined) && (
        <span
          className="ui-file-picker__helper"
          dangerouslySetInnerHTML={{ __html: markdown(helper) }}
        />
      )}
    </div>
  );
}

export default React.memo(UIFilePicker);
