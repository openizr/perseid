/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Model from 'scripts/core/services/Model';
import { type UserDataModel, Id } from '@perseid/core';
import type Telemetry from 'scripts/core/services/Telemetry';
import type DatabaseClient from 'scripts/core/services/AbstractDatabaseClient';

/**
 * `core/services/Engine` mock.
 */

export default class {
  protected noop = vi.fn();

  protected model: Model<UserDataModel>;

  protected telemetry: Telemetry;

  protected databaseClient: DatabaseClient<UserDataModel>;

  protected automaticFieldValue = new Date('2023-01-01');

  protected VALIDATORS = { string: vi.fn(() => null) };

  protected defineCreatePayload = vi.fn((payload: unknown): unknown => payload);

  protected defineUpdatePayload = vi.fn((payload: unknown): unknown => payload);

  protected prepareCreatePayload(
    _resource: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return Promise.resolve({ _createdAt: this.automaticFieldValue, ...payload });
  }

  protected prepareUpdatePayload(
    _resource: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return Promise.resolve({ _updatedAt: this.automaticFieldValue, ...payload });
  }

  public reset(): void {
    this.noop();
  }

  constructor(
    model: Model<UserDataModel>,
    telemetry: Telemetry,
    databaseClient: DatabaseClient<UserDataModel>,
  ) {
    this.model = model;
    this.telemetry = telemetry;
    this.databaseClient = databaseClient;
  }

  public async create(
    _resource: keyof UserDataModel,
    payload: UserDataModel['users'],
  ): Promise<Record<string, unknown>> {
    return Promise.resolve({
      ...payload,
      _id: new Id('000000000000000000000001'),
      _createdAt: this.automaticFieldValue,
    });
  }

  public async update(
    _resource: keyof UserDataModel,
    _id: Id,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return Promise.resolve({
      ...payload,
      _updatedAt: this.automaticFieldValue,
    });
  }

  public async view(): Promise<Record<string, unknown>> {
    return Promise.resolve({
      _updatedAt: this.automaticFieldValue,
    });
  }

  public async list(): Promise<Record<string, unknown>> {
    return Promise.resolve({
      total: 1,
      results: [{
        _updatedAt: this.automaticFieldValue,
      }],
    });
  }

  public async delete(): Promise<boolean> {
    this.noop();
    return Promise.resolve(true);
  }
}
