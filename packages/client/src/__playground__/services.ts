/* c8 ignore start */

import {
  Model,
  Store,
  Logger,
  ApiClient,
  FormBuilder,
} from 'scripts/core/index';
import { I18n } from '@perseid/core';
import labels from '__playground__/labels';
import { type StoreSettings } from 'scripts/core/services/Store';

export const logger = new Logger({ logLevel: 'debug' });
export const i18n = new I18n(logger, labels);
export const pages: StoreSettings<DataModel>['pages'] = {
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
    test: {
      list: {
        route: '/test',
        pageProps: {
          fields: [
            '_createdAt',
            '_createdBy.email',
            'objectOne.boolean',
          ],
        },
      },
      view: {
        route: '/test/:id',
        pageProps: {
          fields: [
            '_createdAt',
            '_createdBy.email',
            'objectOne.boolean',
          ],
        },
      },
      create: {
        route: '/test/create',
        pageProps: {
          fields: [
            'objectOne.optionalRelations.enum',
            'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation.enum',
          ],
        },
      },
      update: {
        route: '/test/:id/edit',
        pageProps: {
          fields: [
            'objectOne.optionalRelations.enum',
            'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation.enum',
          ],
        },
      },
    },
    otherTest: {
      list: {
        route: '/otherTest',
        pageProps: {
          fields: [
            'enum',
            '_createdAt',
            'data.optionalFlatArray',
          ],
        },
      },
      view: {
        route: '/otherTest/:id',
        pageProps: {
          fields: [
            'enum',
            '_createdAt',
            'data.optionalFlatArray',
          ],
        },
      },
      create: {
        route: '/otherTest/create',
        pageProps: {
          fields: ['optionalRelation.indexedString', 'data.optionalRelation.indexedString'],
        },
      },
      update: {
        route: '/otherTest/:id/edit',
        pageProps: {
          fields: ['optionalRelation.indexedString', 'data.optionalRelation.indexedString'],
        },
      },
    },
  },
};
export const model = new Model<DataModel>();
export const apiClient = new ApiClient<DataModel>(model, logger, {
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
      test: {
        list: { route: '/test' },
        create: { route: '/test' },
        view: { route: '/test/:id' },
        update: { route: '/test/:id' },
        delete: { route: '/test/:id' },
        search: { route: '/test/search' },
      },
      otherTest: {
        list: { route: '/otherTest' },
        create: { route: '/otherTest' },
        view: { route: '/otherTest/:id' },
        update: { route: '/otherTest/:id' },
        delete: { route: '/otherTest/:id' },
        search: { route: '/otherTest/search' },
      },

    },
  },
  mockedResponses: {},
  connectTimeout: 3000,
  baseUrl: 'http://localhost:5070/perseid',
});
export const formBuilder = new FormBuilder<DataModel>(model, logger);
export const store = new Store<DataModel>(model, logger, apiClient, formBuilder, {
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
