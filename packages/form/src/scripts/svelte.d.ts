/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/form/svelte' {
  import Engine, {
    type Step,
    type Field,
    type FormState,
    type Configuration,
  } from '@perseid/form';
  import { type SvelteComponent } from 'svelte';
  import { type UseSubscription } from '@perseid/store/connectors/svelte';

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
    Field: SvelteComponent<FormFieldProps>;

    /** Changes current active step. */
    setActiveStep: (stepPath: string) => void;

    /** Store `useSubscription` function, you can use it to directly subscribe to form state. */
    useSubscription: UseSubscription;
  }

  /**
   * Form layout props.
   */
  export interface FormLayoutProps {
    /** Form state. */
    state: FormState;

    /** Loader component to use when loading a new step. */
    Loader: typeof SvelteComponent;

    /** Path of the currently active step. */
    activeStep?: string;

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
    Field: typeof SvelteComponent<FormFieldProps>;

    /** `focus` event handler. */
    onFocus: (path: string) => () => void;

    /** Changes current active step. */
    setActiveStep: (stepPath: string) => void;

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
    configuration: Configuration,

    /** Custom form engine class to use instead of the default engine. */
    engineClass?: typeof Engine;

    /** Default Layout component to use. */
    Layout?: typeof SvelteComponent<Partial<FormLayoutProps>>;

    /** Default Step component to use. */
    Step?: typeof SvelteComponent<Partial<FormStepProps>>;

    /** Default Field component to use. */
    Field?: typeof SvelteComponent<Partial<FormFieldProps>>;

    /** Default Loader component to use. */
    Loader?: typeof SvelteComponent;
  }

  /**
   * Default form field.
   */
  export class DefaultField extends SvelteComponent<FormFieldProps> { }

  /**
   * Default form layout.
   */
  export class DefaultLayout extends SvelteComponent<FormLayoutProps> { }

  /**
   * Default form step loader.
   */
  export class DefaultLoader extends SvelteComponent { }

  /**
   * Default form step.
   */
  export class DefaultStep extends SvelteComponent<FormStepProps> { }

  /**
   * Svelte form.
   */
  export default class Form extends SvelteComponent<FormProps> { }
}
