/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/ConfirmationModal` mock.
 */

export default function ConfirmationModal(props: unknown): JSX.Element {
  return (
    <div id="confirmation-modal">{JSON.stringify(props)}</div>
  );
}
