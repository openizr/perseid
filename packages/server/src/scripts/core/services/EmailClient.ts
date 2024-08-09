/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { HttpClient } from '@perseid/core';
import Logger from 'scripts/core/services/Logger';

/**
 * Email client settings.
 */
export interface EmailClientSettings {
  /** Maximum request duration (in ms) before generating a timeout. */
  connectTimeout: number;
}

/**
 * Handles emails sending.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/EmailClient.ts
 */
export default class EmailClient extends HttpClient {
  /** Logging system. */
  protected logger: Logger;

  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   *
   * @param settings Email client settings.
   */
  constructor(logger: Logger, settings: EmailClientSettings) {
    super(settings.connectTimeout);
    this.logger = logger;
  }

  /**
   * Sends a verification email to `to`.
   *
   * @param verificationUrl Verification URL to indicate in the email.
   */
  public async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    await Promise.resolve();
    this.logger.warn(
      `[EmailClient][sendVerificationEmail] method is not implemented - skipping email sending to ${to} with:`,
    );
    this.logger.warn(verificationUrl);
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
    this.logger.warn(
      `[EmailClient][sendPasswordResetEmail] method is not implemented - skipping email sending to ${to} with:`,
    );
    this.logger.warn(passwordResetUrl);
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
    this.logger.warn(
      `[EmailClient][sendInviteEmail] method is not implemented - skipping email sending to ${to} with:`,
    );
    this.logger.warn(signInUrl);
    this.logger.warn(temporaryPassword);
  }
}
