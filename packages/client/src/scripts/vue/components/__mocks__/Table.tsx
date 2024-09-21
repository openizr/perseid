/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/react/components/Table` mock.
 */

import * as React from 'react';

interface TableProps {
  [key: string]: unknown;
  onSort?: (sorting: unknown) => void;
  rows?: { value: Record<string, React.ReactNode>; }[];
  columns: { component: React.ReactNode; path: string; }[];
}

export default function Table({
  rows,
  onSort,
  columns,
  ...props
}: TableProps): JSX.Element {
  // Covers `onSort` handler.
  if (onSort !== undefined) {
    onSort({ field1: 1 });
  }
  return (
    <div id="table">
      <span>{JSON.stringify(props)}</span>
      <div>
        {columns.map(({ component, ...rest }, index) => {
          const key = index;
          return (
            <div key={key}>
              <span>{JSON.stringify(rest)}</span>
              {component}
            </div>
          );
        })}
      </div>
      <div>
        {rows?.map((row, index) => {
          const key = index;
          return (
            <div key={key}>
              {columns.map((column) => (
                <React.Fragment key={column.path}>
                  {row.value[column.path]}
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
