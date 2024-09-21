/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/Menu` mock.
 */

export default function Menu(props: unknown): JSX.Element {
  return (
    <div id="menu">{JSON.stringify(props)}</div>
  );
}
