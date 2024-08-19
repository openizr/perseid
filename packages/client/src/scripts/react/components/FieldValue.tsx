/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type Id,
  isPlainObject,
  type DefaultDataModel,
  type I18n as BaseI18n,
} from '@perseid/core';
import { UIImage } from '@perseid/ui/react';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import type BaseApiClient from 'scripts/core/services/ApiClient';

/**
 * Field value props.
 */
export interface FieldValueProps<
  DataModel extends DefaultDataModel = DefaultDataModel,
  I18n extends BaseI18n = BaseI18n,
  Store extends BaseStore<DataModel> = BaseStore<DataModel>,
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
  ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
> extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
  /** Id of the resource to display. */
  id: Id;

  /** Field to display. */
  field: string;

  /** Which page is being displayed. */
  page: 'LIST' | 'VIEW';

  /** Whether resource is still being fetched, which means some values might not be there yet. */
  loading: boolean;

  /** Resources registry. */
  registry: Registry<DataModel>;

  /** Data model resource, if any. */
  resource: keyof DataModel & string;
}

const textDecoder = new TextDecoder();

/**
 * Displays a specific resource field value.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/FieldValue.tsx
 */
export default function FieldValue({
  id,
  page,
  field,
  loading,
  services,
  registry,
  resource,
}: FieldValueProps): JSX.Element | null {
  let valueElement = null;
  const value = services.store.getValue(resource, id, field, registry);

  if (typeof page !== 'string' || value === null) {
    valueElement = services.i18n.t(loading ? 'FIELD.LOADING.LABEL' : 'FIELD.FALLBACK.LABEL');
  } else if (typeof value === 'number') {
    valueElement = services.i18n.numeric(value);
  } else if (value instanceof Date) {
    valueElement = services.i18n.dateTime(value);
  } else if (value instanceof Uint8Array) {
    valueElement = (
      <UIImage
        alt={field}
        ratio="square"
        src={textDecoder.decode(value)}
      />
    );
  } else if (Array.isArray(value) || isPlainObject(value)) {
    valueElement = JSON.stringify(value);
  } else {
    valueElement = String(value);
  }

  return <div className="field-value">{valueElement}</div>;
}
