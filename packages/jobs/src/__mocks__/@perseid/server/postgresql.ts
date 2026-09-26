/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { Ids } from '@perseid/core';
import type { Telemetry, Model } from '@perseid/server';

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

  protected telemetry: Telemetry;

  protected client: unknown;

  protected handleError = vi.fn((callback: () => null) => callback());

  protected structurePayload = vi.fn(() => ({ tasks: [{ _status: 'PENDING' }] }));

  constructor(_model: Model<Record<string, Ids>>, telemetry: Telemetry) {
    this.telemetry = telemetry;
    this.client = {
      query: vi.fn(() => [[]]),
      connect: vi.fn(() => connection),
    };
  }
}
