<!-- Default form step. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { computed } from 'vue';
import { type DefineComponent } from 'vue';
import type Engine from 'scripts/core/Engine';
import { type UseSubscription } from '@perseid/store/connectors/vue';
import DefaultField, { type FormFieldProps } from 'scripts/vue/DefaultField.vue';

interface Step {
  path: string;
  status: string;
  fields: (Record<string, unknown> | null)[];
}

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
  field?: DefineComponent<FormFieldProps>;

  /** `focus` event handler. */
  onFocus: (path: string) => () => void;

  /** Changes current active step. */
  setActiveStep: (stepPath: string) => void;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;
}

const props = withDefaults(defineProps<FormStepProps>(), {
  activeStep: undefined,
  field: DefaultField as unknown as undefined,
});

// Specifying the active step prevent browsers auto-fill system from changing fields
// located in other steps, resetting previous steps and breaking overall UX.
const isActive = computed(() => props.activeStep === props.step.path);
const cssPath = computed(() => props.step.path.replace(/\./g, '__'));
const className = computed(() => {
  const modifiers = [props.step.status, cssPath.value].concat(isActive.value ? ['active'] : []);
  return `perseid-form__step perseid-form__step--${[...new Set(modifiers)].join('--')}`;
});
</script>

<template>
  <div :id="cssPath" :class="className" @focus="onFocus(step.path)">
    <div class="perseid-form__step__fields">
      <!--
      Key is composed of both step and field ids, in order to ensure each field is correctly reset
      when user changes his journey in previous steps.
    -->
      <component
        :is="field"
        v-for="currentField of step.fields.filter((f) => f !== null)"
        :key="currentField.path"
        name="currentField"
        :engine="engine"
        :is-active="isActive"
        :path="currentField.path"
        :type="currentField.type"
        :error="currentField.error"
        :value="currentField.value"
        :status="currentField.status"
        :fields="currentField.fields"
        :active-step="activeStep"
        :is-required="currentField.isRequired"
        :set-active-step="setActiveStep"
        :use-subscription="useSubscription"
      />
    </div>
  </div>
</template>
