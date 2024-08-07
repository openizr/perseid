/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Stream } from 'stream';
import { HttpClient } from '@perseid/core';
import Logger from 'scripts/services/Logger';

/**
 * Bucket client settings.
 */
export interface BucketClientSettings {
  /** Maximum request duration (in ms) before generating a timeout. */
  connectTimeout: number;
}

/**
 * Handles log files storage on a remote bucket.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/BucketClient.ts
 */
export default class BucketClient extends HttpClient {
  /** Logging system. */
  protected logger: Logger;

  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   *
   * @param settings Email client settings.
   */
  constructor(logger: Logger, settings: BucketClientSettings) {
    super(settings.connectTimeout);
    this.logger = logger;
  }

  /**
   * Uploads `body` to the bucket at `path`.
   *
   * @param type Content's MIME type.
   *
   * @param path Destination path on the bucket.
   *
   * @param body Content to upload.
   */
  public async upload(_type: string, path: string, body: Stream): Promise<void> {
    await new Promise((resolve) => { body.once('open', resolve); });
    this.logger.warn(`[BucketClient][upload] method is not implemented - skipping file upload at ${path}...`);
  }
}
