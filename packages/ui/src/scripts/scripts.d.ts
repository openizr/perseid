/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Default number of columns in the grid.
 */
export const gridColumns: number;

/**
 * Default breakpoints values.
 */
export const breakpoints: Record<string, string>;

/**
 * Default gaps values.
 */
export const gaps: Record<string, string>;

/**
 * Default shorthands.
 */
export const shorthands: Record<string, string[]>;

/**
 * Generates Perseid UI layout types definitions from `configuration`.
 *
 * @param configuration Configuration from which to generate the types definitions.
 * Contains the grid columns, gaps, breakpoints and shorthands to use.
 *
 * @returns Generated types definitions.
 */
export function generateTypeDefinitions(configuration: {
  gridColumns?: number;
  gaps?: Record<string, string>;
  breakpoints?: Record<string, string>;
  shorthands?: Record<string, string[]>;
}): string;

/**
 * Generates Perseid SCSS variables from `configuration`.
 *
 * @param configuration Configuration from which to generate the SASS variables definitions.
 * Contains the grid columns, gaps, breakpoints and shorthands to use.
 *
 * @param isDefault Whether to add the `!default` flag to the variables. Defaults to `false`.
 *
 * @returns Generated SASS variables definitions.
 */
export function generateSassVariables(configuration: {
  gridColumns?: number;
  gaps?: Record<string, string>;
  breakpoints?: Record<string, string>;
  shorthands?: Record<string, string[]>;
}, isDefault?: boolean): string;
