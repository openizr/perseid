<!-- Default form layout. -->

<script lang="ts" context="module">
  import { type SvelteComponent } from 'svelte';
  import { type FormState } from 'scripts/core/state';
  import { type UseSubscription } from '@perseid/store/connectors/svelte';

  /**
   * Form layout props.
   */
   export interface FormLayoutProps {
    /** Form state. */
    state: FormState;

    /** Loader component to use when loading a new step. */
    Loader: typeof SvelteComponent;

    /** Path of the currently active step. */
    activeStep?: string;

    /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
    useSubscription: UseSubscription;

    /** Changes current active step. */
    setActiveStep: (stepPath: string) => void;
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
  export let state: FormLayoutProps['state'];
  export let Loader: FormLayoutProps['Loader'];
  export let activeStep: FormLayoutProps['activeStep'];
  export let useSubscription: FormLayoutProps['useSubscription'];
  export let setActiveStep: FormLayoutProps['setActiveStep'];
</script>

<div class="perseid-form__steps">
  <slot />
  {#if state.loading && activeStep && typeof setActiveStep !== 'string' && typeof useSubscription !== 'string'}
    <svelte:component this={Loader} />
  {/if}
</div>
