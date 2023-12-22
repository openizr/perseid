/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export default class Store {
  public subscribe = vi.fn((_hash, callback: (arg: unknown) => void) => {
    callback({ count: 5 });
    return 1;
  });

  public unsubscribe = vi.fn();

  public dispatch = vi.fn();

  public mutate = vi.fn();

  public combinedModules = {
    module: {
      moduleIds: ['module'],
      reducer: (newState: unknown): unknown => newState,
      subscriptions: [],
    },
  };

  public modules = {
    module: { state: { value: 'test' } },
  };
}
