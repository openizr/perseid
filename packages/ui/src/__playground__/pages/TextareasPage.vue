/* c8 ignore start */

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { UITextarea } from 'scripts/vue/index';

const newValue = ref('test');

onMounted(() => {
  setTimeout(() => {
    newValue.value = 'new test';
  }, 3000);
});

const { log } = console;

const onChange = (value: string): void => {
  log('Changed!', value);
};

const onBlur = (value: string): void => {
  log('Blurred!', value);
};

const onFocus = (): void => {
  log('Focused!');
};

const onPaste = (...args: unknown[]): void => {
  log('Pasted!', args);
};

</script>

<template>
  <div class="vgap-5">
    <main class="grid cols-1 hgap-3 vgap-5">
      <a href="/vue" class="cols-l-3">GO BACK</a>
      <UITextarea name="textarea1" />
      <UITextarea name="textarea2" label="*ui-textarea*" />
      <UITextarea name="textarea3" label="ui-textarea readonly" readonly />
      <UITextarea name="textarea4" label="ui-textarea with value" :value="newValue" />
      <UITextarea name="textarea5" label="ui-textarea with autofocus" autofocus />
      <UITextarea name="textarea6" label="ui-textarea with helper" helper="helper" />
      <UITextarea name="textarea7" label="ui-textarea with listener" :on-change="onChange" />
      <UITextarea
        name="textarea8"
        label="ui-textarea with debounce"
        :on-change="onChange"
        :debounce-timeout="250"
      />
      <UITextarea name="textarea9" label="ui-textarea with blur listener" :on-blur="onBlur" />
      <UITextarea name="textarea10" label="ui-textarea with maxlength" :maxlength="10" />
      <UITextarea
        name="textarea11"
        label="ui-textarea with placeholder"
        placeholder="placeholder"
      />
      <UITextarea
        name="textarea12"
        label="ui-textarea with rows and cols"
        :rows="10"
        :cols="10"
      />
      <UITextarea name="textarea13" label="ui-textarea disabled" modifiers="disabled" />
      <UITextarea name="textarea14" label="ui-textarea with autoresize" autoresize />
      <UITextarea
        :on-focus="onFocus"
        :on-paste="onPaste"
        name="textarea15"
        label="ui-textarea with focus listener"
      />
    </main>
  </div>
</template>
