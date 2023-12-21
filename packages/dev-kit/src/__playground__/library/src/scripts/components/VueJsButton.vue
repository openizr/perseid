<template>
  <button>{{ label }}</button>
</template>

<script>
/**
 * Button.
 */
export default {
  name: 'VueJsButton',
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
  color: red;
}
</style>
