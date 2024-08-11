/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/form' {
  import Store from '@perseid/store';

  type Data = any;
  type FormPlugin = (engine: Engine) => void;
  type NextHook<T> = (data: T) => Promise<T>;
  type Hook<T> = (data: T, next: NextHook<T>) => Promise<T>;
  type FieldConfigurations = Record<string, FieldConfiguration>;
  type SubConfiguration = FieldConfiguration | StepConfiguration;
  type HookData = UserInputs | Error | Step | UserAction | boolean | null;

  /**
   * Form state data.
   */
  export interface FormState {
    /** All generated form steps. */
    steps: Step[];

    /** Whether next step is being loaded. */
    loading: boolean;

    /** User-defined variables that can be accessed at any point in the form. */
    variables: Variables;

    /** List of both full and partial user inputs for all displayed fields. */
    userInputs: { full: UserInputs; partial: UserInputs; };
  }

  /**
   * Form cache client.
   */
  export interface CacheClient {
    /** Stores `value` at `key` in cache. */
    set(key: string, value: unknown): Promise<void>;

    /** Fetches value at `key` from cache. */
    get(key: string): Promise<unknown>;

    /** Deletes value at `key` from cache. */
    delete(key: string): Promise<void>;
  }

  /** User inputs. */
  export type UserInputs = Record<string, unknown>;

  /** Form variables. */
  export type Variables = Record<string, unknown>;

  /** List of hooks events names. */
  export type FormEvent = 'start' | 'step' | 'afterStep' | 'userAction' | 'afterUserAction' | 'submit' | 'error';

  /**
   * Form user action.
   */
  export interface UserAction {
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
  export interface Field {
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
  export interface Step {
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
  export type Fields = (Field | null)[];

  /**
   * Form data stored in cache.
   */
  export interface CachedData {
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
  export interface GenericConfiguration {
    type: string;

    /** Whether field is required. Defaults to `false`. */
    required?: boolean;

    /** Whether to submit current step when user changes this field. Defaults to `false`. */
    submit?: boolean;

    /** Condition on which field will actually be created and displayed. Defaults to `() => true` */
    condition?: (inputs: UserInputs, variables: Variables) => boolean;
  }

  /**
   * Null field configuration.
   */
  export interface NullConfiguration extends Omit<GenericConfiguration, 'required'> {
    /** Field type. */
    type: 'null';
  }

  /**
   * String field configuration.
   */
  export interface StringConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'string';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: string, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Integer field configuration.
   */
  export interface IntegerConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'integer';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: number, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Float field configuration.
   */
  export interface FloatConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'float';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: number, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Date field configuration.
   */
  export interface DateConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'date';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: Date, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Binary field configuration.
   */
  export interface BinaryConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'binary';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: File, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Boolean field configuration.
   */
  export interface BooleanConfiguration extends GenericConfiguration {
    /** Field type. */
    type: 'boolean';

    /** Returns a different error depending on validation rule. Defaults to `() => null`. */
    validation?: (value: boolean, inputs: UserInputs, variables: Variables) => string | null;
  }

  /**
   * Array field configuration.
   */
  export interface ArrayConfiguration extends Omit<GenericConfiguration, 'submit'> {
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
  export interface ObjectConfiguration extends Omit<GenericConfiguration, 'submit'> {
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
  export type FieldConfiguration = (
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
  export interface StepConfiguration {
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
  export interface Configuration {
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
    steps: Partial<Record<string, StepConfiguration>>;
  }

  /**
   * Form engine.
   */
  export default class Engine {
    /** Store instance. */
    protected store: Store;

    /** Cache client. */
    protected cache: CacheClient | null;

    /** Key used to store and retrieve form data from the cache. */
    protected cacheKey: string;

    /** Timer that dictates when the cached form data should be refreshed. */
    protected cacheTimeout: number | null;

    /** Form engine configuration. */
    protected configuration: Configuration;

    /** Contains all events hooks to trigger when events are fired. */
    protected hooks: Record<FormEvent, Hook<HookData>[]>;

    /** Whether next step is being loaded. */
    protected loading: boolean;

    /** All generated form steps. */
    protected steps: Step[];

    /** Reference to the current step, for quicker access. */
    protected currentStep: Step | null;

    /** User-defined variables that can be accessed at any point in the form. */
    protected variables: Variables;

    /** Timer used to manage the delay before processing queued mutations. */
    protected mutationTimeout: number | null;

    /** Initial values used to prepopulate form fields upon loading. */
    protected initialValues: UserInputs;

    /** Queue of user inputs that are pending processing. */
    protected userInputsQueue: Map<string, { data: unknown; configuration: FieldConfiguration; }>;

    /** Discarded user inputs list (related fields do not meet display conditions). */
    protected discardedUserInputs: Map<string, unknown>;

    /** List of both full and partial user inputs for all displayed fields. */
    protected userInputs: { full: UserInputs; partial: UserInputs; };

    /**
     * Checks whether `firstInput` and `secondInput` are equal, according to their type.
     *
     * @param firstInput First input to compare.
     *
     * @param secondInput Second input to compare.
     *
     * @param type Inputs' type.
     *
     * @returns `true` if `firstInput` and `secondInput` are equal, `false` otherwise.
     */
    protected areEqual(
      firstInput: unknown,
      secondInput: unknown,
      type: FieldConfiguration['type'],
    ): boolean;

    /**
     * Coerces `input` into its proper type.
     *
     * @param input User input to check and coerce.
     *
     * @param type Type to use for coercion and checking.
     *
     * @returns Coerced user input.
     *
     * @throws If input should be an object but is not.
     *
     * @throws If input should be an array but is not.
     */
    protected coerce(input: unknown, type: FieldConfiguration['type']): unknown;

    /**
     * Adds the given mutation and related data into the queue. "Buffering" mutations is an
     * optimization that prevents UI from being notified (and thus re-rendered) too many times per
     * second, which would be unecessary and not great UX-wise.
     *
     * @param mutation Mutation name for the `state` module.
     *
     * @param data Mutation data.
     */
    protected enqueueMutation(mutation: string, data: Step[] | boolean): void;

    /**
     * Generates field with path `path` from its configuration `fieldConfiguration`.
     *
     * @param path Field path in the form.
     *
     * @param configuration Field configuration.
     *
     * @returns Generated field if it meets display condition, `null` otherwise.
     */
    protected createField(path: string, configuration: FieldConfiguration): Field | null;

    /**
     * Manages `field` visibility and value assignment, based on its display condition and current
     * user inputs. This function can be called in two different contexts (stages):
     * - Stage one: simply toggles field and enqueues any extra user action that should be triggered
     * - Stage two: assigns new value to each field, and computes both full and partial updates
     * lists
     *
     * @param path Field path in the form.
     *
     * @param field Field to toggle if it is already generated, `null` otherwise.
     *
     * @param configuration Field configuration.
     *
     * @param newValue New value to assign to the field. In the first stage of form processing, this
     * is a single value. In the second stage, it is a map of all new fields values.
     *
     * @param initialValue Initial field value, used internally to compute updates to the form when
     * user changes fields values.
     *
     * @param newInputs Holds current state of user inputs, including both partial and full updates.
     * Used internally for form processing.
     *
     * @returns Existing or newly created field if it should be displayed, `null` otherwise.
     */
    protected toggleField(
      path: string,
      field: Field | null,
      configuration: FieldConfiguration,
      newValue: unknown,
      initialValue: Exclude<unknown, undefined>,
      newInputs?: { partial?: unknown; full?: unknown },
    ): Field | null;

    /**
     * Toggles all fields and sub-fields for `step`, according to their display conditions.
     *
     * @param step Step to toggle fields for.
     *
     * @param newFieldValues New values to assign to the fields.
     */
    protected toggleFields(step: Step | null, newFieldValues: Map<string, unknown>): void;

    /**
     * Validates `field`, making sure that its value passes all validation rules.
     *
     * @param field Field to validate.
     *
     * @param configuration Field configuration.
     *
     * @param partial Whether to also validate empty fields.
     *
     * @param updatedFieldPaths List of updated fields paths (used for validation on submit only).
     *
     * @returns Field state ("progress", "success" or "error").
     */
    protected validateField(
      field: Field | null,
      configuration: FieldConfiguration,
      partial: boolean,
      updatedFieldPaths: string[],
    ): Exclude<Field['status'], 'initial'>;

    /**
     * Validates current step, making sure that all its fields' values pass validation rules.
     *
     * @param updatedFieldPaths List of updated fields paths (used for validation on submit only).
     *
     * @param partial Whether to also validate empty fields. Defaults to `false`.
     */
    protected validateFields(updatedFieldPaths: string[], partial?: boolean): void;

    /**
     * Triggers hooks chain for the given event.
     *
     * @param eventName Event name.
     *
     * @param data Additional data to pass to the hooks chain.
     *
     * @returns Pending hooks chain.
     */
    protected triggerHooks<T extends HookData>(
      eventName: FormEvent,
      data: T,
    ): Promise<T | null>;

    /**
     * Processes user inputs in batch to optimize performance by preventing too many UI
     * notifications and to enforce hooks consistency.
     */
    protected processUserInputs(): Promise<void>;

    /**
     * Handles new user actions, applying core logic such as hooks triggering or next step
     * generation.
     *
     * @param userAction New state sent by `userActions` store module.
     *
     * @throws If user action path does not point to a valid field.
     */
    protected handleUserAction(userAction: UserAction | null): Promise<void>;

    /**
     * Class constructor.
     *
     * @param configuration Form engine configuration.
     */
    constructor(configuration: Configuration);

    /**
     * Checks whether `input` is considered as empty, according to its type.
     *
     * @param input Input to check.
     *
     * @param type Input type.
     *
     * @returns `true` if `input` is empty, `false` otherwise.
     */
    public isEmpty(input: unknown, type: FieldConfiguration['type']): boolean;

    /**
     * Generates step with id `stepId`.
     *
     * @param stepId Step id.
     */
    public createStep(stepId: string | null): Promise<void>;

    /**
     * Toggles a loader right after current step, indicating next step is/not being generated.
     *
     * @param display Whether to display step loader.
     */
    public toggleLoader(display: boolean): void;

    /**
     * Returns current store instance.
     *
     * @returns Current store instance.
     */
    public getStore(): Store;

    /**
     * Sends a new notification to all `state` module listeners.
     */
    public notifyUI(): void;

    /**
     * Registers a new hook for the given event.
     *
     * @param eventName Name of the event to register hook for.
     *
     * @param hook Hook to register.
     */
    public on(eventName: 'userAction' | 'afterUserAction', hook: Hook<UserAction | null>): void;

    public on(eventName: 'step' | 'afterStep', hook: Hook<Step | null>): void;

    public on(eventName: 'error', hook: Hook<Error | null>): void;

    public on(eventName: 'submit', hook: Hook<UserInputs | null>): void;

    public on(eventName: 'start', hook: Hook<boolean | null>): void;

    public on(eventName: FormEvent, hook: Hook<Data>): void;

    /**
     * Triggers the given user action.
     *
     * @param userAction User action to trigger.
     */
    public userAction(userAction: UserAction): void;

    /**
     * Returns current partial or full user inputs.
     *
     * @param partial Whether to return only partial user inputs. Defaults to `false`.
     *
     * @returns Current user inputs.
     */
    public getUserInputs<T>(partial?: boolean): T;

    /**
     * Returns configuration for `path`. If no path is provided, the global form configuration is
     * returned instead.
     *
     * @param path Field or step path to get configuration for.
     *
     * @returns Requested configuration.
     *
     * @throws If configuration does not exist for `path`.
     */
    public getConfiguration(): Configuration;

    public getConfiguration<T extends SubConfiguration>(path?: string): T;

    /**
     * Returns the generated field at `path`.
     *
     * @param path Field path in the form.
     *
     * @returns Generated field if it exists, `null` otherwise.
     */
    public getField(path: string): Field | null;

    /**
     * Returns all generated steps.
     *
     * @returns Current step.
     */
    public getSteps(): Step[];

    /**
     * Retrieves current form variables.
     *
     * @returns Form variables.
     */
    public getVariables<T>(): T;

    /**
     * Adds or overrides the given form variables.
     *
     * @param variables Form variables to add or override.
     */
    public setVariables(variables: Record<string, unknown>): Promise<void>;

    /**
     * Clears current form cache.
     */
    public clearCache(): Promise<void>;

    /**
     * Sets initial form values. This method is especially useful when you need to reset initial
     * values for multiple partial submissions without re-creating the whole form each time.
     *
     * @param initialValues New initial form values to apply.
     */
    public setInitialValues(initialValues: UserInputs): void;
  }
}
