/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { type FormState } from 'scripts/core/state';
import { type UseSubscription } from '@perseid/store/connectors/react';

/**
 * Form layout props.
 */
export interface FormLayoutProps {
  /** Loader component to use when loading a new step. */
  Loader: React.FC;

  /** Form state. */
  state: FormState;

  /** Current active form step. */
  activeStep: string;

  /** All rendered form steps. */
  steps: JSX.Element[];

  /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
  useSubscription: UseSubscription;

  /** Changes current active step. */
  setActiveStep: (stepId: string) => void;
}

/**
 * Default form layout.
 */
export default function DefaultLayout({
  steps,
  state,
  Loader,
  activeStep,
  setActiveStep,
  useSubscription,
}: FormLayoutProps): JSX.Element {
  return (
    <div className="perseid-form__steps">
      {steps as unknown as React.ReactNode}
      {(
        state.loading
        && activeStep
        && typeof setActiveStep !== 'string'
        && typeof useSubscription !== 'string'
      ) && <Loader /> as unknown as React.ReactNode}
    </div>
  );
}
