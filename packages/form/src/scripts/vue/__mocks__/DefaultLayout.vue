<!-- `scripts/vue/DefaultLayout.vue` mock. -->
<script lang="ts" setup>
const props = defineProps<{
  setActiveStep:(step: string) => void;
  }>();

props.setActiveStep('end');
</script>

<template>
  <div id="default-layout">
    <slot />
  </div>
</template>
