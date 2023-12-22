/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `@perseid/core` mock.
 */

export const deepMerge = (_: unknown, variable: unknown): unknown => variable;
export const isPlainObject = (variable: unknown): boolean => typeof variable === 'object';
export const deepCopy = (variable: unknown): unknown => (typeof variable === 'object' ? { ...variable } : variable);
