<!-- Svelte form. -->

<script lang="ts" context="module">
  import Engine from 'scripts/core/Engine';
  import { type FormState } from 'scripts/core/state';
  import { SvelteComponent, onMount, onDestroy } from 'svelte';
  import { type FormStepProps } from 'scripts/svelte/DefaultStep.svelte';
  import { type FormFieldProps } from 'scripts/svelte/DefaultField.svelte';
  import { type FormLayoutProps } from 'scripts/svelte/DefaultLayout.svelte';

  /**
   * Svelte form props.
   */
  export interface FormProps {
    /** Form current active step. */
    activeStep?: string;

    /** Form configuration. */
    configuration: Configuration,

    /** Custom form engine class to use instead of the default engine. */
    engineClass?: typeof Engine;

    /** Default Layout component to use. */
    Layout?: typeof SvelteComponent<FormLayoutProps>;

    /** Default Step component to use. */
    Step?: typeof SvelteComponent<FormStepProps>;

    /** Default Field component to use. */
    Field?: typeof SvelteComponent<FormFieldProps>;

    /** Default Loader component to use. */
    Loader?: typeof SvelteComponent;
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
  import connect from '@perseid/store/connectors/svelte';
  import DefaultStep from 'scripts/svelte/DefaultStep.svelte';
  import DefaultField from 'scripts/svelte/DefaultField.svelte';
  import DefaultLoader from 'scripts/svelte/DefaultLoader.svelte';
  import DefaultLayout from 'scripts/svelte/DefaultLayout.svelte';

  let key = 0;

  function onSubmit(event: Event): void {
    event.preventDefault();
  }

  function generateId(): string {
    key += 1;
    return `_${String(key)}`;
  }

  export let configuration: FormProps['configuration'];
  export let Step: FormProps['Step'] | null = null;
  export let Field: FormProps['Field'] | null = null;
  export let Loader: FormProps['Loader'] | null = null;
  export let Layout: FormProps['Layout'] | null = null;
  export let engineClass: FormProps['engineClass'] | null = null;
  export let activeStep: FormProps['activeStep'] | undefined = undefined;

  let isWindowFocused = true;
  let ActualLoader: typeof SvelteComponent;
  let currentActiveStep: string | undefined;
  let FieldComponent: typeof SvelteComponent;
  const keys: Partial<Record<string, string>> = {};
  const handleBlur = (): void => { isWindowFocused = false; };

  const setCurrentActiveStep = (newActiveStep: string) => (): void => {
    currentActiveStep = newActiveStep;
  };

  const setActiveStep = (newActiveStep: string | undefined) => {
    // Prevents any additional rendering compared to calling directly `setCurrentActiveStep`.
    if (newActiveStep !== currentActiveStep && newActiveStep !== undefined) {
      // Forces step component to re-mount in order to reset scroll.
      keys[newActiveStep] = generateId();
      setCurrentActiveStep(newActiveStep);
    }
  };

  const handleFocus = (newActiveStep: string) => (): void => {
    if (isWindowFocused) { setActiveStep(newActiveStep); }
    isWindowFocused = true;
  };


  // Enforces props default values.
  $: Step = Step ?? DefaultStep;
  $: Field = Field ?? DefaultField;
  $: Layout = Layout ?? DefaultLayout;
  $: activeStep = activeStep ?? undefined;
  $: ActualLoader = Loader as unknown as typeof SvelteComponent;
  $: FieldComponent = Field as unknown as typeof SvelteComponent;
  $: Loader = Loader ?? DefaultLoader as unknown as typeof SvelteComponent;

  const EngineClass = (engineClass as typeof Engine | null) ?? Engine;
  const engine = new EngineClass(configuration);
  const useSubscription = connect(engine.getStore());
  const state = useSubscription('state', (newState: FormState) => {
    newState.steps.forEach((step) => { keys[step.path] ??= generateId(); });
    return newState;
  });
  const lastStep = $state.steps.at(-1);

  // Updates current step whenever `activeStep` prop or last step change.
  // Be careful: last step path may not change although `lastStep` has (e.g. because it has been
  // re-created or updated), so we need to react to this value instead.
  $: currentActiveStep = activeStep ?? lastStep?.path;

  // When focus gets out of and in back to the current window, the `focus` event gets triggered once
  // again on the step, which leads to unwanted visual effects when displaying only current active
  // step (the last focused step is displayed back). This mechanism prevents that from happening.
  onMount(() => {
    window.addEventListener('blur', handleBlur);
  });
  onDestroy(() => {
    window.removeEventListener('blur', handleBlur);
  });
</script>

<form id={configuration.id} class="perseid-form" on:submit={onSubmit}>
  <svelte:component
    this={Layout}
    state={$state}
    Loader={ActualLoader}
    setActiveStep={setActiveStep}
    activeStep={currentActiveStep}
    useSubscription={useSubscription}
    >
    {#each $state.steps as step (step.path)}
    <svelte:component
      step={step}
      this={Step}
      engine={engine}
      onFocus={handleFocus}
      Field={FieldComponent}
      setActiveStep={setActiveStep}
      activeStep={currentActiveStep}
      useSubscription={useSubscription}
      />
    {/each}
  </svelte:component>
</form>
