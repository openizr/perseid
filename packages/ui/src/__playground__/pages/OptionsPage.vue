/* c8 ignore start */

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { UIOptions } from 'scripts/vue/index';

const { log } = console;

const onChange = (value: string | string[]): void => {
  log('Changed!', value);
};

const onFocus = (value: string): void => {
  log('Focused!', value);
};

const newValue = ref('option3');

const options = [
  {
    type: 'option',
    label: '*Option 1*',
    value: 'option1',
  },
  {
    type: 'option',
    label: 'Option 2',
    value: 'option2',
  },
  {
    type: 'option',
    label: 'Option 3',
    value: 'option3',
  },
  {
    type: 'option',
    label: 'Option 4',
    value: 'option4',
    disabled: true,
  },
];

const selectOptions = [
  {
    label: '*Group 1*',
    type: 'header',
  },
  {
    label: '**Option** & 1',
    value: 'option1',
    disabled: false,
    type: 'option',
  },
  {
    label: 'Option 2',
    value: 'option2',
    disabled: true,
    type: 'option',
  },
  {
    type: 'divider',
  },
  {
    label: 'Option 4',
    value: 'option4',
    disabled: false,
    type: 'option',
  },
  {
    label: 'Option 5',
    value: 'option5',
    disabled: false,
    type: 'option',
  },
  {
    label: 'Option 6',
    value: 'option6',
    disabled: false,
    type: 'option',
  },
];

const v = ref(selectOptions);
onMounted(() => {
  setTimeout(() => {
    newValue.value = 'option1';
    v.value = selectOptions.slice(0, 3);
  }, 3000);
});
</script>

<template>
  <div class="vgap-5">
    <main class="grid cols-1 hgap-3 vgap-5">
      <a href="/vue" class="cols-l-3">GO BACK</a>
      <!-- Single -->
      <UIOptions name="radio1" :options="options" />
      <UIOptions name="radio2" value="option3" label="*Radio*" :options="options" />
      <UIOptions
        name="radio3"
        :value="newValue"
        label="Radio with value"
        :options="options"
      />
      <UIOptions
        name="radio4"
        value="option3"
        label="Radio with helper"
        helper="helper"
        :options="options"
      />
      <UIOptions
        name="radio5"
        value="option3"
        label="Radio with listener"
        :options="options"
        :on-change="onChange"
      />
      <UIOptions name="radio6" value="option3" label="Radio disabled" :options="options" />
      <UIOptions
        name="radio7"
        value="option3"
        label="Radio with focus listener"
        :options="options"
        :on-focus="onFocus"
      />

      <!-- Multiple -->
      <UIOptions
        name="checkbox6"
        :options="options"
        multiple
        label="Checkboxes disabled"
        :on-focus="onFocus"
        :on-change="onChange"
      />
      <UIOptions name="checkbox1" multiple :options="options" />
      <UIOptions name="checkbox2" multiple :options="options" label="*Checkboxes*" />
      <UIOptions
        name="checkbox4"
        multiple
        :options="v"
        label="Checkboxes with helper"
        helper="helper"
      />
      <UIOptions
        name="checkbox3"
        multiple
        :options="options"
        label="Checkboxes with value"
        :value="newValue"
      />
      <UIOptions
        name="checkbox5"
        multiple
        :options="options"
        label="Checkboxes with listener"
        :on-change="onChange"
      />
      <UIOptions
        name="checkbox7"
        multiple
        :options="options"
        label="Checkboxes with focus listener"
        :on-focus="onFocus"
      />

      <!-- Selects -->
      <UIOptions
        name="dropdown1"
        select
        :options="selectOptions"
        :value="['option1']"
        label="*Select*"
        :on-change="onChange"
      />
      <UIOptions
        name="dropdown2"
        select
        :options="selectOptions"
        :value="['option1']"
        label="Select disabled"
      />
      <UIOptions
        name="dropdown3"
        select
        :options="selectOptions"
        value="option1"
        label="Select large"
        :on-focus="onFocus"
        :on-change="onChange"
      />
      <UIOptions
        name="dropdown4"
        select
        :options="selectOptions"
        :value="newValue"
        label="Select large"
        select-position="bottom"
      />
      <UIOptions
        name="dropdown5"
        select
        :options="selectOptions"
        :value="['option1']"
        label="Select"
        modifiers="disabled"
      />
      <UIOptions
        name="dropdown6"
        select
        :options="selectOptions"
        value="option1"
        multiple
        label="Select with focus listener"
        :on-focus="onFocus"
        :on-change="onChange"
      />
      <UIOptions
        name="dropdown7"
        select
        placeholder="test"
        :options="selectOptions"
        label="Select with placeholder"
      />
      <UIOptions
        name="dropdown8"
        select
        :options="selectOptions"
        label="Select with no placeholder"
      />
      <UIOptions
        name="dropdown9"
        select
        :options="selectOptions"
        value="option4"
        expanded
        label="Select expanded"
      />
    </main>
  </div>
</template>
