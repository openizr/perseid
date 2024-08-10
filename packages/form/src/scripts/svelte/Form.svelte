<!-- Svelte form. -->

<script lang="ts" context="module">
  import { SvelteComponent } from 'svelte';
  import Engine from 'scripts/core/Engine';
  import { type FormState } from 'scripts/core/state';
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

  function onSubmit(event: Event): void {
    event.preventDefault();
  }

  function buildClass(baseClass: string, modifiers: string): string {
    const chainedModifiers = [...new Set(modifiers.split(' '))].map((modifier) => (
      (modifier === '') ? '' : `--${modifier}`)).join('');
    return `${baseClass} ${baseClass}${chainedModifiers}`;
  }

  export let activeStep: FormProps['activeStep'];
  export let configuration: FormProps['configuration'];
  export let Step: FormProps['Step'] | null = null;
  export let Field: FormProps['Field'] | null = null;
  export let Loader: FormProps['Loader'] | null = null;
  export let Layout: FormProps['Layout'] | null = null;
  export let engineClass: FormProps['engineClass'] | null = null;

  let currentActiveStep: string;
  let ActualLoader: typeof SvelteComponent;
  let FieldComponent: typeof SvelteComponent;

  const onFocus = (newActiveStep: string) => (): void => {
    // Prevents any additional rendering when calling directly `setCurrentActiveStep`.
    if (newActiveStep !== currentActiveStep) {
      currentActiveStep = newActiveStep;
    }
  };

  const setCurrentActiveStep = (newActiveStep: string) => (): void => {
    currentActiveStep = newActiveStep;
  };

  // Enforces props default values.
  $: Step = Step ?? DefaultStep;
  $: Field = Field ?? DefaultField;
  $: Layout = Layout ?? DefaultLayout;
  $: ActualLoader = Loader as unknown as typeof SvelteComponent;
  $: FieldComponent = Field as unknown as typeof SvelteComponent;
  $: Loader = Loader ?? DefaultLoader as unknown as typeof SvelteComponent;

  const EngineClass = (engineClass as typeof Engine | null) ?? Engine;
  const engine = new EngineClass(configuration);
  const useSubscription = connect(engine.getStore());
  const state = useSubscription<FormState>('state');
  const lastStepPath = $state.steps[$state.steps.length - 1]?.path;

  // Updates current step whenever `activeStep` prop or steps change.
  $: currentActiveStep = activeStep ?? lastStepPath;
</script>

<form id={configuration.id} class="perseid-form" on:submit={onSubmit}>
  <svelte:component
    this={Layout}
    state={$state}
    Loader={ActualLoader}
    activeStep={currentActiveStep}
    useSubscription={useSubscription}
    setActiveStep={setCurrentActiveStep}
  >
    {#each $state.steps as step (step.path)}
      <!--
        Specifying the active step prevent browsers auto-fill system from changing fields
        located in other steps, resetting previous steps and breaking overall UX.
      -->
      <div
        on:focus={onFocus(step.path)}
        id={step.path.replace(/\./g, '__')}
        class={buildClass('perseid-form__step', [step.status, step.path.replace(/\./g, '__'), currentActiveStep === step.path ? 'active' : ''].join(' '))}
      >
        <svelte:component
          step={step}
          this={Step}
          engine={engine}
          Field={FieldComponent}
          useSubscription={useSubscription}
          active={currentActiveStep === step.path}
        />
      </div>
    {/each}
  </svelte:component>
</form>
