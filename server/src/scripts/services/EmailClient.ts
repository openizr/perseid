/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Email options.
 */
export interface EmailOptions {
  /** List of recipients to send email to. */
  to: string[];

  /** Variables to inject in email template. */
  variables: Record<string, unknown>;
}

/**
 * Default email client.
 */
export default class EmailClient {
  /** Verification request email's content. */
  private verifyEmailMessage = 'SENDING VERIFICATION EMAIL WITH OPTIONS';

  /** User invite request email's content. */
  private inviteEmailMessage = 'SENDING INVITE EMAIL WITH OPTIONS';

  /**
   * Sends a verification email with `options`.
   *
   * @param options Email options.
   */
  public async sendVerifyEmail(options: EmailOptions): Promise<void> {
    const { log } = console;
    log(this.verifyEmailMessage, options);
  }

  /**
   * Sends a user invite email with `options`.
   *
   * @param options Email options.
   */
  public async sendInviteEmail(options: EmailOptions): Promise<void> {
    const { log } = console;
    log(this.inviteEmailMessage, options);
  }
}
