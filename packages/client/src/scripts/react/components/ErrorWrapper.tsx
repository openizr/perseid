/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';

/**
 * Error wrapper props.
 */
export interface ErrorWrapperProps {
  /** Components to wrap. */
  children?: React.ReactNode;

  /** Components to display when an error occurs. */
  fallback?: React.ReactNode;

  /** Callback to trigger when an error occurs. */
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

/**
 * Handles uncaught errors and displays a generic UI.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/ErrorWrapper.tsx
 */
export default class ErrorWrapper extends React.Component<ErrorWrapperProps, {
  hasError: boolean;
}> {
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  constructor(props: ErrorWrapperProps) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    const { onError } = this.props;
    onError?.(error, errorInfo);
  }

  render(): JSX.Element {
    const { hasError } = this.state;
    const { children, fallback } = this.props;
    return (hasError ? fallback : children) as JSX.Element;
  }
}
