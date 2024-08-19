/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as react from 'scripts/react/index';

describe('scripts/react', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('contains correct exports', () => {
    react.ViewPage();
    react.ListPage();
    react.ErrorPage();
    react.SignInPage();
    react.SignUpPage();
    react.UpdateUserPage();
    react.VerifyEmailPage();
    react.ResetPasswordPage();
    react.CreateOrUpdatePage();
    expect(Object.keys(react)).toEqual([
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
