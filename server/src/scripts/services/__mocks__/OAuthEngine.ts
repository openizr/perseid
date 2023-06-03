/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

// import { Document } from 'mongodb';
import type Model from 'scripts/common/Model';
import type Logger from 'scripts/services/Logger';
// import { type DataModel, type User, Id } from '@perseid/core';
import type DatabaseClient from 'scripts/services/DatabaseClient';

/**
 * `services/OAuthEngine` mock.
 */

export default class {
  protected model: Model;

  protected logger: Logger;

  protected databaseClient: DatabaseClient;

  protected automaticFieldValue = new Date('2023-01-01');

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
