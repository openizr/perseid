<!-- Default form step. -->

<script lang="ts" context="module">
  import type Engine from 'scripts/core/Engine';
  import { type SvelteComponent } from 'svelte';
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

    /** Path of the currently active step. */
    activeStep?: string;

    /** Field component to use for rendering. */
    Field: typeof SvelteComponent<FormFieldProps>;

    /** `focus` event handler. */
    onFocus: (path: string) => () => void;

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

  let FieldComponent: SvelteComponent;

  export let step: FormStepProps['step'];
  export let Field: FormStepProps['Field'];
  export let engine: FormStepProps['engine'];
  export let onFocus: FormStepProps['onFocus'];
  export let activeStep: FormStepProps['activeStep'];
  export let setActiveStep: FormStepProps['setActiveStep'];
  export let useSubscription: FormStepProps['useSubscription'];

  // Specifying the active step prevent browsers auto-fill system from changing fields
  // located in other steps, resetting previous steps and breaking overall UX.
  $: isActive = activeStep === step.path;
  $: cssPath = step.path.replace(/\./g, '__');
  $: FieldComponent = Field as unknown as SvelteComponent;
  $: modifiers = [step.status, cssPath].concat(isActive ? ['active'] : []);
  $: className = `perseid-form__step perseid-form__step--${[...new Set(modifiers)].join('--')}`;
</script>

<div id={cssPath} class={className} on:focus={onFocus(step.path)}>
  <div class="perseid-form__step__fields">
    <!--
      Key is composed of both step and field ids, in order to ensure each field is correctly reset
      when user changes his journey in previous steps.
    -->
    {#each step.fields as field (String(field?.path))}
      {#if field !== null}
        <svelte:component
          this={Field}
          engine={engine}
          path={field.path}
          type={field.type}
          isActive={isActive}
          error={field.error}
          value={field.value}
          status={field.status}
          fields={field.fields}
          Field={FieldComponent}
          activeStep={activeStep}
          isRequired={field.required}
          setActiveStep={setActiveStep}
          useSubscription={useSubscription}
        />
      {/if}
    {/each}
  </div>
</div>
