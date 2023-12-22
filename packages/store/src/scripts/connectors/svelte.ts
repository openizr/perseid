/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Store from 'scripts/core/Store';
import { readable, Readable } from 'svelte/store';

type TypedReducer = <T>(...newState: unknown[]) => T;
type PrivateStore = Store & {
  modules: Store['modules'];
  combinedModules: Store['combinedModules'];
}

/** Registers a new subscription to the specified module. */
export type UseSubscription = <T>(id: string, reducer?: Reducer<T>) => Readable<T>;

/**
 * Initializes a Svelte connection to `store`.
 *
 * @param store Perseid store to connect Svelte to.
 *
 * @returns `useSubscription` function.
 */
export default function connect(store: Store): UseSubscription {
  const privateStore = store as PrivateStore;
  const defaultReducer: Reducer = (newState) => newState;
  const getState = (moduleId: string): unknown => (privateStore.modules[moduleId] as Module).state;

  return (id, reducer = defaultReducer as TypedReducer) => {
    const combinedModule = privateStore.combinedModules[id];

    if (combinedModule !== undefined) {
      const state = reducer(combinedModule.reducer(
        ...combinedModule.moduleIds.map(getState),
      ));
      // Subscribing to the given module at component creation...
      return readable(state, (set) => {
        const subscriptionId = store.subscribe(id, (newState) => {
          set(reducer(newState));
        });
        return () => {
          store.unsubscribe(id, subscriptionId);
        };
      });
    }
    throw new Error(`Could not subscribe to module with id "${id}": module does not exist.`);
  };
}
