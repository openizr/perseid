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
import { type DataModel as BaseDataModel } from 'scripts/services/__mocks__/schema';

interface DataModel extends BaseDataModel {
  collection: {
    rootObject: {
      fieldOne: string | null;
    } | null;
    array: ({
      fieldOne: Id | null;
      fieldTwo: string | null;
      fieldThree: {
        [key: string]: string | null;
      } | null;
      dynamicOne: {
        [key: string]: {
          subKeyOne: string | null;
          subKeyTwo: Id | null;
        } | string | null;
      } | null;
    } | null)[];
  }
}

type TestEngine = Engine<DataModel> & {
  deepMerge: Engine<DataModel>['deepMerge'];
  checkForeignIds: Engine<DataModel>['checkForeignIds'];
  withAutomaticFields: Engine<DataModel>['withAutomaticFields'];
  checkAndUpdatePayload: Engine<DataModel>['checkAndUpdatePayload'];
  createRelationFilters: Engine<DataModel>['createRelationFilters'];
};

describe('services/Engine', () => {
  vi.mock('@perseid/core');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/DatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  let engine: TestEngine;
  const context = {} as CommandContext;
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
  const dataModel: ObjectDataModel<DataModel> = {
    type: 'object',
    fields: {
      rootObject: {
        type: 'object',
        fields: {
          fieldOne: { type: 'string' },
        },
      },
      array: {
        type: 'array',
        fields: {
          type: 'object',
          fields: {
            fieldOne: { type: 'id' },
            fieldTwo: { type: 'string' },
            fieldThree: {
              type: 'dynamicObject',
              fields: {
                '.*': { type: 'string' },
              },
            },
            dynamicOne: {
              type: 'dynamicObject',
              fields: {
                '^key$': {
                  type: 'object',
                  fields: {
                    subKeyOne: {
                      type: 'string',
                    },
                    subKeyTwo: {
                      type: 'id',
                      relation: 'test',
                    },
                  },
                },
                '^newKey$': {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NO_RESULT;
    engine = new Engine<DataModel>(model, logger, databaseClient) as TestEngine;
  });

  test('[deepMerge]', async () => {
    expect(engine.deepMerge({}, {}, { type: 'integer' })).toEqual({});
    expect(engine.deepMerge({
      rootObject: null,
      array: [{
        fieldTwo: null,
        fieldOne: new Id('64723318e84f943f1ad6578e'),
        fieldThree: null,
        dynamicOne: null,
      }],
    }, {
      rootObject: null,
      array: [{ fieldTwo: null, fieldThree: {} }, {}, null],
    }, dataModel)).toEqual({
      array: [{
        fieldTwo: null,
        fieldThree: {},
        dynamicOne: null,
        fieldOne: new Id('64723318e84f943f1ad6578e'),
      }, {}],
    });
    const foreignIds = new Map();
    expect(engine.deepMerge({
      array: [
        {
          fieldOne: null,
          fieldTwo: null,
          fieldThree: null,
          dynamicOne: {
            key: {
              subKeyOne: 'valueOne',
              subKeyTwo: new Id('64723318e84f943f1ad6578b'),
            },
          },
        },
        {
          fieldOne: null,
          fieldTwo: null,
          fieldThree: null,
          dynamicOne: {
            key: {
              subKeyOne: 'valueOne',
              subKeyTwo: new Id('64723318e84f943f1ad6578c'),
            },
          },
        },
        {
          fieldOne: null,
          fieldTwo: null,
          fieldThree: null,
          dynamicOne: {
            key: {
              subKeyOne: 'valueOne',
              subKeyTwo: new Id('64723318e84f943f1ad6578d'),
            },
            newKey: 'otherValue',
          },
        },
        {
          fieldOne: null,
          fieldTwo: null,
          fieldThree: null,
          dynamicOne: {
            key: {
              subKeyOne: 'valueOne',
              subKeyTwo: new Id('64723318e84f943f1ad6578f'),
            },
            newKey: 'otherValueThree',
          },
        },
      ],
    }, {
      array: [
        null,
        {
          dynamicOne: {
            key: { subKeyTwo: new Id('64723318e84f943f1ad6578e') },
            newKey: 'newOtherValue',
          },
        },
        {
          dynamicOne: {
            key: { subKeyTwo: new Id('64723318e84f943f1ad6578a') },
            newKey: null,
          },
        },
      ],
    }, dataModel, foreignIds)).toEqual({
      array: [
        {
          dynamicOne: {
            key: {
              subKeyTwo: new Id('64723318e84f943f1ad6578e'),
              subKeyOne: 'valueOne',
            },
            newKey: 'newOtherValue',
          },
          fieldOne: null,
          fieldTwo: null,
          fieldThree: null,
        },
        {
          dynamicOne: {
            key: {
              subKeyTwo: new Id('64723318e84f943f1ad6578a'),
              subKeyOne: 'valueOne',
            },
          },
          fieldOne: null,
          fieldTwo: null,
          fieldThree: null,
        },
        {
          fieldOne: null,
          fieldTwo: null,
          fieldThree: null,
          dynamicOne: {
            key: {
              subKeyOne: 'valueOne',
              subKeyTwo: new Id('64723318e84f943f1ad6578f'),
            },
            newKey: 'otherValueThree',
          },
        },
      ],
    });
    expect(foreignIds).toEqual(new Map([
      ['test', {
        'array.dynamicOne.key.subKeyTwo': new Set([
          '64723318e84f943f1ad6578e',
          '64723318e84f943f1ad6578a',
        ]),
      }],
    ]));
  });

  test('[deepMerge] no change', async () => {
    const foreignIds = new Map();
    expect(engine.deepMerge({
      rootObject: null,
    }, {
      rootObject: null,
    }, dataModel, foreignIds)).toEqual({});
    expect(foreignIds).toEqual(new Map());
  });

  test('[deepMerge] whole new payload', async () => {
    const foreignIds = new Map();
    expect(engine.deepMerge(
      {},
      {
        array: [
          {
            fieldOne: null,
            fieldTwo: null,
            fieldThree: null,
            dynamicOne: {
              key: {
                subKeyOne: 'valueOne',
                subKeyTwo: new Id('64723318e84f943f1ad6578b'),
              },
            },
          },
        ],
      },
      dataModel,
      foreignIds,
    )).toEqual({
      array: [
        {
          fieldOne: null,
          fieldTwo: null,
          fieldThree: null,
          dynamicOne: {
            key: {
              subKeyOne: 'valueOne',
              subKeyTwo: new Id('64723318e84f943f1ad6578b'),
            },
          },
        },
      ],
    });
    expect(foreignIds).toEqual(new Map([
      ['test', { 'array.dynamicOne.key.subKeyTwo': new Set(['64723318e84f943f1ad6578b']) }],
    ]));
  });

  test('[checkForeignIds]', async () => {
    const foreignIds = new Map([['test', { 'path.to.field': new Set(['64723318e84f943f1ad6578b']) }]]);
    await engine.checkForeignIds('externalRelation', null, {}, foreignIds, context);
    expect(databaseClient.checkForeignIds).toHaveBeenCalledTimes(1);
    expect(databaseClient.checkForeignIds).toHaveBeenCalledWith(new Map([
      ['test', [{ _id: [new Id('64723318e84f943f1ad6578b')] }]],
    ]));
  });

  test('[createRelationFilters]', async () => {
    const resource = { _id: new Id(), name: 'test', relations: [new Id()] };
    expect(engine.createRelationFilters('externalRelation', '', [], resource, {}, context)).toEqual({
      _id: [],
    });
  });

  test('[withAutomaticFields]', async () => {
    const newContext = { user: {} } as CommandContext;
    expect(engine.withAutomaticFields('externalRelation', null, {}, newContext)).toEqual({
      _id: new Id(),
      _version: 1,
      _updatedAt: null,
      _updatedBy: null,
      _createdBy: null,
      _isDeleted: false,
      _createdAt: new Date('2023-01-01T00:00:00.000Z'),
    });
  });

  test('[checkAndUpdatePayload]', async () => {
    const newPayload = await engine.checkAndUpdatePayload('test', null, {}, context);
    expect(newPayload).toEqual({ _id: new Id() });
  });

  test('[create]', async () => {
    const payload = { name: 'test', relations: [new Id('64723318e84f943f1ad6578b')] };
    const newContext = { user: { _id: new Id('64723318e84f943f1ad6578b') } } as CommandContext;
    await engine.create('externalRelation', payload, {}, newContext);
    expect(databaseClient.create).toHaveBeenCalledTimes(1);
    expect(databaseClient.create).toHaveBeenCalledWith('externalRelation', {
      _id: new Id(),
      _version: 1,
      _updatedAt: null,
      _updatedBy: null,
      _isDeleted: false,
      _createdBy: new Id('64723318e84f943f1ad6578b'),
      _createdAt: new Date('2023-01-01T00:00:00.000Z'),
      name: 'test',
      relations: [new Id('64723318e84f943f1ad6578b')],
    });
    expect(databaseClient.view).toHaveBeenCalledTimes(1);
    expect(databaseClient.view).toHaveBeenCalledWith('externalRelation', new Id(), {
      fields: undefined,
    });
  });

  test('[update]', async () => {
    const id = new Id('64723318e84f943f1ad6578b');
    const newContext = { user: { _id: new Id('64723318e84f943f1ad6578b') } } as CommandContext;
    await engine.update('externalRelation', id, { name: 'test' }, {}, newContext);
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('externalRelation', id, {
      name: 'test',
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      _updatedBy: new Id('64723318e84f943f1ad6578b'),
    });
    expect(databaseClient.view).toHaveBeenCalledTimes(2);
    expect(databaseClient.view).toHaveBeenCalledWith('externalRelation', id, {});
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
    const newContext = { user: { _id: new Id('64723318e84f943f1ad6578b') } } as CommandContext;
    const id = new Id('64723318se84f943f1ad6578b');
    expect(async () => {
      await engine.delete('otherExternalRelation', id, newContext);
    }).rejects.toThrow(new EngineError('NO_RESOURCE'));
  });

  test('[delete] result', async () => {
    const id = new Id('64723318e84f943f1ad6578b');
    const newContext = { user: { _id: new Id('64723318e84f943f1ad6578b') } } as CommandContext;
    await engine.delete('externalRelation', id, newContext);
    expect(databaseClient.delete).toHaveBeenCalledTimes(1);
    expect(databaseClient.delete).toHaveBeenCalledWith('externalRelation', id, {
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
