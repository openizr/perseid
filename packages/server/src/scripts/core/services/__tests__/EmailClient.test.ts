/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Logger from 'scripts/core/services/Logger';
import EmailClient from 'scripts/core/services/EmailClient';

describe('core/services/EmailClient', () => {
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Logger');

  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  let emailClient: EmailClient;

  beforeEach(() => {
    vi.clearAllMocks();
    emailClient = new EmailClient(logger, { connectTimeout: 3000 });
  });

  test('[sendVerificationEmail]', async () => {
    await emailClient.sendVerificationEmail('test@test.com', 'https://verify.com');
    expect(logger.warn).toHaveBeenCalledWith(
      '[EmailClient][sendVerificationEmail] method is not implemented - skipping email sending to test@test.com with:',
    );
    expect(logger.warn).toHaveBeenCalledWith('https://verify.com');
  });

  test('[sendPasswordResetEmail]', async () => {
    await emailClient.sendPasswordResetEmail('test@test.com', 'https://reset-password.com');
    expect(logger.warn).toHaveBeenCalledWith(
      '[EmailClient][sendPasswordResetEmail] method is not implemented - skipping email sending to test@test.com with:',
    );
    expect(logger.warn).toHaveBeenCalledWith('https://reset-password.com');
  });

  test('[sendInviteEmail]', async () => {
    await emailClient.sendInviteEmail('test@test.com', 'https://sign-in.com', 'test123!');
    expect(logger.warn).toHaveBeenCalledWith(
      '[EmailClient][sendInviteEmail] method is not implemented - skipping email sending to test@test.com with:',
    );
    expect(logger.warn).toHaveBeenCalledWith('https://sign-in.com');
    expect(logger.warn).toHaveBeenCalledWith('test123!');
  });
});
