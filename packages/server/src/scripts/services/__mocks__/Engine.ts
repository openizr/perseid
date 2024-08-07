/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Model from 'scripts/services/Model';
import type Logger from 'scripts/services/Logger';
import { type DefaultDataModel, Id } from '@perseid/core';
import type DatabaseClient from 'scripts/services/AbstractDatabaseClient';

/**
 * `services/Engine` mock.
 */

export default class {
  protected noop = vi.fn();

  protected model: Model;

  protected logger: Logger;

  protected databaseClient: DatabaseClient;

  protected automaticFieldValue = new Date('2023-01-01');

  protected VALIDATORS = {
    string: vi.fn(() => null),
  };

  protected checkAndUpdatePayload(
    _resource: string,
    _existingResource: unknown,
    payload: unknown,
  ): unknown {
    return { _updatedAt: this.automaticFieldValue, ...payload as Record<string, unknown> };
  }

  protected withAutomaticFields(_: unknown, __: unknown, payload: unknown): unknown {
    return { ...payload as Record<string, unknown>, _updatedAt: this.automaticFieldValue };
  }

  protected async create(
    resource: keyof DefaultDataModel,
    payload: DefaultDataModel['users'],
  ): Promise<unknown> {
    await this.databaseClient.create(resource, payload);
    return {
      ...payload,
      _id: new Id('000000000000000000000001'),
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
