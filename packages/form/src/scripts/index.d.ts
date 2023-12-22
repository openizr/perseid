/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Engine from 'scripts/core/Engine';

declare module '*.svelte' {
  import { SvelteComponent } from 'svelte';

  export default SvelteComponent;
}

declare module '*.vue' {
  import Vue from 'vue';

  export default Vue;
}

declare global {
  type Data = any;
  type FormPlugin = (engine: Engine) => void;
  type NextHook<T> = (data: T) => Promise<T>;
  type Hook<T> = (data: T, next: NextHook<T>) => Promise<T>;
  type FieldConfigurations = Record<string, FieldConfiguration>;
  type HookData = UserInputs | Error | Step | UserAction | boolean | null;
  type SubConfiguration = Configuration | FieldConfiguration | StepConfiguration | null;

  /**
   * Form cache client.
   */
  interface CacheClient {
    /** Stores `value` at `key` in cache. */
    set(key: string, value: unknown): Promise<void>;

    /** Fetches value at `key` from cache. */
    get(key: string): Promise<unknown>;

    /** Deletes value at `key` from cache. */
    delete(key: string): Promise<void>;
  }

  /** User inputs. */
  type UserInputs = Record<string, unknown>;

  /** Form variables. */
  type Variables = Record<string, unknown>;

  /** List of hooks events names. */
  type FormEvent = 'start' | 'step' | 'afterStep' | 'userAction' | 'afterUserAction' | 'submit' | 'error';

  /**
   * Form user action.
   */
  interface UserAction {
    /** Type of user action (most of the time, `'input'`). */
    type: string;

    /** Full path to the field that triggered user action. */
    path: string;

    /** User action data. */
    data: unknown;
  }

  /**
   * Form field.
   */
  interface Field {
    /** Field path from root. */
    path: string;

    /** Field subfields list. */
    fields?: Fields;

    /** Field error, if any. */
    error: string | null;

    /** Field current value. */
    value: unknown;

    /** Whether field is required. */
    required: boolean;

    /** Field current status. */
    status: 'initial' | 'error' | 'progress' | 'success';

    /** Field type. */
    type: 'string' | 'boolean' | 'date' | 'binary' | 'integer' | 'float' | 'object' | 'array' | 'null';
  }

  /**
   * Form step.
   */
  interface Step {
    /** Step path from root. */
    path: string;

    /** Step fields list. */
    fields: (Field | null)[];

    /** Step current status. */
    status: 'initial' | 'error' | 'progress' | 'success';
  }

  /**
   * Form fields list.
   */
  type Fields = (Field | null)[];

  /**
   * Form data stored in cache.
   */
  interface CachedData {
    /** All generated form steps. */
    steps: Step[];

    /** User-defined variables that can be accessed at any point in the form. */
    variables: Variables;

    /** Discarded user inputs list (related fields do not meet display conditions). */
    discardedUserInputs: Map<string, unknown>;

    /** List of both full and partial user inputs for all displayed fields. */
    userInputs: { full: UserInputs; partial: UserInputs; };
  }

  /**
   * Configuration that is common to all types of fields.
   */
  interface GenericConfiguration {
    type: string;

    /** Whether field is required. Defaults to `false`. */
    required?: boolean;

    /** Whether to submit current step when user changes this field. Defaults to `false`. */
    submit?: boolean;

    /** Field default value. Defaults to `null`. */
    defaultValue?: unknown;

    /** Condition on which field will actually be created and displayed. Defaults to `() => true` */
    condition?: (inputs: UserInputs, variables: Variables) => boolean;
  }

  /**
   * Null field configuration.
   */
  interface NullConfiguration extends Omit<GenericConfiguration, 'defaultValue' | 'required'> {
    /** Field type. */
    type: 'null';
  }

  /**
   * String field configuration.
   */
  interface StringConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'string';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: string, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Integer field configuration.
   */
  interface IntegerConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'integer';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: number, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Float field configuration.
   */
  interface FloatConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'float';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: number, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Date field configuration.
   */
  interface DateConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'date';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: Date, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Binary field configuration.
   */
  interface BinaryConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'binary';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: File, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Boolean field configuration.
   */
  interface BooleanConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'boolean';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: boolean, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Array field configuration.
   */
  interface ArrayConfiguration extends Omit<GenericConfiguration, 'defaultValue' | 'submit'> {
    /** Field type. */
    type: 'array';

    /** Field sub-fields configurations. */
    fields: Exclude<FieldConfiguration, ArrayConfiguration>;

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (
      value: (Field | null)[],
      inputs: UserInputs,
      variables: Variables,
    ) => string | null;
  }

  /**
   * Object field configuration.
   */
  interface ObjectConfiguration extends Omit<GenericConfiguration, 'defaultValue' | 'submit'> {
    /** Field type. */
    type: 'object';

    /** Field sub-fields configurations. */
    fields: FieldConfigurations;

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (
      value: (Field | null)[],
      inputs: UserInputs,
      variables: Variables,
    ) => string | null;
  }

  /**
   * Form field configuration.
   */
  type FieldConfiguration = (
    NullConfiguration |
    StringConfiguration |
    IntegerConfiguration |
    FloatConfiguration |
    BooleanConfiguration |
    BinaryConfiguration |
    DateConfiguration |
    ArrayConfiguration |
    ObjectConfiguration
  );

  /**
   * Form step configuration.
   */
  interface StepConfiguration {
    /** Step fields names list. */
    fields: string[];

    /** Whether to submit form when step is complete. Defaults to `false`. */
    submit?: boolean;

    /** Determines which step to load next. Defaults to `undefined`. */
    nextStep?: string | ((inputs: UserInputs, variables: Variables) => string);
  }

  /**
   * Form configuration.
   */
  interface Configuration {
    /** Form id (used as a cache id). Defaults to `cache`. */
    id?: string;

    /** Root step. */
    root: string;

    /** List of custom plugins to register to the current form instance. Defaults to `[]`. */
    plugins?: FormPlugin[];

    /** Set of initial variables. Defaults to `{}`. */
    variables?: Variables;

    /** Cache instance to use. Defaults to `null`. */
    cache?: CacheClient | null;

    /** Whether to restart form from the beginning when reloading the page. Defaults to `false`. */
    restartOnReload?: boolean;

    /** Initial form values to fill fields with. Defaults to `{}`. */
    initialValues?: UserInputs;

    /** Whether to clear form cache on submit. Defaults to `true`. */
    clearCacheOnSubmit?: boolean;

    /** Whether to validate fields only on step submission. Defaults to `false`. */
    validateOnSubmit?: boolean;

    /** Whether to submit only updated fields values. Defaults to `true`. */
    submitPartialUpdates?: boolean;

    /** This function is called on form submission, after all "submit" hooks went well. */
    onSubmit?: (userInputs: UserInputs, variables: Variables) => Promise<void>;

    /** Form fields configurations. */
    fields: Record<string, FieldConfiguration>;

    /** Form steps configurations. */
    steps: Record<string, StepConfiguration>;
  }
}
