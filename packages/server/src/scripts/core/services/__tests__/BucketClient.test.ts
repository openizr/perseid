/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Stream } from 'stream';
import Logger from 'scripts/core/services/Logger';
import BucketClient from 'scripts/core/services/BucketClient';

describe('core/services/BucketClient', () => {
  vi.mock('stream');
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Logger');

  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const bucketClient = new BucketClient(logger, { connectTimeout: 3000 });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('uploadLogs', async () => {
    await bucketClient.upload('application/pdf', '/var/log/test.pdf', {
      once: (_event, callback) => {
        callback();
      },
    } as Stream);
    expect(logger.warn).toHaveBeenCalledWith(
      '[BucketClient][upload] method is not implemented - skipping file upload at /var/log/test.pdf...',
    );
  });
});
