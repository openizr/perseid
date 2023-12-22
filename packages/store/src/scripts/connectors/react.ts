/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Store from 'scripts/core/Store';

type TypedReducer = <T>(...newState: unknown[]) => T;
type PrivateStore = Store & {
  modules: Store['modules'];
  combinedModules: Store['combinedModules'];
}

/** Registers a new subscription to the specified module. */
export type UseSubscription = <T>(id: string, reducer?: Reducer<T>) => T;

/**
 * Initializes a React connection to `store`.
 *
 * @param store Perseid store to connect React to.
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
      // Subscribing to the given module at component creation...
      const [state, setState] = React.useState(() => reducer(combinedModule.reducer(
        ...combinedModule.moduleIds.map(getState),
      )));
      React.useEffect(() => {
        const subscriptionId = store.subscribe(id, (newState) => {
          setState(reducer(newState));
        });
        return (): void => {
          store.unsubscribe(id, subscriptionId);
        };
      }, []);
      return state;
    }
    throw new Error(`Could not subscribe to module with id "${id}": module does not exist.`);
  };
}
