<!-- Default form step. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Step } from 'scripts/core';
import { type DefineComponent } from 'vue';
import type Engine from 'scripts/core/Engine';
import { type UseSubscription } from '@perseid/store/connectors/vue';
import DefaultField, { type FormFieldProps } from 'scripts/vue/DefaultField.vue';

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
  fieldComponent?: DefineComponent<FormFieldProps>;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;
}

const props = withDefaults(defineProps<FormStepProps>(), {
  fieldComponent: DefaultField as unknown as undefined,
});
</script>

<template>
  <div class="perseid-form__step__fields">
    <!--
      Key is composed of both step and field ids, in order to ensure each field is correctly reset
      when user changes his journey in previous steps.
    -->
    <component
      :is="fieldComponent"
      v-for="field of props.step.fields.filter((field: Field) => field !== null)"
      :key="field.path"
      name="field"
      :path="field.path"
      :type="field.type"
      :error="field.error"
      :value="field.value"
      :status="field.status"
      :fields="field.fields"
      :active="props.active"
      :engine="props.engine"
      :required="field.required"
      :use-subscription="props.useSubscription"
    />
  </div>
</template>
