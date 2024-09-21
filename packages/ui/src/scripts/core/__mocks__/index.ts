/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/core/index` mock.
 */

export const generateRandomId = vi.fn(() => 'z8a8d7a5zad4');
export const markdown = vi.fn((label: string) => `<strong>${label}</strong>`);
export const buildClass = vi.fn((baseClass: string, modifiers = '') => `${baseClass} ${String(modifiers)}`);
