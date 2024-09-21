/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/Icon` mock.
 */

export default function Icon(props: unknown): JSX.Element {
  return (
    <i id="icon">{JSON.stringify(props)}</i>
  );
}
