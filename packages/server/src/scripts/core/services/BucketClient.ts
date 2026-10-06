/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Stream } from 'stream';
import { HttpClient, type HttpClientSettings } from '@perseid/core';

/**
 * Bucket client settings.
 */
export type BucketClientSettings = HttpClientSettings;

/**
 * Handles log files storage on a remote bucket.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/BucketClient.ts
 */
export default class BucketClient extends HttpClient {
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
    this.telemetry.warn(`[BucketClient][upload] method is not implemented - skipping file upload at ${path}...`);
  }
}
