<!-- Vue form. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  ref,
  watch,
  computed,
  onMounted,
  onBeforeUnmount,
  type DefineComponent,
} from 'vue';
import type Store from '@perseid/store';
import Engine from 'scripts/core/Engine';
import connect from '@perseid/store/connectors/vue';
import { type FormState } from 'scripts/core/state';
import DefaultLoader from 'scripts/vue/DefaultLoader.vue';
import DefaultStep, { type FormStepProps } from 'scripts/vue/DefaultStep.vue';
import DefaultField, { type FormFieldProps } from 'scripts/vue/DefaultField.vue';
import DefaultLayout, { type FormLayoutProps } from 'scripts/vue/DefaultLayout.vue';

/**
 * Vue form props.
 */
export interface FormProps {
  /** Form current active step. */
  activeStep?: string;

  /** Form configuration. */
  configuration: Record<string, unknown>;

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

let key = 0;

function onSubmit(event: Event): void {
  event.preventDefault();
}

function generateId(): string {
  key += 1;
  return `_${String(key)}`;
}

const props = withDefaults(defineProps<FormProps>(), {
  activeStep: undefined,
  engineClass: undefined,
  stepComponent: DefaultStep as unknown as undefined,
  fieldComponent: DefaultField as unknown as undefined,
  loaderComponent: DefaultLoader as unknown as undefined,
  layoutComponent: DefaultLayout as unknown as undefined,
});

const isWindowFocused = ref(false);
const keys = ref<Partial<Record<string, string>>>({});
const handleBlur = (): void => { isWindowFocused.value = false; };
const EngineClass = ((props.engineClass) ?? Engine) as unknown as typeof String;
const engine = new EngineClass(props.configuration);
const useSubscription = connect((engine as unknown as { getStore: () => Store; }).getStore());
const state = useSubscription('state', (newState: FormState) => {
  newState.steps.forEach((step) => { keys.value[step.path] ??= generateId(); });
  return newState;
});
const lastStep = computed(() => state.value.steps.at(-1));
const currentActiveStep = ref(props.activeStep ?? lastStep.value?.path);

const setCurrentActiveStep = (newActiveStep: string) => {
  currentActiveStep.value = newActiveStep;
};

const setActiveStep = (newActiveStep: string | undefined) => {
  // Prevents any additional rendering compared to calling directly `setCurrentActiveStep`.
  if (newActiveStep !== currentActiveStep.value && newActiveStep !== undefined) {
    // Forces step component to re-mount in order to reset scroll.
    keys.value[newActiveStep] = generateId();
    setCurrentActiveStep(newActiveStep);
  }
};

const handleFocus = (newActiveStep: string) => () => {
  if (isWindowFocused.value) { setActiveStep(newActiveStep); }
  isWindowFocused.value = true;
};

// Updates current step whenever `activeStep` prop or last step change.
// Be careful: last step path may not change although `lastStep` has (e.g. because it has been
// re-created or updated), so we need to react to this value instead.
watch(() => [props.activeStep, lastStep], () => {
  setActiveStep(props.activeStep ?? lastStep.value?.path);
});

// When focus gets out of and in back to the current window, the `focus` event gets triggered once
// again on the step, which leads to unwanted visual effects when displaying only current active
// step (the last focused step is displayed back). This mechanism prevents that from happening.
onMounted(() => {
  window.addEventListener('blur', handleBlur);
});
onBeforeUnmount(() => {
  window.removeEventListener('blur', handleBlur);
});
</script>

<template>
  <form :id="props.configuration.id as string" class="perseid-form" @submit="onSubmit">
    <component
      :is="layoutComponent"
      :state="state"
      :active-step="currentActiveStep"
      :set-active-step="setActiveStep"
      :loader-component="loaderComponent"
      :use-subscription="useSubscription"
    >
      <component
        :is="stepComponent"
        v-for="step of state.steps"
        :key="step.path"
        name="step"
        :step="step"
        :engine="engine as unknown as Engine"
        :on-focus="handleFocus"
        :set-active-step="setActiveStep"
        :use-subscription="useSubscription"
      />
    </component>
  </form>
</template>
