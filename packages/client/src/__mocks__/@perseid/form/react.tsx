/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `@perseid/form/react` mock.
 */

export default function Form(props: unknown): JSX.Element {
  return (
    <div id="react-form">
      <span>{JSON.stringify(props)}</span>
    </div>
  );
}
