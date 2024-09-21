<!--
  Generic form field.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/FormField.vue
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
  Id,
  toSnakeCase,
  I18n as BaseI18n,
  type DefaultDataModel,
} from '@perseid/core';
import {
  markdown,
  UIButton,
  UIOptions,
  buildClass,
  UITextarea,
  UITextfield,
  UIFilePicker,
  type UIOptionsOption,
} from '@perseid/ui/vue';
import type Engine from '@perseid/form';
import { computed, type DefineComponent } from 'vue';
import { type Field as FormField } from '@perseid/form';
import type BaseModel from 'scripts/core/services/Model';
import type BaseStore from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import NestedFields from 'scripts/vue/components/NestedFields.vue';
import { type UseSubscription } from '@perseid/store/connectors/vue';
import OptionalField from 'scripts/vue/components/OptionalField.vue';
import LazyOptions, { type LazyOptionsProps } from 'scripts/vue/components/LazyOptions.vue';

/**
 * Generic form field props.
 */
export interface FormFieldProps<T extends Engine = Engine> {
  /** Instance of the form engine. */
  engine: T;

  /** Whether field belongs to current active step. */
  isActive: boolean;

  /** Path of the currently active step. */
  activeStep?: string;

  /** Field type. */
  type: FormField['type'];

  /** Field full path in the form. */
  path: FormField['path'];

  /** Field value. */
  value: FormField['value'];

  /** Field error, if any. */
  error: FormField['error'];

  /** Field status. */
  status: FormField['status'];

  /** Field sub-fields (for objects and arrays only). */
  fields?: FormField['fields'];

  /** Whether field is required. */
  isRequired: boolean;

  /** Field component to use for rendering. */
  Field: DefineComponent<unknown>;

  /** Changes current active step. */
  setActiveStep: (stepPath: string) => void;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;

  additionalProps?: Record<string, unknown>;
}

const dateRegExp = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

const props = defineProps<FormFieldProps>();

const additionalProps = computed(() => (props.additionalProps ?? {}) as {
    _canonicalPath?: string;

    fieldProps: Partial<Record<string, {
      /** Name of the component to use for that field. */
      component: string;

      /** Component props for that field. */
      componentProps?: Record<string, unknown>;
    }>>;
    context: {
      prefix: string;
      services: {
        /** I18n instance. */
        i18n: BaseI18n;

        /** Perseid store instance. */
        store: BaseStore & { useSubscription: UseSubscription; };

        /** Perseid model instance. */
        model: BaseModel;

        /** API client instance. */
        apiClient: BaseApiClient;
      };
    };
});
const shortPath = additionalProps.value._canonicalPath ?? props.path.split('.').slice(2).join('.');
const context = computed(() => additionalProps.value.context);
const fieldConfiguration = computed<Record<string, unknown> | undefined>(() => (
  additionalProps.value.fieldProps[props.path] ?? additionalProps.value.fieldProps[shortPath]
));
const componentProps = computed<Record<string, unknown>>(() => (
  (fieldConfiguration.value?.componentProps ?? {}) as Record<string, unknown>
));
const modifiers = computed(() => {
  const baseModifiers = ((fieldConfiguration.value?.componentProps as Record<
    string, Record<string, string>
  > | null)?.componentProps?.modifiers) ?? '';
  return `${props.status} ${props.isRequired ? 'required' : ''} ${baseModifiers}`;
});

const fieldPath = computed(() => toSnakeCase(shortPath.replace(/\$n/g, 'fields')));
const labels = computed(() => ({
  label: context.value.services.i18n.t(`${context.value.prefix}.FIELDS.${fieldPath.value}.LABEL`),
  helper: !props.error ? undefined : context.value.services.i18n.t(`${context.value.prefix}.FIELDS.${fieldPath.value}.ERRORS.${props.error}`),
  placeholder: !componentProps.value.placeholder ? undefined : context.value.services.i18n.t(`${context.value.prefix}.FIELDS.${fieldPath.value}.${String(componentProps.value.placeholder)}`),
  options: (componentProps.value.options as UIOptionsOption[] | undefined)?.map((option) => ({
    ...option,
    label: context.value.services.i18n.t(`${context.value.prefix}.FIELDS.${fieldPath.value}.OPTIONS.${option.label}`),
  })),
}));

</script>

