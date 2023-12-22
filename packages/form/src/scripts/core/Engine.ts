/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Store from '@perseid/store';
import state from 'scripts/core/state';
import userActions from 'scripts/core/userActions';
import { deepCopy, deepMerge, isPlainObject } from '@perseid/core';

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
  protected cacheTimeout: NodeJS.Timeout | null;

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
  protected mutationTimeout: NodeJS.Timeout | null;

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
  protected areEqual<T1, T2>(
    firstInput: T1,
    secondInput: T2,
    type: FieldConfiguration['type'],
  ): boolean {
    return (
      (firstInput as unknown) === secondInput
      || (type === 'string' && String(firstInput) === String(secondInput))
      || (type === 'float' && Number.isNaN(secondInput) && Number.isNaN(firstInput))
      || (type === 'integer' && Number.isNaN(secondInput) && Number.isNaN(firstInput))
      || (type === 'date' && (firstInput as Date).getTime() === (secondInput as Date).getTime())
      || (type === 'binary' && (
        (firstInput as File).name === (secondInput as File).name
        && (firstInput as File).size === (secondInput as File).size
      ))
    );
  }

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
  protected coerce(input: unknown, type: FieldConfiguration['type']): unknown {
    // Coercing data types...
    const isEmpty = (typeof input === 'string' && input.trim() === '');
    if (input === null) {
      return null;
    }
    if (type === 'string' && isEmpty) {
      return null;
    }
    if (type === 'boolean') {
      return (String(input) === 'true');
    }
    if (type === 'float' && typeof input !== 'number') {
      const parsedData = parseFloat(String(input));
      return (isEmpty || Number.isNaN(parsedData)) ? null : parsedData;
    }
    if (type === 'integer' && typeof input !== 'number') {
      const parsedData = parseInt(String(input), 10);
      return (isEmpty || Number.isNaN(parsedData)) ? null : parsedData;
    }
    if (type === 'date' && !(input instanceof Date)) {
      return new Date(String(input));
    }

    // Checking types...
    if (type === 'array' && !Array.isArray(input)) {
      throw new Error('Input is not an array.');
    }
    if (type === 'object' && !isPlainObject(input)) {
      throw new Error('Input is not a plain object.');
    }

    return input;
  }

  /**
   * Adds the given mutation and related data into the queue. "Buffering" mutations is an
   * optimization that prevents UI from being notified (and thus re-rendered) too many times per
   * second, which would be unecessary and not great UX-wise.
   *
   * @param mutation Mutation name for the `state` module.
   *
   * @param data Mutation data.
   */
  protected enqueueMutation(mutation: string, data: Step[] | boolean): void {
    clearTimeout((this.mutationTimeout as unknown as NodeJS.Timeout));
    if (mutation === 'SET_LOADER') {
      this.loading = data as boolean;
    }
    this.mutationTimeout = setTimeout(() => {
      this.cache?.set(this.cacheKey, {
        steps: this.steps,
        variables: this.variables,
        userInputs: this.userInputs,
        discardedUserInputs: this.discardedUserInputs,
      });
      this.store.mutate('state', 'UPDATE', {
        steps: this.steps,
        loading: this.loading,
        variables: this.variables,
        userInputs: this.userInputs,
      });
    }, 50);
  }

  /**
   * Generates field with path `path` from its configuration `fieldConfiguration`.
   *
   * @param path Field path in the form.
   *
   * @param configuration Field configuration.
   *
   * @returns Generated field if it meets display condition, `null` otherwise.
   */
  protected createField(path: string, configuration: FieldConfiguration): Field | null {
    const { type, condition } = configuration;
    const { required } = configuration as StringConfiguration;

    if (condition !== undefined && !condition(this.userInputs.full, this.variables)) {
      return null;
    }

    const newField: Field = {
      path,
      type,
      value: null,
      error: null,
      status: 'initial',
      required: required === true,
    };

    if (type === 'array' || type === 'object') {
      newField.fields = [];
    }

    return newField;
  }

  /**
   * Manages `field` visibility and value assignment, based on its display condition and current
   * user inputs. This function can be called in two different contexts (stages):
   * - Stage one: simply toggles field and enqueues any extra user action that should be triggered
   * - Stage two: assigns new value to each field, and computes both full and partial updates lists
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
    newInputs: { partial?: unknown; full?: unknown } = { full: undefined, partial: undefined },
  ): Field | null {
    const newUserInputs = newInputs;
    const { type, condition } = configuration;
    const isStageTwo = newValue instanceof Map;
    const discardedFieldValue = this.discardedUserInputs.get(path);
    const { required, defaultValue, submit } = configuration as StringConfiguration;
    // We can't use nullish coalescing operator here as we need to keep `null` value.
    let newFieldValue = (isStageTwo ? newValue.get(path) : newValue) as unknown;
    newFieldValue = (newFieldValue !== undefined) ? newFieldValue : field?.value;
    newFieldValue = (newFieldValue !== undefined) ? newFieldValue : discardedFieldValue;
    newFieldValue = (newFieldValue !== undefined) ? newFieldValue : initialValue;
    newFieldValue = (type === 'array' && required) ? newFieldValue ?? [] : newFieldValue;
    newFieldValue = (type === 'object' && required) ? newFieldValue ?? {} : newFieldValue;
    newFieldValue = (newFieldValue !== undefined) ? newFieldValue : defaultValue ?? null;

    if (condition !== undefined && !condition(this.userInputs.full, this.variables)) {
      this.discardedUserInputs.set(path, newFieldValue ?? null);
      return null;
    }

    const newField = field ?? this.createField(path, configuration) as unknown as Field;
    const isNewValue = !this.areEqual(newFieldValue, newField.value, type);
    // We either queue new field value or assign it to the field depending on the stage.
    if ((!isStageTwo || (field === null && submit !== true)) && isNewValue) {
      this.userInputsQueue.set(path, { data: newFieldValue, configuration });
      this.discardedUserInputs.delete(path);
    } else if (type !== 'null') {
      newField.value = newFieldValue;
    }

    // Null field...
    if (type === 'null') {
      return newField;
    }

    // Other primitive...
    if (type !== 'array' && type !== 'object') {
      newUserInputs.full = newField.value;
      const isInitialValue = this.areEqual(initialValue, newField.value, type);
      newUserInputs.partial = isInitialValue ? undefined : newField.value;
      return newField;
    }

    // Nested field...
    const isArray = (type === 'array');
    const fields = newField.fields as (Field | null)[];

    if (newFieldValue === null) {
      newField.fields = [];
      newUserInputs.full = null;
      newUserInputs.partial = (initialValue !== null) ? null : undefined;
      return newField;
    }

    newUserInputs.full = isArray ? [] : {};
    const fieldIds = isArray ? newFieldValue : Object.keys(configuration.fields);
    newField.fields = isArray ? fields.slice(0, (newFieldValue as unknown[]).length) : [...fields];

    for (let index = 0, { length } = fieldIds as unknown[]; index < length; index += 1) {
      const key = isArray ? index : (fieldIds as string[])[index];
      const updatedUserInputs = { full: undefined, partial: undefined };
      const subField = this.toggleField(
        `${path}.${key}`,
        newField.fields[index],
        isArray ? configuration.fields : configuration.fields[key],
        isStageTwo ? newValue : (newFieldValue as unknown[])[key as number] ?? null,
        (initialValue as unknown[] | undefined)?.[key as number],
        updatedUserInputs,
      );
      if (subField !== null) {
        subField.path = `${path}.${key}`;
      }
      newField.fields[index] = subField;
      if ((updatedUserInputs.full as unknown) !== undefined) {
        (newUserInputs.full as unknown[])[key as number] = updatedUserInputs.full;
      }
      if (isArray && (updatedUserInputs.partial as unknown) !== undefined) {
        newUserInputs.partial = newUserInputs.full;
      } else if ((updatedUserInputs.partial as unknown) !== undefined) {
        newUserInputs.partial ??= {};
        (newUserInputs.partial as unknown[])[key as number] = updatedUserInputs.partial;
      }
    }

    // If any of the array subfields was added or deleted...
    if (isArray && (
      initialValue === null
      || (newUserInputs.full as unknown[]).length !== (initialValue as unknown[] | null)?.length)
    ) {
      newUserInputs.partial = newUserInputs.full;
    }

    newField.value = newUserInputs.full;
    return newField;
  }

  /**
   * Toggles all fields and sub-fields for `step`, according to their display conditions.
   *
   * @param step Step to toggle fields for.
   *
   * @param newFieldValues New values to assign to the fields.
   */
  protected toggleFields(step: Step | null, newFieldValues: Map<string, unknown>): void {
    if (step !== null) {
      const { path, fields } = step;
      const { fields: fieldIds } = this.configuration.steps[path.split('.')[0]];
      for (let index = 0, { length } = fieldIds; index < length; index += 1) {
        const newUserInputs = { full: undefined, partial: undefined };
        const fieldId = fieldIds[index];
        fields[index] = this.toggleField(
          `${path}.${fieldId}`,
          fields[index],
          this.configuration.fields[fieldId],
          newFieldValues,
          this.initialValues[fieldId],
          newUserInputs,
        );
        if ((newUserInputs.full as unknown) !== undefined) {
          this.userInputs.full[fieldId] = newUserInputs.full;
        }
        if ((newUserInputs.partial as unknown) !== undefined) {
          this.userInputs.partial[fieldId] = newUserInputs.partial;
        } else {
          delete this.userInputs.partial[fieldId];
        }
      }
    }
  }

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
  ): Exclude<Field['status'], 'initial'> {
    const { type } = configuration;

    if (type === 'null' || field === null) {
      return 'success';
    }

    // Note: this variable is used to determine the step global status, and has nothing to do with
    // the field status itself!
    let fieldState: Exclude<Field['status'], 'initial'> = (field.status === 'error') ? 'error' : 'progress';
    const currentField = field;
    const hasBeenUpdated = updatedFieldPaths.includes(field.path);

    // Nested fields...
    let allSubfieldsPassed = true;
    if (type === 'array' || type === 'object') {
      const fields = field.fields as Field[];
      let allSubfieldsInitial = true;
      for (let index = 0, { length } = fields; index < length; index += 1) {
        let subFieldState: Exclude<Field['status'], 'initial'> = 'error';
        if (type === 'array') {
          subFieldState = this.validateField(
            fields[index],
            configuration.fields,
            partial,
            updatedFieldPaths,
          );
        } else {
          const fieldIds = Object.keys(configuration.fields);
          const fieldConfiguration = configuration.fields[fieldIds[index]];
          subFieldState = this.validateField(
            fields[index],
            fieldConfiguration,
            partial,
            updatedFieldPaths,
          );
        }
        allSubfieldsPassed = allSubfieldsPassed && subFieldState !== 'error';
        allSubfieldsInitial = allSubfieldsInitial && fields[index]?.status === 'initial';
        if (subFieldState === 'error' || subFieldState === 'progress') {
          // `error` status always takes precedence over any other status.
          fieldState = (fieldState === 'error') ? fieldState : subFieldState;
        }
      }
      // This status might be overriten by the field required/validation checks below.
      if (allSubfieldsPassed) {
        fieldState = 'progress';
        currentField.error = null;
      }
      currentField.status = allSubfieldsInitial ? 'initial' : fieldState;
    }

    const isRequired = configuration.required === true;
    const isEmpty = this.isEmpty(field.value, type);

    // When `validateOnSubmit` option is enabled, we just reset the updated fields statuses
    // without performing any special check, unless one of them is a submit field.
    if (hasBeenUpdated && this.configuration.validateOnSubmit && partial) {
      fieldState = 'progress';
      currentField.error = null;
      currentField.status = 'progress';
    } else if (
      !partial
      || (hasBeenUpdated && this.configuration.validateOnSubmit !== true)
      || field.status === 'progress'
      || field.status === 'success'
    ) {
      currentField.error = null;
      // Empty fields...
      if (isEmpty && isRequired && (!partial || currentField.status === 'error')) {
        fieldState = 'error';
        currentField.status = 'error';
        currentField.error = 'REQUIRED';
      } else if (isEmpty) {
        currentField.status = 'initial';
        fieldState = isRequired ? 'progress' : 'success';
      } else {
        // Validation rules...
        const { validation } = configuration;
        const error = (validation !== undefined)
          ? validation(field.value as never, this.userInputs, this.variables)
          : null;
        if (error !== null) {
          fieldState = 'error';
          currentField.status = 'error';
          currentField.error = error;
        } else if (allSubfieldsPassed) {
          fieldState = 'success';
          currentField.error = null;
          currentField.status = 'success';
        }
      }
    } else if (field.status === 'initial') {
      return !isRequired && isEmpty ? 'success' : fieldState;
    }

    return fieldState;
  }

  /**
   * Validates current step, making sure that all its fields' values pass validation rules.
   *
   * @param updatedFieldPaths List of updated fields paths (used for validation on submit only).
   *
   * @param partial Whether to also validate empty fields. Defaults to `false`.
   */
  protected validateFields(updatedFieldPaths: string[], partial = false): void {
    if (this.currentStep !== null) {
      let allFieldsSucceeded = true;
      // We reset current step status to not stay in error state forever.
      this.currentStep.status = 'progress';
      const currentStepId = this.currentStep.path.split('.')[0];
      const { fields: fieldIds } = this.configuration.steps[currentStepId];
      for (let index = 0, { length } = fieldIds; index < length; index += 1) {
        const fieldState = this.validateField(
          this.currentStep.fields[index],
          this.configuration.fields[fieldIds[index]],
          partial,
          updatedFieldPaths,
        );
        if (fieldState !== 'success') {
          allFieldsSucceeded = false;
          this.currentStep.status = (fieldState === 'progress') ? this.currentStep.status : 'error';
        }
      }
      this.currentStep.status = allFieldsSucceeded ? 'success' : this.currentStep.status;
    }
  }

  /**
   * Triggers hooks chain for the given event.
   *
   * @param eventName Event name.
   *
   * @param data Additional data to pass to the hooks chain.
   *
   * @returns Pending hooks chain.
   */
  protected async triggerHooks<T extends HookData>(
    eventName: FormEvent,
    data: T,
  ): Promise<T | null> {
    try {
      const hooksChain = this.hooks[eventName].reduce((chain, hook) => (updatedData) => (
        hook(updatedData, chain as NextHook<HookData>)
      ), (updatedData) => Promise.resolve(updatedData));
      const updatedData = await (hooksChain as NextHook<HookData>)(data);
      if ((updatedData as unknown) === undefined) {
        throw new Error(
          `Event "${eventName}": data passed to the next hook is "undefined".`
          + ' This usually means that you did not correctly resolved your hook Promise with'
          + ' proper data.',
        );
      }
      this.notifyUI();
      return updatedData as T;
    } catch (error) {
      // Disabling cache on error prevents the form to be stucked in error step forever.
      this.cache = null;
      await this.clearCache();
      // This safety mechanism prevents infinite loops when throwing errors from "error" hooks.
      if (eventName !== 'error' && this.hooks.error.length > 0) {
        await this.triggerHooks('error', error as Error);
      } else {
        throw error;
      }
      return null as T;
    }
  }

  /**
   * Processes user inputs in batch to optimize performance by preventing too many UI notifications
   * and to enforce hooks consistency.
   */
  protected async processUserInputs(): Promise<void> {
    let shouldSubmit = false;
    const updatedUserActions: (UserAction | null)[] = [];

    const executeNextBatch = async (forceStop = false): Promise<void> => {
      const newUserInputs = new Map<string, Data>();
      updatedUserActions.push(...await Promise.all(
        [...this.userInputsQueue].map(async ([subPath, { data, configuration }]) => {
          const updatedUserAction = await this.triggerHooks('userAction', {
            type: 'input',
            path: subPath,
            data: this.coerce(data, configuration.type),
          });
          this.userInputsQueue.delete(subPath);
          if (updatedUserAction !== null) {
            newUserInputs.set(updatedUserAction.path, updatedUserAction.data);
            shouldSubmit = shouldSubmit || (configuration as StringConfiguration).submit === true;
          }
          return updatedUserAction;
        }),
      ));
      this.toggleFields(this.currentStep, newUserInputs);
      if (this.userInputsQueue.size > 0) {
        await executeNextBatch();
      } else if (!forceStop) {
        // Toggles fields one last time for conditional fields.
        await executeNextBatch(true);
      }
    };

    // Toggling fields as long as there are new user actions to perform...
    await executeNextBatch();

    // Validating relevant fields...
    this.validateFields(updatedUserActions.reduce<string[]>((fieldPaths, updatedUserAction) => (
      (updatedUserAction !== null) ? fieldPaths.concat([updatedUserAction.path]) : fieldPaths
    ), []), !shouldSubmit);

    // Triggering post-user action hooks...
    await Promise.all(updatedUserActions.map((action) => this.triggerHooks('afterUserAction', action)));

    if ((this.currentStep as unknown as Step).status === 'success' && shouldSubmit as boolean) {
      const { submitPartialUpdates } = this.configuration;
      const currentStepId = (this.currentStep as unknown as Step).path.split('.')[0];
      const { nextStep, submit } = this.configuration.steps[currentStepId];
      const userInputsType = (submitPartialUpdates !== false) ? 'partial' : 'full';
      let finalUserInputs: UserInputs | null = this.userInputs[userInputsType];

      // Submitting form, if necessary...
      if (submit) {
        finalUserInputs = await this.triggerHooks('submit', finalUserInputs);
        if (finalUserInputs !== null && this.configuration.clearCacheOnSubmit !== false) {
          this.cache = null;
          this.clearCache();
          await this.configuration.onSubmit?.(finalUserInputs, this.variables);
        }
      }

      // Generating next step, if it exists...
      if (finalUserInputs !== null) {
        this.createStep((typeof nextStep === 'function')
          ? nextStep(this.userInputs.full, this.variables)
          : nextStep ?? null);
      }
    }
  }

  /**
   * Handles new user actions, applying core logic such as hooks triggering or next step generation.
   *
   * @param userAction New state sent by `userActions` store module.
   *
   * @throws If user action path does not point to a valid field.
   */
  protected async handleUserAction(userAction: UserAction | null): Promise<void> {
    if (userAction !== null) {
      const { path } = userAction;
      const stepIndex = +path.split('.')[1];

      // If user changes a field in a previous step, it may have an impact on next steps to render.
      // Thus, it is not necessary to keep any more step than the one containing last user action.
      if (!Number.isNaN(stepIndex)) {
        this.steps = this.steps.slice(0, stepIndex + 1);
        this.currentStep = this.steps[this.steps.length - 1];
      }

      const field = this.getField(path);
      const fieldConfiguration = this.getConfiguration(path) as FieldConfiguration | null;

      if (field === null || fieldConfiguration === null) {
        throw new Error(`Field with path "${path}" does not exist.`);
      }

      const splittedPath = path.split('.').slice(2);
      let initialValue: UserInputs | null = this.initialValues;
      while (splittedPath.length > 0 && initialValue !== null) {
        initialValue = initialValue[String(splittedPath.shift())] as UserInputs | null ?? null;
      }
      this.toggleField(path, field, fieldConfiguration, userAction.data, initialValue);
      await this.processUserInputs();
    }
  }

  /**
   * Class constructor.
   *
   * @param configuration Form engine configuration.
   */
  constructor(configuration: Configuration) {
    const { initialValues, ...rest } = configuration;
    const store = new Store();
    store.register('state', state);
    store.register('userActions', userActions);
    this.hooks = {
      step: [],
      error: [],
      start: [],
      submit: [],
      afterStep: [],
      afterUserAction: [],
      userAction: [],
    };
    this.steps = [];
    this.store = store;
    this.loading = true;
    this.currentStep = null;
    this.cacheTimeout = null;
    this.mutationTimeout = null;
    this.userInputsQueue = new Map();
    this.configuration = deepCopy(rest);
    this.discardedUserInputs = new Map();
    this.cache = configuration.cache ?? null;
    this.userInputs = { full: {}, partial: {} };
    this.initialValues = deepCopy(initialValues ?? {});
    this.cacheKey = `form_${configuration.id ?? 'cache'}`;
    this.variables = deepCopy(configuration.variables ?? {});

    // Be careful: plugins' order matters!
    (configuration.plugins ?? []).forEach((hook) => { hook(this); });

    // Engine initialization.
    // NOTE: we must NOT subscribe to `state` module, as it would generate asynchronous updates
    // on the engine `steps` attribute, which would lead to unpredictable behaviours.
    // `steps` MUST stay the single source of truth, and `states` module must be only used
    // for unidirectional notification to the view.
    this.store.subscribe('userActions', this.handleUserAction.bind(this) as unknown as () => void);

    // Depending on the configuration, we want either to load the complete form from cache, or just
    // its filled values and restart user journey from the beginning.
    const cachePromise = this.cache?.get(this.cacheKey) ?? Promise.resolve(null);
    cachePromise.then((data) => {
      if (data !== null) {
        const cachedData = data as CachedData;
        this.variables = cachedData.variables;
        this.userInputs = cachedData.userInputs;
        this.discardedUserInputs = cachedData.discardedUserInputs;
        if (this.configuration.restartOnReload !== true) {
          this.steps = cachedData.steps;
          this.userInputs = cachedData.userInputs;
          this.currentStep = this.steps[this.steps.length - 1];
        }
      }
      this.triggerHooks('start', true).then((status) => {
        if (status !== null && (data === null || this.configuration.restartOnReload)) {
          this.createStep(this.configuration.root);
        }
      });
    });
  }

  /**
   * Checks whether `input` is considered as empty, according to its type.
   *
   * @param input Input to check.
   *
   * @param type Input type.
   *
   * @returns `true` if `input` is empty, `false` otherwise.
   */
  public isEmpty(input: Data, type: FieldConfiguration['type']): boolean {
    return (
      input === null
      || input === undefined
      || (type === 'string' && `${input}`.trim() === '')
    );
  }

  /**
   * Generates step with id `stepId`.
   *
   * @param stepId Step id.
   */
  public async createStep(stepId: string | null): Promise<void> {
    if (stepId !== null) {
      const path = `${stepId}.${this.steps.length}`;
      const fields = this.configuration.steps[stepId].fields.map((fieldId) => {
        const value = this.userInputs.full[fieldId];
        const initialValue = this.initialValues[fieldId];
        const configuration = this.configuration.fields[fieldId];

        if ((configuration as unknown) === undefined) {
          throw new Error(`Could not find configuration for field with id "${fieldId}" in step "${stepId}".`);
        }

        return this.toggleField(`${path}.${fieldId}`, null, configuration, value, initialValue);
      });
      const updatedNextStep = await this.triggerHooks('step', { path, status: 'initial', fields });

      if (updatedNextStep !== null) {
        this.steps.push(updatedNextStep);
        this.currentStep = updatedNextStep;
        await this.triggerHooks('afterStep', updatedNextStep);
        await this.processUserInputs();
        this.loading = false;
      }
    }
  }

  /**
   * Toggles a loader right after current step, indicating next step is/not being generated.
   *
   * @param display Whether to display step loader.
   */
  public toggleLoader(display: boolean): void {
    this.enqueueMutation('SET_LOADER', display);
  }

  /**
   * Returns current store instance.
   *
   * @returns Current store instance.
   */
  public getStore(): Store {
    return this.store;
  }

  /**
   * Sends a new notification to all `state` module listeners.
   */
  public notifyUI(): void {
    this.enqueueMutation('UPDATE', this.steps);
  }

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

  public on(eventName: FormEvent, hook: Hook<Data>): void {
    this.hooks[eventName] = [hook].concat(this.hooks[eventName]);
  }

  /**
   * Triggers the given user action.
   *
   * @param userAction User action to trigger.
   */
  public userAction(userAction: UserAction): void {
    this.store.mutate('userActions', 'ADD', userAction);
  }

  /**
   * Returns current partial or full user inputs.
   *
   * @param partial Whether to return only partial user inputs. Defaults to `false`.
   *
   * @returns Current user inputs.
   */
  public getUserInputs<T>(partial = false): T {
    return this.userInputs[partial ? 'partial' : 'full'] as T;
  }

  /**
   * Returns field/step configuration for `path`. If no path is provided, the global form
   * configuration is returned instead.
   *
   * @param path Field/step path to get configuration for.
   *
   * @returns Path configuration.
   */
  public getConfiguration(path?: string): SubConfiguration {
    let subConfiguration = this.configuration as SubConfiguration | null;
    if (path === undefined) {
      return subConfiguration;
    }
    const splittedPath = path.split('.');
    subConfiguration = this.configuration.steps[splittedPath.shift() as unknown as string];
    splittedPath.shift();
    while ((subConfiguration as unknown) !== undefined && splittedPath.length > 0) {
      const subPath = String(splittedPath.shift());
      if ((subConfiguration as FieldConfiguration).type === 'array') {
        subConfiguration = (subConfiguration as ArrayConfiguration).fields;
      } else if ((subConfiguration as FieldConfiguration).type === 'object') {
        subConfiguration = (subConfiguration as ObjectConfiguration).fields[subPath];
      } else {
        subConfiguration = this.configuration.fields[subPath];
      }
    }
    return (subConfiguration as SubConfiguration) ?? null;
  }

  /**
   * Returns the generated field at `path`.
   *
   * @param path Field path in the form.
   *
   * @returns Generated field if it exists, `null` otherwise.
   */
  public getField(path: string): Field | null {
    const splitted = path.split('.');
    let subPath = `${splitted.shift()}.${splitted[0]}`;
    let field = this.steps[+(splitted.shift() as unknown as string)] as Field | null | undefined;
    const findField = (currentField: Field | null): boolean => currentField?.path === subPath;
    while (splitted.length > 0 && field !== undefined && field !== null) {
      subPath += `.${splitted.shift()}`;
      field = (field.fields as unknown as Field[]).find(findField);
    }
    return field ?? null;
  }

  /**
   * Returns all generated steps.
   *
   * @returns Current step.
   */
  public getSteps(): Step[] {
    return this.steps;
  }

  /**
   * Retrieves current form variables.
   *
   * @returns Form variables.
   */
  public getVariables<T>(): T {
    return this.variables as T;
  }

  /**
   * Adds or overrides the given form variables.
   *
   * @param variables Form variables to add or override.
   */
  public async setVariables<T>(variables: T): Promise<void> {
    this.variables = deepMerge(this.variables, variables);
    await this.processUserInputs();
    this.notifyUI();
  }

  /**
   * Clears current form cache.
   */
  public async clearCache(): Promise<void> {
    await this.cache?.delete(this.cacheKey);
  }

  /**
   * Sets initial form values. This method is especially useful when you need to reset initial
   * values for multiple partial submissions without re-creating the whole form each time.
   *
   * @param initialValues New initial form values to apply.
   */
  public setInitialValues(initialValues: UserInputs): void {
    this.initialValues = deepCopy(initialValues);
  }
}
