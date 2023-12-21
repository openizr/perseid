import Store from 'diox';
import routes from 'scripts/store/routes';
import router from 'diox/extensions/router';

const store = new Store();
store.register('router', router(Object.keys(routes)));

export default store;
