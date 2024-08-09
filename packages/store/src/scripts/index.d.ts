/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '*.svelte' {
  import { SvelteComponent } from 'svelte';

  export default SvelteComponent;
}

declare module '*.vue' {
  import Vue from 'vue';

  export default Vue;
}

/** Reducer, mixes several modules' states into one. */
type Reducer<T = unknown> = (...newState: any[]) => T;

/** Subscription to modules' states changes. */
type Subscription<T = unknown> = (newState: T) => void | Promise<void>;

/** Mutation API. */
interface MutationApi<T> {
  /** Module's id. */
  id: string;

  /** Module's current state. */
  state: T;
}

/** Action API. */
interface ActionApi {
  /** Module's id. */
  id: string;

  /** Store's `mutate` method. */
  mutate: (id: string, name: string, data?: unknown) => void;

  /** Store's `dispatch` method. */
  dispatch: <T>(id: string, name: string, data?: unknown) => Promise<T>;

  /** Store's `register` method. */
  register: <T>(id: string, module: Module<T>) => string;

  /** Store's `unregister` method. */
  unregister: (id: string) => void;

  /** Store's `combine` method. */
  combine: <T>(id: string, modules: string[], reducer: Reducer<T>) => string;

  /** Store's `uncombine` method. */
  uncombine: (id: string) => void;
}

/** Module. */
interface Module<T = unknown> {
  /** Initial state. */
  state: T;

  /** Setup function, called on module registration. You can use it to perform initializations. */
  setup?: (api: ActionApi) => void;

  /** List of module's mutations. */
  mutations: Partial<Record<string, (api: MutationApi<T>, data?: any) => T>>;

  /** List of module's actions. */
  actions?: Partial<Record<string, (api: ActionApi, data?: any) => Promise<unknown>>>;
}
