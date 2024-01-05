<!-- Title. -->
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
  level?: '1' | '2' | '3' | '4' | '5' | '6';
}>(), {
  level: '1',
  modifiers: '',
  id: undefined,
  itemProp: undefined,
});

const className = computed(() => {
  let fullModifiers = props.modifiers;
  // Checks if any of the given modifiers corresponds to a valid level (1, 2, ...).
  // By default, if no level is specified in modifiers, we set it to the `level` prop.
  if (!/(^|\s)([1-6])($|\s)/i.test(props.modifiers)) {
    fullModifiers = `${props.modifiers} ${props.level}`;
  }
  return buildClass('ui-title', fullModifiers);
});
</script>

<template>
  <component
    :is="`h${level}`"
    :id="id"
    :class="className"
    :itemprop="itemProp"
    v-html="markdown(props.label)"
  />
</template>
