<!-- Default form layout. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type DefineComponent } from 'vue';
import { type FormState } from 'scripts/core/state';
import DefaultLoader from 'scripts/vue/DefaultLoader.vue';
import { type UseSubscription } from '@perseid/store/connectors/vue';

/**
 * Form layout props.
 */
export interface FormLayoutProps {
  /** Loader component to use when loading a new step. */
  loaderComponent?: DefineComponent;

  /** Form state. */
  state: FormState;

  /** Path of the currently active step. */
  activeStep?: string;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;

  /** Changes current active step. */
  setActiveStep: (stepPath: string) => void;
}

const props = withDefaults(defineProps<FormLayoutProps>(), {
  activeStep: undefined,
  loaderComponent: DefaultLoader as unknown as undefined,
});
</script>

<template>
  <div class="perseid-form__steps">
    <slot />
    <component
      :is="loaderComponent"
      v-if="(
        props.state.loading
        && props.activeStep
        && typeof props.setActiveStep !== 'string'
        && typeof props.useSubscription !== 'string'
      )"
    />
  </div>
</template>
