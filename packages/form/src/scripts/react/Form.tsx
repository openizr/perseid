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
import DefaultLoader from 'scripts/react/DefaultLoader';
import DefaultStep, { type FormStepProps } from 'scripts/react/DefaultStep';
import DefaultField, { type FormFieldProps } from 'scripts/react/DefaultField';
import DefaultLayout, { type FormLayoutProps } from 'scripts/react/DefaultLayout';

/**
 * React form props.
 */
export interface FormProps {
  /** Form current active step. */
  activeStep?: string;

  /** Form configuration. */
  configuration: Configuration,

  /** Custom form engine class to use instead of the default engine. */
  engineClass?: typeof Engine;

  /** Default Layout component to use. */
  Layout?: React.FC<FormLayoutProps>;

  /** Default Step component to use. */
  Step?: React.FC<FormStepProps>;

  /** Default Field component to use. */
  Field?: React.FC<FormFieldProps>;

  /** Default Loader component to use. */
  Loader?: React.FC;
}

let key = 0;

function onSubmit(event: React.FormEvent): void {
  event.preventDefault();
}

function generateId(): string {
  key += 1;
  return `_${String(key)}`;
}

/**
 * React form.
 */
function Form({
  activeStep,
  configuration,
  Field = DefaultField,
  Step = DefaultStep as unknown as React.FC,
  Loader = DefaultLoader as unknown as React.FC,
  Layout = DefaultLayout as unknown as React.FC,
  engineClass: EngineClass = Engine,
}: FormProps): JSX.Element {
  const isWindowFocused = React.useRef(false);
  const keys = React.useRef<Partial<Record<string, string>>>({});
  const [engine] = React.useState(() => new EngineClass(configuration));
  const [useSubscription] = React.useState(() => connect(engine.getStore()));
  const state = useSubscription('state', (newState: FormState) => {
    newState.steps.forEach((step) => { keys.current[step.path] ??= generateId(); });
    return newState;
  });
  const lastStep = state.steps.at(-1);
  const [currentActiveStep, setCurrentActiveStep] = React.useState(activeStep ?? lastStep?.path);

  const setActiveStep = React.useCallback((newActiveStep: string | undefined) => {
    // Prevents any additional rendering compared to calling directly `setCurrentActiveStep`.
    if (newActiveStep !== currentActiveStep && newActiveStep !== undefined) {
      // Forces step component to re-mount in order to reset scroll.
      keys.current[newActiveStep] = generateId();
      setCurrentActiveStep(newActiveStep);
    }
  }, [currentActiveStep]);

  const handleFocus = React.useCallback((newActiveStep: string) => (): void => {
    if (isWindowFocused.current) { setActiveStep(newActiveStep); }
    isWindowFocused.current = true;
  }, [setActiveStep]);

  // Updates current step whenever `activeStep` prop or last step change.
  // Be careful: last step path may not change although `lastStep` has (e.g. because it has been
  // re-created or updated), so we need to react to this value instead.
  React.useEffect(() => {
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
      <Layout
        state={state}
        Loader={Loader}
        setActiveStep={setActiveStep}
        activeStep={currentActiveStep}
        useSubscription={useSubscription}
        steps={state.steps.map((step) => (
          <Step
            step={step}
            Field={Field}
            engine={engine}
            onFocus={handleFocus}
            key={keys.current[step.path]}
            setActiveStep={setActiveStep}
            activeStep={currentActiveStep}
            useSubscription={useSubscription}
          />
        ))}
      />
    </form>
  );
}

export default React.memo(
  Form as unknown as React.FunctionComponent<FormProps>,
  (prevProps, nextProps) => prevProps.activeStep === nextProps.activeStep,
);
