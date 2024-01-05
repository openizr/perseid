/* c8 ignore start */

<script lang="ts">
  import { UIFilePicker } from 'scripts/svelte/index';

  const { log } = console;

  const onChange = (value: File | File[]): void => {
    log('Changed!', value);
  };

  const onFocus = (): void => {
    log('Focused!');
  };
</script>

<div>
  <main class="grid cols-1 hgap-3 vgap-5">
    <a href="/svelte" class="cols-l-3">GO BACK</a>
    <UIFilePicker name="file-uploader1" />
    <UIFilePicker name="file-uploader2" label="*ui-file-uploader*" />
    <UIFilePicker name="file-uploader5" label="ui-file-uploader multiple" multiple />
    <UIFilePicker name="file-uploader5" label="ui-file-uploader with helper" helper="helper" />
    <UIFilePicker
      onChange={onChange}
      name="file-uploader6"
      label="ui-file-uploader with listener"
    />
    <UIFilePicker name="file-uploader11" label="ui-file-uploader disabled" modifiers="disabled" />
    <UIFilePicker name="file-uploader12" label="ui-file-uploader icon left" icon="star" />
    <UIFilePicker
      icon="star"
      iconPosition="right"
      name="file-uploader13"
      label="ui-file-uploader icon right"
    />
    <UIFilePicker
      onFocus={onFocus}
      name="file-uploader14"
      label="ui-file-uploader with focus listener"
    />
    <UIFilePicker name="file-uploader15" label="ui-file-uploader with accept" accept="image/*" />
    <UIFilePicker name="file-uploader16" label="ui-file-uploader with value" value={[new File([], 'test.png')]} />
  </main>
</div>
