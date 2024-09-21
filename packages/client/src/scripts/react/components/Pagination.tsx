/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { UIButton, buildClass } from '@perseid/ui/react';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import { type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Pagination buttons props.
 */
export interface PaginationProps<
  DataModel extends DefaultDataModel = DefaultDataModel,
  I18n extends BaseI18n = BaseI18n,
  Store extends BaseStore<DataModel> = BaseStore<DataModel>,
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
  ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
> extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
  /** Total number of displayed items. */
  total: number;

  /** Current page. */
  currentPage: number;

  /** Number of items per page. */
  itemsPerPage: number;

  /** Callback triggered when clicking on pagination buttons. */
  onClick: (page: number) => () => void;
}

const getRange = (currentPage: number, totalPages: number, length: number, min = 1): number[] => {
  // Number of pagination buttons must be bound to maximum number of pages.
  const actualLength = Math.min(length, totalPages);
  let startIndex = currentPage - Math.floor(actualLength / 2);
  // If current page is in the first numbers, pagination must show the first pages.
  startIndex = Math.max(startIndex, min);
  // If current page is in the last numbers, pagination must show the last pages.
  startIndex = Math.min(startIndex, min + totalPages - actualLength);
  return Array.from({ length: actualLength }, (_item, index) => startIndex + index);
};

/**
 * Pagination buttons.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Pagination.tsx
 */
function Pagination({
  total,
  onClick,
  services,
  currentPage,
  itemsPerPage,
}: PaginationProps): JSX.Element | null {
  const totalPages = Math.ceil(total / itemsPerPage);

  const pages = getRange(currentPage, totalPages, 5).map((pageIndex) => (
    <button
      type="button"
      key={pageIndex}
      onClick={onClick(pageIndex)}
      className={buildClass('pagination__page', currentPage === pageIndex ? 'active' : '')}
    >
      {pageIndex}
    </button>
  ));

  if (pages.length < 2) {
    return null;
  }

  return (
    <div className="pagination">
      <UIButton
        iconPosition="left"
        onClick={onClick(currentPage - 1)}
        label={services.i18n.t('PAGINATION.PREVIOUS')}
        modifiers={(currentPage - 1 < 1) ? 'disabled' : ''}
      />
      <div className="none s:flex hgap-2">
        {pages}
      </div>
      <UIButton
        iconPosition="right"
        onClick={onClick(currentPage + 1)}
        label={services.i18n.t('PAGINATION.NEXT')}
        modifiers={(currentPage + 1 > totalPages) ? 'disabled' : ''}
      />
    </div>
  );
}

export default React.memo(Pagination);
