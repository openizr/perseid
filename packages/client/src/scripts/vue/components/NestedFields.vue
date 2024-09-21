<!--
  Nested fields (array / object) form component.

  @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/NestedFields.vue
-->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { ref, watch, type DefineComponent } from 'vue';
import { buildClass, UIButton } from '@perseid/ui/vue';

const props = withDefaults(defineProps<{
  id?: string;
  path: string;
  type: string;
  label?: string;
  status: string;
  value: unknown;
  helper?: string;
  minItems: number;
  maxItems?: number;
  isActive: boolean;
  modifiers: string;
  activeStep?: string;
  error: string | null;
  _canonicalPath?: string;
  Field: DefineComponent<unknown>;
  setActiveStep:(path: string) => void;
  useSubscription:(id: string) => unknown;
  additionalProps: Record<string, unknown>;
  addButtonProps?: Record<string, unknown>;
  removeButtonProps?: Record<string, unknown>;
  fields: {
    path: string;
    required: boolean;
    type: string;
    value: unknown;
    status: string;
    fields?: unknown[];
    error: string | null;
  }[];
  engine: { userAction:(params: { path: string; type: string; data: unknown; }) => void; };
}>(), {
  minItems: 0,
  modifiers: '',
  id: undefined,
  label: undefined,
  helper: undefined,
  maxItems: Infinity,
  activeStep: undefined,
  _canonicalPath: undefined,
  addButtonProps: undefined,
  removeButtonProps: undefined,

});

const currentFields = ref(props.fields);
const className = buildClass('ui-nested-fields', [props.modifiers, props.type].join(' '));

const addItem = () => {
  const newValue = ((props.value as null | unknown[]) ?? []).concat([null]);
  props.engine.userAction({ path: props.path, type: 'input', data: newValue });
};

const removeItem = (index: number) => (): void => {
  currentFields.value = currentFields.value.slice(0, index)
    .concat(currentFields.value.slice(index + 1));
  const value = props.value as unknown[];
  const newValue = value.slice(0, index).concat(value.slice(index + 1));
  props.engine.userAction({ path: props.path, type: 'input', data: newValue });
};

// Updates current fields whenever `fields` prop changes.
watch(() => props.fields, () => {
  currentFields.value = props.fields;
});

// Adds new fields if length does not fit minimum length.
watch(() => props.minItems, () => {
  const value = props.value as unknown[] | null;
  if (props.type === 'array' && value !== null && value.length < props.minItems) {
    const newValue = value.concat(new Array(props.minItems - value.length).fill(null));
    props.engine.userAction({ path: props.path, type: 'input', data: newValue });
  }
});

// Removes extra fields if length does not fit maximum length.
watch(() => props.maxItems, () => {
  const value = props.value as unknown[] | null;
  if (props.type === 'array' && value !== null && value.length > props.maxItems) {
    currentFields.value = currentFields.value.slice(0, props.maxItems);
    const newValue = value.slice(0, props.maxItems);
    props.engine.userAction({ path: props.path, type: 'input', data: newValue });
  }
});
</script>

<template>
  <div :id="id" :class="className">
    <span v-if="label !== undefined" class="ui-nested-fields__label">{{ label }}</span>
    <div
      v-for="(field, index) in currentFields.filter((field) => field !== null)"
      :key="field.path"
      class="ui-nested-fields__field"
    >
      <UIButton
        v-if="type !== 'object' && currentFields.length > minItems"
        type="button"
        icon="delete"
        :onClick="removeItem(index)"
        v-bind="removeButtonProps"
      />
      <component
        :is="Field"
        :Field="Field"
        :engine="engine"
        :type="field.type"
        :path="field.path"
        :value="field.value"
        :error="field.error"
        :isActive="isActive"
        :status="field.status"
        :fields="field.fields"
        :activeStep="activeStep"
        :isRequired="field.required"
        :setActiveStep="setActiveStep"
        :additionalProps="{
          ...additionalProps,
          _canonicalPath: `${String(_canonicalPath)}.${String(type === 'array'
            ? '$n' : field.path.split('.').at(-1))}`
        }"
        :useSubscription="useSubscription"
      />
    </div>
    <UIButton
      v-if="type === 'array'"
      icon="plus"
      :onClick="addItem"
      :disabled="currentFields.length >= maxItems"
      v-bind="addButtonProps"
    />
    <span v-if="helper !== undefined" class="ui-nested-fields__helper">{{ helper }}</span>
  </div>
</template>
