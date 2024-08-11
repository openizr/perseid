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

  /** Path of the currently active step. */
  activeStep?: string;

  /** Field component to use for rendering. */
  Field: React.FC<FormFieldProps>;

  /** `focus` event handler. */
  onFocus: (path: string) => () => void;

  /** Changes current active step. */
  setActiveStep: (stepPath: string) => void;

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;
}

/**
 * Default form step.
 */
export default function DefaultStep({
  step,
  Field,
  engine,
  onFocus,
  activeStep,
  setActiveStep,
  useSubscription,
}: FormStepProps): JSX.Element {
  const isActive = activeStep === step.path;
  const cssPath = step.path.replace(/\./g, '__');
  const modifiers = [step.status, cssPath].concat(isActive ? ['active'] : []);
  const className = `perseid-form__step perseid-form__step--${[...new Set(modifiers)].join('--')}`;
  return (
    // Specifying the active step prevent browsers auto-fill system from changing fields
    // located in other steps, resetting previous steps and breaking overall UX.
    <div id={cssPath} className={className} onFocus={onFocus(step.path)}>
      <div className="perseid-form__step__fields">
        {/* Key is composed of both step and field ids, in order to ensure each field is correctly
         reset when user changes his journey in previous steps. */}
        {step.fields.map((field) => (
          (field !== null) && (
            <Field
              Field={Field}
              engine={engine}
              key={field.path}
              path={field.path}
              type={field.type}
              error={field.error}
              isActive={isActive}
              value={field.value}
              status={field.status}
              fields={field.fields}
              activeStep={activeStep}
              isRequired={field.required}
              setActiveStep={setActiveStep}
              useSubscription={useSubscription}
            /> as unknown as React.ReactNode
          )
        ))}
      </div>
    </div>
  );
}
