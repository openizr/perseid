<!-- Default form step. -->

<script lang="ts" context="module">
  import type Engine from 'scripts/core/Engine';
  import { SvelteComponent } from 'svelte';
  import { type UseSubscription } from '@perseid/store/connectors/svelte';
  import { type FormFieldProps } from 'scripts/svelte/DefaultField.svelte';

  /**
   * Form step props.
   */
  export interface FormStepProps<T extends Engine = Engine> {
    /** Instance of the form engine. */
    engine: T;

    /** Form step to render. */
    step: Step;

    /** Whether step is currently active. */
    active: boolean;

    /** Field component to use for rendering. */
    Field: typeof SvelteComponent<FormFieldProps>;

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

  let FieldComponent: SvelteComponent;

  export let engine: FormStepProps['engine'];
  export let step: FormStepProps['step'];
  export let active: FormStepProps['active'];
  export let Field: FormStepProps['Field'];
  export let useSubscription: FormStepProps['useSubscription'];

  $: FieldComponent = Field as unknown as SvelteComponent;
</script>

<div class="perseid-form__step__fields">
   <!--
    Key is composed of both step and field ids, in order to ensure each field is correctly reset
    when user changes his journey in previous steps.
  -->
  {#each step.fields as field (`${field?.path}`)}
    {#if field !== null}
      <svelte:component
        this={Field}
        active={active}
        engine={engine}
        path={field.path}
        type={field.type}
        error={field.error}
        value={field.value}
        status={field.status}
        fields={field.fields}
        Field={FieldComponent}
        required={field.required}
        useSubscription={useSubscription}
      />
    {/if}
  {/each}
</div>
