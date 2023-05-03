<!-- Home page. -->

<script lang="ts" setup>
import { Locale } from 'basx/i18n';
import AppMessage from 'scripts/components/AppMessage.vue';

defineProps<{
  locale: Locale;
}>();
</script>

<template>
  <AppMessage :label="locale.LABEL_TEST" />
</template>
