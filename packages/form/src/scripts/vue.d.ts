/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/form/vue' {
  import Engine, {
    type Step,
    type Field,
    type FormState,
    type Configuration,
  } from '@perseid/form';
  import { type DefineComponent } from 'vue';
  import { type UseSubscription } from '@perseid/store/connectors/vue';

  export * from '@perseid/form';

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
    field?: DefineComponent;

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
    loaderComponent?: DefineComponent;

    /** Form state. */
    state: FormState;

    /** Current active form step. */
    activeStep: string;

    /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
    useSubscription: UseSubscription;

    /** Changes current active step. */
    setActiveStep: (stepId: string) => void;
  }

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
    field?: DefineComponent<FormFieldProps>;

    /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
    useSubscription: UseSubscription;
  }

  /**
   * Svelte form props.
   */
  export interface FormProps {
    /** Form current active step. */
    activeStep?: string;

    /** Form configuration. */
    configuration: Configuration;

    /** Custom form engine class to use instead of the default engine. */
    engineClass?: typeof Engine;

    /** Default Layout component to use. */
    layoutComponent?: DefineComponent<FormLayoutProps>;

    /** Default Step component to use. */
    stepComponent?: DefineComponent<FormStepProps>;

    /** Default Field component to use. */
    field?: DefineComponent<FormFieldProps>;

    /** Default Loader component to use. */
    loaderComponent?: DefineComponent;
  }

  /**
   * Default form step.
   */
  export const DefaultField: DefineComponent<FormFieldProps>;

  /**
   * Default form layout.
   */
  export const DefaultLayout: DefineComponent<FormLayoutProps>;

  /**
   * Default form step loader.
   */
  export const DefaultLoader: DefineComponent;

  /**
   * Default form step.
   */
  export const DefaultStep: DefineComponent<FormStepProps>;

  /**
   * Vue form.
   */
  const Form: DefineComponent<FormProps>;

  export default Form;
}
