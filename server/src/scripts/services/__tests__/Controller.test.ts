/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/common/Model';
import Logger from 'scripts/services/Logger';
import Controller from 'scripts/services/Controller';
import OAuthEngine from 'scripts/services/OAuthEngine';
import EmailClient from 'scripts/services/EmailClient';
import CacheClient from 'scripts/services/CacheClient';
import DatabaseClient from 'scripts/services/DatabaseClient';
import { type Id, type DataModel as BaseDataModel } from '@perseid/core';

type TestController = Controller<DataModel> & {
  generateFieldsFrom: Controller['generateFieldsFrom'];
};

interface DataModel extends BaseDataModel {
  test: {
    primitiveOne: Id;
    primitiveTwo: ArrayBuffer;
    primitiveThree: string;
    arrayOne: {
      dynamicObject: {
        [key: string]: Id | DataModel['externalRelation'];
      };
      object: {
        fieldOne: string;
      }
    }[];
    arrayTwo: (Id | null | DataModel['externalRelation'])[];
    arrayThree: (Id | DataModel['externalRelation'])[];
    arrayFour: string[];
    arrayFive: {
      fieldOne: string;
    }[];
    dynamicOne: {
      [key: string]: Id | {
        test: string;
      } | DataModel['externalRelation'];
    };
    dynamicTwo: {
      [key: string]: Id | {
        test: string;
      };
    };
  };
  externalRelation: {
    _id: Id;
    name: string;
    relations: (Id | DataModel['otherExternalRelation']);
  };
  otherExternalRelation: {
    _id: Id;
    type: string;
  };
}

describe('services/Controller', () => {
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
  let controller: TestController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new Controller<DataModel>(model, logger, engine, {
      version: '0.0.1',
      endpoints: {
        oAuth: {},
        collections: {},
      },
    }) as TestController;
  });

  test('[generateFieldsFrom]', async () => {
    const permissions = new Set();
    expect(controller.generateFieldsFrom('test', [
      '*',
      'invalid',
      'primitiveOne',
      'primitiveOne',
      'primitiveTwo',
      'arrayOne.object.*',
      'arrayOne.*',
      'dynamicOne.testThree.test',
      'arrayTwo._id',
      'arrayFour',
      'dynamicOne.*',
      'dynamicOne.testTwo.type',
      'dynamicOne.testOne.relations._id',
      'arrayOne.dynamicObject.testOne._id',
      'arrayOne.dynamicObject.testOne.*',
      'dynamicOne.testOne.name',
      'dynamicOne.testTwo._id',
      'dynamicOne.testOne.relations.type',
      'dynamicOne.specialTest',
      'dynamicOne.specialTestTwo.name',
      'dynamicOne.specialTestThree',
      'dynamicTwo',
      'dynamicOne.specialTestTwo',
      'arrayOne.object',
      'dynamicOne.testOne.relations',
    ].join(','), permissions)).toEqual([
      '_id',
      'primitiveOne',
      'primitiveTwo',
      'primitiveThree',
      'arrayOne',
      'arrayTwo',
      'arrayThree',
      'arrayFour',
      'arrayFive',
      'dynamicOne',
      'dynamicTwo',
      'invalid',
      'arrayOne.object.fieldOne',
      'arrayOne.dynamicObject',
      'arrayOne.object',
      'dynamicOne.testThree.test',
      'arrayTwo._id',
      'dynamicOne.testTwo.type',
      'dynamicOne.testOne.relations._id',
      'arrayOne.dynamicObject.testOne._id',
      'arrayOne.dynamicObject.testOne.name',
      'arrayOne.dynamicObject.testOne._isDeleted',
      'arrayOne.dynamicObject.testOne.relations',
      'dynamicOne.testOne.name',
      'dynamicOne.testTwo._id',
      'dynamicOne.testOne.relations.type',
      'dynamicOne.specialTest',
      'dynamicOne.specialTestTwo.name',
      'dynamicOne.specialTestThree',
      'dynamicOne.specialTestTwo',
      'dynamicOne.testOne.relations',
    ]);
    expect([...permissions]).toEqual([
      'TEST_VIEW',
      'PRIMITIVE_THREE_VIEW',
      'ARRAY_ONE_VIEW',
      'ARRAY_ONE_OBJECT_VIEW',
      'EXTERNAL_RELATION_VIEW',
      'OTHER_EXTERNAL_RELATION_VIEW',
    ]);
  });
});
