<!-- Hyperlink. -->
<script lang="ts">
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { markdown, buildClass } from 'scripts/core/index';

export let href: string;
export let label: string;
export let modifiers = '';
export let id: string | undefined = undefined;
export let rel: string | undefined = undefined;
export let disabled: boolean | undefined = false;
export let target: string | undefined = undefined;
export let onClick: ((event: MouseEvent) => void) | undefined = undefined;

// Enforces props default values.
$: modifiers = (modifiers as string | undefined) ?? '';

$: className = buildClass('ui-link', `${modifiers}${disabled ? ' disabled' : ''}`);

// -----------------------------------------------------------------------------------------------
// CALLBACKS DECLARATION.
// -----------------------------------------------------------------------------------------------

const handleClick = (event: MouseEvent): void => {
  if (onClick !== undefined && !disabled) {
    onClick(event);
  }
};
</script>

<a {id} {rel} {href} class={className} {target} on:click={handleClick} tabIndex={disabled ? -1 : 0}>
  {@html markdown(label)}
</a>
