/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Binary,
  ObjectId,
  MongoClient,
  type Document,
  MongoServerError,
} from 'mongodb';
import { Id } from '@perseid/core';
import Model from 'scripts/common/Model';
import Logger from 'scripts/services/Logger';
import DatabaseError from 'scripts/errors/Database';
import CacheClient from 'scripts/services/CacheClient';
import DatabaseClient from 'scripts/services/DatabaseClient';

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

type TestDatabaseClient = DatabaseClient<DataModel> & {
  checkForeignKeys: (foreignKeys: Map<string, Set<string>>) => Promise<void>;
  formatInput: <Collection extends keyof DataModel>(
    input: Partial<DataModel[Collection]>,
    model: FieldDataModel<DataModel>,
    foreignKeys?: Map<string, Set<string>>,
  ) => Partial<DataModel[Collection]>;
  formatOutput: <Collection extends keyof DataModel>(
    output: Partial<DataModel[Collection]>,
    model: FieldDataModel<DataModel>,
    projections: Document,
  ) => Partial<DataModel[Collection]>;
  generateProjectionsFrom: <Collection extends keyof DataModel>(
    fields: string[],
    model: FieldDataModel<Collection>,
  ) => Document;
  generateLookupsPipelineFrom: <Collection extends keyof DataModel>(
    projections: Document,
    model: FieldDataModel<Collection>,
    path?: string[],
    isFlatArray?: boolean,
  ) => Document[];
  generateSortingPipelineFrom: (
    sortBy?: CommandOptions['sortBy'],
    sortOrder?: CommandOptions['sortOrder'],
  ) => Document[];
  generatePaginationPipelineFrom: (
    offset?: number,
    limit?: number
  ) => Document[];
  handleError: () => Promise<void>;
};

