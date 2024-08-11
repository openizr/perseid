<!-- Mocked step. -->

<script lang="ts" context="module">
  import { type FormStepProps } from 'scripts/svelte/DefaultStep.svelte';
</script>

<script lang="ts">
  /**
   * Copyright (c) Openizr. All Rights Reserved.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  export let step: FormStepProps['step'];
  export let Field: FormStepProps['Field'];
  export let engine: FormStepProps['engine'];
  export let onFocus: FormStepProps['onFocus'];
  export let activeStep: FormStepProps['activeStep'];
  export let setActiveStep: FormStepProps['setActiveStep'];
  export let useSubscription: FormStepProps['useSubscription'];

  const json = JSON.stringify({
    Field: typeof Field,
    engine: typeof engine,
    step: step as unknown,
    activeStep: activeStep as unknown,
    onFocus: typeof onFocus,
    setActiveStep: typeof setActiveStep,
    useSubscription: typeof useSubscription,
  });
</script>

<div id="step">
  {json}
</div>
