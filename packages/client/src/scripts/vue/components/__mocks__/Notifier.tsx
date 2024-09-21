/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/Notifier` mock.
 */

export default function Notifier(props: unknown): JSX.Element {
  return (
    <div id="notifier">{JSON.stringify(props)}</div>
  );
}