describe('services/DatabaseClient', () => {
  vi.mock('mongodb');
  vi.mock('scripts/common/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/CacheClient');

  const cacheClient = new CacheClient();
  let databaseClient: TestDatabaseClient;
  const mongoClient = new MongoClient('', {});
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const model = new Model<DataModel>({} as Record<keyof DataModel, CollectionDataModel<DataModel>>);

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NO_RESULT;
    delete process.env.VIEW_MODE;
    delete process.env.MISSING_FOREIGN_KEYS;
    databaseClient = new DatabaseClient<DataModel>(model, logger, cacheClient, {
      protocol: 'mongo+srv',
      host: 'localhost',
      port: 27018,
      user: 'test',
      password: 'test',
      database: 'test',
      maxPoolSize: 0,
      connectTimeout: 0,
      connectionLimit: 0,
      queueLimit: 0,
      cacheDuration: 0,
    }) as TestDatabaseClient;
  });

  test('[formatInput]', () => {
    const foreignKeys = new Map();
    expect(databaseClient.formatInput({
      primitiveOne: new Id('646b9be5e921d0ef42f8a149'),
      primitiveTwo: new ArrayBuffer(10),
      primitiveThree: 'test',
      arrayOne: [
        {
          dynamicObject: {
            testOne: new Id('646b9be5e921d0ef42f8a147'),
          },
          object: {
            fieldOne: 'test',
          },
        },
      ],
      arrayTwo: [
        null,
        new Id('646b9be5e921d0ef42f8a150'),
      ],
      arrayFour: ['testOne', 'testTwo'],
      dynamicOne: {
        testOne: new Id('646b9be5e921d0ef42f8a142'),
        testTwo: new Id('646b9be5e921d0ef42f8a143'),
        testThree: { test: 'test' },
        specialTest: new Id('646b9be5e921d0ef42f8a141'),
        specialTestTwo: new Id('646b9be5e921d0ef42f8a142'),
        specialTestThree: new Id('646b9be5e921d0ef42f8a146'),
      },
      dynamicTwo: {
        testOne: new Id('646b9be5e921d0ef42f8a142'),
        testTwo: { test: 'test' },
      },
    }, { type: 'object', fields: model.getCollection('test').fields }, foreignKeys)).toEqual({
      primitiveOne: new ObjectId('646b9be5e921d0ef42f8a149'),
      primitiveTwo: new Binary('test'),
      primitiveThree: 'test',
      arrayOne: [
        {
          dynamicObject: {
            testOne: new ObjectId('646b9be5e921d0ef42f8a147'),
          },
          object: {
            fieldOne: 'test',
          },
        },
      ],
      arrayTwo: [
        null,
        new ObjectId('646b9be5e921d0ef42f8a150'),
      ],
      arrayFour: ['testOne', 'testTwo'],
      dynamicOne: {
        testOne: new ObjectId('646b9be5e921d0ef42f8a142'),
        testTwo: new ObjectId('646b9be5e921d0ef42f8a143'),
        testThree: { test: 'test' },
        specialTest: new ObjectId('646b9be5e921d0ef42f8a141'),
        specialTestTwo: new ObjectId('646b9be5e921d0ef42f8a142'),
        specialTestThree: new ObjectId('646b9be5e921d0ef42f8a146'),
      },
      dynamicTwo: {
        testOne: new ObjectId('646b9be5e921d0ef42f8a142'),
        testTwo: { test: 'test' },
      },
    });
    expect(foreignKeys).toEqual(new Map([
      ['externalRelation', new Set([
        '646b9be5e921d0ef42f8a147',
        '646b9be5e921d0ef42f8a150',
        '646b9be5e921d0ef42f8a142',
        '646b9be5e921d0ef42f8a141',
        '646b9be5e921d0ef42f8a146',
      ])],
      ['otherExternalRelation', new Set([
        '646b9be5e921d0ef42f8a143',
      ])],
    ]));
  });

  test('[formatOutput]', () => {
    expect(databaseClient.formatOutput({
      primitiveOne: new ObjectId('646b9be5e921d0ef42f8a149'),
      primitiveTwo: new Binary('test'),
    } as Document, { type: 'object', fields: model.getCollection('test').fields }, {
      primitiveThree: 1,
    })).toEqual({
      primitiveThree: null,
    });

    expect(databaseClient.formatOutput({
      primitiveOne: new ObjectId('646b9be5e921d0ef42f8a149'),
      primitiveTwo: new Binary('test'),
      primitiveThree: 'test',
      arrayOne: [
        {
          dynamicObject: {
            testOne: { _id: new ObjectId('646b9be5e921d0ef42f8a147') },
          },
          object: {
            fieldOne: 'test',
          },
        },
      ],
      arrayTwo: [
        null,
        { _id: new ObjectId('646b9be5e921d0ef42f8a150') },
      ],
      arrayFour: ['testOne', 'testTwo'],
      dynamicOne: {
        testOne: {
          _id: new ObjectId('646b9be5e921d0ef42f8a142'),
          name: 'test',
          relations: [{
            _id: new ObjectId('646b9be5e921d0ef42f8a150'),
            type: 'test',
          }],
        },
        testTwo: { _id: new ObjectId('646b9be5e921d0ef42f8a143'), type: 'test' },
        testThree: { test: 'test' },
        specialTest: new ObjectId('646b9be5e921d0ef42f8a141'),
        specialTestTwo: new ObjectId('646b9be5e921d0ef42f8a142'),
        specialTestThree: new ObjectId('646b9be5e921d0ef42f8a146'),
      },
      dynamicTwo: {
        testOne: new ObjectId('646b9be5e921d0ef42f8a142'),
        testTwo: { test: 'test' },
      },
    } as Document, { type: 'object', fields: model.getCollection('test').fields }, {
      primitiveOne: 1,
      primitiveTwo: 1,
      arrayOne: {
        dynamicObject: {
          testOne: {
            _id: 1,
          },
        },
        object: 1,
      },
      arrayTwo: {
        _id: 1,
      },
      arrayFour: 1,
      dynamicOne: {
        testOne: {
          _id: 1,
          name: 1,
          relations: {
            _id: 1,
            type: 1,
          },
        },
        testTwo: {
          _id: 1,
          type: 1,
        },
        testThree: {
          test: 1,
        },
        specialTest: 1,
        specialTestTwo: 1,
        specialTestThree: 1,
      },
      dynamicTwo: 1,
    })).toEqual({
      primitiveOne: new Id('646b9be5e921d0ef42f8a149'),
      primitiveTwo: new ArrayBuffer(10),
      arrayOne: [
        {
          dynamicObject: {
            testOne: { _id: new Id('646b9be5e921d0ef42f8a147') },
          },
          object: {
            fieldOne: 'test',
          },
        },
      ],
      arrayTwo: [
        null,
        { _id: new Id('646b9be5e921d0ef42f8a150') },
      ],
      arrayFour: ['testOne', 'testTwo'],
      dynamicOne: {
        testOne: {
          _id: new Id('646b9be5e921d0ef42f8a142'),
          name: 'test',
          relations: [{
            _id: new Id('646b9be5e921d0ef42f8a150'),
            type: 'test',
          }],
        },
        testTwo: { _id: new Id('646b9be5e921d0ef42f8a143'), type: 'test' },
        testThree: { test: 'test' },
        specialTest: new Id('646b9be5e921d0ef42f8a141'),
        specialTestTwo: new Id('646b9be5e921d0ef42f8a142'),
        specialTestThree: new Id('646b9be5e921d0ef42f8a146'),
      },
      dynamicTwo: {
        testOne: new Id('646b9be5e921d0ef42f8a142'),
        testTwo: { test: 'test' },
      },
    });
  });

  test('[checkForeignKeys] - all foreign keys are valid', async () => {
    await databaseClient.checkForeignKeys(new Map([
      ['externalRelation', new Set([
        '646b9be5e921d0ef42f8a147',
        '646b9be5e921d0ef42f8a142',
        '646b9be5e921d0ef42f8a143',
        '646b9be5e921d0ef42f8a141',
        '646b9be5e921d0ef42f8a146',
      ])],
    ]));
    expect(mongoClient.db().collection('_config').aggregate).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('_config').aggregate).toHaveBeenCalledWith([
      { $limit: 1 },
      {
        $project: {
          externalRelationIds: [
            new ObjectId('646b9be5e921d0ef42f8a147'),
            new ObjectId('646b9be5e921d0ef42f8a142'),
            new ObjectId('646b9be5e921d0ef42f8a143'),
            new ObjectId('646b9be5e921d0ef42f8a141'),
            new ObjectId('646b9be5e921d0ef42f8a146'),
          ],
        },
      },
      {
        $lookup: {
          as: 'externalRelation',
          foreignField: '_id',
          from: 'externalRelation',
          localField: 'externalRelationIds',
          pipeline: [{ $match: { _isDeleted: { $ne: true } } }, { $project: { _id: 1 } }],
        },
      },
    ]);
  });

  test('[checkForeignKeys] - some foreign keys are missing', async () => {
    process.env.MISSING_FOREIGN_KEYS = 'true';
    expect(async () => {
      await databaseClient.checkForeignKeys(new Map([
        ['externalRelation', new Set([
          '646b9be5e921d0ef42f8a148',
          '646b9be5e921d0ef42f8a142',
        ])],
      ]));
    }).rejects.toThrow(new DatabaseError('NO_RESOURCE'));
  });

  test('[generateProjectionsFrom] invalid field', () => {
    expect(() => {
      databaseClient.generateProjectionsFrom([
        'arrayFour._id',
      ], { type: 'object', fields: model.getCollection('test').fields });
    }).toThrow(new DatabaseError('INVALID_FIELD', { path: 'arrayFour._id' }));
    expect(() => {
      databaseClient.generateProjectionsFrom([
        'invalid.test',
      ], { type: 'object', fields: model.getCollection('test').fields });
    }).toThrow(new DatabaseError('INVALID_FIELD', { path: 'invalid.test' }));
  });

  test('[generateProjectionsFrom] invalid index', () => {
    expect(() => {
      databaseClient.generateProjectionsFrom([
        'arrayFour',
      ], { type: 'object', fields: model.getCollection('test').fields }, true);
    }).toThrow(new DatabaseError('INVALID_INDEX', { path: 'arrayFour' }));
  });

  test('[generateProjectionsFrom] valid fields', () => {
    expect(databaseClient.generateProjectionsFrom([
      'primitiveOne',
      'primitiveOne',
      'primitiveTwo',
      'arrayOne.object',
      'dynamicOne.testThree.test',
      'arrayTwo._id',
      'arrayFour',
      'dynamicOne.testTwo.type',
      'dynamicOne.testOne.relations._id',
      'dynamicOne.testOne.relations.type',
      'arrayOne.dynamicObject.testOne._id',
      'dynamicOne.testOne.name',
      'dynamicOne.testTwo._id',
      'dynamicOne.specialTest',
      'dynamicOne.specialTestTwo.name',
      'dynamicOne.specialTestTwo',
      'dynamicOne.specialTestThree',
      'dynamicTwo',
    ], { type: 'object', fields: model.getCollection('test').fields })).toEqual({
      _id: 1,
      primitiveOne: 1,
      primitiveTwo: 1,
      arrayOne: {
        dynamicObject: {
          testOne: {
            _id: 1,
          },
        },
        object: 1,
      },
      arrayTwo: {
        _id: 1,
      },
      arrayFour: 1,
      dynamicOne: {
        testOne: {
          _id: 1,
          name: 1,
          relations: {
            _id: 1,
            type: 1,
          },
        },
        testTwo: {
          _id: 1,
          type: 1,
        },
        testThree: {
          test: 1,
        },
        specialTest: 1,
        specialTestTwo: 1,
        specialTestThree: 1,
      },
      dynamicTwo: 1,
    });
  });

  test('[generateLookupsPipelineFrom]', () => {
    expect(databaseClient.generateLookupsPipelineFrom({
      _id: 1,
      primitiveOne: 1,
      primitiveTwo: 1,
      arrayOne: {
        dynamicObject: {
          testOne: {
            _id: 1,
          },
        },
        object: 1,
      },
      arrayTwo: {
        _id: 1,
      },
      arrayFour: 1,
      dynamicOne: {
        testOne: {
          _id: 1,
          name: 1,
          relations: {
            _id: 1,
            type: 1,
          },
        },
        testTwo: {
          _id: 1,
          type: 1,
        },
        testThree: {
          test: 1,
        },
        specialTest: 1,
        specialTestTwo: 1,
        specialTestThree: 1,
      },
      dynamicTwo: 1,
    }, { type: 'object', fields: model.getCollection('test').fields })).toEqual([
      {
        $lookup: {
          as: '__arrayOne.dynamicObject.testOne',
          from: 'externalRelation',
          foreignField: '_id',
          localField: 'arrayOne.dynamicObject.testOne',
          pipeline: [],
        },
      },
      {
        $addFields: {
          'arrayOne.dynamicObject': {
            $map: {
              input: '$arrayOne.dynamicObject',
              in: {
                $mergeObjects: [
                  '$$this',
                  {
                    testOne: {
                      $arrayElemAt: [
                        '$__arrayOne.dynamicObject.testOne',
                        { $indexOfArray: ['$__arrayOne.dynamicObject.testOne._id', '$$this.testOne'] },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $project: { __arrayOne: 0 } },
      {
        $lookup: {
          as: 'arrayTwo',
          from: 'externalRelation',
          foreignField: '_id',
          localField: 'arrayTwo',
          pipeline: [],
        },
      },
      {
        $lookup: {
          as: 'dynamicOne.testOne',
          from: 'externalRelation',
          foreignField: '_id',
          localField: 'dynamicOne.testOne',
          pipeline: [
            {
              $lookup: {
                as: 'relations',
                from: 'otherExternalRelation',
                foreignField: '_id',
                localField: 'relations',
                pipeline: [],
              },
            },
          ],
        },
      },
      {
        $addFields: {
          'dynamicOne.testOne': { $arrayElemAt: ['$dynamicOne.testOne', 0] },
        },
      },
      {
        $lookup: {
          as: 'dynamicOne.testTwo',
          from: 'otherExternalRelation',
          foreignField: '_id',
          localField: 'dynamicOne.testTwo',
          pipeline: [],
        },
      },
      {
        $addFields: {
          'dynamicOne.testTwo': { $arrayElemAt: ['$dynamicOne.testTwo', 0] },
        },
      },
    ]);
  });

  test('[generateSortingPipelineFrom] no sorting field', () => {
    expect(databaseClient.generateSortingPipelineFrom([], [])).toEqual([]);
  });

  test('[generateSortingPipelineFrom] invalid sorting field', () => {
    expect(() => {
      databaseClient.generateSortingPipelineFrom([], [1]);
    }).toThrow(new DatabaseError('INVALID_SORTING', { sortBy: [], sortOrder: [] }));
  });

  test('[generateSortingPipelineFrom] valid sorting fields', () => {
    expect(databaseClient.generateSortingPipelineFrom(['_id', 'primitiveOne'], [1, -1])).toEqual([
      {
        $sort: {
          _id: 1,
          primitiveOne: -1,
        },
      },
    ]);
  });

  test('[generatePaginationPipelineFrom]', () => {
    expect(databaseClient.generatePaginationPipelineFrom()).toEqual([
      { $skip: 0 },
      { $limit: 20 },
    ]);
  });

  test('[handleError]', async () => {
    await databaseClient.handleError(async () => null);
    expect(mongoClient.connect).toHaveBeenCalledTimes(1);
  });

  test('[handleError] connection error', async () => {
    (databaseClient as Document).database = null;
    const callback = async (): Promise<null> => null;
    const databaseError = new DatabaseError('CONNECTION_FAILED');
    await expect(async () => databaseClient.handleError(callback)).rejects.toEqual(databaseError);
  });

  test('[handleError] unique index constraing error', async () => {
    const callback = async (): Promise<void> => {
      const error = new MongoServerError({ message: 'Error' });
      error.code = 11000;
      throw error;
    };
    const databaseError = new DatabaseError('DUPLICATE_RESOURCE', { field: '_id', value: 'test' });
    await expect(async () => databaseClient.handleError(callback)).rejects.toEqual(databaseError);
  });

  test('[handleError] other error', async () => {
    const callback = async (): Promise<void> => { throw new Error('Unknown'); };
    await expect(async () => databaseClient.handleError(callback)).rejects.toEqual(new Error('Unknown'));
  });

  test('[constructor] default settings', async () => {
    vi.clearAllMocks();
    databaseClient = new DatabaseClient<DataModel>(model, logger, cacheClient, {
      protocol: 'mongo+srv',
      host: 'localhost',
      port: null,
      user: null,
      password: null,
      database: 'test',
      maxPoolSize: 0,
      connectTimeout: 0,
      connectionLimit: 0,
      queueLimit: 0,
      cacheDuration: 0,
    }) as TestDatabaseClient;
    expect(mongoClient.db).toHaveBeenCalledTimes(1);
    expect(mongoClient.db).toHaveBeenCalledWith('test');
  });

  test('[list] no result', async () => {
    process.env.NO_RESULT = 'true';
    const response = await databaseClient.list('test');
    expect(response).toEqual({ total: 0, results: [] });
  });

  test('[list] collection that enables deletion', async () => {
    const response = await databaseClient.list('test');
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledWith([
      { $project: { _id: 1 } },
      {
        $facet: {
          total: [{ $group: { _id: null, total: { $sum: 1 } } }],
          results: [{ $skip: 0 }, { $limit: 20 }],
        },
      },
    ]);
    expect(response).toEqual({
      total: 1,
      results: [{ _id: new Id('64723318e84f943f1ad6578b') }],
    });
  });

  test('[list] collection that does not enables deletion', async () => {
    const response = await databaseClient.list('externalRelation');
    expect(mongoClient.db().collection('externalRelation').aggregate).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('externalRelation').aggregate).toHaveBeenCalledWith([
      { $match: { _isDeleted: false } },
      { $project: { _id: 1 } },
      {
        $facet: {
          total: [{ $group: { _id: null, total: { $sum: 1 } } }],
          results: [{ $skip: 0 }, { $limit: 20 }],
        },
      },
    ]);
    expect(response).toEqual({
      total: 1,
      results: [{ _id: new Id('64723318e84f943f1ad6578b') }],
    });
  });

  test('[create]', async () => {
    const resource = { _id: new Id('64723318e84f943f1ad6578b'), type: 'test' };
    await databaseClient.create('otherExternalRelation', resource);
    expect(mongoClient.db().collection('otherExternalRelation').insertOne).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('otherExternalRelation').insertOne).toHaveBeenCalledWith({
      _id: new ObjectId('64723318e84f943f1ad6578b'),
      type: 'test',
    });
  });

  test('[update] collection that enables deletion', async () => {
    const resourceId = new Id('64723318e84f943f1ad6578b');
    await databaseClient.update('test', resourceId, { primitiveThree: 'new test' });
    expect(mongoClient.db().collection('test').updateOne).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('test').updateOne).toHaveBeenCalledWith({
      _id: new ObjectId('64723318e84f943f1ad6578b'),
    }, { $set: { primitiveThree: 'new test' } });
  });

  test('[update] collection that does not enables deletion', async () => {
    const resourceId = new Id('64723318e84f943f1ad6578b');
    await databaseClient.update('externalRelation', resourceId, { name: 'new test' });
    expect(mongoClient.db().collection('externalRelation').updateOne).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('externalRelation').updateOne).toHaveBeenCalledWith({
      _isDeleted: false,
      _id: new ObjectId('64723318e84f943f1ad6578b'),
    }, { $set: { name: 'new test' } });
  });

  test('[exclusiveUpdate] no result', async () => {
    process.env.NO_RESULT = 'true';
    const resourceId = new Id('64723318e84f943f1ad6578b');
    const response = await databaseClient.exclusiveUpdate('otherExternalRelation', { _id: resourceId }, {
      type: 'new test',
    });
    expect(response).toBe(false);
  });

  test('[exclusiveUpdate] collection that enables deletion', async () => {
    const resourceId = new Id('64723318e84f943f1ad6578b');
    await databaseClient.exclusiveUpdate('test', { _id: resourceId }, { primitiveThree: 'new test' });
    expect(mongoClient.db().collection('test').findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('test').findOneAndUpdate).toHaveBeenCalledWith({
      _id: new ObjectId('64723318e84f943f1ad6578b'),
    }, { $set: { primitiveThree: 'new test' } }, { projection: { _id: 1 } });
  });

  test('[exclusiveUpdate] collection that does not enables deletion', async () => {
    const resourceId = new Id('64723318e84f943f1ad6578b');
    await databaseClient.exclusiveUpdate('externalRelation', { _id: resourceId }, { name: 'new test' });
    expect(mongoClient.db().collection('externalRelation').findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('externalRelation').findOneAndUpdate).toHaveBeenCalledWith({
      _isDeleted: false,
      _id: new ObjectId('64723318e84f943f1ad6578b'),
    }, { $set: { name: 'new test' } }, { projection: { _id: 1 } });
  });

  test('[view] no result', async () => {
    process.env.NO_RESULT = 'true';
    process.env.VIEW_MODE = 'true';
    const resource = await databaseClient.view('otherExternalRelation', new Id('64723318e84f943f1ad6578b'));
    expect(resource).toBe(null);
  });

  test('[view] collection that enables deletion', async () => {
    process.env.VIEW_MODE = 'true';
    const resource = await databaseClient.view('test', new Id('64723318e84f943f1ad6578b'));
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledWith([
      { $match: { _id: new ObjectId('64723318e84f943f1ad6578b') } },
      { $project: { _id: 1 } },
    ]);
    expect(resource).toEqual({ _id: new Id('64723318e84f943f1ad6578b') });
  });

  test('[view] collection that does not enables deletion', async () => {
    process.env.VIEW_MODE = 'true';
    const resource = await databaseClient.view('externalRelation', new Id('64723318e84f943f1ad6578b'));
    expect(mongoClient.db().collection('externalRelation').aggregate).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('externalRelation').aggregate).toHaveBeenCalledWith([
      { $match: { _id: new ObjectId('64723318e84f943f1ad6578b'), _isDeleted: false } },
      { $project: { _id: 1 } },
    ]);
    expect(resource).toEqual({ _id: new Id('64723318e84f943f1ad6578b') });
  });

  test('[delete] no result', async () => {
    process.env.NO_RESULT = 'true';
    const isDeleted = await databaseClient.delete('test', new Id('64723318e84f943f1ad6578b'));
    expect(isDeleted).toBe(false);
  });

  test('[delete] collection that enables deletion', async () => {
    const isDeleted = await databaseClient.delete('test', new Id('64723318e84f943f1ad6578b'));
    expect(mongoClient.db().collection('test').deleteOne).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('test').deleteOne).toHaveBeenCalledWith({
      _id: new ObjectId('64723318e84f943f1ad6578b'),
    });
    expect(isDeleted).toBe(true);
  });

  test('[delete] collection that does not enables deletion', async () => {
    const isDeleted = await databaseClient.delete('externalRelation', new Id('64723318e84f943f1ad6578b'), {
      name: 'deleted',
    });
    expect(mongoClient.db().collection('externalRelation').updateOne).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('externalRelation').updateOne).toHaveBeenCalledWith({
      _isDeleted: false,
      _id: new ObjectId('64723318e84f943f1ad6578b'),
    }, { $set: { _isDeleted: true, name: 'deleted' } });
    expect(isDeleted).toBe(true);
  });
});
