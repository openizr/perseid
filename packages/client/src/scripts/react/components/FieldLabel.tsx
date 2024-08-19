/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { toSnakeCase, type DefaultDataModel } from '@perseid/core';

/**
 * Field label props.
 */
export interface FieldLabelProps<
  DataModel extends DefaultDataModel
> extends ReactCommonProps<DataModel> {
  /** Field to display. */
  field: string;

  /** Which page is being displayed. */
  page: 'LIST' | 'VIEW';
}

/**
 * Displays a specific resource field label.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/FieldLabel.tsx
 */
export default function FieldLabel<DataModel extends DefaultDataModel = DefaultDataModel>({
  page,
  field,
  services,
  resource,
}: FieldLabelProps<DataModel>): JSX.Element {
  const label = React.useMemo(() => {
    const path = toSnakeCase(field.replace(/\./g, '__'));
    return services.i18n.t(`PAGES.${toSnakeCase(String(resource))}.${page}.FIELDS.${path}.LABEL`);
  }, [services, resource, field, page]);

  return <span className="field-label">{label}</span>;
}
