/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import { toSnakeCase, type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Field label props.
 */
export interface FieldLabelProps<
  DataModel extends DefaultDataModel = DefaultDataModel,
  I18n extends BaseI18n = BaseI18n,
  Store extends BaseStore<DataModel> = BaseStore<DataModel>,
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
  ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
> extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
  /** Field to display. */
  field: string;

  /** Which page is being displayed. */
  page: 'LIST' | 'VIEW';
}

/**
 * Displays a specific resource field label.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/FieldLabel.tsx
 */
export default function FieldLabel({
  page,
  field,
  services,
  resource,
}: FieldLabelProps): JSX.Element {
  const label = React.useMemo(() => {
    const path = toSnakeCase(field.replace(/\./g, '.fields.'));
    return services.i18n.t(`PAGES.${toSnakeCase(String(resource))}.${page}.FIELDS.${path}.LABEL`);
  }, [services, resource, field, page]);

  return <span className="field-label">{label}</span>;
}
