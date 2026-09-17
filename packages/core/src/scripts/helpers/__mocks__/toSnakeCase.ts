/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `toSnakeCase` mock.
 */
export default vi.fn((text: string): string => `TO_SNAKE_CASE_${text}`);
