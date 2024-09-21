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
import Engine, { type Field as FormField } from '@perseid/form';
import { type UseSubscription } from '@perseid/store/connectors/vue';
import DefaultField, { type FormFieldProps } from 'scripts/vue/components/form/DefaultField.vue';

/**
 * Form step props.
 */
export interface FormStepProps<T extends Engine = Engine> {
  /** Instance of the form engine. */
  engine: T;

  // /** Form step to render. */
  // step: Step;
  path: string;

  fields: (FormField | null)[];

  status: string;

  /** Path of the currently active step. */
  activeStep?: string;

  /** Field component to use for rendering. */
  Field?: DefineComponent<FormFieldProps>;

  /** `focus` event handler. */
  onFocus: (path: string) => () => void;

  /** Changes current active step. */
  setActiveStep: (stepPath: string) => void;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;

  /** Additional props to pass to children components. */
  additionalProps: Record<string, unknown>;
}

const props = withDefaults(defineProps<FormStepProps>(), {
  activeStep: undefined,
  Field: DefaultField as unknown as undefined,
});

// Specifying the active step prevent browsers auto-fill system from changing fields
// located in other steps, resetting previous steps and breaking overall UX.
const isActive = computed(() => props.activeStep === props.path);
const cssPath = computed(() => props.path.replace(/\./g, '__'));
const className = computed(() => {
  const modifiers = [props.status, cssPath.value].concat(isActive.value ? ['active'] : []);
  return `perseid-form__step perseid-form__step--${[...new Set(modifiers)].join('--')}`;
});
</script>

<template>
  <div :id="cssPath" :class="className" @focus="onFocus(path)">
    <div class="perseid-form__step__fields">
      <!--
      Key is composed of both step and field ids, in order to ensure each field is correctly reset
      when user changes his journey in previous steps.
    -->
      <component
        :is="Field"
        v-for="currentField of fields.filter((f) => f !== null)"
        :key="currentField.path as string"
        :Field="Field as DefineComponent<unknown>"
        :engine="props.engine"
        :is-active="isActive"
        :path="currentField.path"
        :type="currentField.type"
        :error="currentField.error"
        :value="currentField.value"
        :status="currentField.status"
        :fields="currentField.fields"
        :active-step="props.activeStep"
        :is-required="currentField.required"
        :set-active-step="props.setActiveStep"
        :use-subscription="props.useSubscription"
        :additional-props="additionalProps"
      />
    </div>
  </div>
</template>
