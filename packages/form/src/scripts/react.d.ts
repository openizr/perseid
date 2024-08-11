/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/form/react' {
  import 'react';
  import Engine, {
    type Step,
    type Field,
    type FormState,
    type Configuration,
  } from '@perseid/form';
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
   * Form layout props.
   */
  export interface FormLayoutProps {
    /** Loader component to use when loading a new step. */
    Loader: React.FC;

    /** Form state. */
    state: FormState;

    /** Path of the currently active step. */
    activeStep?: string;

    /** All rendered form steps. */
    steps: JSX.Element[];

    /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
    useSubscription: UseSubscription;

    /** Changes current active step. */
    setActiveStep: (stepPath: string) => void;
  }

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

  /**
   * Default form step.
   */
  export function DefaultField(props: FormFieldProps): JSX.Element;

  /**
   * Default form layout.
   */
  export function DefaultLayout(props: FormLayoutProps): JSX.Element;

  /**
   * Default form step loader.
   */
  export function DefaultLoader(): JSX.Element | null;

  /**
   * Default form step.
   */
  export function DefaultStep(props: FormStepProps): JSX.Element;

  /**
   * React form.
   */
  export default function Form(props: FormProps): JSX.Element;
}
