<!-- Paragraph. -->
<script lang="ts">
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { markdown, buildClass } from 'scripts/core/index';

export let label: string;
export let modifiers = '';
export let id: string | undefined = undefined;
export let itemProp: string | undefined = undefined;

// Enforces props default values.
$: id = id ?? undefined;
$: itemProp = itemProp ?? undefined;
$: modifiers = (modifiers as string | undefined) ?? '';

$: className = buildClass('ui-p', modifiers);
</script>

<p {id} class={className} itemprop={itemProp}>
  {@html markdown(label)}
</p>
