/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export const ref = vi.fn(() => ({ value: 'test' }));
export const onMounted = vi.fn((callback: () => unknown) => callback());
export const onUnmounted = vi.fn((callback: () => unknown) => callback());
