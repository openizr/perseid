/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Transforms `text` into SNAKE_CASE.
 *
 * @param text Text to transform.
 *
 * @returns Transformed text.
 */
export default function toSnakeCase(text: string): string {
  return (text.match(/([A-Z])/g) ?? [] as string[]).reduce((match, char: string) => (
    match.replace(new RegExp(char), `_${char.toLowerCase()}`)
  ), text).toUpperCase();
}
