/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Engine from 'scripts/core/Engine';
import { type FormState } from 'scripts/core/state';
import connect from '@perseid/store/connectors/react';
import { type FormStepProps } from 'scripts/react/DefaultStep';

/**
 * React form props.
 */
export interface FormProps {
  /**
   * Form current active step.
   */
  activeStep?: string;

  /**
   * Form configuration.
   */
  configuration: Configuration,

  /**
   * Custom form engine class to use instead of the default engine.
   */
  engineClass?: typeof Engine;

  /**
   * Render prop that receives form internals.
   */
  children?: (context: FormStepProps) => React.ReactNode;
}

function onSubmit(event: React.FormEvent): void {
  event.preventDefault();
}

/**
 * React form.
 */
function Form({
  activeStep,
  configuration,
  engineClass: EngineClass = Engine,
  children,
}: FormProps): JSX.Element {
  const isWindowFocused = React.useRef(false);
  const [engine] = React.useState(() => new EngineClass(configuration));
  const [useSubscription] = React.useState(() => connect(engine.getStore()));
  const state = useSubscription<FormState>('state');
  const lastStep = state.steps.at(-1);
  const [currentActiveStep, setCurrentActiveStep] = React.useState(activeStep ?? lastStep?.path);

  // Prevents any additional rendering compared to calling directly `setCurrentActiveStep`.
  const setActiveStep = React.useCallback((newActiveStep: string | undefined) => {
    setCurrentActiveStep((previousState) => newActiveStep ?? previousState);
  }, []);

  const handleFocus = React.useCallback((newActiveStep: string) => (): void => {
    if (isWindowFocused.current) { setActiveStep(newActiveStep); }
    isWindowFocused.current = true;
  }, [setActiveStep]);

  // Updates current step whenever `activeStep` prop or last step change.
  // Be careful: last step path may not change although `lastStep` has (e.g. because it has been
  // re-created or updated), so we need to react to this value instead.
  // Layout effect, so that a new step is never painted before being activated.
  React.useLayoutEffect(() => {
    setActiveStep(activeStep ?? lastStep?.path);
  }, [setActiveStep, activeStep, lastStep]);

  // When focus gets out of and in back to the current window, the `focus` event gets triggered once
  // again on the step, which leads to unwanted visual effects when displaying only current active
  // step (the last focused step is displayed back). This mechanism prevents that from happening.
  React.useEffect(() => {
    const handleBlur = (): void => { isWindowFocused.current = false; };
    window.addEventListener('blur', handleBlur);
    return (): void => { window.removeEventListener('blur', handleBlur); };
  }, []);

  return (
    <form id={configuration.id} className="perseid-form" onSubmit={onSubmit}>
      {state.steps.map((step) => (
        <React.Fragment key={step.path}>
          {children?.({
            step,
            engine,
            setActiveStep,
            useSubscription,
            onFocus: handleFocus,
            activeStep: currentActiveStep,
          })}
        </React.Fragment>
      ))}
    </form>
  );
}

export default React.memo(Form);
