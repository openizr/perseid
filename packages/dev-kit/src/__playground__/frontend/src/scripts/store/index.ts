import Store from '@perseid/store';
import routes from 'scripts/store/routes';
import router from '@perseid/store/extensions/router';

const store = new Store();
store.register('router', router(Object.keys(routes)));

export default store;
