/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Store from 'scripts/core/Store';
import { readable } from 'svelte/store';
import connect from 'scripts/connectors/svelte';

vi.mock('scripts/core/Store');
vi.mock('svelte/store', () => {
  const set = vi.fn();
  return ({
    readable: vi.fn((_state, callback: (arg: unknown) => () => void) => {
      callback(set)();
      return { value: 'test' };
    }),
  });
});

describe('connectors/svelte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should correctly initialize a Svelte connection to the store', () => {
    const store = new Store();
    const useSubscription = connect(store);
    expect(typeof useSubscription).toBe('function');
  });

  test('should throw an error if given module does not exist', () => {
    const store = new Store();
    const useSubscription = connect(store);
    expect(() => {
      useSubscription('invalid');
    }).toThrow(
      'Could not subscribe to module with id "invalid": module does not exist.',
    );
  });

  test('should correctly subscribe to an existing module', () => {
    const store = new Store();
    const useSubscription = connect(store);
    const state = useSubscription('module');
    expect(state).toEqual({ value: 'test' });
    expect(readable).toHaveBeenCalledTimes(1);
    expect(readable).toHaveBeenCalledWith({ value: 'test' }, expect.any(Function));
    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(store.subscribe).toHaveBeenCalledWith('module', expect.any(Function));
    expect(store.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.unsubscribe).toHaveBeenCalledWith('module', 1);
  });
});
