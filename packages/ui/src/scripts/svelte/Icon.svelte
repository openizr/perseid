<!-- Basic icon. -->
<script lang="ts">
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import buildClass from 'scripts/core/buildClass';

export let name: string;
export let modifiers = '';
export let id: string | undefined = undefined;

// Enforces props default values.
$: modifiers = (modifiers as string | undefined) ?? '';

$: className = buildClass('ui-icon', `${name} ${modifiers}`);
</script>

<i
  id={id}
  class={className}
/>
