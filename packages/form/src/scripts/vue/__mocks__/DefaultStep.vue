<!-- `scripts/vue/DefaultStep.vue` mock. -->
<script lang="ts" setup>

const props = withDefaults(defineProps<{
  step: unknown;
  engine: unknown;
  activeStep?: string;
  onFocus:(_: string) => void;
  setActiveStep: (_: string) => void;
  useSubscription: (_: string) => void;
}>(), {
  activeStep: undefined,
});

props.onFocus('root.1');
</script>

<template>
  <div id="default-step">
    {{ JSON.stringify({
      step: props.step,
      activeStep: props.activeStep,
      engine: `<${typeof props.engine !== 'string' && 'Engine'}>`,
      setActiveStep: `<${typeof props.setActiveStep !== 'string' && 'Function'}>`,
      useSubscription: `<${typeof props.useSubscription !== 'string' && 'Function'}>`,
    }) }}
  </div>
</template>
