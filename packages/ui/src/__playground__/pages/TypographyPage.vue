/* c8 ignore start */

<script lang="ts" setup>
import { UIP, UITitle, UILink } from 'scripts/vue/index';

const { log } = console;
const onClick = (event: MouseEvent): void => {
  log('Clicked!', event);
  event.preventDefault();
};
</script>

<template>
  <div class="vgap-5">
    <main class="ui-page ui-block cols-1 vgap-5">
      <a href="/vue" class="cols-l-3">GO BACK</a>
      <UITitle level="1" label="ui-title\n**ui-title--1 ui-title strong**" />
      <UITitle
        level="2"
        label="ui-title\nui-title--2\n~ui-title ui-title--2~"
      />
      <UITitle level="3" label="ui-title ui-title--3\nui-title ui-title--3" />
      <UITitle level="4" label="ui-title ui-title--4\nui-title ui-title--4" />
      <UITitle level="5" label="ui-title ui-title--5\nui-title ui-title--5" />
      <UITitle level="6" label="ui-title ui-title--6\nui-title ui-title--6" />
      <UIP
        :label="`
        ui-p ui-p ui-p ui-p ~ui-p italic~ _ui-p underline_ **ui-p strong** *ui-p emphasis* ui-p
        ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p
        ui-p ui-p ui-p ui-p ui-p ui-p ui-p ui-p
      `"
      />
      <UILink
        href="/"
        target="_blank"
        rel="nofollow noopener noreferer"
        label="ui-link"
        :on-click="onClick"
      />
    </main>
  </div>
</template>
