/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Store from 'scripts/core/Store';
import connect from 'scripts/connectors/react';

vi.mock('react');
vi.mock('scripts/core/Store');

describe('connectors/react', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should correctly initialize a React connection to the store', () => {
    const store = new Store();
    const useSubscription = connect(store);
    expect(typeof useSubscription).toBe('function');
  });

  test('should throw an error if given module does not exist', () => {
    const store = new Store();
    const useSubscription = connect(store);
    expect(() => {
      useSubscription('invalid', (newState: unknown) => newState);
    }).toThrow(
      'Could not subscribe to module with id "invalid": module does not exist.',
    );
  });

  test('should correctly subscribe to an existing module', () => {
    const store = new Store();
    const useSubscription = connect(store);
    const reducer = vi.fn((value: { value: unknown; }) => value.value);
    const state = useSubscription('module', reducer as unknown as (s: unknown) => unknown);
    expect(reducer).toHaveBeenCalledTimes(2);
    // First time to compute initial state...
    expect(reducer).toHaveBeenCalledWith({ count: 5 });
    // Second time to compute new state after subscription was triggered.
    expect(reducer).toHaveBeenCalledWith({ value: 'test' });
    // Component mounted...
    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(store.subscribe).toHaveBeenCalledWith('module', expect.any(Function));
    // Component unmounted.
    expect(store.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.unsubscribe).toHaveBeenCalledWith('module', 1);
    expect(state).toBe('test');
    const otherState = useSubscription('module'); // With default reducer.
    expect(otherState).toEqual({ value: 'test' });
  });
});
