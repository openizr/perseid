/* c8 ignore start */

import {
  Model,
  Store,
  Logger,
  ApiClient,
  FormBuilder,
} from 'scripts/core/index';
import '__playground__/style.scss';
import labels from '__playground__/labels';
import { Router } from 'scripts/vue/index';
import { type Component, createApp } from 'vue';
import { type DefaultDataModel, I18n } from '@perseid/core';
import { type StoreSettings } from 'scripts/core/services/Store';

let app: unknown;

export const a = true;
export class TestStore extends Store {
  a(): void {
    const { log } = console;
    log('ok', this.apiClient);
  }
}

function main(): void {
  const logger = new Logger({ logLevel: 'debug' });
  const i18n = new I18n(logger, labels);
  const pages: StoreSettings['pages'] = {
    auth: {
      signIn: { route: '/sign-in' },
      signUp: { route: '/sign-up' },
      updateUser: { route: '/users/me' },
      verifyEmail: { route: '/verify-email' },
      resetPassword: { route: '/reset-password' },
    },
    resources: {
      users: {
        list: {
          route: '/users',
          pageProps: {
            // fields: ['roles._createdBy._updatedBy'],
            // fields: ['roles._createdBy.email'],
            // fields: ['_devices'],
            searchFields: ['email'],
            fields: [
              '_createdAt',
              'email',
              'roles._createdBy._updatedBy',
              '_devices',
              'password',
              '_apiKeys',
              '_verifiedAt',
            ],
          },
        },
        view: {
          route: '/users/:id',
          pageProps: {
            fields: [
              '_createdAt',
              'roles._createdBy.email',
              '_devices',
              'password',
              '_apiKeys',
              '_verifiedAt',
            ],
          },
        },
        create: {
          route: '/users/create',
          pageProps: {
            fields: ['roles.name'],
          },
        },
        update: {
          route: '/users/:id/edit',
          pageProps: {
            fields: ['roles.name'],
          },
        },
      },
      roles: {
        list: {
          route: '/roles',
          pageProps: {
            fields: ['name'],
            searchFields: ['name'],
          },
        },
        view: {
          route: '/roles/:id',
          pageProps: {
            fields: ['_createdAt', '_createdBy', 'name', 'permissions'],
          },
        },
        update: {
          route: '/roles/:id/edit',
          pageProps: {},
        },
      },
    },
  };

  const model = new Model<DefaultDataModel>();
  const apiClient = new ApiClient<DefaultDataModel>(model, logger, {
    connectTimeout: 3000,
    endpoints: {
      auth: {
        viewMe: { route: '/auth/me' },
        signUp: { route: '/auth/sign-up' },
        signIn: { route: '/auth/sign-in' },
        signOut: { route: '/auth/sign-out' },
        verifyEmail: { route: '/auth/verify-email' },
        refreshToken: { route: '/auth/refresh-token' },
        resetPassword: { route: '/auth/reset-password' },
        requestPasswordReset: { route: '/auth/reset-password' },
        requestEmailVerification: { route: '/auth/verify-email' },
      },
      resources: {
        users: {
          list: { route: '/users' },
          create: { route: '/users' },
          view: { route: '/users/:id' },
          update: { route: '/users/:id' },
          search: { route: '/users/search' },
        },
        roles: {
          list: { route: '/roles' },
          view: { route: '/roles/:id' },
          update: { route: '/roles/:id' },
          search: { route: '/roles/search' },
        },
      },
    },
    mockedResponses: {},
    baseUrl: 'http://localhost:5070/perseid',
  });
  const formBuilder = new FormBuilder<DefaultDataModel>(model, logger);
  const store = new TestStore(model, logger, apiClient, formBuilder, {
    pages,
    fallbackPageRoute: '/',
  });
  store.createRoute('/', {
    component: 'Home',
    visibility: 'PRIVATE',
  });
  store.createRoute('/custom-integration', {
    component: 'CustomIntegration',
    layoutProps: { display: false },
    visibility: 'PUBLIC',

  });
  store.createRoute('/ok', {
    component: 'Home',
    visibility: 'PUBLIC',
  });
  store.createRoute('/ko', {
    component: 'Home',
    visibility: 'PUBLIC_ONLY',
  });
  store.createRoutes();
  app = createApp(Router as unknown as Component, {
    container: document.querySelector('#root'),
    services: {
      i18n,
      model,
      store,
      apiClient,
    },
    pages: {
      // Home: async () => Promise.resolve({ default: () => <div /> }),
      // CustomIntegration: () => import('__playground__/CustomIntegration'),
    },
    components: {
      // FieldLabel: React.memo(() => <div>OK </div>),
      // Menu: ((): JSX.Element => <div>OK </div>),
      // ConfirmationModal: ((): JSX.Element | null => null),
      // FieldLabels: React.memo(() => <div>OK </div>),
      // FieldLabelsss: ((): JSX.Element => <div>OK </div>),
      // FieldLabelssss: ((): JSX.Element | null => null),
    },
  });
  (app as { mount: (root: string) => void; }).mount('#root');
}

// Ensures DOM is fully loaded before running app's main logic.
// Loading hasn't finished yet...
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
  // `DOMContentLoaded` has already fired...
} else {
  main();
}

// Ensures subscriptions to Store are correctly cleared when page is left, to prevent "ghost"
// processing, by manually unmounting React components tree.
window.addEventListener('beforeunload', () => {
  // app.unmount();
  (app as { unmount: () => void; }).unmount();
});
