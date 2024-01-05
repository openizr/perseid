<!-- Title. -->
<script lang="ts">
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import markdown from 'scripts/core/markdown';
import buildClass from 'scripts/core/buildClass';

export let label: string;
export let modifiers = '';
export let id: string | undefined = undefined;
export let itemProp: string | undefined = undefined;
export let level: '1' | '2' | '3' | '4' | '5' | '6' = '1';

// Enforces props default values.
$: level = (level as '1' | undefined) ?? '1';
$: modifiers = (modifiers as string | undefined) ?? '';

$: fullModifiers = modifiers;
// Checks if any of the given modifiers corresponds to a valid level (1, 2, ...).
// By default, if no level is specified in modifiers, we set it to the `level` prop.
$: if (!/(^|\s)([1-6])($|\s)/i.test(modifiers)) {
  fullModifiers = `${fullModifiers} ${level}`;
}
$: className = buildClass('ui-title', fullModifiers);
</script>

{#if level === '1'}
  <h1 {id} class={className} itemprop={itemProp}>
    {@html markdown(label)}
  </h1>
{:else if level === '2'}
  <h2 {id} class={className} itemprop={itemProp}>
    {@html markdown(label)}
  </h2>
{:else if level === '3'}
  <h3 {id} class={className} itemprop={itemProp}>
    {@html markdown(label)}
  </h3>
{:else if level === '4'}
  <h4 {id} class={className} itemprop={itemProp}>
    {@html markdown(label)}
  </h4>
{:else if level === '5'}
  <h5 {id} class={className} itemprop={itemProp}>
    {@html markdown(label)}
  </h5>
{:else}
  <h6 {id} class={className} itemprop={itemProp}>
    {@html markdown(label)}
  </h6>
{/if}
