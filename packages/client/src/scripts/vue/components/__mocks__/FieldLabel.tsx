/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/FieldLabel` mock.
 */

export default function FieldLabel(props: unknown): JSX.Element {
  return (
    <div id="field-label">{JSON.stringify(props)}</div>
  );
}
