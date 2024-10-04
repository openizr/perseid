/* c8 ignore start */

import {
  Model,
  Store,
  Logger,
  ApiClient,
  FormBuilder,
} from 'scripts/core/index';
import {
  Grid,
  Router,
} from 'scripts/react/index';
import {
  type Ids,
  type Authors,
  type Version,
  type Deletion,
  type Timestamps,
  type DefaultDataModel, I18n,
} from '@perseid/core';
import * as React from 'react';
import '__playground__/style.scss';
import labels from '__playground__/labels';
import { createRoot, type Root } from 'react-dom/client';
import { type StoreSettings } from 'scripts/core/services/Store';
import type { UseSubscription } from '@perseid/store/connectors/react';

let app: Root;

interface DataModel extends DefaultDataModel {
  tests: Ids & Deletion & Timestamps & Authors & Version & {
    elements: null | {
      child: string;
    }[];
  };
}

function main(): void {
  const logger = new Logger({ logLevel: 'debug' });
  const i18n = new I18n(logger, labels);
  const pages: StoreSettings<DataModel>['pages'] = {
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
        create: {
          route: '/roles/create',
          pageProps: {},
        },
      },
      tests: {
        list: {
          route: '/tests',
          pageProps: {
            fields: [
              '_createdAt',
              '_createdBy.email',
              'elements',
            ],
          },
        },
        view: {
          route: '/tests/:id',
          pageProps: {
            fields: [
              '_createdAt',
              '_createdBy.email',
              'elements',
            ],
          },
        },
        create: {
          route: '/tests/create',
          pageProps: {
            fields: [],
          },
        },
        update: {
          route: '/tests/:id/edit',
          pageProps: {
            fields: [],
          },
        },
      },
    },
  };
  const model = new Model<DataModel>();
  const apiClient = new ApiClient<DataModel>(model, logger, {
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
          create: { route: '/roles' },
          view: { route: '/roles/:id' },
          update: { route: '/roles/:id' },
          search: { route: '/roles/search' },
        },
        tests: {
          list: { route: '/tests' },
          create: { route: '/tests' },
          view: { route: '/tests/:id' },
          update: { route: '/tests/:id' },
          delete: { route: '/tests/:id' },
          search: { route: '/tests/search' },
        },
      },
    },
    mockedResponses: {},
    connectTimeout: 3000,
    baseUrl: 'http://localhost:5070/perseid',
  });
  const formBuilder = new FormBuilder<DataModel>(model, logger);
  const store = new Store<DataModel>(model, logger, apiClient, formBuilder, {
    pages,
    fallbackPageRoute: '/',
  });
  store.createRoute('/', {
    component: 'Home',
    visibility: 'PRIVATE',
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
  const container = document.querySelector('#root') as unknown as HTMLElement;
  app = createRoot(container);
  app.render(
    <React.StrictMode>
      <Router<DataModel>
        services={{
          i18n,
          model,
          store: store as Store<DataModel> & { useSubscription: UseSubscription; },
          apiClient,
        }}
        pages={{
          Home: async () => Promise.resolve({ default: () => <div /> }),
        }}
        components={{}}
      />
      <Grid columns={{ mobile: 4, tablet: 8, desktop: 12 }} />
    </React.StrictMode>,
  );
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
  app.unmount();
});
