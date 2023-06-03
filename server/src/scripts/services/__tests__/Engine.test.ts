/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';
import Model from 'scripts/services/Model';
import Engine from 'scripts/services/Engine';
import Logger from 'scripts/services/Logger';
import EngineError from 'scripts/errors/Engine';
import CacheClient from 'scripts/services/CacheClient';
import DatabaseClient from 'scripts/services/DatabaseClient';

type TestEngine = Engine<DataModel> & {
  deepMerge: Engine<DataModel>['deepMerge'];
  generateAutomaticFields: Engine<DataModel>['generateAutomaticFields'];
};

interface DataModel {
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

describe('services/Engine', () => {
  vi.mock('@perseid/core');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/DatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  let engine: TestEngine;
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
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

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NO_RESULT;
    engine = new Engine<DataModel>(model, logger, databaseClient) as TestEngine;
  });

  test('[deepMerge] primitive values', async () => {
    const firstValue = '2' as unknown as DataModel['test'];
    const secondValue = '3' as unknown as DataModel['test'];
    expect(engine.deepMerge(firstValue, secondValue, { type: 'integer' })).toEqual('3');
  });

  test('[deepMerge] nested objects', async () => {
    const dataModel: DynamicObjectDataModel<DataModel> = {
      type: 'dynamicObject',
      fields: {
        '^key$': {
          type: 'object',
          fields: {
            subKeyOne: {
              type: 'string',
            },
            subKeyTwo: {
              type: 'string',
            },
          },
        },
        '^newKey$': {
          type: 'string',
        },
      },
    };

    const objectOne = {
      key: {
        subKeyOne: 'valueOne',
        subKeyTwo: 'valueTwo',
      },
    } as unknown as DataModel['test'];

    const objectTwo = {
      key: { subKeyTwo: 'newValueTwo' },
      newKey: 'otherValue',
    } as unknown as DataModel['test'];

    expect(engine.deepMerge(objectOne, objectTwo, dataModel)).toEqual({
      key: {
        subKeyOne: 'valueOne',
        subKeyTwo: 'newValueTwo',
      },
      newKey: 'otherValue',
    });
  });

  test('[deepMerge] nested arrays', async () => {
    const dataModel: ArrayDataModel<DataModel> = {
      type: 'array',
      fields: {
        type: 'dynamicObject',
        fields: {
          '^key$': {
            type: 'object',
            fields: {
              subKeyOne: {
                type: 'string',
              },
              subKeyTwo: {
                type: 'string',
              },
            },
          },
          '^newKey$': {
            type: 'string',
          },
        },
      },
    };

    const arrayOne = [
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
        newKey: 'otherValue',
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
        newKey: 'otherValueThree',
      },
    ] as unknown as DataModel['test'];

    const arrayTwo = [
      null,
      {
        key: { subKeyTwo: 'newValueTwo' },
        newKey: 'newOtherValue',
      },
      {
        newKey: null,
      },
    ] as unknown as DataModel['test'];

    expect(engine.deepMerge(arrayOne, arrayTwo, dataModel)).toEqual([
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'newValueTwo',
        },
        newKey: 'newOtherValue',
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
        newKey: 'otherValueThree',
      },
    ]);
  });

  test('[generateAutomaticFields]', async () => {
    const context = {} as CommandContext;
    expect(engine.generateAutomaticFields({
      version: 1,
      enableAuthors: true,
      enableDeletion: false,
      enableTimestamps: true,
      fields: {},
    }, context, true)).toEqual({
      _id: new Id(),
      _version: 1,
      _updatedAt: null,
      _updatedBy: null,
      _createdBy: null,
      _isDeleted: false,
      _createdAt: new Date('2023-01-01T00:00:00.000Z'),
    });
  });

  test('[create]', async () => {
    const context = { user: { _id: new Id('64723318e84f943f1ad6578b') } } as CommandContext;
    await engine.create('otherExternalRelation', { type: 'test' }, {}, context);
    expect(databaseClient.create).toHaveBeenCalledTimes(1);
    expect(databaseClient.create).toHaveBeenCalledWith('otherExternalRelation', {
      _id: new Id(),
      _updatedAt: null,
      _updatedBy: null,
      _createdBy: new Id('64723318e84f943f1ad6578b'),
      _createdAt: new Date('2023-01-01T00:00:00.000Z'),
      type: 'test',
    });
    expect(databaseClient.view).toHaveBeenCalledTimes(1);
    expect(databaseClient.view).toHaveBeenCalledWith('otherExternalRelation', new Id(), {
      fields: undefined,
    });
  });

  test('[update]', async () => {
    const id = new Id('64723318e84f943f1ad6578b');
    const context = { user: { _id: new Id('64723318e84f943f1ad6578b') } } as CommandContext;
    await engine.update('otherExternalRelation', id, { type: 'test' }, {}, context);
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('otherExternalRelation', id, {
      type: 'test',
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      _updatedBy: new Id('64723318e84f943f1ad6578b'),
    });
    expect(databaseClient.view).toHaveBeenCalledTimes(2);
    expect(databaseClient.view).toHaveBeenCalledWith('otherExternalRelation', id, {});
  });

  test('[view] no result', async () => {
    process.env.NO_RESULT = 'true';
    const id = new Id('64723318e84f943f1ad6578b');
    expect(async () => {
      await engine.view('otherExternalRelation', id, {});
    }).rejects.toThrow(new EngineError('NO_RESOURCE'));
  });

  test('[view] result', async () => {
    const id = new Id('64723318e84f943f1ad6578b');
    await engine.view('otherExternalRelation', id, {});
    expect(databaseClient.view).toHaveBeenCalledTimes(1);
    expect(databaseClient.view).toHaveBeenCalledWith('otherExternalRelation', id, {});
  });

  test('[list]', async () => {
    await engine.list('otherExternalRelation', {});
    expect(databaseClient.list).toHaveBeenCalledTimes(1);
    expect(databaseClient.list).toHaveBeenCalledWith('otherExternalRelation', {});
  });

  test('[search]', async () => {
    await engine.search('otherExternalRelation', {}, {});
    expect(databaseClient.search).toHaveBeenCalledTimes(1);
    expect(databaseClient.search).toHaveBeenCalledWith('otherExternalRelation', {}, {});
  });

  test('[delete] no result', async () => {
    process.env.NO_RESULT = 'true';
    const context = { user: { _id: new Id('64723318e84f943f1ad6578b') } } as CommandContext;
    const id = new Id('64723318se84f943f1ad6578b');
    expect(async () => {
      await engine.delete('otherExternalRelation', id, context);
    }).rejects.toThrow(new EngineError('NO_RESOURCE'));
  });

  test('[delete] result', async () => {
    const id = new Id('64723318e84f943f1ad6578b');
    const context = { user: { _id: new Id('64723318e84f943f1ad6578b') } } as CommandContext;
    await engine.delete('otherExternalRelation', id, context);
    expect(databaseClient.delete).toHaveBeenCalledTimes(1);
    expect(databaseClient.delete).toHaveBeenCalledWith('otherExternalRelation', id, {
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      _updatedBy: new Id('64723318e84f943f1ad6578b'),
    });
  });

  test('[reset]', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    const promise = engine.reset();
    vi.runAllTimers();
    await promise;
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      '[Engine][reset] 🕐 Resetting system in 5 seconds, it\'s still time to abort...',
    );
    expect(databaseClient.reset).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
