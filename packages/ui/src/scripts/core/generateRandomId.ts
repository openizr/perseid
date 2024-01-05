/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Generates a random HTML id.
 *
 * @returns The generated id.
 */
export default function generateRandomId(): string {
  return `_${Math.random().toString(36).slice(2, 8)}`;
}
