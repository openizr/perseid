/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import type Engine from 'scripts/core/Engine';
import { type UseSubscription } from '@perseid/store/connectors/react';

/**
 * Form field props.
 */
export interface FormFieldProps<T extends Engine = Engine> {
  /** Instance of the form engine. */
  engine: T;

  /** Whether field belongs to current active step. */
  active: boolean;

  /** Field type. */
  type: Field['type'];

  /** Field full path in the form. */
  path: Field['path'];

  /** Field value. */
  value: Field['value'];

  /** Field error, if any. */
  error: Field['error'];

  /** Field status. */
  status: Field['status'];

  /** Field sub-fields (for objects and arrays only). */
  fields?: Field['fields'];

  /** Whether field is required. */
  required: Field['required'];

  /** Field component to use for rendering. */
  Field: React.FC<FormFieldProps>;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;
}

/**
 * Default form field.
 */
function DefaultField(props: FormFieldProps): JSX.Element {
  const { fields, Field } = props;
  const { path, type, error } = props;
  const { engine, status, value } = props;
  const { active, required, useSubscription } = props;
  return (
    <pre>
      {JSON.stringify({
        path,
        type,
        status,
        error,
        active,
        required,
        value: (type === 'binary') ? '<Binary>' : value,
        Field: `<${typeof Field !== 'string' && 'Component'}>`,
        engine: `<${typeof engine !== 'string' && 'Engine'}>`,
        useSubscription: `<${typeof useSubscription !== 'string' && 'Function'}>`,
        fields,
      }, null, 2)}
    </pre>
  );
}

export default React.memo(DefaultField as unknown as React.FunctionComponent<FormFieldProps>);
