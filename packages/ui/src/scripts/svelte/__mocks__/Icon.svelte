<!-- `scripts/svelte/Icon.svelte` mock. -->
<script lang="ts">
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export let name: string;
export let modifiers = '';
export let id: string | undefined = undefined;
</script>

<i id="icon">{JSON.stringify({ name, modifiers, id })}</i>
