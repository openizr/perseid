/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/PageLayout` mock.
 */

import * as React from 'react';

interface PageLayoutProps { children: React.ReactNode; props: unknown; }

export default function PageLayout({ children, ...props }: PageLayoutProps): JSX.Element {
  return (
    <div id="page-layout">
      <span>{JSON.stringify(props)}</span>
      <div>{children}</div>
    </div>
  );
}
