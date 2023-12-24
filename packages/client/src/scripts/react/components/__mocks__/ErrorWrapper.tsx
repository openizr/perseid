/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/ErrorWrapper` mock.
 */

import * as React from 'react';

interface ErrorWrapperProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  [key: string]: unknown;
}

export default function ErrorWrapper({
  children,
  fallback,
  ...props
}: ErrorWrapperProps): JSX.Element {
  return (
    <div id="error-wrapper">
      <span>{JSON.stringify(props)}</span>
      <div>{fallback}</div>
      <div>{children}</div>
    </div>
  );
}
