<!-- Vue form. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Engine from 'scripts/core/Engine';
import { type Configuration } from 'scripts/core';
import { DefineComponent, ref, watch } from 'vue';
import connect from '@perseid/store/connectors/vue';
import { type FormState } from 'scripts/core/state';
import DefaultLoader from 'scripts/vue/DefaultLoader.vue';
import DefaultField, { FormFieldProps } from 'scripts/vue/DefaultField.vue';
import DefaultStep, { type FormStepProps } from 'scripts/vue/DefaultStep.vue';
import DefaultLayout, { type FormLayoutProps } from 'scripts/vue/DefaultLayout.vue';

/**
 * Vue form props.
 */
export interface FormProps {
  /** Form current active step. */
  activeStep?: string;

  /** Form configuration. */
  configuration: Configuration;

  /** Custom form engine class to use instead of the default engine. */
  engineClass?: typeof Engine;

  /** Default Layout component to use. */
  layoutComponent?: DefineComponent<FormLayoutProps>;

  /** Default Step component to use. */
  stepComponent?: DefineComponent<FormStepProps>;

  /** Default Field component to use. */
  fieldComponent?: DefineComponent<FormFieldProps>;

  /** Default Loader component to use. */
  loaderComponent?: DefineComponent;
}

function onSubmit(event: Event): void {
  event.preventDefault();
}

function buildClass(baseClass: string, modifiers: string): string {
  const chainedModifiers = [...new Set(modifiers.split(' '))].map((modifier) => (
    (modifier === '') ? '' : `--${modifier}`)).join('');
  return `${baseClass}${` ${baseClass}${chainedModifiers}`}`;
}

const props = withDefaults(defineProps<FormProps>(), {
  activeStep: '',
  engineClass: undefined,
  stepComponent: DefaultStep as unknown as undefined,
  fieldComponent: DefaultField as unknown as undefined,
  loaderComponent: DefaultLoader as unknown as undefined,
  layoutComponent: DefaultLayout as unknown as undefined,
});

const EngineClass = (props.engineClass as typeof Engine | null) ?? Engine;
const engine = new EngineClass(props.configuration as unknown);
const useSubscription = connect(engine.getStore());
const state = useSubscription<FormState>('state');

const currentActiveStep = ref(
  (props.activeStep as string | undefined)
  ?? state.value.steps[state.value.steps.length - 1]?.path,
);

const onFocus = (newActiveStep: string) => (): void => {
  // Prevents any additional rendering when calling directly `setCurrentActiveStep`.
  if (newActiveStep !== currentActiveStep.value) {
    currentActiveStep.value = newActiveStep;
  }
};

const setCurrentActiveStep = (newActiveStep: string) => (): void => {
  currentActiveStep.value = newActiveStep;
};

watch(() => [props.activeStep], () => {
  currentActiveStep.value = props.activeStep;
});
</script>

<template>
  <form :id="props.configuration.id" class="perseid-form" @submit="onSubmit">
    <component
      :is="layoutComponent"
      :state="state"
      :active-step="currentActiveStep"
      :loader-component="loaderComponent"
      :use-subscription="useSubscription"
      :set-active-step="setCurrentActiveStep"
    >
      <!--
        Specifying the active step prevent browsers auto-fill system from changing fields
        located in other steps, resetting previous steps and breaking overall UX.
      -->
      <div
        v-for="step of state.steps"
        :id="step.path.replace(/\./g, '__')"
        :key="step.path"
        :class="buildClass('perseid-form__step', [
          step.status,
          step.path.replace(/\./g, '__'),
          currentActiveStep === step.path ? 'active' : '',
        ].join(' '))"
        @focus="onFocus(step.path)"
      >
        <component
          :is="stepComponent"
          name="step"
          :step="step"
          :engine="engine"
          :use-subscription="useSubscription"
          :active="currentActiveStep === step.path"
        />
      </div>
    </component>
  </form>
</template>
