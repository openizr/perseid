/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/common/Model';
import Logger from 'scripts/services/Logger';
import { type DataModel } from '@perseid/core';
import OAuthEngine from 'scripts/services/OAuthEngine';
import EmailClient from 'scripts/services/EmailClient';
import CacheClient from 'scripts/services/CacheClient';
import DatabaseClient from 'scripts/services/DatabaseClient';
import FastifyController from 'scripts/services/FastifyController';

describe('services/FastifyController', () => {
  vi.mock('@perseid/core');
  vi.mock('scripts/common/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/Engine');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/DatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const emailClient = new EmailClient(logger);
  const cacheClient = new CacheClient({ cachePath: '/var/www/html/node_modules/.cache' });
  const model = new Model<DataModel>({} as Record<keyof DataModel, CollectionDataModel<DataModel>>);
  const databaseClient = new DatabaseClient<DataModel>(model, logger, cacheClient, {
    cacheDuration: 0,
    connectionLimit: 0,
    connectTimeout: 0,
    database: '',
    host: '',
    maxPoolSize: 0,
    password: '',
    port: 0,
    protocol: '',
    queueLimit: 0,
    user: '',
  });
  const engine = new OAuthEngine<DataModel>(
    model,
    logger,
    databaseClient,
    emailClient,
    cacheClient,
    {
      baseUrl: '',
      oAuth: {
        algorithm: 'RS256',
        clientId: '',
        issuer: '',
        privateKey: '',
        publicKey: '',
      },
    },
  );
  let controller: FastifyController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new FastifyController(model, logger, engine, {
      endpoints: {
        oAuth: {},
        collections: {},
      },
    });
  });

  test('[sendVerificationEmail]', async () => {
    const permissions = new Set();
    // console.log((controller as any).generateFieldsFrom('test', '*,arrayOne.object.fieldOne', permissions));
    console.log(permissions);
  });
});
