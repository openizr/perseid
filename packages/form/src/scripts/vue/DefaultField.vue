<!-- Default form field. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Field } from 'scripts/core';
import { type DefineComponent } from 'vue';
import type Engine from 'scripts/core/Engine';
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
  type: Field['type'];

  /** Field full path in the form. */
  path: Field['path'];

  /** Field value. */
  value: Field['value'];

  /** Field error, if any. */
  error: Field['error'];

  /** Field status. */
  status: Field['status'];

  /** Field sub-fields (for objects and arrays only). */
  fields?: Field['fields'];

  /** Whether field is required. */
  isRequired: Field['required'];

  /** Field component to use for rendering. */
  field?: DefineComponent;

  /** Changes current active step. */
  setActiveStep: (stepPath: string) => void;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;
}

const props = withDefaults(defineProps<FormFieldProps>(), {
  field: this,
  fields: undefined,
  activeStep: undefined,
});
</script>

<template>
  <pre>
    {{ JSON.stringify({
      path: props.path,
      type: props.type,
      status: props.status,
      error: props.error,
      isActive: props.isActive,
      isRequired: props.isRequired,
      activeStep: props.activeStep,
      value: (props.type === 'binary') ? '<Binary>' : props.value,
      field: `<${typeof props.field !== 'string' && 'Component'}>`,
      engine: `<${typeof props.engine !== 'string' && 'Engine'}>`,
      setActiveStep: `<${typeof props.setActiveStep !== 'string' && 'Function'}>`,
      useSubscription: `<${typeof props.useSubscription !== 'string' && 'Function'}>`,
      fields: props.fields,
    }, null, 2) }}
  </pre>
</template>
