/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/Pagination` mock.
 */

interface PaginationProps {
  [key: string]: unknown;
  onClick?: (page: number) => () => void;
}

export default function Pagination({ onClick, ...props }: PaginationProps): JSX.Element {
  // Covers `onClick` handler.
  if (onClick !== undefined) {
    onClick(1)();
  }
  return (
    <div id="pagination">{JSON.stringify(props)}</div>
  );
}
