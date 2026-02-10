/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { HttpClient, type HttpClientSettings } from '@perseid/core';

/**
 * Email client settings.
 */
export type EmailClientSettings = HttpClientSettings;

/**
 * Handles emails sending.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/EmailClient.ts
 */
export default class EmailClient extends HttpClient {
  /**
   * Sends a verification email to `to`.
   *
   * @param verificationUrl Verification URL to indicate in the email.
   */
  public async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    await Promise.resolve();
    this.telemetry.warn(
      `[EmailClient][sendVerificationEmail] method is not implemented - skipping email sending to ${to} with:`,
    );
    this.telemetry.warn(verificationUrl);
  }

  /**
   * Sends a password reset email to `to`.
   *
   * @param to Recipient email address.
   *
   * @param passwordResetUrl Password reset URL to indicate in the email.
   */
  public async sendPasswordResetEmail(to: string, passwordResetUrl: string): Promise<void> {
    await Promise.resolve();
    this.telemetry.warn(
      `[EmailClient][sendPasswordResetEmail] method is not implemented - skipping email sending to ${to} with:`,
    );
    this.telemetry.warn(passwordResetUrl);
  }

  /**
   * Sends a user invite email to `to`.
   *
   * @param to Recipient email address.
   *
   * @param signInUrl Sign-in URL to indicate in the email.
   *
   * @param temporaryPassword Temporary password to indicate in the email.
   */
  public async sendInviteEmail(
    to: string,
    signInUrl: string,
    temporaryPassword: string,
  ): Promise<void> {
    await Promise.resolve();
    this.telemetry.warn(
      `[EmailClient][sendInviteEmail] method is not implemented - skipping email sending to ${to} with:`,
    );
    this.telemetry.warn(signInUrl);
    this.telemetry.warn(temporaryPassword);
  }
}
