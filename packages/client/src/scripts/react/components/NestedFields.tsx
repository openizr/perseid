/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { type Fields } from '@perseid/form';
import { type FormFieldProps } from '@perseid/form/react';
import { buildClass, UIButton, UIButtonProps } from '@perseid/ui/react';

/**
 * Nested fields props.
 */
export interface NestedFieldsProps extends FormFieldProps {
  _canonicalPath?: string;

  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** Initial field value. */
  value: unknown[];

  /** Element's label. Supports light markdown. */
  label?: string;

  /** Element's helper. Supports light markdown. */
  helper?: string;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** Minimum items allowed for this field. Defaults to `0`. */
  minItems?: number;

  /** Maximum items allowed for this field. Defaults to `Infinity`. */
  maxItems?: number;

  /** Add item button props. */
  addButtonProps?: UIButtonProps;

  /** Remove item button props. */
  removeButtonProps?: UIButtonProps;

  /** Field sub-fields list. */
  fields: Fields;

  /** Field component to use for rendering. */
  Field: (props: FormFieldProps & { _canonicalPath?: string; }) => JSX.Element;
}

/**
 * Nested fields (array / object) form component.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/NestedFields.tsx
 */
function NestedFields({
  id,
  type,
  path,
  Field,
  label,
  value,
  helper,
  engine,
  fields,
  active,
  modifiers,
  minItems = 0,
  _canonicalPath,
  addButtonProps,
  useSubscription,
  removeButtonProps,
  maxItems = Infinity,
}: NestedFieldsProps): JSX.Element {
  const [currentFields, setCurrentFields] = React.useState<Fields>(fields);
  const className = buildClass('ui-nested-fields', [modifiers, type].join(' '));

  const addItem = React.useCallback(() => {
    const newValue = (value as unknown[] | null ?? []).concat([null]);
    engine.userAction({ path, type: 'input', data: newValue });
  }, [engine, path, value]);

  const removeItem = React.useCallback((index: number) => () => {
    setCurrentFields((previousState) => (
      previousState.slice(0, index).concat(previousState.slice(index + 1))
    ));
    const newValue = value.slice(0, index).concat(value.slice(index + 1));
    engine.userAction({ path, type: 'input', data: newValue });
  }, [engine, path, value]);

  // Updates current fields whenever `fields` prop changes.
  React.useEffect(() => {
    setCurrentFields(fields);
  }, [fields]);

  // Adds new fields if length does not fit minimum length.
  React.useEffect(() => {
    if (type === 'array' && value as unknown !== null && value.length < minItems) {
      const newValue = value.concat(new Array(minItems - value.length).fill(null));
      engine.userAction({ path, type: 'input', data: newValue });
    }
  }, [minItems, engine, value, path, type]);

  // Removes extra fields if length does not fit maximum length.
  React.useEffect(() => {
    if (type === 'array' && value as unknown !== null && value.length > maxItems) {
      setCurrentFields((previousState) => previousState.slice(0, maxItems));
      const newValue = value.slice(0, maxItems);
      engine.userAction({ path, type: 'input', data: newValue });
    }
  }, [engine, value, maxItems, path, type]);

  return (
    <div id={id} className={className}>
      {(label !== undefined) && <span className="ui-nested-fields__label">{label}</span>}

      {currentFields.map((field, index) => ((field === null) ? null : (
        <div className="ui-nested-fields__field" key={field.path}>
          {(type !== 'object' && currentFields.length > minItems) && (
            <UIButton
              type="button"
              icon="delete"
              onClick={removeItem(index)}
              {...removeButtonProps}
            />
          )}
          <Field
            {...field}
            Field={Field}
            active={active}
            engine={engine}
            useSubscription={useSubscription}
            _canonicalPath={`${_canonicalPath}.${type === 'array' ? '$n' : field.path.split('.').at(-1)}`}
          />
        </div>
      )))}

      {(type === 'array') && (
        <UIButton
          icon="plus"
          onClick={addItem}
          disabled={currentFields.length >= maxItems}
          {...addButtonProps}
        />
      )}
      {(helper !== undefined) && <span className="ui-nested-fields__helper">{helper}</span>}
    </div>
  );
}

export default React.memo(NestedFields);
