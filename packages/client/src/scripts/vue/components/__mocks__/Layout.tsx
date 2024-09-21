/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/Layout` mock.
 */

import * as React from 'react';

interface LayoutProps { children: React.ReactNode; props: unknown; }

export default function Layout({ children, ...props }: LayoutProps): JSX.Element {
  return (
    <div id="layout">
      <span>{JSON.stringify(props)}</span>
      <div>{children}</div>
    </div>
  );
}
