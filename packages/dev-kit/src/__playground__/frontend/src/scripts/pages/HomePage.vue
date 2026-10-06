<!-- Home page. -->

<script lang="ts" setup>
import AppMessage from 'scripts/components/AppMessage.vue';

defineProps<{
  locale: Record<string, string>;
}>();
</script>

<template>
  <AppMessage :label="locale.LABEL_TEST" />
</template>
