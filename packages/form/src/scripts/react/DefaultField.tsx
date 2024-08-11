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
  isActive: boolean;

  /** Path of the currently active step. */
  activeStep?: string;

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
  isRequired: Field['required'];

  /** Field component to use for rendering. */
  Field: React.FC<FormFieldProps>;

  /** Changes current active step. */
  setActiveStep: (stepPath: string) => void;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;
}

/**
 * Default form field.
 */
function DefaultField(props: FormFieldProps): JSX.Element {
  const { setActiveStep } = props;
  const { path, type, error } = props;
  const { engine, status, value } = props;
  const { fields, activeStep, Field } = props;
  const { isActive, isRequired, useSubscription } = props;
  return (
    <pre>
      {JSON.stringify({
        path,
        type,
        status,
        error,
        isActive,
        isRequired,
        activeStep,
        value: (type === 'binary') ? '<Binary>' : value,
        Field: `<${String(typeof Field !== 'string' && 'Component')}>`,
        engine: `<${String(typeof engine !== 'string' && 'Engine')}>`,
        setActiveStep: `<${String(typeof setActiveStep !== 'string' && 'Function')}>`,
        useSubscription: `<${String(typeof useSubscription !== 'string' && 'Function')}>`,
        fields,
      }, null, 2)}
    </pre>
  );
}

export default React.memo(DefaultField as unknown as React.FunctionComponent<FormFieldProps>);
