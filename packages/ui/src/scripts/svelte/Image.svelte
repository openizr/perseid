<!-- Image. -->
<script lang="ts">
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { buildClass } from 'scripts/core/index';

export let src: string;
export let alt: string;
export let ratio: string;
export let modifiers = '';
export let lazy: boolean | undefined = true;
export let id: string | undefined = undefined;
export let itemProp: string | undefined = undefined;

// Enforces props default values.
$: modifiers = (modifiers as string | undefined) ?? '';

$: isCustomRatio = /^([0-9]+)x([0-9]+)$/i.test(ratio);
$: className = buildClass('ui-image', `${ratio} ${modifiers}`);
$: dimensions = (() => {
  let newDimensions;
  switch (ratio) {
    case 'square':
      return { width: 1, height: 1 };
    case 'portrait':
      return { width: 2, height: 3 };
    case 'landscape':
      return { width: 3, height: 2 };
    case 'panoramic':
      return { width: 16, height: 9 };
    default:
      newDimensions = ratio.split('x').map((value) => parseInt(value, 10));
      return { width: newDimensions[0], height: newDimensions[1] };
  }
})();
</script>

{#if isCustomRatio}
  <img
    {id}
    {src}
    {alt}
    class={className}
    itemprop={itemProp}
    width={dimensions.width}
    height={dimensions.height}
    loading={lazy ? 'lazy' : undefined}
  />
{:else}
  <div {id} class={className}>
    <img
      {src}
      {alt}
      itemprop={itemProp}
      width={dimensions.width}
      height={dimensions.height}
      loading={lazy ? 'lazy' : undefined}
    />
  </div>
{/if}
