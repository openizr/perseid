/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Document } from 'mongodb';
import type Model from 'scripts/common/Model';
import type Logger from 'scripts/services/Logger';
import { type DataModel, type User, Id } from '@perseid/core';
import type DatabaseClient from 'scripts/services/DatabaseClient';

/**
 * `services/Engine` mock.
 */

export default class {
  protected noop = vi.fn();

  protected model: Model;

  protected logger: Logger;

  protected databaseClient: DatabaseClient;

  protected automaticFieldValue = new Date('2023-01-01');

  protected checkAndUpdatePayload(
    _command: string,
    _collection: string,
    payload: Document,
  ): Document {
    return { _updatedAt: this.automaticFieldValue, ...payload };
  }

  protected generateAutomaticFields(): Document {
    return { _updatedAt: this.automaticFieldValue };
  }

  protected create(
    collection: keyof DataModel,
    payload: User,
  ): Document {
    this.databaseClient.create(collection, payload);
    return {
      ...payload,
      _id: new Id('64723318e84f943f1ad6578b'),
      _updatedAt: this.automaticFieldValue,
    };
  }

  public reset(): void {
    this.noop();
  }

  constructor(
    model: Model,
    logger: Logger,
    databaseClient: DatabaseClient,
  ) {
    this.model = model;
    this.logger = logger;
    this.databaseClient = databaseClient;
  }
}
