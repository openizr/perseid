<!--
  Optional form field.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/OptionalField.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { DefineComponent } from 'vue';
import { UIButton, buildClass } from '@perseid/ui/vue';

const props = withDefaults(defineProps<{
  path: string;
  type: string;
  value: unknown;
  status: string;
  isActive: boolean;
  modifiers: string;
  hideLabel: string;
  showLabel: string;
  fields?: unknown[];
  activeStep?: string;
  error: string | null;
  Field: DefineComponent<unknown>;
  setActiveStep:(path: string) => void;
  useSubscription:(id: string) => unknown;
  additionalProps: Record<string, unknown>;
  engine: { userAction:(params: { path: string; type: string; data: unknown; }) => void; };
}>(), {
  modifiers: '',
  fields: undefined,
  activeStep: undefined,
});

const toggleExpand = () => {
  const newData = (props.type === 'array') ? [] : {};
  props.engine.userAction({ type: 'input', path: props.path, data: (props.value === null) ? newData : null });
};
</script>

<template>
  <div :class="buildClass('optional-field', modifiers)">
    <UIButton
      :onClick="toggleExpand"
      modifiers="secondary outlined"
      :label="(value !== null) ? hideLabel : showLabel"
    />
    <component
      :is="Field"
      v-if="value !== null"
      isRequired
      :type="type"
      :path="path"
      :Field="Field"
      :error="error"
      :value="value"
      :fields="fields"
      :engine="engine"
      :status="status"
      :isActive="isActive"
      :activeStep="activeStep"
      :setActiveStep="setActiveStep"
      :useSubscription="useSubscription"
      :additionalProps="additionalProps"
    />
  </div>
</template>
