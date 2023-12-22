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
  active: boolean;

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
  required: Field['required'];

  /** Field component to use for rendering. */
  fieldComponent?: DefineComponent;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;
}

const props = withDefaults(defineProps<FormFieldProps>(), {
  fields: undefined,
  fieldComponent: this,
});
</script>

<template>
  <pre>
    {{ JSON.stringify({
      path: props.path,
      type: props.type,
      status: props.status,
      error: props.error,
      active: props.active,
      required: props.required,
      value: (props.type === 'binary') ? '<Binary>' : props.value,
      field: `<${typeof props.fieldComponent !== 'string' && 'Component'}>`,
      engine: `<${typeof props.engine !== 'string' && 'Engine'}>`,
      useSubscription: `<${typeof props.useSubscription !== 'string' && 'Function'}>`,
      fields: props.fields,
    }, null, 2) }}
  </pre>
</template>
