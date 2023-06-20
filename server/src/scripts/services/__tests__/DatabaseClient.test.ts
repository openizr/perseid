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
import { type DataModel } from 'scripts/services/__mocks__/schema';

type TestDatabaseClient = DatabaseClient<DataModel> & {
  handleError: DatabaseClient<DataModel>['handleError'];
  formatInput: DatabaseClient<DataModel>['formatInput'];
  formatOutput: DatabaseClient<DataModel>['formatOutput'];
  createSchema: DatabaseClient<DataModel>['createSchema'];
  checkForeignIds: DatabaseClient<DataModel>['checkForeignIds'];
  checkReferencesTo: DatabaseClient<DataModel>['checkReferencesTo'];
  generateProjectionsFrom: DatabaseClient<DataModel>['generateProjectionsFrom'];
  getCollectionIndexedFields: DatabaseClient<DataModel>['getCollectionIndexedFields'];
  generateSearchPipelineFrom: DatabaseClient<DataModel>['generateSearchPipelineFrom'];
  generateSortingPipelineFrom: DatabaseClient<DataModel>['generateSortingPipelineFrom'];
  generateLookupsPipelineFrom: DatabaseClient<DataModel>['generateLookupsPipelineFrom'];
  generatePaginationPipelineFrom: DatabaseClient<DataModel>['generatePaginationPipelineFrom'];
  invertedRelationsPerCollection: DatabaseClient<DataModel>['invertedRelationsPerCollection'];
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
    vi.setSystemTime(new Date('2023-01-01'));
    delete process.env.NO_RESULT;
    delete process.env.VIEW_MODE;
    delete process.env.INTEGRITY_MODE;
    delete process.env.REFERENCES_MODE;
    delete process.env.REFERENCE_EXISTS;
    delete process.env.MISSING_FOREIGN_IDS;
    delete process.env.INTEGRITY_CHECKS_FAIL;

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
      arrayFive: [{ fieldOne: 'test' }, null],
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
    }, { type: 'object', fields: model.getCollection('test').fields })).toEqual({
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
      arrayFive: [{ fieldOne: 'test' }, null],
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

  test('[checkReferencesTo] resource is not referenced in collections', async () => {
    process.env.REFERENCES_MODE = 'true';
    await databaseClient.checkReferencesTo('otherExternalRelation', new Id('646b9be5e921d0ef42f8a141'));
    expect(mongoClient.db().collection('_config').aggregate).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('_config').aggregate).toHaveBeenCalledWith([
      { $limit: 1 },
      { $project: { _id: new ObjectId('646b9be5e921d0ef42f8a141') } },
      {
        $lookup: {
          from: 'test',
          as: 'test__arrayThree',
          foreignField: 'arrayThree',
          localField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'test',
          as: 'test__dynamicOne.^testTwo$',
          foreignField: 'dynamicOne.^testTwo$',
          localField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'externalRelation',
          as: 'externalRelation__relations',
          foreignField: 'relations',
          localField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
    ]);
  });

  test('[checkReferencesTo] resource is still referenced in collections', async () => {
    process.env.REFERENCES_MODE = 'true';
    process.env.REFERENCE_EXISTS = 'true';
    const id = new Id('646b9be5e921d0ef42f8a141');
    await expect(async () => {
      await databaseClient.checkReferencesTo('otherExternalRelation', id);
    }).rejects.toThrow(new DatabaseError('RESOURCE_REFERENCED', { collection: 'externalRelation' }));
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
    // Just to make sure schemas enumerations are not directly mutated by formatters.
    databaseClient.createSchema({ type: 'object', fields: model.getCollection('test2').fields });
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
      { key: { arrayThree: 1 } },
    ]);
  });

  test('[checkForeignIds] - all foreign ids are valid', async () => {
    await databaseClient.checkForeignIds(new Map([
      ['externalRelation', [
        {
          _id: [
            new Id('646b9be5e921d0ef42f8a147'),
            new Id('646b9be5e921d0ef42f8a142'),
            new Id('646b9be5e921d0ef42f8a143'),
            new Id('646b9be5e921d0ef42f8a141'),
            new Id('646b9be5e921d0ef42f8a146'),
          ],
        },
      ]],
    ]));
    expect(mongoClient.db().collection('_config').aggregate).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().collection('_config').aggregate).toHaveBeenCalledWith([
      { $limit: 1 },
      {
        $project: {
          externalRelation0Ids: [
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
          foreignField: '_id',
          as: 'externalRelation0',
          from: 'externalRelation',
          localField: 'externalRelation0Ids',
          pipeline: [{ $match: { _isDeleted: { $ne: true } } }, { $project: { _id: 1 } }],
        },
      },
    ]);
  });

  test('[checkForeignIds] - some foreign ids are missing', async () => {
    process.env.MISSING_FOREIGN_IDS = 'true';
    expect(async () => {
      await databaseClient.checkForeignIds(new Map([
        ['externalRelation', [{
          _id: [
            new Id('646b9be5e921d0ef42f8a148'),
            new Id('646b9be5e921d0ef42f8a142'),
          ],
        }],
        ],
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
      indexed: ['arrayThree'],
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
      arrayThree: 1,
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
    vi.useRealTimers();
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
    expect(databaseClient.invertedRelationsPerCollection).toEqual({
      externalRelation: new Map([
        [
          'test',
          [
            'arrayOne.dynamicObject.^testOne$',
            'arrayOne.dynamicObject.^testTwo$',
            'arrayOne.dynamicObject.^special(.*)$',
            'arrayTwo',
            'dynamicOne.^testOne$',
            'dynamicOne.^special(.*)$',
            'dynamicTwo.^testOne$',
          ],
        ],
      ]),
      otherExternalRelation: new Map([
        [
          'test',
          ['arrayThree', 'dynamicOne.^testTwo$'],
        ],
        [
          'externalRelation',
          ['relations'],
        ],
      ]),
      test: new Map(),
      roles: new Map(),
      users: new Map(),
    });
  });

  test('[list] no result', async () => {
    process.env.NO_RESULT = 'true';
    const response = await databaseClient.list('test', { limit: 0 });
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
    const response = await databaseClient.search('test', { query: { on: ['_id'], text: 'test' } }, {
      limit: 0,
    });
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
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      '[DatabaseClient][resetCollection] Resetting collection externalRelation...',
    );
    expect(mongoClient.db().dropCollection).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('externalRelation');
    expect(mongoClient.db().createCollection).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().createCollection).toHaveBeenCalledWith('externalRelation', {
      validator: {
        $jsonSchema: {
          bsonType: ['object', 'null'],
          additionalProperties: false,
          required: [
            '_id',
            'name',
            '_version',
            '_isDeleted',
            '_updatedBy',
            '_createdBy',
            '_updatedAt',
            '_createdAt',
            'relations',
          ],
          properties: {
            _id: { bsonType: ['objectId', 'null'] },
            name: { bsonType: ['string', 'null'] },
            _version: { bsonType: ['int', 'null'] },
            _isDeleted: { bsonType: ['bool', 'null'] },
            _createdAt: { bsonType: ['date', 'null'] },
            _updatedAt: { bsonType: ['date', 'null'] },
            _createdBy: { bsonType: ['objectId', 'null'] },
            _updatedBy: { bsonType: ['objectId', 'null'] },
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

  test('[updateCollection] collection exists', async () => {
    await databaseClient.updateCollection('externalRelation');
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      '[DatabaseClient][updateCollection] Updating collection externalRelation...',
    );
    expect(mongoClient.startSession).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().command).toHaveBeenCalledTimes(1);
    expect(mongoClient.db().command).toHaveBeenCalledWith({
      collMod: 'externalRelation',
      validationLevel: 'strict',
      validator: {
        $jsonSchema: {
          bsonType: ['object', 'null'],
          additionalProperties: false,
          required: [
            '_id',
            'name',
            '_version',
            '_isDeleted',
            '_updatedBy',
            '_createdBy',
            '_updatedAt',
            '_createdAt',
            'relations',
          ],
          properties: {
            _id: { bsonType: ['objectId', 'null'] },
            name: { bsonType: ['string', 'null'] },
            _version: { bsonType: ['int', 'null'] },
            _isDeleted: { bsonType: ['bool', 'null'] },
            _createdAt: { bsonType: ['date', 'null'] },
            _updatedAt: { bsonType: ['date', 'null'] },
            _createdBy: { bsonType: ['objectId', 'null'] },
            _updatedBy: { bsonType: ['objectId', 'null'] },
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
    expect(logger.info).toHaveBeenCalledTimes(8);
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][reset] Dropping database...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][reset] Re-creating database...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][reset] Initializing collections...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][resetCollection] Resetting collection users...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][resetCollection] Resetting collection roles...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][resetCollection] Resetting collection test...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][resetCollection] Resetting collection externalRelation...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][resetCollection] Resetting collection otherExternalRelation...');
    expect(mongoClient.db().dropCollection).toHaveBeenCalledTimes(5);
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('users');
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('roles');
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('test');
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('externalRelation');
    expect(mongoClient.db().dropCollection).toHaveBeenCalledWith('otherExternalRelation');
    expect(mongoClient.db().createCollection).toHaveBeenCalledTimes(6);
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

  test('[checkIntegrity] integrity checks fail', async () => {
    process.env.INTEGRITY_MODE = 'true';
    process.env.INTEGRITY_CHECKS_FAIL = 'true';
    const corruptedId = new Id('64723318e84f943f1ad6578b');
    await expect(async () => {
      await databaseClient.checkIntegrity();
    }).rejects.toThrow(new DatabaseError('FAILED_INTEGRITY_CHECKS'));
    expect(logger.info).toHaveBeenCalledWith({
      users: { AUTOMATIC_FIELDS: [corruptedId, corruptedId], NO_RESOURCE: [corruptedId] },
      roles: { AUTOMATIC_FIELDS: [corruptedId], NO_RESOURCE: [corruptedId] },
      test: { AUTOMATIC_FIELDS: [corruptedId], NO_RESOURCE: [corruptedId] },
      externalRelation: {
        AUTOMATIC_FIELDS: [corruptedId],
        NO_RESOURCE: [
          corruptedId,
          corruptedId,
        ],
      },
      otherExternalRelation: { AUTOMATIC_FIELDS: [corruptedId], NO_RESOURCE: [corruptedId] },
    });
  });

  test('[checkIntegrity] integrity checks pass', async () => {
    process.env.INTEGRITY_MODE = 'true';
    await databaseClient.checkIntegrity();
    expect(logger.info).toHaveBeenCalledTimes(7);
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][checkIntegrity] Checking integrity for collection users...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][checkIntegrity] Checking integrity for collection roles...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][checkIntegrity] Checking integrity for collection test...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][checkIntegrity] Checking integrity for collection externalRelation...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][checkIntegrity] Checking integrity for collection otherExternalRelation...');
    expect(logger.info).toHaveBeenCalledWith('[DatabaseClient][checkIntegrity] Integrity checks results:');
    expect(logger.info).toHaveBeenCalledWith({
      users: { AUTOMATIC_FIELDS: [], NO_RESOURCE: [] },
      roles: { AUTOMATIC_FIELDS: [], NO_RESOURCE: [] },
      test: { AUTOMATIC_FIELDS: [], NO_RESOURCE: [] },
      externalRelation: { AUTOMATIC_FIELDS: [], NO_RESOURCE: [] },
      otherExternalRelation: { AUTOMATIC_FIELDS: [], NO_RESOURCE: [] },
    });
    expect(mongoClient.db().collection('users').aggregate).toHaveBeenCalledTimes(3);
    expect(mongoClient.db().collection('users').aggregate).toHaveBeenCalledWith([
      { $match: { $or: [] } },
      { $project: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('users').aggregate).toHaveBeenCalledWith([
      { $project: {} },
      { $project: {} },
      { $project: {} },
      { $match: { $or: [] } },
      { $project: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('roles').aggregate).toHaveBeenCalledTimes(2);
    expect(mongoClient.db().collection('roles').aggregate).toHaveBeenCalledWith([
      { $match: { $or: [] } },
      { $project: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('roles').aggregate).toHaveBeenCalledWith([
      { $project: {} },
      { $project: {} },
      { $project: {} },
      { $match: { $or: [] } },
      { $project: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledTimes(2);
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledWith([
      { $match: { $or: [] } },
      { $project: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledWith([
      {
        $project: {
          'arrayOne__dynamicObject__^testOne$': { $ifNull: ['$arrayOne.dynamicObject.^testOne$', []] },
          'arrayOne__dynamicObject__^testTwo$': { $ifNull: ['$arrayOne.dynamicObject.^testTwo$', []] },
          'arrayOne__dynamicObject__^special(__*)$': { $ifNull: ['$arrayOne.dynamicObject.^special(.*)$', []] },
          arrayTwo: { $ifNull: ['$arrayTwo', []] },
          'dynamicOne__^testOne$': { $ifNull: ['$dynamicOne.^testOne$', []] },
          'dynamicOne__^special(__*)$': { $ifNull: ['$dynamicOne.^special(.*)$', []] },
          'dynamicTwo__^testOne$': { $ifNull: ['$dynamicTwo.^testOne$', []] },
          arrayThree: { $ifNull: ['$arrayThree', []] },
          'dynamicOne__^testTwo$': { $ifNull: ['$dynamicOne.^testTwo$', []] },
        },
      },
      {
        $project: {
          'arrayOne__dynamicObject__^testOne$': {
            $cond: {
              if: {
                $eq: [
                  { $type: '$arrayOne__dynamicObject__^testOne$' },
                  'array',
                ],
              },
              then: '$arrayOne__dynamicObject__^testOne$',
              else: ['$arrayOne__dynamicObject__^testOne$'],
            },
          },
          'arrayOne__dynamicObject__^testTwo$': {
            $cond: {
              if: {
                $eq: [
                  { $type: '$arrayOne__dynamicObject__^testTwo$' },
                  'array',
                ],
              },
              then: '$arrayOne__dynamicObject__^testTwo$',
              else: ['$arrayOne__dynamicObject__^testTwo$'],
            },
          },
          'arrayOne__dynamicObject__^special(__*)$': {
            $cond: {
              if: {
                $eq: [
                  { $type: '$arrayOne__dynamicObject__^special(__*)$' },
                  'array',
                ],
              },
              then: '$arrayOne__dynamicObject__^special(__*)$',
              else: ['$arrayOne__dynamicObject__^special(__*)$'],
            },
          },
          arrayTwo: {
            $cond: {
              if: { $eq: [{ $type: '$arrayTwo' }, 'array'] },
              then: '$arrayTwo',
              else: ['$arrayTwo'],
            },
          },
          'dynamicOne__^testOne$': {
            $cond: {
              if: { $eq: [{ $type: '$dynamicOne__^testOne$' }, 'array'] },
              then: '$dynamicOne__^testOne$',
              else: ['$dynamicOne__^testOne$'],
            },
          },
          'dynamicOne__^special(__*)$': {
            $cond: {
              if: {
                $eq: [{ $type: '$dynamicOne__^special(__*)$' }, 'array'],
              },
              then: '$dynamicOne__^special(__*)$',
              else: ['$dynamicOne__^special(__*)$'],
            },
          },
          'dynamicTwo__^testOne$': {
            $cond: {
              if: { $eq: [{ $type: '$dynamicTwo__^testOne$' }, 'array'] },
              then: '$dynamicTwo__^testOne$',
              else: ['$dynamicTwo__^testOne$'],
            },
          },
          arrayThree: {
            $cond: {
              if: { $eq: [{ $type: '$arrayThree' }, 'array'] },
              then: '$arrayThree',
              else: ['$arrayThree'],
            },
          },
          'dynamicOne__^testTwo$': {
            $cond: {
              if: { $eq: [{ $type: '$dynamicOne__^testTwo$' }, 'array'] },
              then: '$dynamicOne__^testTwo$',
              else: ['$dynamicOne__^testTwo$'],
            },
          },
        },
      },
      {
        $project: {
          'arrayOne__dynamicObject__^testOne$': { $setUnion: ['$arrayOne__dynamicObject__^testOne$', []] },
          'arrayOne__dynamicObject__^testTwo$': { $setUnion: ['$arrayOne__dynamicObject__^testTwo$', []] },
          'arrayOne__dynamicObject__^special(__*)$': {
            $setUnion: ['$arrayOne__dynamicObject__^special(__*)$', []],
          },
          arrayTwo: { $setUnion: ['$arrayTwo', []] },
          'dynamicOne__^testOne$': { $setUnion: ['$dynamicOne__^testOne$', []] },
          'dynamicOne__^special(__*)$': { $setUnion: ['$dynamicOne__^special(__*)$', []] },
          'dynamicTwo__^testOne$': { $setUnion: ['$dynamicTwo__^testOne$', []] },
          arrayThree: { $setUnion: ['$arrayThree', []] },
          'dynamicOne__^testTwo$': { $setUnion: ['$dynamicOne__^testTwo$', []] },
        },
      },
      {
        $lookup: {
          from: 'externalRelation',
          as: '__arrayOne__dynamicObject__^testOne$',
          localField: 'arrayOne__dynamicObject__^testOne$',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'externalRelation',
          as: '__arrayOne__dynamicObject__^testTwo$',
          localField: 'arrayOne__dynamicObject__^testTwo$',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'externalRelation',
          as: '__arrayOne__dynamicObject__^special(__*)$',
          localField: 'arrayOne__dynamicObject__^special(__*)$',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'externalRelation',
          as: '__arrayTwo',
          localField: 'arrayTwo',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'externalRelation',
          as: '__dynamicOne__^testOne$',
          localField: 'dynamicOne__^testOne$',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'externalRelation',
          as: '__dynamicOne__^special(__*)$',
          localField: 'dynamicOne__^special(__*)$',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'externalRelation',
          as: '__dynamicTwo__^testOne$',
          localField: 'dynamicTwo__^testOne$',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'otherExternalRelation',
          as: '__arrayThree',
          localField: 'arrayThree',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'otherExternalRelation',
          as: '__dynamicOne__^testTwo$',
          localField: 'dynamicOne__^testTwo$',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $match: {
          $or: [
            {
              $expr: {
                $ne: [
                  { $size: '$__arrayOne__dynamicObject__^testOne$' },
                  { $size: '$arrayOne__dynamicObject__^testOne$' },
                ],
              },
            },
            {
              $expr: {
                $ne: [
                  { $size: '$__arrayOne__dynamicObject__^testTwo$' },
                  { $size: '$arrayOne__dynamicObject__^testTwo$' },
                ],
              },
            },
            {
              $expr: {
                $ne: [
                  { $size: '$__arrayOne__dynamicObject__^special(__*)$' },
                  { $size: '$arrayOne__dynamicObject__^special(__*)$' },
                ],
              },
            },
            {
              $expr: {
                $ne: [{ $size: '$__arrayTwo' }, { $size: '$arrayTwo' }],
              },
            },
            {
              $expr: {
                $ne: [
                  { $size: '$__dynamicOne__^testOne$' },
                  { $size: '$dynamicOne__^testOne$' },
                ],
              },
            },
            {
              $expr: {
                $ne: [
                  { $size: '$__dynamicOne__^special(__*)$' },
                  { $size: '$dynamicOne__^special(__*)$' },
                ],
              },
            },
            {
              $expr: {
                $ne: [
                  { $size: '$__dynamicTwo__^testOne$' },
                  { $size: '$dynamicTwo__^testOne$' },
                ],
              },
            },
            {
              $expr: {
                $ne: [
                  { $size: '$__arrayThree' },
                  { $size: '$arrayThree' },
                ],
              },
            },
            {
              $expr: {
                $ne: [
                  { $size: '$__dynamicOne__^testTwo$' },
                  { $size: '$dynamicOne__^testTwo$' },
                ],
              },
            },
          ],
        },
      },
      { $project: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('externalRelation').aggregate).toHaveBeenCalledTimes(3);
    expect(mongoClient.db().collection('externalRelation').aggregate).toHaveBeenCalledWith([
      {
        $match: {
          $or: [
            { _isDeleted: true, _updatedAt: null },
            {
              $or: [
                { _createdAt: { $lt: new Date('2021-01-01') } },
                { _createdAt: { $gte: new Date('2023-01-01T00:00:00.000Z') } },
              ],
            },
            {
              $and: [
                { _updatedAt: { $ne: null } },
                {
                  $or: [
                    { _updatedAt: { $gte: new Date('2023-01-01T00:00:00.000Z') } },
                    {
                      $expr: { $lte: ['$_updatedAt', '$_createdAt'] },
                    },
                  ],
                },
              ],
            },
            { _updatedAt: { $eq: null }, _updatedBy: { $ne: null } },
            { _updatedBy: { $eq: null }, _updatedAt: { $ne: null } },
          ],
        },
      },
      { $project: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('externalRelation').aggregate).toHaveBeenCalledWith([
      {
        $project: { relations: { $ifNull: ['$relations', []] } },
      },
      {
        $project: {
          relations: {
            $cond: {
              if: { $eq: [{ $type: '$relations' }, 'array'] },
              then: '$relations',
              else: ['$relations'],
            },
          },
        },
      },
      {
        $project: { relations: { $setUnion: ['$relations', []] } },
      },
      {
        $lookup: {
          from: 'otherExternalRelation',
          as: '__relations',
          localField: 'relations',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $match: {
          $or: [
            {
              $expr: {
                $ne: [{ $size: '$__relations' }, { $size: '$relations' }],
              },
            },
          ],
        },
      },
      { $project: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('otherExternalRelation').aggregate).toHaveBeenCalledTimes(2);
    expect(mongoClient.db().collection('otherExternalRelation').aggregate).toHaveBeenCalledWith([
      { $match: { $or: [] } },
      { $project: { _id: 1 } },
    ]);
    expect(mongoClient.db().collection('otherExternalRelation').aggregate).toHaveBeenCalledWith([
      { $project: {} },
      { $project: {} },
      { $project: {} },
      { $match: { $or: [] } },
      { $project: { _id: 1 } },
    ]);
  });
});
