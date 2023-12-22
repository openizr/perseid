/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Store from 'scripts/core/Store';

Date.now = vi.fn(() => 1543757462922);

describe('core/Store', () => {
  let store: Store;
  let moduleA: Module<{ test: number; }>;
  const moduleB: Module<{ test: number; }> = {
    state: {
      test: 5,
    },
    mutations: {
      ADD: ({ state }) => ({ test: state.test + 1 }),
    },
    actions: {
      ADD: async ({ mutate, id }) => {
        await Promise.resolve();
        mutate(id, 'ADD');
      },
    },
  };

  beforeEach(() => {
    store = new Store();
    moduleA = {
      state: {
        test: 0,
      },
      setup: vi.fn(),
      mutations: {
        ADD({ state }) {
          return {
            test: state.test + 1,
          };
        },
        BAD({ state }) {
          return Object.assign(state, { test: 10 });
        },
        NOOP({ state }) {
          return { ...state };
        },
      },
    } as Module<{ test: number; }>;
  });

  describe('constructor', () => {
    test('always correctly instanciates', () => {
      expect(store).toMatchSnapshot();
    });
  });

  describe('register', () => {
    test('throws an error if id is already used by another module', () => {
      store.register('module', moduleA);
      expect(() => {
        store.register('module', moduleB);
      }).toThrow(
        'Could not register module with id "module": '
        + 'another module with the same id already exists.',
      );
    });
    test('correctly registers module if id is not already used', () => {
      store.register('module', moduleA);
      expect(moduleA.setup).toHaveBeenCalledTimes(1);
      expect(moduleA.setup).toHaveBeenCalledWith({
        id: 'module',
        combine: store.combine,
        dispatch: store.dispatch,
        mutate: store.mutate,
        register: store.register,
        uncombine: store.uncombine,
        unregister: store.unregister,
      });
      expect(store).toMatchSnapshot();
    });
  });

  describe('unregister', () => {
    test('throws an error if id does not exist', () => {
      expect(() => {
        store.unregister('module');
      }).toThrow(
        'Could not unregister module with id "module": '
        + 'module does not exist.',
      );
    });
    test('throws an error if module has still related combined modules', () => {
      store.register('module', moduleA);
      store.combine('moduleC', ['module'], vi.fn());
      expect(() => {
        store.unregister('module');
      }).toThrow(
        'Could not unregister module with id "module": '
        + 'all the related combined modules must be uncombined first using `uncolmbine`.',
      );
    });
    test('correctly unregisters if module does not have related combined modules', () => {
      store.register('module', moduleA);
      store.unregister('module');
      expect(store).toMatchSnapshot();
    });
  });

  describe('combine', () => {
    test('throws an error if id is already used by another combined module', () => {
      store.register('module', moduleA);
      expect(() => {
        store.combine('module', ['module'], vi.fn());
      }).toThrow(
        'Could not create combined module with id "module": '
        + 'another module with the same id already exists.',
      );
    });
    test('throws an error if one of the modules\' ides does not correspond to a registered module', () => {
      expect(() => {
        store.combine('moduleC', ['module'], vi.fn());
      }).toThrow(
        'Could not create combined module with id "moduleC": '
        + 'module with id "module" does not exist.',
      );
    });
    test('correctly creates combined module if all modules\' ids exist', () => {
      store.register('moduleA', moduleA);
      store.register('moduleB', moduleB);
      store.combine('moduleC', ['moduleA', 'moduleB'], vi.fn());
      expect(store).toMatchSnapshot();
    });
  });

  describe('uncombine', () => {
    test('throws an error if id does not exist', () => {
      expect(() => {
        store.uncombine('moduleC');
      }).toThrow(
        'Could not uncombine module with id "moduleC": '
        + 'combined module does not exist.',
      );
    });
    test('throws an error if the given id corresponds to a default combined module', () => {
      store.register('module', moduleA);
      expect(() => {
        store.uncombine('module');
      }).toThrow(
        'Could not uncombine combined module with id "module": '
        + 'default combined modules cannot be uncombined, use `unregister` instead.',
      );
    });
    test('throws an error if the given id corresponds to a default combined module', () => {
      store.register('module', moduleA);
      store.combine('moduleC', ['module'], vi.fn());
      store.subscribe('moduleC', vi.fn());
      expect(() => {
        store.uncombine('moduleC');
      }).toThrow(
        'Could not uncombine combined module with id "moduleC": '
        + 'all the related subscriptions must be removed first using `unsubscribe`.',
      );
    });
    test('correctly uncombines the combined module if it has no more subscriptions', () => {
      store.register('module', moduleA);
      store.combine('moduleC', ['module'], vi.fn());
      store.unsubscribe('moduleC', store.subscribe('moduleC', vi.fn()));
      store.uncombine('moduleC');
      expect(store).toMatchSnapshot();
    });
  });

  describe('subscribe', () => {
    test('throws an error if id does not exist', () => {
      expect(() => {
        store.subscribe('module', () => {
          // No-op.
        });
      }).toThrow(
        'Could not subscribe to module with id "module": '
        + 'module does not exist.',
      );
    });
    test('correctly subscribes to the given module if it exists', async () => {
      await new Promise<void>((resolve) => {
        const handler = vi.fn().mockImplementationOnce(() => {
          expect(store).toMatchSnapshot();
          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith({
            a: 0,
            b: {
              test: 5,
            },
          });
          resolve();
        });
        store.register('moduleA', moduleA);
        store.register('moduleB', moduleB);
        store.combine('moduleC', ['moduleA', 'moduleB'], (newStateA: { test: unknown; }, newStateB: unknown) => ({
          a: newStateA.test,
          b: newStateB,
        }));
        expect(store.subscribe('moduleC', handler)).toBe('641676f1d7d8a');
      });
    });
  });

  describe('unsubscribe', () => {
    test('throws an error if id does not exist', () => {
      expect(() => {
        store.unsubscribe('module', 'abcde13256');
      }).toThrow(
        'Could not unsubscribe from module with id "module": '
        + 'module does not exist.',
      );
    });
    test('throws an error if subscription id does not exist', () => {
      expect(() => {
        store.register('module', moduleA);
        store.unsubscribe('module', 'abcde13256');
      }).toThrow(
        'Could not unsubscribe from module with id "module": '
        + 'subscription id "abcde13256" does not exist on that module.',
      );
    });
    test('correctly unsubscribes from the given module if it exists', () => {
      store.register('module', moduleA);
      store.unsubscribe('module', (store.subscribe('module', vi.fn())));
      expect(store).toMatchSnapshot();
    });
    // Issue #1 (https://github.com/openizr/diox/issues/1).
    test('correctly unsubscribes several listeners from the given module in any order', () => {
      store.register('module', moduleA);
      const firstID: string = store.subscribe('module', vi.fn());
      const secondID: string = store.subscribe('module', vi.fn());
      store.unsubscribe('module', firstID);
      store.unsubscribe('module', secondID);
      expect(store).toMatchSnapshot();
    });
  });

  describe('mutate', () => {
    test('throws an error if id does not exist', () => {
      expect(() => {
        store.mutate('module', 'ADD');
      }).toThrow(
        'Could not perform mutation on module with id "module": '
        + 'module does not exist, or is a combined module.',
      );
    });
    test('throws an error if mutation does not exist in module', () => {
      expect(() => {
        store.register('module', moduleA);
        store.mutate('module', 'SUB');
      }).toThrow(
        'Could not perform mutation on module with id "module": '
        + 'mutation "SUB" does not exist on that module.',
      );
    });
    test('correctly performs mutation on the given module if it exists', async () => {
      await new Promise<void>((resolve) => {
        const handler = vi.fn().mockImplementationOnce(() => {
          expect(handler).toHaveBeenCalledWith({ test: 0 });
        }).mockImplementationOnce(() => {
          expect(handler).toHaveBeenCalledTimes(2);
          expect(handler).toHaveBeenCalledWith({ test: 0 });
          resolve();
        });
        store.register('module', moduleA);
        store.subscribe('module', handler);
        store.mutate('module', 'ADD');
      });
    });
    test('does not trigger subscriptions if new state is the same as the current one', async () => {
      const handler = vi.fn();
      store.register('module', moduleA);
      store.subscribe('module', handler);
      store.mutate('module', 'BAD');
      await new Promise((resolve) => { setTimeout(resolve, 50); });
      expect(handler).toHaveBeenCalledTimes(1);
    });
    test('asynchronously calls each subscription in the order of their declaration', async () => {
      await new Promise<void>((resolve) => {
        const handler = vi.fn((newState: { test: unknown; }) => {
          if (newState.test === 2) {
            expect(handler).toHaveBeenNthCalledWith(1, { test: 0 });
            expect(handler).toHaveBeenNthCalledWith(2, { test: 1 });
            expect(handler).toHaveBeenNthCalledWith(3, { test: 2 });
            resolve();
          }
        });
        store.register('module', moduleA);
        store.subscribe('module', (newState: { test: number; }) => {
          if (newState.test === 1) {
            store.mutate('module', 'ADD');
          }
        });
        store.subscribe('module', handler);
        store.mutate('module', 'ADD');
      });
    });
  });

  describe('dispatch', () => {
    test('throws an error if id does not exist', async () => {
      try {
        await store.dispatch('module', 'ADD');
      } catch (error) {
        expect((error as Error).message).toBe(
          'Could not dispatch action to module with id "module": '
          + 'module does not exist, or is a combined module.',
        );
      }
    });
    test('throws an error if action does not exist in module', async () => {
      try {
        store.register('module', moduleA);
        await store.dispatch('module', 'ADD');
      } catch (error) {
        expect((error as Error).message).toBe(
          'Could not dispatch action to module with id "module": '
          + 'action "ADD" does not exist on that module.',
        );
      }
    });
    test('correctly dispatches action on the given module if it exists', async () => {
      await new Promise<void>((resolve) => {
        const handler = vi.fn((newState: { test: unknown; }) => {
          if (newState.test === 6) {
            expect(handler).toHaveBeenCalledTimes(2);
            resolve();
          }
        });
        store.register('module', moduleB);
        store.subscribe('module', handler);
        store.dispatch('module', 'ADD').catch(() => null);
      });
    });
  });

  describe('use', () => {
    test('correctly applies middleware to the store', () => {
      const middleware = vi.fn();
      store.use(middleware);
      store.register('module', moduleA);
      store.mutate('module', 'NOOP');
      expect(middleware).toHaveBeenCalledTimes(1);
      expect(middleware).toHaveBeenCalledWith({ test: 0 });
    });
  });
});
