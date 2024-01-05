/* c8 ignore start */

<script lang="ts" setup>
import { UIFilePicker } from 'scripts/vue/index';

const { log } = console;

const onChange = (value: File | File[]): void => {
  log('Changed!', value);
};

const onFocus = (): void => {
  log('Focused!');
};

const value = [new File([], 'test.png')];
</script>

<template>
  <div>
    <main class="grid cols-1 hgap-3 vgap-5">
      <a href="/vue" class="cols-l-3">GO BACK</a>
      <UIFilePicker name="file-uploader1" />
      <UIFilePicker name="file-uploader2" label="*ui-file-uploader*" />
      <UIFilePicker name="file-uploader5" label="ui-file-uploader multiple" multiple />
      <UIFilePicker name="file-uploader5" label="ui-file-uploader with helper" helper="helper" />
      <UIFilePicker
        :on-change="onChange"
        name="file-uploader6"
        label="ui-file-uploader with listener"
      />
      <UIFilePicker name="file-uploader11" label="ui-file-uploader disabled" modifiers="disabled" />
      <UIFilePicker name="file-uploader12" label="ui-file-uploader icon left" icon="star" />
      <UIFilePicker
        icon="star"
        icon-position="right"
        name="file-uploader13"
        label="ui-file-uploader icon right"
      />
      <UIFilePicker
        :on-focus="onFocus"
        name="file-uploader14"
        label="ui-file-uploader with focus listener"
      />
      <UIFilePicker name="file-uploader15" label="ui-file-uploader with accept" accept="image/*" />
      <UIFilePicker
        name="file-uploader16"
        label="ui-file-uploader with value"
        :value="value"
      />
    </main>
  </div>
</template>
