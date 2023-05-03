<!-- App message. -->

<script lang="ts" setup>
import testJpg from 'images/test.jpg';
import testSvg from 'images/test.svg';

defineProps<{
  label: string;
}>();
</script>

<template>
  <p>
    <img alt="test" :src="testJpg">
    <img alt="test" :src="testSvg">
    <a>{{ label }}</a>
  </p>
</template>

<style scoped>
img {
  display: block;
  width: 50px;
  height: 50px;
}
</style>
