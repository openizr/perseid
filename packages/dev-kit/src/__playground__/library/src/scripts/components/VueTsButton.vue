<template>
  <button>{{ label }}</button>
</template>

<script lang="ts">
/**
 * Button.
 */
export default {
  name: 'VueTsButton',
  props: {
    label: {
      type: String,
      required: true,
    },
  },
};
</script>

<style scoped>
button {
  color: blue;
}
</style>
