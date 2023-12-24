/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/core/services/FormBuilder` mock.
 */

export default class FormBuilder {
  public buildConfiguration = vi.fn(() => ((process.env.FORBIDDEN === 'true') ? ({
    fieldProps: {},
    configuration: {},
    requestedFields: new Set(),
  }) : ({
    fieldProps: {},
    configuration: {},
    requestedFields: new Set(['_createdBy']),
  })));

  public getUpdateUserConfiguration = vi.fn((_, onSubmit, resetPassword) => ({
    fieldProps: {},
    configuration: {
      plugins: [resetPassword],
      onSubmit: onSubmit as () => void,
    },
    requestedFields: new Set(),
  }));

  public getResetPasswordConfiguration = vi.fn((_, onSubmit, requestPasswordReset) => {
    (requestPasswordReset as (data: unknown) => void)({});
    return ({
      fieldProps: {},
      configuration: {
        onSubmit: onSubmit as () => void,
      },
      requestedFields: new Set(),
    });
  });

  public getSignInConfiguration = vi.fn((onSubmit) => ({
    fieldProps: {},
    configuration: {
      onSubmit: onSubmit as () => void,
    },
    requestedFields: new Set(),
  }));

  public getSignUpConfiguration = vi.fn((onSubmit) => ({
    fieldProps: {},
    configuration: {
      onSubmit: onSubmit as () => void,
    },
    requestedFields: new Set(),
  }));
}
