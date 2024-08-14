/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  markdown,
  UIButton,
  UIOptions,
  buildClass,
  UITextarea,
  UITextfield,
  UIFilePicker,
  type UIOptionsOption,
} from '@perseid/ui/react';
import * as React from 'react';
import { type Fields } from '@perseid/form';
import { type FormFieldProps } from '@perseid/form/react';
import NestedFields from 'scripts/react/components/NestedFields';
import OptionalField from 'scripts/react/components/OptionalField';
import { toSnakeCase, type DefaultDataModel, Id } from '@perseid/core';
import LazyOptions, { type LazyOptionsProps } from 'scripts/react/components/LazyOptions';

const dateRegExp = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

/**
 * Generic form field.
 */
export default function FormField<DataModel extends DefaultDataModel = DefaultDataModel>(
  fieldProps: FormDefinition['fieldProps'],
  context: { prefix: string; services: ReactCommonProps<DataModel>['services']; },
): React.FC<FormFieldProps & { _canonicalPath?: string; }> {
  return React.memo(({
    type,
    path,
    Field,
    error,
    value,
    engine,
    status,
    fields,
    isActive,
    isRequired,
    _canonicalPath,
    useSubscription,
    ...rest
  }: FormFieldProps & { _canonicalPath?: string; }) => {
    const { services, prefix } = context;
    const fieldConfiguration = fieldProps[_canonicalPath ?? path];
    const { options, placeholder, ...componentProps } = fieldConfiguration?.componentProps ?? {};
    let modifiers = (fieldConfiguration?.componentProps?.modifiers as string | undefined) ?? '';
    modifiers = `${status} ${isRequired ? 'required' : ''} ${modifiers}`;

    const labels = React.useMemo(() => {
      const fieldPath = toSnakeCase((_canonicalPath ?? path).replace('root.0.', '').replace(/\$n/g, 'fields'));
      return {
        label: services.i18n.t(`${prefix}.FIELDS.${fieldPath}.LABEL`),
        helper: !error ? undefined : services.i18n.t(`${prefix}.FIELDS.${fieldPath}.ERRORS.${error}`),
        placeholder: !placeholder ? undefined : services.i18n.t(`${prefix}.FIELDS.${fieldPath}.${String(placeholder)}`),
        options: (options as UIOptionsOption[] | undefined)?.map((option) => ({
          ...option,
          label: services.i18n.t(`${prefix}.FIELDS.${fieldPath}.OPTIONS.${option.label}`),
        })),
      };
    }, [services, options, prefix, error, path, placeholder, _canonicalPath]);

    if (fieldConfiguration?.component === 'Button') {
      return (
        <UIButton
          label={labels.label}
          modifiers={modifiers}
          onClick={(): void => { engine.userAction({ type: 'input', path, data: true }); }}
          {...componentProps}
        />
      );
    }

    if (fieldConfiguration?.component === 'Textfield') {
      return (
        <UITextfield
          name={path}
          label={labels.label}
          modifiers={modifiers}
          debounceTimeout={100}
          helper={labels.helper}
          placeholder={labels.placeholder}
          value={(value as string | undefined) ?? undefined}
          readonly={!isActive || componentProps.readOnly as boolean}
          onChange={(newValue): void => {
            if (newValue !== value) {
              engine.userAction({ type: 'input', path, data: newValue });
            }
          }}
          {...componentProps}
        />
      );
    }

    if (fieldConfiguration?.component === 'Textarea') {
      return (
        <UITextarea
          name={path}
          label={labels.label}
          modifiers={modifiers}
          debounceTimeout={100}
          helper={labels.helper}
          placeholder={labels.placeholder}
          value={(value as string | undefined) ?? undefined}
          readonly={!isActive || componentProps.readOnly as boolean}
          onChange={(newValue): void => {
            engine.userAction({ type: 'input', path, data: newValue });
          }}
          {...componentProps}
        />
      );
    }

    if (fieldConfiguration?.component === 'DatePicker') {
      return (
        <UITextfield
          name={path}
          modifiers={modifiers}
          debounceTimeout={100}
          label={labels.label}
          helper={labels.helper}
          placeholder={labels.placeholder}
          readonly={!isActive || componentProps.readOnly as boolean}
          value={value instanceof Date ? (value).toISOString() : undefined}
          onChange={(newValue): void => {
            engine.userAction({
              path,
              type: 'input',
              data: dateRegExp.test(newValue) ? new Date(newValue) : null,
            });
          }}
          {...componentProps}
        />
      );
    }

    if (fieldConfiguration?.component === 'FilePicker') {
      return (
        <UIFilePicker
          name={path}
          modifiers={modifiers}
          label={labels.label}
          helper={labels.helper}
          placeholder={labels.placeholder}
          value={(value as File | undefined) ?? undefined}
          onChange={(newValue): void => {
            engine.userAction({ type: 'input', path, data: newValue });
          }}
          {...componentProps}
        />
      );
    }

    if (fieldConfiguration?.component === 'Options') {
      return (
        <UIOptions
          name={path}
          label={labels.label}
          modifiers={modifiers}
          helper={labels.helper}
          options={labels.options as UIOptionsOption[]}
          value={(value as string | undefined) ?? undefined}
          onChange={(newValue): void => {
            engine.userAction({ type: 'input', path, data: newValue });
          }}
          {...componentProps}
        />
      );
    }

    if (fieldConfiguration?.component === 'Message') {
      return (
        <section
          className={buildClass('ui-message', modifiers)}
          dangerouslySetInnerHTML={{ __html: markdown(labels.label, false) }}
          {...rest}
        />
      );
    }

    if (fieldConfiguration?.component === 'Array' || fieldConfiguration?.component === 'Object') {
      if (!isRequired) {
        const collection = toSnakeCase((_canonicalPath ?? path).replace('root.0.', '').replace(/\$n/g, 'fields'));
        return (
          <OptionalField
            type={type}
            path={path}
            Field={Field}
            error={error}
            value={value}
            fields={fields}
            engine={engine}
            status={status}
            isActive={isActive}
            isRequired={isRequired}
            useSubscription={useSubscription}
            modifiers={fieldConfiguration.component.toLowerCase()}
            showLabel={services.i18n.t(`${prefix}.FIELDS.${collection}.SHOW.LABEL`)}
            hideLabel={services.i18n.t(`${prefix}.FIELDS.${collection}.HIDE.LABEL`)}
            {...rest}
          />
        );
      }
      return (
        <NestedFields
          type={type}
          path={path}
          error={error}
          engine={engine}
          status={status}
          isActive={isActive}
          label={labels.label}
          modifiers={modifiers}
          helper={labels.helper}
          isRequired={isRequired}
          value={value as unknown[]}
          useSubscription={useSubscription}
          fields={fields as unknown as Fields}
          {...rest}
          Field={Field as unknown as (props: FormFieldProps) => JSX.Element}
          _canonicalPath={_canonicalPath ?? path}
          {...fieldConfiguration.componentProps}
        />
      );
    }

    if (fieldConfiguration?.component === 'LazyOptions') {
      return (
        <LazyOptions
          label={labels.label}
          value={String(value)}
          modifiers={modifiers}
          store={services.store}
          helper={labels.helper}
          loadingLabel="loading..."
          noResultLabel="no result..."
          placeholder={labels.placeholder}
          collection={componentProps.collection as LazyOptionsProps<DefaultDataModel>['collection']}
          labelFn={componentProps.labelFn as LazyOptionsProps<DefaultDataModel>['labelFn']}
          loadResults={componentProps.loadResults as LazyOptionsProps<DefaultDataModel>['loadResults']}
          {...componentProps}
          onChange={(option): void => {
            engine.userAction({ type: 'input', path, data: option?.value ? new Id(option.value) : null });
          }}
        />
      );
    }

    return null;
  });
}
