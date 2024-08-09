/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { Logger, Model } from '@perseid/server';

/** `@perseid/server/postgresql` mock. */

const connection = {
  release: vi.fn(),
  query: vi.fn(() => {
    if (process.env.DATABASE_ERROR === 'true') {
      throw new Error('DATABASE_ERROR');
    }
    return { rowCount: 1 };
  }),
};
export default class PostgreSQLDatabaseClient {
  protected mock = vi.fn();

  protected logger: Logger;

  protected client: unknown;

  protected handleError = vi.fn((callback: () => null) => callback());

  protected structurePayload = vi.fn(() => ({ tasks: [{ _status: 'PENDING' }] }));

  constructor(_model: Model, logger: Logger) {
    this.logger = logger;
    this.client = {
      query: vi.fn(() => [[]]),
      connect: vi.fn(() => connection),
    };
  }
}
