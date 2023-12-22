/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import type Engine from 'scripts/core/Engine';
import { type FormFieldProps } from 'scripts/react/DefaultField';
import { type UseSubscription } from '@perseid/store/connectors/react';

/**
 * Form step props.
 */
export interface FormStepProps<T extends Engine = Engine> {
  /** Instance of the form engine. */
  engine: T;

  /** Form step to render. */
  step: Step;

  /** Whether step is currently active. */
  active: boolean;

  /** Field component to use for rendering. */
  Field: React.FC<FormFieldProps>;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;
}

/**
 * Default form step.
 */
export default function DefaultStep({
  step,
  Field,
  active,
  engine,
  useSubscription,
}: FormStepProps): JSX.Element {
  return (
    <div className="perseid-form__step__fields">
      {/* Key is composed of both step and field ids, in order to ensure each field is correctly
         reset when user changes his journey in previous steps. */}
      {step.fields.map((field) => (
        (field !== null) && (
          <Field
            Field={Field}
            active={active}
            engine={engine}
            key={field.path}
            path={field.path}
            type={field.type}
            error={field.error}
            value={field.value}
            status={field.status}
            fields={field.fields}
            required={field.required}
            useSubscription={useSubscription}
          /> as unknown as React.ReactNode
        )
      ))}
    </div>
  );
}
