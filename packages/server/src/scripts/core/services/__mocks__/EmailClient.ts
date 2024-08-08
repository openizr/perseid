/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `core/services/EmailClient` mock.
 */

export default class {
  public sendInviteEmail = vi.fn();

  public sendVerificationEmail = vi.fn();

  public sendPasswordResetEmail = vi.fn();
}
