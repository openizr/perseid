/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';
import type Model from 'scripts/services/Model';
import type Logger from 'scripts/services/Logger';
import type DatabaseClient from 'scripts/services/AbstractDatabaseClient';

/**
 * `services/UsersEngine` mock.
 */

export default class {
  protected model: Model;

  protected logger: Logger;

  protected databaseClient: DatabaseClient;

  protected automaticFieldValue = new Date('2023-01-01');

  public create = vi.fn();

  public update = vi.fn();

  public list = vi.fn();

  public search = vi.fn();

  public delete = vi.fn();

  public signIn = vi.fn();

  public signUp = vi.fn();

  public signOut = vi.fn();

  public viewMe = vi.fn();

  public verifyEmail = vi.fn();

  public refreshToken = vi.fn();

  public resetPassword = vi.fn();

  public requestPasswordReset = vi.fn();

  public requestEmailVerification = vi.fn();

  public verifyToken = vi.fn(() => new Id('000000000000000000000001'));

  public generateContext = vi.fn(() => {
    if (process.env.UNKNOWN_ERROR === 'true') {
      throw new Error('UNKNOWN');
    }
    return {
      user: {
        _devices: [{ _id: 'valid' }],
        roles: [{
          name: 'TEST',
          permissions: ['TEST'],
        }],
      },
    };
  });

  public view = vi.fn();

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
