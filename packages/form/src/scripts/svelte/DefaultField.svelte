<!-- Default form field. -->

<script lang="ts" context="module">
  import { type SvelteComponent } from 'svelte';
  import type Engine from 'scripts/core/Engine';
  import { type UseSubscription } from '@perseid/store/connectors/svelte';

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
    Field: SvelteComponent<FormFieldProps>;

    /** Changes current active step. */
    setActiveStep: (stepPath: string) => void;

    /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
    useSubscription: UseSubscription;
  }
</script>

<script lang="ts">
  /**
   * Copyright (c) Openizr. All Rights Reserved.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  export let type: FormFieldProps['type'];
  export let path: FormFieldProps['path'];
  export let Field: FormFieldProps['Field'];
  export let value: FormFieldProps['value'];
  export let error: FormFieldProps['error'];
  export let engine: FormFieldProps['engine'];
  export let fields: FormFieldProps['fields'];
  export let status: FormFieldProps['status'];
  export let isActive: FormFieldProps['isActive'];
  export let activeStep: FormFieldProps['activeStep'];
  export let isRequired: FormFieldProps['isRequired'];
  export let setActiveStep: FormFieldProps['setActiveStep'];
  export let useSubscription: FormFieldProps['useSubscription'];
</script>

<pre>
  {JSON.stringify({
    path,
    type,
    status,
    error,
    isActive,
    activeStep,
    isRequired,
    value: (type === 'binary') ? '<Binary>' : value,
    Field: `<${String(typeof Field !== 'string' && 'Component')}>`,
    engine: `<${String(typeof engine !== 'string' && 'Engine')}>`,
    setActiveStep: `<${String(typeof setActiveStep !== 'string' && 'Function')}>`,
    useSubscription: `<${String(typeof useSubscription !== 'string' && 'Function')}>`,
    fields,
  }, null, 2)}
</pre>
