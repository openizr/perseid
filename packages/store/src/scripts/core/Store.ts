/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Global state manager.
 * Contains all the sub-states, combined modules and their subscriptions.
 */
export default class Store {
  /** List of store middlewares. */
  protected middlewares: Subscription[];

  /** Unique index used for subscriptions ids generation. */
  protected index: number;

  /** List of store combined modules. */
  protected combinedModules: Partial<Record<string, {
    reducer: Reducer;
    moduleIds: string[];
    subscriptions: Partial<Record<string, Subscription>>;
  }>>;

  /** Global modules registry. */
  protected modules: Partial<Record<string, Module & {
    combinedModules: string[];
    actions: Partial<Record<string, ((api: ActionApi, data?: unknown) => Promise<unknown>)>>;
  }>>;

  /**
   * Generates a unique subscription id.
   *
   * @returns The generated subscription id.
   */
  protected generateSubscriptionId(): string {
    const subscriptionId = ((this.index += 1) * 100).toString(16) + Date.now().toString(16);
    return subscriptionId;
  }

  /**
   * Class constructor.
   */
  public constructor() {
    this.index = 0;
    this.modules = {};
    this.middlewares = [];
    this.combinedModules = {};
    this.mutate = this.mutate.bind(this);
    this.dispatch = this.dispatch.bind(this);
    this.combine = this.combine.bind(this);
    this.uncombine = this.uncombine.bind(this);
    this.register = this.register.bind(this);
    this.unregister = this.unregister.bind(this);
  }

  /**
   * Registers a new module into the store registry.
   *
   * @param id Module's unique identifier in registry. Can be any string, although it
   * is recommended to follow a tree-structure pattern, like `/my_app/module_a/module_b`.
   *
   * @param module Module to register.
   *
   * @returns Module's id.
   *
   * @throws If a module with the same id already exists in registry.
   */
  public register<T>(id: string, module: Module<T>): string {
    if (this.modules[id] !== undefined) {
      throw new Error(
        `Could not register module with id "${id}": `
        + 'another module with the same id already exists.',
      );
    }
    this.modules[id] = {
      state: module.state,
      actions: module.actions ?? {},
      mutations: module.mutations as unknown as Module['mutations'],
      // Storing related combined modules' ids makes it easier to notify them after mutations.
      combinedModules: [],
    };
    // A default combined module with the same id is always created first.
    this.combine(id, [id], (newState: unknown) => newState);
    if (module.setup !== undefined) {
      module.setup({
        id,
        mutate: this.mutate,
        combine: this.combine,
        register: this.register,
        dispatch: this.dispatch,
        uncombine: this.uncombine,
        unregister: this.unregister,
      });
    }
    return id;
  }

  /**
   * Unregisters module with id `id` from the global modules registry.
   *
   * @param id Id of the module to unregister.
   *
   * @throws If module with id `id` does not exist.
   *
   * @throws If module still has related user-defined combined modules.
   */
  public unregister(id: string): void {
    const module = this.modules[id];
    if (module === undefined) {
      throw new Error(
        `Could not unregister module with id "${id}": `
        + 'module does not exist.',
      );
    }
    if (module.combinedModules.length > 1) {
      throw new Error(
        `Could not unregister module with id "${id}": `
        + 'all the related combined modules must be uncombined first using `uncolmbine`.',
      );
    }
    // Deleting module and related default combined module...
    delete (this.modules[id]);
    delete (this.combinedModules[id]);
  }

  /**
   * Combines one or several modules to allow subscriptions on that combination.
   *
   * @param id Combined module's unique identifier in registry. Can be any string, although it
   * is recommended to follow a tree-structure pattern, e.g. `/my_app/module_a/module_b`.
   *
   * @param moduleIds Ids of the modules to combine.
   *
   * @param reducer Transformation function. This function is called with every combined
   * module's state as arguments.
   * For instance: `(stateA, stateB, stateC) => ({ a: stateA.prop, b: stateB, c: stateC.propC })`
   *
   * @returns Combined module's id.
   *
   * @throws If a module with the same id already exists in registry.
   *
   * @throws If one of the modules' ids does not exist.
   */
  public combine<T>(id: string, moduleIds: string[], reducer: Reducer<T>): string {
    if (this.combinedModules[id] !== undefined) {
      throw new Error(
        `Could not create combined module with id "${id}": `
        + 'another module with the same id already exists.',
      );
    }
    moduleIds.forEach((moduleId) => {
      const module = this.modules[moduleId];
      if (module === undefined) {
        throw new Error(
          `Could not create combined module with id "${id}": `
          + `module with id "${moduleId}" does not exist.`,
        );
      }
      module.combinedModules.push(id);
    });
    this.combinedModules[id] = {
      reducer,
      moduleIds,
      subscriptions: {},
    };
    return id;
  }

  /**
   * Uncombines user-defined combined module with id `id`.
   *
   * @param id Id of the combined module to uncombine.
   *
   * @throws If combined module with id `id` does not exist.
   *
   * @throws If the given id corresponds to a default combined module.
   *
   * @throws If combined module still has subscriptions.
   */
  public uncombine(id: string): void {
    const combinedModule = this.combinedModules[id];
    if (combinedModule === undefined) {
      throw new Error(
        `Could not uncombine module with id "${id}": `
        + 'combined module does not exist.',
      );
    }
    if (this.modules[id] !== undefined) {
      throw new Error(
        `Could not uncombine combined module with id "${id}": `
        + 'default combined modules cannot be uncombined, use `unregister` instead.',
      );
    }
    if (Object.keys(combinedModule.subscriptions).length > 0) {
      throw new Error(
        `Could not uncombine combined module with id "${id}": `
        + 'all the related subscriptions must be removed first using `unsubscribe`.',
      );
    }
    // Removing all the references to this id from modules...
    combinedModule.moduleIds.forEach((moduleId) => {
      const module = this.modules[moduleId] as { combinedModules: string[]; };
      const index = module.combinedModules.indexOf(id);
      module.combinedModules.splice(index, 1);
    });
    delete (this.combinedModules[id]);
  }

