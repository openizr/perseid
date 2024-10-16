/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/ActionsWrapper` mock.
 */

export default function ActionsWrapper(props: unknown): JSX.Element {
  return (
    <div id="actions-wrapper">{JSON.stringify(props)}</div>
  );
}
