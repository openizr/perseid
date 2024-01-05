/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/store/connectors/vue' {
  import { type Ref, type UnwrapRef } from 'vue';
  import Store, { type Reducer } from '@perseid/store';

  /**
   * Registers a new subscription to the specified module.
   *
   * @param moduleId Id of the module to subscribe to.
   *
   * @param reducer Optional state reducer. Allows you to transform the new state to
   * get exactly what you need. Defaults to the identify function.
   *
   * @returns Reduced state.
   */
  export type UseSubscription = <T>(id: string, reducer?: Reducer<T>) => Ref<UnwrapRef<T>>;

  /**
   * Initializes a Vue connection to `store`.
   *
   * @param store Perseid store to connect Vue to.
   *
   * @returns `useSubscription` function.
   */
  export default function connect(store: Store): UseSubscription;
}
