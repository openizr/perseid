/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { UIButton, buildClass } from '@perseid/ui/react';
import { type FormFieldProps } from '@perseid/form/react';

/**
 * Optional form field props.
 */
export interface OptionalFieldProps extends FormFieldProps {
  /** Label to display for showing optional field. */
  showLabel: string;

  /** Label to display for hide optional field. */
  hideLabel: string;

  /** Additional modifiers to apply to the optional field. */
  modifiers?: string;

  /** Field component to use for rendering. */
  Field: (props: FormFieldProps & { _canonicalPath?: string; }) => JSX.Element;

  _canonicalPath?: string;
}

/**
 * Optional form field.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/OptionalField.tsx
 */
function OptionalField({
  showLabel,
  hideLabel,
  modifiers = '',
  _canonicalPath,
  ...field
}: OptionalFieldProps): JSX.Element {
  const {
    path,
    Field,
    value,
    engine,
  } = field;

  const toggleExpand = React.useCallback(() => {
    const newData = (field.type === 'array') ? [] : {};
    engine.userAction({ type: 'input', path, data: (value === null) ? newData : null });
  }, [engine, path, value, field.type]);

  return (
    <div className={buildClass('optional-field', modifiers)}>
      <UIButton
        onClick={toggleExpand}
        modifiers="secondary outlined"
        label={(value !== null) ? hideLabel : showLabel}
      />
      {(value !== null) && (
        <Field
          {...field}
          isRequired
          _canonicalPath={_canonicalPath}
        />
      )}
    </div>
  );
}

export default React.memo(OptionalField);
