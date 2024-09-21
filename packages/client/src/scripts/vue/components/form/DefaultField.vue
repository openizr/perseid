<!-- Default form field. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type DefineComponent } from 'vue';
import Engine, { type Field as FormField } from '@perseid/form';
import { type UseSubscription } from '@perseid/store/connectors/vue';

/**
 * Form field props.
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
  isRequired: FormField['required'];

  /** Field component to use for rendering. */
  Field: DefineComponent<unknown>;

  /** Changes current active step. */
  setActiveStep: (stepPath: string) => void;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;

  /** Additional props to pass to children components. */
  additionalProps?: Record<string, unknown>;
}

const props = withDefaults(defineProps<FormFieldProps>(), {
  fields: undefined,
  activeStep: undefined,
  additionalProps: undefined,
});
</script>

<template>
  <pre>
    {{ JSON.stringify({
      additionalProps,
      path: props.path,
      type: props.type,
      status: props.status,
      error: props.error,
      isActive: props.isActive,
      isRequired: props.isRequired,
      activeStep: props.activeStep,
      value: (props.type === 'binary') ? '<Binary>' : props.value,
      field: `<${typeof props.Field !== 'string' && 'Component'}>`,
      engine: `<${typeof props.engine !== 'string' && 'Engine'}>`,
      setActiveStep: `<${typeof props.setActiveStep !== 'string' && 'Function'}>`,
      useSubscription: `<${typeof props.useSubscription !== 'string' && 'Function'}>`,
      fields: props.fields,
    }, null, 2) }}
  </pre>
</template>
