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

function onSubmit(event: React.FormEvent): void {
  event.preventDefault();
}

function buildClass(baseClass: string, modifiers: string): string {
  const chainedModifiers = [...new Set(modifiers.split(' '))].map((modifier) => (
    (modifier === '') ? '' : `--${modifier}`)).join('');
  return `${baseClass}${` ${baseClass}${chainedModifiers}`}`;
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
  const [engine] = React.useState(() => new EngineClass(configuration));
  const [useSubscription] = React.useState(() => connect(engine.getStore()));
  const state = useSubscription<FormState>('state');
  const lastStepPath = state.steps[state.steps.length - 1]?.path;
  const [currentActiveStep, setCurrentActiveStep] = React.useState(activeStep ?? lastStepPath);
  const onFocus = React.useCallback((newActiveStep: string) => (): void => {
    // Prevents any additional rendering when calling directly `setCurrentActiveStep`.
    if (newActiveStep !== currentActiveStep) {
      setCurrentActiveStep(newActiveStep);
    }
  }, [currentActiveStep]);

  // Updates current step whenever `activeStep` prop or steps change.
  React.useEffect(() => {
    setCurrentActiveStep(activeStep ?? lastStepPath);
  }, [activeStep, lastStepPath]);

  return (
    <form id={configuration.id} className="perseid-form" onSubmit={onSubmit}>
      {<Layout
        state={state}
        Loader={Loader}
        activeStep={currentActiveStep}
        useSubscription={useSubscription}
        setActiveStep={setCurrentActiveStep}
        steps={state.steps.map((step) => {
          const active = currentActiveStep === step.path;
          const cssPath = step.path.replace(/\./g, '__');
          const modifiers = [step.status, cssPath, active ? 'active' : ''];
          const className = buildClass('perseid-form__step', modifiers.join(' '));
          return (
            // Specifying the active step prevent browsers auto-fill system from changing fields
            // located in other steps, resetting previous steps and breaking overall UX.
            <div key={cssPath} id={cssPath} className={className} onFocus={onFocus(step.path)}>
              {<Step
                step={step}
                Field={Field}
                engine={engine}
                active={active}
                useSubscription={useSubscription}
              /> as unknown as React.ReactNode}
            </div>
          );
        })}
      /> as unknown as React.ReactNode}
    </form>
  );
}

export default React.memo(
  Form as unknown as React.FunctionComponent<FormProps>,
  (prevProps, nextProps) => prevProps.activeStep === nextProps.activeStep,
);
