/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { Ids } from '@perseid/core';
import type { Telemetry, Model } from '@perseid/server';

/** `@perseid/server/mongodb` mock. */

const updateOne = vi.fn(() => ({ modifiedCount: 1 }));
const aggregate = vi.fn(() => ({ toArray: vi.fn(() => [{}, {}, {}]) }));

const databaseConnection = {
  collection: vi.fn(() => ({ updateOne, aggregate })),
};

export default class MongoDatabaseClient {
  protected mock = vi.fn();

  protected telemetry: Telemetry;

  protected databaseConnection: unknown;

  protected handleError = vi.fn((callback: () => null) => callback());

  protected structurePayload = vi.fn(() => ({ tasks: [{ _status: 'PENDING' }] }));

  constructor(_model: Model<Record<string, Ids>>, telemetry: Telemetry) {
    this.telemetry = telemetry;
    this.databaseConnection = databaseConnection;
  }
}