  /**
   * Subscribes to changes on module with id `id`.
   *
   * @param id Id of the module to subscribe to.
   *
   * @param handler Callback to execute each time module notifies changes.
   *
   * @returns Subscription's id, used to unsubscribe handler.
   *
   * @throws If module with id `id` does not exist.
   */
  public subscribe<T>(id: string, handler: Subscription<T>): string {
    const combinedModule = this.combinedModules[id];
    if (combinedModule === undefined) {
      throw new Error(`Could not subscribe to module with id "${id}": module does not exist.`);
    }
    const subscriptionId = this.generateSubscriptionId();
    combinedModule.subscriptions[subscriptionId] = handler as Subscription;
    // We trigger the notification a first time with "initial" states.
    const states = combinedModule.moduleIds.map((moduleId) => (
      (this.modules[moduleId] as Module).state
    ));
    (handler as (newState: T) => void)((combinedModule.reducer as Reducer<T>)(...states));
    return subscriptionId;
  }

  /**
   * Unsubscribes from changes on module with id `id`.
   *
   * @param id Id of the module to unsubscribe from.
   *
   * @param subscriptionId Id of the subscription.
   *
   * @throws If module with id `id` does not exist.
   *
   * @throws If subscription with id `id` does not exist on that module.
   */
  public unsubscribe(id: string, subscriptionId: string): void {
    const module = this.combinedModules[id];
    if (module === undefined) {
      throw new Error(
        `Could not unsubscribe from module with id "${id}": `
        + 'module does not exist.',
      );
    }
    if (module.subscriptions[subscriptionId] === undefined) {
      throw new Error(
        `Could not unsubscribe from module with id "${id}": `
        + `subscription id "${subscriptionId}" does not exist on that module.`,
      );
    }
    delete (module.subscriptions[subscriptionId]);
  }

  /**
   * Performs a state mutation on module with id `id`.
   *
   * @param id Id of the module on which to perform mutation.
   *
   * @param name Name of the mutation to perform.
   *
   * @param data Additional data to pass to the mutation.
   *
   * @throws If module with id `id` does not exist or is a combined module.
   *
   * @throws If mutation's name does not exist on that module.
   */
  public mutate(id: string, name: string, data?: unknown): void {
    const registeredModule = this.modules[id];
    if (registeredModule === undefined) {
      throw new Error(
        `Could not perform mutation on module with id "${id}": `
        + 'module does not exist, or is a combined module.',
      );
    }
    const mutation = registeredModule.mutations[name];
    if (mutation === undefined) {
      throw new Error(
        `Could not perform mutation on module with id "${id}": `
        + `mutation "${name}" does not exist on that module.`,
      );
    }

    const newState = mutation({ id, state: registeredModule.state }, data);

    if (newState !== registeredModule.state) {
      registeredModule.state = newState;

      // Notifying all the middlewares of the changes...
      this.middlewares.forEach(async (middleware) => {
        await middleware(newState);
      });

      // Notifying all the combined modules' subscriptions of the changes...
      registeredModule.combinedModules.forEach((combinedmoduleId) => {
        const combinedModule = this.combinedModules[combinedmoduleId] as unknown as Exclude<
          Store['combinedModules'][''], undefined
        >;
        const states = combinedModule.moduleIds.map((moduleId) => (
          (this.modules[moduleId] as Module).state
        ));
        const finalState = combinedModule.reducer(...states);
        // All subscriptions are called asynchronously to avoid the "mutation in mutation" effect,
        // which happens when performing a mutation on a module inside a subscription to that
        // same module, making any other subscription receiving updates in the wrong order.
        Object.keys(combinedModule.subscriptions).forEach((subscriptionId) => setTimeout(() => {
          // In some cases, when unsubscribing from a module and mutating it at the same time,
          // subscriptions may be removed while they are triggered. We ensure they still exist
          // before actually calling them.
          /* istanbul ignore next */
          const subscription = combinedModule.subscriptions[subscriptionId];
          if (subscription !== undefined) {
            (subscription as (state: unknown) => void)(finalState);
          }
        }));
      });
    }
  }

  /**
   * Dispatches an asynchronous action to module with id `id`.
   *
   * @param id Id of the module to dispatch action on.
   *
   * @param name Name of the action to perform.
   *
   * @param data Additional data to pass to the action.
   *
   * @throws If module with id `id` does not exist or is a combined module.
   *
   * @throws If action's name does not exist on that module.
   */
  public async dispatch<T>(id: string, name: string, data?: unknown): Promise<T> {
    const registeredModule = this.modules[id];
    if (registeredModule === undefined) {
      throw new Error(
        `Could not dispatch action to module with id "${id}": `
        + 'module does not exist, or is a combined module.',
      );
    }
    const action = registeredModule.actions[name];
    if (action === undefined) {
      throw new Error(
        `Could not dispatch action to module with id "${id}": `
        + `action "${name}" does not exist on that module.`,
      );
    }
    return action({
      id,
      mutate: this.mutate,
      dispatch: this.dispatch,
      combine: this.combine,
      uncombine: this.uncombine,
      register: this.register,
      unregister: this.unregister,
    }, data) as Promise<T>;
  }

  /**
   * Applies the given middleware to the store.
   *
   * @param middleware Middleware to apply to store.
   */
  public use<T>(middleware: Subscription<T>): void {
    this.middlewares.push(middleware as Subscription);
  }
}
