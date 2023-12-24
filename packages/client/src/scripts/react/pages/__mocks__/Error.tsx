/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/pages/Error` mock.
 */

import * as React from 'react';

export default function Error(props: unknown): JSX.Element {
  return (
    <div id="error-page">{JSON.stringify(props)}</div>
  );
}
