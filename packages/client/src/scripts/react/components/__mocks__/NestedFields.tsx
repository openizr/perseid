/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/NestedFields` mock.
 */

export default function NestedFields(props: unknown): JSX.Element {
  return (
    <div id="nested-fields">{JSON.stringify(props)}</div>
  );
}
