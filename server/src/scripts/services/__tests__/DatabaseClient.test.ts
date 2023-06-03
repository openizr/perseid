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
import Model from 'scripts/services/Model';
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
  test2: {
    null: null;
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
  handleError: DatabaseClient<DataModel>['handleError'];
  formatInput: DatabaseClient<DataModel>['formatInput'];
  formatOutput: DatabaseClient<DataModel>['formatOutput'];
  createSchema: DatabaseClient<DataModel>['createSchema'];
  checkForeignKeys: DatabaseClient<DataModel>['checkForeignKeys'];
  generateProjectionsFrom: DatabaseClient<DataModel>['generateProjectionsFrom'];
  getCollectionIndexedFields: DatabaseClient<DataModel>['getCollectionIndexedFields'];
  generateSearchPipelineFrom: DatabaseClient<DataModel>['generateSearchPipelineFrom'];
  generateSortingPipelineFrom: DatabaseClient<DataModel>['generateSortingPipelineFrom'];
  generateLookupsPipelineFrom: DatabaseClient<DataModel>['generateLookupsPipelineFrom'];
  generatePaginationPipelineFrom: DatabaseClient<DataModel>['generatePaginationPipelineFrom'];
};

describe('services/DatabaseClient', () => {
  vi.mock('mongodb');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/CacheClient');

  let databaseClient: TestDatabaseClient;
  const mongoClient = new MongoClient('', {});
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const cacheClient = new CacheClient({ cachePath: '/var/www/html/node_modules/.cache' });
  const model = new Model<DataModel>({} as Record<keyof DataModel, CollectionDataModel<DataModel>>);

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NO_RESULT;
    delete process.env.VIEW_MODE;
    delete process.env.NO_COLLECTION;
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

  test('[createSchema]', () => {
    expect(databaseClient.createSchema({
      type: 'object',
      fields: model.getCollection('test').fields,
    })).toEqual({
      $jsonSchema: {
        bsonType: ['object', 'null'],
        additionalProperties: false,
        required: [
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
        ],
        properties: {
          _id: { bsonType: ['objectId', 'null'] },
          primitiveOne: { bsonType: ['objectId', 'null'] },
          primitiveTwo: { bsonType: ['binData', 'null'] },
          primitiveThree: { bsonType: ['string', 'null'] },
          arrayOne: {
            bsonType: ['array', 'null'],
            items: {
              bsonType: ['object', 'null'],
              additionalProperties: false,
              required: ['dynamicObject', 'object'],
              properties: {
                dynamicObject: {
                  bsonType: ['object', 'null'],
                  additionalProperties: false,
                  patternProperties: {
                    '^testOne$': { bsonType: ['objectId', 'null'] },
                    '^testTwo$': { bsonType: ['objectId', 'null'] },
                    '^special(.*)$': { bsonType: ['objectId', 'null'] },
                  },
                },
                object: {
                  bsonType: ['object'],
                  additionalProperties: false,
                  required: ['fieldOne'],
                  properties: { fieldOne: { bsonType: ['string', 'null'] } },
                },
              },
            },
          },
          arrayTwo: {
            bsonType: ['array', 'null'],
            items: { bsonType: ['objectId', 'null'] },
          },
          arrayThree: {
            bsonType: ['array', 'null'],
            items: { bsonType: ['objectId', 'null'] },
          },
          arrayFour: {
            bsonType: ['array', 'null'],
            items: { bsonType: ['string', 'null'] },
          },
          arrayFive: {
            bsonType: ['array', 'null'],
            items: {
              bsonType: ['object', 'null'],
              additionalProperties: false,
              required: ['fieldOne'],
              properties: { fieldOne: { bsonType: ['string', 'null'] } },
            },
          },
          dynamicOne: {
            bsonType: ['object', 'null'],
            additionalProperties: false,
            patternProperties: {
              '^testOne$': { bsonType: ['objectId', 'null'] },
              '^testTwo$': { bsonType: ['objectId', 'null'] },
              '^testThree$': {
                bsonType: ['object', 'null'],
                additionalProperties: false,
                required: ['test'],
                properties: { test: { bsonType: ['string', 'null'] } },
              },
              '^special(.*)$': { bsonType: ['objectId', 'null'] },
            },
          },
          dynamicTwo: {
            bsonType: ['object', 'null'],
            additionalProperties: false,
            patternProperties: {
              '^testOne$': { bsonType: ['objectId', 'null'] },
              '^testTwo$': {
                bsonType: ['object', 'null'],
                additionalProperties: false,
                required: ['test'],
                properties: { test: { bsonType: ['string', 'null'] } },
              },
            },
          },
        },
      },
    });
    expect(databaseClient.createSchema({
      type: 'object',
      fields: model.getCollection('test2').fields,
    })).toEqual({
      $jsonSchema: {
        bsonType: ['object', 'null'],
        additionalProperties: false,
        required: [
          'float', 'floatTwo',
          'integer', 'integerTwo',
          'string', '_id',
          'null', 'binary',
          'enum', 'boolean',
          'booleanTwo', 'relation',
          'date', 'dateTwo',
          'id', 'array',
          'arrayTwo', 'dynamicObject',
          'dynamicObjectTwo',
        ],
        properties: {
          float: {
            bsonType: ['int', 'double', 'null'],
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: true,
            exclusiveMaximum: true,
            multipleOf: 2,
            enum: [1, null],
          },
          floatTwo: { bsonType: ['int', 'double', 'null'] },
          integer: {
            bsonType: ['int', 'null'],
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: true,
            exclusiveMaximum: true,
            multipleOf: 2,
            enum: [1, null],
          },
          integerTwo: { bsonType: ['int', 'null'] },
          string: {
            bsonType: ['string', 'null'],
            maxLength: 10,
            minLength: 1,
            pattern: 'test',
            enum: ['test', null],
          },
          _id: { bsonType: ['objectId', 'null'] },
          null: { bsonType: ['null'] },
          binary: { bsonType: ['binData', 'null'] },
          enum: { bsonType: ['string', 'null'], enum: ['test', null] },
          boolean: { bsonType: ['bool', 'null'] },
          booleanTwo: { bsonType: ['bool', 'null'] },
          relation: { bsonType: ['objectId', 'null'] },
          date: {
            bsonType: ['date', 'null'],
            enum: ['2023-01-01T00:00:00.000Z', null],
          },
          dateTwo: { bsonType: ['date', 'null'] },
          id: {
            bsonType: ['objectId', 'null'],
            enum: ['6478a6c5392350aaced68cf9', null],
          },
          array: {
            bsonType: ['array', 'null'],
            items: { bsonType: ['string', 'null'] },
            minItems: 3,
            maxItems: 10,
            uniqueItems: true,
          },
          arrayTwo: {
            bsonType: ['array', 'null'],
            items: { bsonType: ['string', 'null'] },
            minItems: 1,
            maxItems: 1,
            uniqueItems: true,
          },
          dynamicObject: {
            bsonType: ['object', 'null'],
            additionalProperties: false,
            minProperties: 3,
            maxProperties: 10,
            patternProperties: { test: { bsonType: ['string', 'null'] } },
          },
          dynamicObjectTwo: {
            bsonType: ['object', 'null'],
            additionalProperties: false,
            minProperties: 1,
            maxProperties: 1,
            patternProperties: { test: { bsonType: ['string', 'null'] } },
          },
        },
      },
    });
  });

  test('[getCollectionIndexedFields]', () => {
    expect(databaseClient.getCollectionIndexedFields({
      type: 'object',
      fields: model.getCollection('test').fields,
    })).toEqual([
      { key: { _id: 1 } },
      { key: { primitiveOne: 1 }, unique: true },
      { key: { 'arrayOne.dynamicObject.^testOne$': 1 } },
      { key: { arrayTwo: 1 } },
    ]);
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
      databaseClient.generateProjectionsFrom({
        classic: ['arrayFour._id'],
      }, { type: 'object', fields: model.getCollection('test').fields }, 3);
    }).toThrow(new DatabaseError('INVALID_FIELD', { path: 'arrayFour._id' }));
    expect(() => {
      databaseClient.generateProjectionsFrom({
        classic: ['invalid.test'],
      }, { type: 'object', fields: model.getCollection('test').fields }, 3);
    }).toThrow(new DatabaseError('INVALID_FIELD', { path: 'invalid.test' }));
  });

  test('[generateProjectionsFrom] maximum depth exceeded', () => {
    expect(() => {
      databaseClient.generateProjectionsFrom({
        classic: ['arrayTwo._id'],
      }, { type: 'object', fields: model.getCollection('test').fields }, 1);
    }).toThrow(new DatabaseError('MAXIMUM_DEPTH_EXCEEDED', { path: 'arrayTwo._id' }));
  });

  test('[generateProjectionsFrom] invalid index', () => {
    expect(() => {
      databaseClient.generateProjectionsFrom({
        classic: [],
        indexed: ['arrayFour'],
      }, { type: 'object', fields: model.getCollection('test').fields }, 3);
    }).toThrow(new DatabaseError('INVALID_INDEX', { path: 'arrayFour' }));
  });

  test('[generateProjectionsFrom] valid fields', () => {
    expect(databaseClient.generateProjectionsFrom({
      classic: [
        'primitiveOne',
        'primitiveOne',
        'primitiveTwo',
        'arrayOne.object.fieldOne',
        'dynamicOne.testThree.test',
        'arrayTwo._id',
        'arrayFour',
        'dynamicOne.testTwo.type',
        'dynamicOne.testOne.relations._id',
        'arrayOne.dynamicObject.testOne._id',
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
      ],
    }, { type: 'object', fields: model.getCollection('test').fields }, 10)).toEqual({
      _id: 1,
      primitiveOne: 1,
      primitiveTwo: 1,
      arrayOne: {
        dynamicObject: {
          testOne: {
            _id: 1,
          },
        },
        object: {
          fieldOne: 1,
        },
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
        specialTestTwo: {
          _id: 1,
          name: 1,
        },
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

  test('[generateSearchPipelineFrom]', () => {
    const searchQuery = { on: ['testOne'], text: 'test' };
    const searchFilters = {
      testOne: [new Id('646b9be5e921d0ef42f8a147')],
      testTwo: [new Date('2023-01-01'), new Date('2023-01-02')],
      testThree: new Date('2023-01-01'),
      testFour: [1, 2, 3],
      testFive: 'test',
      testSix: new Id('646b9be5e921d0ef42f8a147'),
    };
    expect(databaseClient.generateSearchPipelineFrom(null, null)).toEqual([]);
    expect(databaseClient.generateSearchPipelineFrom(searchQuery, searchFilters)).toEqual([
      {
        $match: {
          $and: [
            { $or: [{ testOne: { $regex: /(?=.*test)/i } }] },
            {
              testOne: { $in: [new ObjectId('646b9be5e921d0ef42f8a147')] },
              testTwo: {
                $gte: new Date('2023-01-01T00:00:00.000Z'),
                $lte: new Date('2023-01-02T00:00:00.000Z'),
              },
              testThree: { $gte: new Date('2023-01-01T00:00:00.000Z') },
              testFour: { $in: [1, 2, 3] },
              testFive: { $eq: 'test' },
              testSix: { $eq: new ObjectId('646b9be5e921d0ef42f8a147') },
            },
          ],
        },
      },
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

  test('[checkFields]', async () => {
    expect(() => {
      databaseClient.checkFields('test', ['invalid']);
    }).toThrow(new DatabaseError('INVALID_FIELD'));
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

  test('[search] no result', async () => {
    process.env.NO_RESULT = 'true';
    const response = await databaseClient.search('test', { query: { on: ['_id'], text: 'test' } });
    expect(response).toEqual({ total: 0, results: [] });
  });

  test('[search] collection that enables deletion', async () => {
    const response = await databaseClient.search('test', {});
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

  test('[search] collection that does not enables deletion', async () => {
    const response = await databaseClient.search('externalRelation', {});
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

  test('[dropDatabase]', async () => {
    await databaseClient.dropDatabase();
    expect(mongoClient.db().dropDatabase).toHaveBeenCalledTimes(1);
  });

  test('[createDatabase]', async () => {
    await databaseClient.createDatabase();
    expect(mongoClient.db).toHaveBeenCalledTimes(2);
  });

  test('[resetCollection]', async () => {
    await databaseClient.resetCollection('externalRelation');
    expect(mongoClient.db().dropCollection).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('externalRelation');
    expect(mongoClient.db().createCollection).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().createCollection).toHaveBeenCalledWith('externalRelation', {
      validator: {
        $jsonSchema: {
          bsonType: ['object', 'null'],
          additionalProperties: false,
          required: ['_id', 'name', '_isDeleted', 'relations'],
          properties: {
            _id: { bsonType: ['objectId', 'null'] },
            name: { bsonType: ['string', 'null'] },
            _isDeleted: { bsonType: ['bool', 'null'] },
            relations: {
              bsonType: ['array', 'null'],
              items: { bsonType: ['objectId', 'null'] },
            },
          },
        },
      },
    });
    expect(mongoClient.db().collection('externalRelation').createIndexes).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('externalRelation').createIndexes).toHaveBeenCalledWith([
      { key: { _id: 1 } },
    ]);
  });

  test('[updateCollection] collection does not exist', async () => {
    process.env.NO_COLLECTION = 'true';
    expect(async () => {
      await databaseClient.updateCollection('test');
    }).rejects.toThrow(new DatabaseError('NO_COLLECTION', { collection: 'test' }));
  });

  test('[updateCollection] collection exists', async () => {
    await databaseClient.updateCollection('externalRelation');
    expect(mongoClient.startSession).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().command).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().command).toHaveBeenCalledWith({
      collMod: 'externalRelation',
      validationLevel: 'strict',
      validator: {
        $jsonSchema: {
          bsonType: ['object', 'null'],
          additionalProperties: false,
          required: ['_id', 'name', '_isDeleted', 'relations'],
          properties: {
            _id: { bsonType: ['objectId', 'null'] },
            name: { bsonType: ['string', 'null'] },
            _isDeleted: { bsonType: ['bool', 'null'] },
            relations: {
              bsonType: ['array', 'null'],
              items: { bsonType: ['objectId', 'null'] },
            },
          },
        },
      },
    }, {
      session: expect.any(Object),
    });
    expect(mongoClient.db().collection('externalRelation').dropIndexes).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('externalRelation').dropIndexes).toHaveBeenCalledWith({
      session: expect.any(Object),
    });
    expect(mongoClient.db().collection('externalRelation').createIndexes).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('externalRelation').createIndexes).toHaveBeenCalledWith([
      { key: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('externalRelation').insertOne).toHaveBeenCalledTimes(1);
  });

  test('[dropCollection]', async () => {
    await databaseClient.dropCollection('test');
    expect(mongoClient.db().dropCollection).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('test');
  });

  test('[reset]', async () => {
    await databaseClient.reset();
    expect(logger.info).toHaveBeenCalledTimes(3);
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][reset] Dropping database...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][reset] Re-creating database...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][reset] Initializing collections...');
    expect(mongoClient.db().dropCollection).toHaveBeenCalledTimes(2);
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('users');
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('roles');
    expect(mongoClient.db().createCollection).toHaveBeenCalledTimes(3);
    expect(mongoClient.db().createCollection).toHaveBeenCalledWith('_config', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          patternProperties: {
            '^[A-Z0-9_]+$': {
              bsonType: 'string',
            },
          },
        },
      },
    });
    expect(mongoClient.db().collection('_config').insertOne).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('_config').insertOne).toHaveBeenCalledWith({});
  });
});