<template>
  <UIButton
    v-if="fieldConfiguration?.component === 'Button'"
    :label="labels.label"
    :modifiers="modifiers"
    :on-click="() => (engine as Engine).userAction({ type: 'input', path, data: true })"
    v-bind="componentProps"
  />
  <UITextfield
    v-else-if="fieldConfiguration?.component === 'Textfield'"
    :name="path"
    :label="labels.label"
    :modifiers="modifiers"
    :debounce-timeout="100"
    :helper="labels.helper"
    :placeholder="labels.placeholder"
    :value="(value as string | undefined) ?? undefined"
    :readonly="!isActive || componentProps.readOnly as boolean"
    v-bind="componentProps"
    :on-change="(newValue): void => {
      if (newValue !== value) {
        (engine as Engine).userAction({ type: 'input', path, data: newValue });
      }
    }"
  />
  <UITextarea
    v-else-if="fieldConfiguration?.component === 'Textarea'"
    :name="path"
    :label="labels.label"
    :modifiers="modifiers"
    :debounce-timeout="100"
    :helper="labels.helper"
    :placeholder="labels.placeholder"
    :value="(value as string | undefined) ?? undefined"
    :readonly="!isActive || componentProps.readOnly as boolean"
    :on-change="(newValue): void => {
      (engine as Engine).userAction({ type: 'input', path, data: newValue });
    }"
    v-bind="componentProps"
  />
  <UITextfield
    v-else-if="fieldConfiguration?.component === 'DatePicker'"
    :name="path"
    :modifiers="modifiers"
    :debounce-timeout="100"
    :label="labels.label"
    :helper="labels.helper"
    :placeholder="labels.placeholder"
    :readonly="!isActive || componentProps.readOnly as boolean"
    :value="value instanceof Date ? (value).toISOString() : undefined"
    :on-change="(newValue): void => {
      (engine as Engine).userAction({
        path,
        type: 'input',
        data: dateRegExp.test(newValue) ? new Date(newValue) : null,
      });
    }"
    v-bind="componentProps"
  />
  <UIFilePicker
    v-else-if="fieldConfiguration?.component === 'FilePicker'"
    :name="path"
    :modifiers="modifiers"
    :label="labels.label"
    :helper="labels.helper"
    :placeholder="labels.placeholder"
    :value="(value as File | undefined) ?? undefined"
    :on-change="(newValue): void => {
      (engine as Engine).userAction({ type: 'input', path, data: newValue });
    }"
    v-bind="componentProps"
  />
  <UIOptions
    v-else-if="fieldConfiguration?.component === 'Options'"
    :name="path"
    :label="labels.label"
    :modifiers="modifiers"
    :helper="labels.helper"
    :options="labels.options as UIOptionsOption[]"
    :value="(value as string | undefined) ?? undefined"
    :on-change="(newValue): void => {
      (engine as Engine).userAction({ type: 'input', path, data: newValue });
    }"
    v-bind="componentProps"
  />
  <section
    v-if="fieldConfiguration?.component === 'Message'"
    :class="buildClass('ui-message', modifiers)"
    v-html="markdown(labels.label, false)"
  />
  <OptionalField
    v-else-if="(
      fieldConfiguration?.component === 'Array' || fieldConfiguration?.component === 'Object'
    ) && !isRequired"
    :type="type"
    :path="path"
    :Field="Field"
    :error="error"
    :value="value"
    :fields="fields"
    :engine="engine"
    :status="status"
    :isActive="isActive"
    :isRequired="isRequired"
    :activeStep="activeStep"
    :setActiveStep="setActiveStep"
    :useSubscription="useSubscription"
    :additionalProps="additionalProps"
    :modifiers="fieldConfiguration.component.toLowerCase()"
    :showLabel="additionalProps.context.services.i18n.t(
      `${additionalProps.context.prefix}.FIELDS.${
        toSnakeCase(shortPath.replace(/\$n/g, 'fields'))}.SHOW.LABEL`
    )"
    :hideLabel="additionalProps.context.services.i18n.t(
      `${additionalProps.context.prefix}.FIELDS.${
        toSnakeCase(shortPath.replace(/\$n/g, 'fields'))}.HIDE.LABEL`
    )"
    v-bind="componentProps"
  />
  <NestedFields
    v-else-if="(
      fieldConfiguration?.component === 'Array' || fieldConfiguration?.component === 'Object'
    ) && isRequired"
    :type="type"
    :path="path"
    :Field="Field"
    :error="error"
    :engine="engine"
    :status="status"
    :isActive="isActive"
    :isRequired="isRequired"
    :activeStep="activeStep"
    :value="value as unknown[]"
    :_canonicalPath="shortPath"
    :fields="fields as FormField[]"
    :setActiveStep="setActiveStep"
    :useSubscription="useSubscription"
    :additionalProps="additionalProps"
    :minItems="componentProps.minItems as number"
    :maxItems="componentProps.maxItems as number"
    :modifiers="fieldConfiguration.component.toLowerCase()"
    v-bind="componentProps"
  />
  <LazyOptions
    v-else-if="fieldConfiguration?.component === 'LazyOptions'"
    :label="labels.label"
    :value="String(value)"
    :modifiers="modifiers"
    :store="context.services.store"
    :helper="labels.helper"
    loadingLabel="loading..."
    noResultLabel="no result..."
    :placeholder="labels.placeholder"
    :resource="componentProps.resource as LazyOptionsProps<DefaultDataModel>['resource']"
    :labelFn="componentProps.labelFn as LazyOptionsProps<DefaultDataModel>['labelFn']"
    :loadResults="componentProps.loadResults as LazyOptionsProps<DefaultDataModel>['loadResults']"
    v-bind="componentProps"
    :onChange="(option): void => {
      (engine as Engine).userAction({
        type: 'input', path, data: option?.value ? new Id(option.value) : null
      });
    }"
  />
</template>
