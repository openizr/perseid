/* c8 ignore start */

import Store from 'scripts/core/Store';
import router from 'scripts/extensions/router';

interface Test {
  test: string;
}

const store = new Store();
store.register('router', router(['/', '/test', '/test2']));
store.subscribe('router', () => {
  // No-op.
});
store.use(() => {
  // No-op.
});
const a: Module<Test> = {
  state: {
    test: 'ok',
  },
  mutations: {
    test({ state }) {
      return { ...state };
    },
  },
  actions: {},
};
store.register('test', a);

store.combine('test2', ['test'], (s1: Test) => ({
  ok: 'test',
  ...s1,
}));

export default store;
