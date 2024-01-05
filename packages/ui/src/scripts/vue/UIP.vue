<!-- Paragraph. -->
<script lang="ts" setup>
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { computed } from 'vue';
import markdown from 'scripts/core/markdown';
import buildClass from 'scripts/core/buildClass';

const props = withDefaults(defineProps<{
  id?: string;
  label: string;
  itemProp?: string;
  modifiers?: string;
}>(), {
  modifiers: '',
  id: undefined,
  itemProp: undefined,
});

const className = computed(() => buildClass('ui-p', props.modifiers));
</script>

<template>
  <p
    :id="id"
    :class="className"
    :itemprop="itemProp"
    v-html="markdown(props.label)"
  />
</template>
