/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/FormField` mock.
 */

export default function FormField(...context: unknown[]): unknown {
  return {
    class: 'form-field',
    args: JSON.stringify(context),
  };
}
