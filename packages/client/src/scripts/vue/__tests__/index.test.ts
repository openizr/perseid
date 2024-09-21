/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as vue from 'scripts/vue/index';

describe('scripts/vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('contains correct exports', () => {
    vue.ViewPage();
    vue.ListPage();
    vue.ErrorPage();
    vue.SignInPage();
    vue.SignUpPage();
    vue.UpdateUserPage();
    vue.VerifyEmailPage();
    vue.ResetPasswordPage();
    vue.CreateOrUpdatePage();
    expect(Object.keys(vue)).toEqual([
      'ActionsWrapper',
      'ConfirmationModal',
      'FieldLabel',
      'FieldValue',
      'FormField',
      'Grid',
      'LazyOptions',
      'Loader',
      'Menu',
      'Modal',
      'NestedFields',
      'Notifier',
      'OptionalField',
      'PageLayout',
      'Pagination',
      'PermissionsWrapper',
      'Router',
      'Table',
      'ViewPage',
      'ListPage',
      'UpdateUserPage',
      'SignInPage',
      'SignUpPage',
      'CreateOrUpdatePage',
      'ErrorPage',
      'ResetPasswordPage',
      'VerifyEmailPage',
    ]);
  });
});
