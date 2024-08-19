/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { buildClass, generateRandomId } from '@perseid/ui/react';

/**
 * Table column.
 */
export interface TableColumn {
  /** Field path for that column. */
  path: string;

  /** Whether field can be sorted. */
  isSortable?: boolean;

  /** Component to display for that column. */
  component: React.ReactNode;
}

/**
 * Table row.
 */
export interface TableRow {
  /** List of columns values for this row. */
  value: Record<string, unknown>;

  /** Callback triggered when clicking on this row. */
  onClick?: () => void;
}

/**
 * Generic table props.
 */
export interface TableProps {
  /** Sorting options */
  sorting?: Sorting;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** Callback triggered when changing table sorting. */
  onSort?: (newSorting: Sorting) => void;

  /** List of table rows. Defaults to `null`. */
  rows?: TableRow[] | null;

  /** List of table columns. */
  columns: TableColumn[];

  /** Table labels. */
  labels: {
    loading?: string;
    noResult?: string;
    fallback?: string;
  };
}

const defaultSorting = {};
const defaultOnSort = (): void => { /* No-op. */ };
const sortingModifiers: Record<string, 'ascending' | 'descending' | 'none'> = {
  1: 'ascending',
  '-1': 'descending',
};

/**
 * Generic table.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Table.tsx
 */
function Table({
  labels,
  columns,
  rows = null,
  modifiers = '',
  onSort = defaultOnSort,
  sorting = defaultSorting,
}: TableProps): JSX.Element {
  const rowKeys = (rows?.map(generateRandomId) ?? []);
  const [currentSorting, setCurrentSorting] = React.useState<Sorting>(sorting);
  const className = buildClass('table', `${modifiers} ${rows === null ? 'loading' : ''} ${rows?.length === 0 ? 'no-result' : ''}`);

  const sortBy = React.useCallback((column: string) => (): void => {
    setCurrentSorting((previousState) => {
      let newState: Sorting;
      const { [column]: columnValue, ...rest } = previousState;
      if (columnValue as unknown === undefined) {
        newState = { ...previousState, [column]: 1 };
      } else if (columnValue === 1) {
        newState = { ...previousState, [column]: -1 };
      } else {
        newState = { ...rest };
      }
      onSort(newState);
      return newState;
    });
  }, [onSort]);

  const keySortBy = React.useCallback((column: string) => (
    (event: React.KeyboardEvent<HTMLTableCellElement>): void => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Space') {
        sortBy(column)();
      }
    }
  ), [sortBy]);

  // Updates sorting whenever `sorting` prop is updated.
  React.useEffect(() => {
    setCurrentSorting(sorting);
  }, [sorting]);

  return (
    <div className={className}>
      <table>
        <thead className="table__headers">
          <tr>
            {columns.map((column) => {
              // TODO currentSorting[column.path] may be undefined
              const sortingModifier = sortingModifiers[String(currentSorting[column.path])];
              const columnModifiers = `${sortingModifier} ${column.path} ${column.isSortable ? 'sortable' : ''}`;
              const columnClassName = buildClass('table__headers__column', columnModifiers);
              return (
                // TODO move sorting handling in column heading component?
                <th
                  key={column.path}
                  className={columnClassName}
                  tabIndex={column.isSortable ? 0 : -1}
                  aria-sort={column.isSortable ? sortingModifier : undefined}
                  onClick={column.isSortable ? sortBy(column.path) : undefined}
                  onKeyUp={column.isSortable ? keySortBy(column.path) : undefined}
                >
                  {column.component}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="table__values">
          {rows?.map((row, index) => (
            <tr key={rowKeys[index]} className="table__values__row" onClick={row.onClick}>
              {columns.map((column) => {
                const cellClassName = buildClass('table__values__row__cell');
                return (
                  <td className={cellClassName} key={column.path}>
                    {row.value[column.path] as React.ReactNode}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table__loading">{labels.loading}</div>
      <div className="table__no-result">{labels.noResult}</div>
    </div>
  );
}

export default React.memo(Table) as ReactTableComponent;
