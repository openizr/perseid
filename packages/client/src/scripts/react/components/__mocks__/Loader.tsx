/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/Loader` mock.
 */

import * as React from 'react';

export default function Loader(props: unknown): JSX.Element {
  return (
    <div id="loader">{JSON.stringify(props)}</div>
  );
}
