/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { ref } from 'vue';
import Store from 'scripts/core/Store';
import connect from 'scripts/connectors/vue';

vi.mock('vue');
vi.mock('scripts/core/Store');

describe('connectors/vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should correctly initialize a Vue connection to the store', () => {
    const store = new Store();
    const useCombiner = connect(store);
    expect(typeof useCombiner).toBe('function');
  });

  test('should throw an error if given module does not exist', () => {
    const store = new Store();
    const useCombiner = connect(store);
    expect(() => {
      useCombiner('invalid');
    }).toThrow(
      'Could not subscribe to module with id "invalid": module does not exist.',
    );
  });

  test('should correctly subscribe to an existing module', () => {
    const store = new Store();
    const useCombiner = connect(store);
    const state = useCombiner('module');
    expect(state).toEqual({ value: { count: 5 } });
    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledWith({ value: 'test' });
    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(store.subscribe).toHaveBeenCalledWith('module', expect.any(Function));
    expect(store.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.unsubscribe).toHaveBeenCalledWith('module', 1);
  });
});
