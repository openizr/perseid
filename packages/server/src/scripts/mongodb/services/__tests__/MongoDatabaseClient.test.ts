/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Db,
  Binary,
  ObjectId,
  MongoClient,
  MongoServerError,
} from 'mongodb';
import Model from 'scripts/core/services/Model';
import Logger from 'scripts/core/services/Logger';
import { type ResourceSchema, Id } from '@perseid/core';
import DatabaseError from 'scripts/core/errors/Database';
import CacheClient from 'scripts/core/services/CacheClient';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';
import MongoDatabaseClient from 'scripts/mongodb/services/MongoDatabaseClient';
import type { FormattedQuery } from 'scripts/core/services/AbstractDatabaseClient';

type TestMongoDatabaseClient = MongoDatabaseClient<DataModel> & {
  isConnected: MongoDatabaseClient<DataModel>['isConnected'];
  handleError: MongoDatabaseClient<DataModel>['handleError'];
  parseFields: MongoDatabaseClient<DataModel>['parseFields'];
  generateQuery: MongoDatabaseClient<DataModel>['generateQuery'];
  formatResources: MongoDatabaseClient<DataModel>['formatResources'];
  structurePayload: MongoDatabaseClient<DataModel>['structurePayload'];
  resourcesMetadata: MongoDatabaseClient<DataModel>['resourcesMetadata'];
  checkReferencesTo: MongoDatabaseClient<DataModel>['checkReferencesTo'];
  databaseConnection: MongoDatabaseClient<DataModel>['databaseConnection'];
  generateResourceMetadata: MongoDatabaseClient<DataModel>['generateResourceMetadata'];
};

describe('mongodb/services/MongoDatabaseClient', () => {
  vi.mock('mongodb');
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/core/services/AbstractDatabaseClient');

  let databaseClient: TestMongoDatabaseClient;
  const mongoClient = new MongoClient('', {});
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const cacheClient = new CacheClient({ cachePath: '/.cache', connectTimeout: 0 });
  const model = new Model<DataModel>({} as Record<keyof DataModel, ResourceSchema<DataModel>>);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2023-01-01'));
    delete process.env.NO_RESULT;
    delete process.env.DATABASE_ERROR;
    delete process.env.REFERENCES_MODE;
    delete process.env.REFERENCE_EXISTS;
    delete process.env.MISSING_FOREIGN_IDS;

    databaseClient = new MongoDatabaseClient<DataModel>(model, logger, cacheClient, {
      protocol: 'mongo+srv',
      host: 'localhost',
      port: 27018,
      user: 'test',
      password: 'test',
      database: 'test',
      connectTimeout: 0,
      connectionLimit: 0,
    }) as TestMongoDatabaseClient;
  });

  test('[generateResourceMetadata]', () => {
    expect(databaseClient.resourcesMetadata).toEqual({
      test: {
        constraints: [],
        subStructures: [],
        structure: 'test',
        subStructuresPerPath: {},
        indexes: [
          { path: '_isDeleted', unique: false },
          { path: 'indexedString', unique: false },
          { path: 'objectOne.optionalRelations', unique: false },
          { path: 'objectOne.objectTwo.optionalIndexedString', unique: true },
          { path: 'objectOne.objectTwo.optionalNestedArray.data.optionalInteger', unique: false },
          { path: 'objectOne.objectTwo.optionalNestedArray.data.flatArray', unique: false },
        ],
        invertedRelations: new Map([['otherTest', ['optionalRelation', 'data.optionalRelation']]]),
        fields: {
          properties: {
            _id: { bsonType: ['objectId'] },
            _isDeleted: { bsonType: ['bool'] },
            indexedString: { bsonType: ['string'] },
            objectOne: {
              properties: {
                boolean: { bsonType: ['bool'] },
                optionalRelations: {
                  bsonType: ['array', 'null'],
                  items: { bsonType: ['objectId', 'null'] },
                },
                objectTwo: {
                  properties: {
                    optionalIndexedString: { bsonType: ['string', 'null'] },
                    optionalNestedArray: {
                      bsonType: ['array', 'null'],
                      items: {
                        properties: {
                          data: {
                            properties: {
                              optionalInteger: { bsonType: ['int', 'null'] },
                              flatArray: {
                                bsonType: ['array'],
                                items: { bsonType: ['string', 'null'] },
                              },
                              nestedArray: {
                                bsonType: ['array'],
                                items: {
                                  properties: {
                                    optionalRelation: { bsonType: ['objectId', 'null'] },
                                    key: { bsonType: ['string'] },
                                  },
                                  additionalProperties: false,
                                  required: ['optionalRelation', 'key'],
                                  bsonType: ['object'],
                                },
                              },
                            },
                            additionalProperties: false,
                            required: [
                              'optionalInteger',
                              'flatArray',
                              'nestedArray',
                            ],
                            bsonType: ['object'],
                          },
                        },
                        additionalProperties: false,
                        required: ['data'],
                        bsonType: ['object', 'null'],
                      },
                    },
                  },
                  additionalProperties: false,
                  required: ['optionalIndexedString', 'optionalNestedArray'],
                  bsonType: ['object'],
                },
              },
              additionalProperties: false,
              required: ['boolean', 'optionalRelations', 'objectTwo'],
              bsonType: ['object'],
            },
          },
          additionalProperties: false,
          required: ['_id', '_isDeleted', 'indexedString', 'objectOne'],
          bsonType: ['object'],
        },
      },
      otherTest: {
        indexes: [
          { path: '_createdAt', unique: false },
          { path: 'optionalRelation', unique: false },
          { path: 'data.optionalRelation', unique: false },
          { path: 'data.optionalFlatArray', unique: true },
        ],
        constraints: [],
        subStructures: [],
        structure: 'otherTest',
        subStructuresPerPath: {},
        invertedRelations: new Map([
          ['test', [
            'objectOne.optionalRelations',
            'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation',
          ]],
        ]),
        fields: {
          properties: {
            _id: { bsonType: ['objectId'] },
            _createdAt: { bsonType: ['date'] },
            binary: { bsonType: ['binData'] },
            optionalRelation: { bsonType: ['objectId', 'null'] },
            data: {
              properties: {
                optionalRelation: { bsonType: ['objectId', 'null'] },
                optionalFlatArray: {
                  bsonType: ['array', 'null'],
                  items: { bsonType: ['string'] },
                },
              },
              additionalProperties: false,
              required: ['optionalRelation', 'optionalFlatArray'],
              bsonType: ['object'],
            },
          },
          additionalProperties: false,
          required: ['_id', '_createdAt', 'binary', 'optionalRelation', 'data'],
          bsonType: ['object'],
        },
      },
    });
  });

  describe('[parseFields]', () => {
    test('unknown field error', () => {
      expect(() => (
        databaseClient.parseFields('otherTest', new Set([
          'data.invalid_field',
        ]), 1)
      )).toThrow(new DatabaseError('UNKNOWN_FIELD', { path: 'data.invalid_field' }));
    });

    test('maximum depth exceeded error', () => {
      expect(() => (
        databaseClient.parseFields('otherTest', new Set([
          'data.optionalRelation._id',
        ]), 1)
      )).toThrow(new DatabaseError('MAXIMUM_DEPTH_EXCEEDED', { path: 'data.optionalRelation._id' }));
    });

    test('invalid field error', () => {
      expect(() => (
        databaseClient.parseFields('test', new Set([]), 1, {
          query: null,
          filters: {
            'objectOne.objectTwo.optionalNestedArray': false,
          },
        })
      )).toThrow(new DatabaseError('INVALID_FIELD', { path: 'objectOne.objectTwo.optionalNestedArray' }));
    });

    test('unindexed field error', () => {
      expect(() => (
        databaseClient.parseFields('test', new Set([]), 1, {
          query: null,
          filters: {
            'objectOne.boolean': false,
          },
        })
      )).toThrow(new DatabaseError('UNINDEXED_FIELD', { path: 'objectOne.boolean' }));
    });

    test('unsortable field error', () => {
      expect(() => (
        databaseClient.parseFields('otherTest', new Set([]), 1, null, { 'data.optionalFlatArray': 1 })
      )).toThrow(new DatabaseError('UNSORTABLE_FIELD', { path: 'data.optionalFlatArray' }));
    });

    test('existing fields', () => {
      expect(databaseClient.parseFields('test', new Set([
        '_id',
        '_isDeleted',
        'indexedString',
        'objectOne.objectTwo.optionalIndexedString',
        'objectOne.optionalRelations.data.optionalFlatArray',
        'objectOne.objectTwo.optionalNestedArray.data.flatArray',
        'objectOne.objectTwo.optionalNestedArray.data.optionalInteger',
        'objectOne.objectTwo.optionalNestedArray.data.nestedArray.key',
        'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation',
      ]), 10, {
        query: {
          on: new Set([
            'objectOne.objectTwo.optionalIndexedString',
            'objectOne.objectTwo.optionalNestedArray.data.flatArray',
          ]),
          text: 'test',
        },
        filters: {
          'objectOne.optionalRelations': new Id('000000000000000000000001'),
          'objectOne.objectTwo.optionalNestedArray.data.optionalInteger': 3,
          'objectOne.objectTwo.optionalIndexedString': new Date(1719399429820),
          'objectOne.optionalRelations.data.optionalRelation.objectOne.objectTwo.optionalIndexedString': 'test',
        },
      }, { indexedString: -1 })).toEqual({
        formattedQuery: {
          structure: 'test',
          sort: { indexedString: -1 },
          localField: null,
          foreignField: null,
          fields: {
            _id: '$_id',
            _isDeleted: '$_isDeleted',
            indexedString: '$indexedString',
            objectOne: '$objectOne',
            _objectOne_optionalRelations: '$_objectOne_optionalRelations',
          },
          match: {
            query: [
              { 'objectOne.objectTwo.optionalNestedArray.data.flatArray': { $regex: /(?=.*test)/i } },
              { 'objectOne.objectTwo.optionalIndexedString': { $regex: /(?=.*test)/i } },
            ],
            filters: [
              { 'objectOne.objectTwo.optionalIndexedString': { $eq: new Date('2024-06-26T10:57:09.820Z') } },
              { 'objectOne.objectTwo.optionalNestedArray.data.optionalInteger': { $eq: 3 } },
              { 'objectOne.optionalRelations': { $eq: new ObjectId('000000000000000000000001') } },
              { '_objectOne_optionalRelations._data_optionalRelation.objectOne.objectTwo.optionalIndexedString': { $eq: 'test' } },
            ],
          },
          lookups: {
            _objectOne_optionalRelations: {
              sort: null,
              match: null,
              structure: 'otherTest',
              foreignField: '_id',
              localField: 'objectOne.optionalRelations',
              fields: {
                _id: '$_id',
                data: '$data',
                _data_optionalRelation: '$_data_optionalRelation',
              },
              lookups: {
                _data_optionalRelation: {
                  sort: null,
                  match: null,
                  lookups: {},
                  structure: 'test',
                  foreignField: '_id',
                  localField: 'data.optionalRelation',
                  fields: { _id: '$_id', objectOne: '$objectOne' },
                },
              },
            },
          },
        },
        projections: {
          _id: 1,
          _isDeleted: 1,
          indexedString: 1,
          objectOne: {
            objectTwo: {
              optionalIndexedString: 1,
              optionalNestedArray: {
                data: {
                  flatArray: 1,
                  optionalInteger: 1,
                  nestedArray: { key: 1, optionalRelation: 1 },
                },
              },
            },
            optionalRelations: {
              _id: 1,
              data: {
                optionalFlatArray: 1,
                optionalRelation: {
                  _id: 1,
                  objectOne: { objectTwo: { optionalIndexedString: 1 } },
                },
              },
            },
          },
        },
      });

      expect(databaseClient.parseFields('otherTest', new Set([
        '_id',
        'data.optionalFlatArray',
        'data.optionalRelation.indexedString',
      ]), 10, {
        query: null,
        filters: {
          _createdAt: [new Date(1719399428820)],
          'data.optionalRelation': ['000000000000000000000002'],
          _id: [new Id('000000000000000000000001')],
          'data.optionalFlatArray': [new Date(1719399428820), new Date(1719399429820)],
        },
      })).toEqual({
        formattedQuery: {
          structure: 'otherTest',
          lookups: {
            _data_optionalRelation: {
              sort: null,
              match: null,
              lookups: {},
              foreignField: '_id',
              localField: 'data.optionalRelation',
              fields: { _id: '$_id', indexedString: '$indexedString' },
              structure: 'test',
            },
          },
          sort: null,
          match: {
            query: [],
            filters: [
              { _id: { $eq: new ObjectId('000000000000000000000001') } },
              {
                'data.optionalFlatArray': {
                  $in: [new Date('2024-06-26T10:57:08.820Z'), new Date('2024-06-26T10:57:09.820Z')],
                },
              },
              { _createdAt: { $gte: new Date('2024-06-26T10:57:08.820Z') } },
              { 'data.optionalRelation': { $eq: new ObjectId('000000000000000000000002') } },
            ],
          },
          localField: null,
          foreignField: null,
          fields: {
            _id: '$_id',
            data: '$data',
            _createdAt: '$_createdAt',
            _data_optionalRelation: '$_data_optionalRelation',
          },
        },
        projections: {
          _id: 1,
          _createdAt: 1,
          data: {
            optionalFlatArray: 1,
            optionalRelation: { _id: 1, indexedString: 1 },
          },
        },
      });
      databaseClient.parseFields('otherTest', new Set([]), 10, {
        query: null,
        filters: { _createdAt: '2024-06-26T10:57:09.820Z' },
      });
      databaseClient.parseFields('otherTest', new Set([]), 10, {
        query: null,
        filters: { _createdAt: ['2024-06-26T10:57:09.820Z', '2024-06-26T10:57:09.820Z'] },
      });
      databaseClient.parseFields('otherTest', new Set([]), 10, {
        query: null,
        filters: { _createdAt: [new Date('2024-06-26T10:57:09.820Z'), new Date('2024-06-26T10:57:09.820Z')] },
      });
      databaseClient.parseFields('otherTest', new Set([]), 10, {
        query: null,
        filters: {
          _createdAt: [
            new Date('2024-06-26T10:57:09.820Z'),
            new Date('2024-06-26T10:57:09.820Z'),
            '2024-06-26T10:57:09.820Z',
          ],
        },
      });

      expect(databaseClient.parseFields('otherTest', new Set([]), 10)).toEqual({
        formattedQuery: {
          sort: null,
          localField: null,
          foreignField: null,
          structure: 'otherTest',
          fields: { _id: '$_id' },
          lookups: {},
          match: null,
        },
        projections: { _id: 1 },
      });
    });
  });

  test('[generateQuery]', () => {
    expect(databaseClient.generateQuery('test', {
      structure: 'test',
      sort: { indexedString: -1 },
      localField: null,
      foreignField: null,
      fields: {
        _id: '$_id',
        _isDeleted: '$_isDeleted',
        indexedString: '$indexedString',
        objectOne: '$objectOne',
        _objectOne_optionalRelations: '$_objectOne_optionalRelations',
      },
      match: {
        query: [
          { 'objectOne.objectTwo.optionalNestedArray.data.flatArray': { $regex: /(?=.*test)/i } },
          { 'objectOne.objectTwo.optionalIndexedString': { $regex: /(?=.*test)/i } },
        ],
        filters: [
          { 'objectOne.objectTwo.optionalIndexedString': { $eq: new Date('2024-06-26T10:57:09.820Z') } },
          { 'objectOne.objectTwo.optionalNestedArray.data.optionalInteger': { $eq: 3 } },
          { 'objectOne.optionalRelations': { $eq: new ObjectId('000000000000000000000001') } },
          { '_objectOne_optionalRelations._data_optionalRelation.objectOne.objectTwo.optionalIndexedString': { $eq: 'test' } },
        ],
      },
      lookups: {
        _objectOne_optionalRelations: {
          sort: null,
          match: null,
          structure: 'otherTest',
          foreignField: '_id',
          localField: 'objectOne.optionalRelations',
          fields: {
            _id: '$_id',
            data: '$data',
            _data_optionalRelation: '$_data_optionalRelation',
          },
          lookups: {
            _data_optionalRelation: {
              sort: null,
              match: null,
              lookups: {},
              structure: 'test',
              foreignField: '_id',
              localField: 'data.optionalRelation',
              fields: { _id: '$_id', objectOne: '$objectOne' },
            },
          },
        },
      },
    })).toEqual([
      {
        $lookup: {
          from: 'otherTest',
          foreignField: '_id',
          as: '_objectOne_optionalRelations',
          localField: 'objectOne.optionalRelations',
          pipeline: [
            {
              $lookup: {
                from: 'test',
                as: '_data_optionalRelation',
                localField: 'data.optionalRelation',
                foreignField: '_id',
                pipeline: [
                  { $project: { _id: '$_id', objectOne: '$objectOne' } },
                ],
              },
            },
            {
              $project: {
                _id: '$_id',
                data: '$data',
                _data_optionalRelation: '$_data_optionalRelation',
              },
            },
          ],
        },
      },
      {
        $match: {
          $and: [
            { 'objectOne.objectTwo.optionalIndexedString': { $eq: new Date('2024-06-26T10:57:09.820Z') } },
            { 'objectOne.objectTwo.optionalNestedArray.data.optionalInteger': { $eq: 3 } },
            { 'objectOne.optionalRelations': { $eq: new ObjectId('000000000000000000000001') } },
            { '_objectOne_optionalRelations._data_optionalRelation.objectOne.objectTwo.optionalIndexedString': { $eq: 'test' } },
            {
              $or: [
                { 'objectOne.objectTwo.optionalNestedArray.data.flatArray': { $regex: /(?=.*test)/i } },
                { 'objectOne.objectTwo.optionalIndexedString': { $regex: /(?=.*test)/i } },
              ],
            },
          ],
        },
      },
      { $sort: { indexedString: -1 } },
      {
        $project: {
          _id: '$_id',
          objectOne: '$objectOne',
          _isDeleted: '$_isDeleted',
          indexedString: '$indexedString',
          _objectOne_optionalRelations: '$_objectOne_optionalRelations',
        },
      },
    ]);

    expect(databaseClient.generateQuery('otherTest', {
      structure: 'otherTest',
      lookups: {
        _data_optionalRelation: {
          sort: null,
          match: null,
          lookups: {},
          foreignField: '_id',
          localField: 'data.optionalRelation',
          fields: { _id: '$_id', indexedString: '$indexedString' },
          structure: 'test',
        },
      },
      sort: null,
      match: {
        query: [],
        filters: [
          { _id: { $eq: new ObjectId('000000000000000000000001') } },
          {
            'data.optionalFlatArray': {
              $gte: new Date('2024-06-26T10:57:08.820Z'),
              $lte: new Date('2024-06-26T10:57:09.820Z'),
            },
          },
          { 'data.optionalRelation': { $eq: new ObjectId('000000000000000000000002') } },
        ],
      },
      localField: null,
      foreignField: null,
      fields: {
        _id: '$_id',
        data: '$data',
        _data_optionalRelation: '$_data_optionalRelation',
      },
    })).toEqual([
      {
        $lookup: {
          as: '_data_optionalRelation',
          from: 'test',
          localField: 'data.optionalRelation',
          foreignField: '_id',
          pipeline: [{ $project: { _id: '$_id', indexedString: '$indexedString' } }],
        },
      },
      {
        $match: {
          $and: [
            { _id: { $eq: new ObjectId('000000000000000000000001') } },
            {
              'data.optionalFlatArray': {
                $gte: new Date('2024-06-26T10:57:08.820Z'),
                $lte: new Date('2024-06-26T10:57:09.820Z'),
              },
            },
            { 'data.optionalRelation': { $eq: new ObjectId('000000000000000000000002') } },
          ],
        },
      },
      {
        $project: {
          _id: '$_id',
          data: '$data',
          _data_optionalRelation: '$_data_optionalRelation',
        },
      },
    ]);
  });

  describe('[structurePayload]', () => {
    test('unknown field error', () => {
      expect(() => (
        databaseClient.structurePayload('test', new Id('000000000000000000000001'), {
          unknown: 'test',
        } as unknown as DataModel['test'], 'CREATE')
      )).toThrow(new DatabaseError('UNKNOWN_FIELD', { path: 'unknown' }));
    });

    test('missing field error', () => {
      expect(() => (
        databaseClient.structurePayload('test', new Id('000000000000000000000001'), {}, 'CREATE')
      )).toThrow(new DatabaseError('MISSING_FIELD', { path: '_id' }));
    });

    test('CREATE mode', () => {
      expect(databaseClient.structurePayload('test', new Id('000000000000000000000001'), {
        _id: new Id('000000000000000000000001'),
        _isDeleted: false,
        indexedString: 'test',
        objectOne: {
          boolean: true,
          objectTwo: {
            optionalIndexedString: 'test1',
            optionalNestedArray: [
              null,
              {
                data: {
                  flatArray: ['test2', null, 'test3'],
                  optionalInteger: null,
                  nestedArray: [
                    { key: 'test4', optionalRelation: new Id('000000000000000000000022') },
                    { key: 'test5', optionalRelation: null },
                  ],
                },
              },
              {
                data: {
                  flatArray: ['test6', null, 'test7'],
                  optionalInteger: 1,
                  nestedArray: [
                    { key: 'test8', optionalRelation: new Id('000000000000000000000023') },
                  ],
                },
              },
              null,
            ],
          },
          optionalRelations: [null],
        },
      }, 'CREATE')).toEqual({
        test: [{
          _id: new ObjectId('000000000000000000000001'),
          _isDeleted: false,
          indexedString: 'test',
          objectOne: {
            boolean: true,
            objectTwo: {
              optionalIndexedString: 'test1',
              optionalNestedArray: [
                null,
                {
                  data: {
                    flatArray: ['test2', null, 'test3'],
                    optionalInteger: null,
                    nestedArray: [
                      { key: 'test4', optionalRelation: new ObjectId('000000000000000000000022') },
                      { key: 'test5', optionalRelation: null },
                    ],
                  },
                },
                {
                  data: {
                    flatArray: ['test6', null, 'test7'],
                    optionalInteger: 1,
                    nestedArray: [
                      { key: 'test8', optionalRelation: new ObjectId('000000000000000000000023') },
                    ],
                  },
                },
                null,
              ],
            },
            optionalRelations: [null],
          },
        }],
      });

      expect(databaseClient.structurePayload('otherTest', new Id('000000000000000000000001'), {
        _id: new Id('000000000000000000000001'),
        _createdAt: new Date('2023-01-01'),
        binary: new ArrayBuffer(10),
        optionalRelation: null,
        data: {
          optionalFlatArray: null,
          optionalRelation: new Id('6672a3e15169f0ba5b26d422'),
        },
      }, 'CREATE')).toEqual({
        otherTest: [
          {
            _id: new ObjectId('000000000000000000000001'),
            _createdAt: new Date('2023-01-01'),
            binary: new Binary(),
            optionalRelation: null,
            data: {
              optionalFlatArray: null,
              optionalRelation: new ObjectId('6672a3e15169f0ba5b26d422'),
            },
          },
        ],
      });
    });

    test('UPDATE mode', () => {
      expect(databaseClient.structurePayload('test', new Id('000000000000000000000001'), {
        objectOne: {
          optionalRelations: [new Id('000000000000000000000041'), null, new Id('000000000000000000000042')],
          objectTwo: {
            optionalNestedArray: null,
          },
        },
      }, 'UPDATE')).toEqual({
        test: [
          {
            'objectOne.objectTwo.optionalNestedArray': null,
            'objectOne.optionalRelations': [
              new ObjectId('000000000000000000000041'),
              null,
              new ObjectId('000000000000000000000042'),
            ],
          },
        ],
      });
    });
  });

  test('[formatResources]', () => {
    expect(databaseClient.formatResources('test', [{
      _id: new ObjectId('000000000000000000000001'),
      _isDeleted: true,
      indexedString: 'test',
      objectOne: {
        boolean: true,
        objectTwo: {
          optionalIndexedString: 'test1',
          optionalNestedArray: [
            null,
            {
              data: {
                flatArray: ['test2', null, 'test3'],
                optionalInteger: null,
                nestedArray: [
                  { key: 'test4', optionalRelation: new ObjectId('000000000000000000000022') },
                  { key: 'test5', optionalRelation: null },
                  { key: 'test6', optionalRelation: new ObjectId('000000000000000000000023') },
                ],
              },
            },
            {
              data: {
                flatArray: ['test6', null, 'test7'],
                optionalInteger: 1,
                nestedArray: [
                  { key: 'test8', optionalRelation: new ObjectId('000000000000000000000023') },
                ],
              },
            },
            null,
          ],
        },
        optionalRelations: [
          new ObjectId('000000000000000000000002'),
          null,
          new ObjectId('000000000000000000000003'),
        ],
      },
      _objectOne_optionalRelations: [
        {
          _id: new ObjectId('000000000000000000000002'),
          data: {
            optionalRelation: null,
            optionalFlatArray: null,
          },
          _data_optionalRelation: [],
        },
        {
          _id: new ObjectId('000000000000000000000003'),
          data: {
            optionalRelation: new ObjectId('000000000000000000000001'),
            optionalFlatArray: ['test1', 'test2'],
          },
          _data_optionalRelation: [{
            _id: new ObjectId('000000000000000000000001'),
            objectOne: {
              boolean: true,
              objectTwo: {
                optionalIndexedString: 'test1',
                optionalNestedArray: [
                  null,
                  {
                    data: {
                      flatArray: ['test2', null, 'test3'],
                      optionalInteger: null,
                      nestedArray: [
                        { key: 'test4', optionalRelation: new ObjectId('000000000000000000000022') },
                        { key: 'test5', optionalRelation: null },
                        { key: 'test6', optionalRelation: new ObjectId('000000000000000000000023') },
                      ],
                    },
                  },
                  {
                    data: {
                      flatArray: ['test6', null, 'test7'],
                      optionalInteger: 1,
                      nestedArray: [
                        { key: 'test8', optionalRelation: new ObjectId('000000000000000000000023') },
                      ],
                    },
                  },
                  null,
                ],
              },
              optionalRelations: [
                new ObjectId('000000000000000000000002'),
                null,
                new ObjectId('000000000000000000000003'),
              ],
            },
          }],
        },
      ],
    }], {
      _id: 1,
      _isDeleted: 1,
      indexedString: 1,
      objectOne: {
        objectTwo: {
          optionalIndexedString: 1,
          optionalNestedArray: {
            data: {
              flatArray: 1,
              optionalInteger: 1,
              nestedArray: { key: 1, optionalRelation: 1 },
            },
          },
        },
        optionalRelations: {
          _id: 1,
          data: {
            optionalFlatArray: 1,
            optionalRelation: {
              _id: 1,
              objectOne: { objectTwo: { optionalIndexedString: 1 } },
            },
          },
        },
      },
    })).toEqual([
      {
        _id: new Id('000000000000000000000001'),
        _isDeleted: true,
        indexedString: 'test',
        objectOne: {
          objectTwo: {
            optionalIndexedString: 'test1',
            optionalNestedArray: [
              null,
              {
                data: {
                  flatArray: ['test2', null, 'test3'],
                  optionalInteger: null,
                  nestedArray: [
                    { key: 'test4', optionalRelation: new Id('000000000000000000000022') },
                    { key: 'test5', optionalRelation: null },
                    { key: 'test6', optionalRelation: new Id('000000000000000000000023') },
                  ],
                },
              },
              {
                data: {
                  flatArray: ['test6', null, 'test7'],
                  optionalInteger: 1,
                  nestedArray: [
                    { key: 'test8', optionalRelation: new Id('000000000000000000000023') },
                  ],
                },
              },
              null,
            ],
          },
          optionalRelations: [
            {
              _id: new Id('000000000000000000000002'),
              data: {
                optionalRelation: null,
                optionalFlatArray: null,
              },
            },
            null,
            {
              _id: new Id('000000000000000000000003'),
              data: {
                optionalRelation: {
                  _id: new Id('000000000000000000000001'),
                  objectOne: {
                    objectTwo: {
                      optionalIndexedString: 'test1',
                    },
                  },
                },
                optionalFlatArray: [
                  'test1',
                  'test2',
                ],
              },
            },
          ],
        },
      },
    ]);

    expect(databaseClient.formatResources('otherTest', [{
      _id: new ObjectId('000000000000000000000001'),
      binary: new Binary(),
      data: {
        optionalFlatArray: [],
      },
    }], {
      _id: 1,
      binary: 1,
      data: {
        optionalFlatArray: 1,
      },
    })).toEqual([
      {
        _id: new Id('000000000000000000000001'),
        binary: new ArrayBuffer(0),
        data: {
          optionalFlatArray: [],
        },
      },
    ]);
  });

  describe('[checkReferencesTo]', () => {
    test('resource is not referenced in collections', async () => {
      process.env.REFERENCES_MODE = 'true';
      await databaseClient.checkReferencesTo('test', new Id('646b9be5e921d0ef42f8a141'));
      expect(logger.debug).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith(
        '[MongoDatabaseClient][checkReferencesTo] Performing aggregation on pipeline:',
      );
      expect(logger.debug).toHaveBeenCalledWith([
        { $limit: 1 },
        { $project: { _id: new ObjectId('646b9be5e921d0ef42f8a141') } },
        {
          $lookup: {
            as: 'otherTest__optionalRelation',
            foreignField: 'optionalRelation',
            from: 'otherTest',
            localField: '_id',
            pipeline: [{ $project: { _id: 1 } }],
          },
        },
        {
          $lookup: {
            as: 'otherTest__data_optionalRelation',
            foreignField: 'data.optionalRelation',
            from: 'otherTest',
            localField: '_id',
            pipeline: [{ $project: { _id: 1 } }],
          },
        },
      ]);
      expect(mongoClient.db().collection('_config').aggregate).toHaveBeenCalledOnce();
      expect(mongoClient.db().collection('_config').aggregate).toHaveBeenCalledWith([
        {
          $limit: 1,
        },
        {
          $project: {
            _id: new ObjectId('646b9be5e921d0ef42f8a141'),
          },
        },
        {
          $lookup: {
            as: 'otherTest__optionalRelation',
            foreignField: 'optionalRelation',
            from: 'otherTest',
            localField: '_id',
            pipeline: [{ $project: { _id: 1 } }],
          },
        },
        {
          $lookup: {
            as: 'otherTest__data_optionalRelation',
            foreignField: 'data.optionalRelation',
            from: 'otherTest',
            localField: '_id',
            pipeline: [
              {
                $project: {
                  _id: 1,
                },
              },
            ],
          },
        },
      ]);
    });

    test('resource is still referenced in collections', async () => {
      process.env.REFERENCES_MODE = 'true';
      process.env.REFERENCE_EXISTS = 'true';
      const id = new Id('646b9be5e921d0ef42f8a141');
      await expect(async () => (
        databaseClient.checkReferencesTo('test', id)
      )).rejects.toEqual(new DatabaseError('RESOURCE_REFERENCED', { path: 'data_optionalRelation' }));
    });
  });

  describe('[handleError]', () => {
    test('connection error', async () => {
      databaseClient.databaseConnection = null as unknown as Db;
      const databaseError = new DatabaseError('CONNECTION_FAILED');
      const callback = async (): Promise<null> => Promise.resolve(null);
      await expect(async () => databaseClient.handleError(callback)).rejects.toEqual(databaseError);
    });

    test('unique index constraing error', async () => {
      const callback = async (): Promise<void> => {
        await Promise.resolve();
        const error = new MongoServerError({ message: 'dup key: { _id: "test" }' });
        error.code = 11000;
        throw error;
      };
      const databaseError = new DatabaseError('DUPLICATE_RESOURCE', { path: '_id', value: 'test' });
      await expect(async () => databaseClient.handleError(callback)).rejects.toEqual(databaseError);
    });

    test('other error', async () => {
      const callback = async (): Promise<void> => { await Promise.resolve(); throw new Error('Unknown'); };
      await expect(async () => databaseClient.handleError(callback)).rejects.toEqual(new Error('Unknown'));
    });

    test('no error', async () => {
      await databaseClient.handleError(async () => Promise.resolve(null));
      expect(mongoClient.connect).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledWith('[MongoDatabaseClient][handleError] Connecting to database test...');
    });
  });

  test('[constructor]', () => {
    vi.clearAllMocks();
    databaseClient = new MongoDatabaseClient<DataModel>(model, logger, cacheClient, {
      protocol: 'mongo+srv',
      host: 'localhost',
      port: null,
      user: null,
      password: null,
      database: 'test',
      connectTimeout: 0,
      connectionLimit: 0,
    }) as TestMongoDatabaseClient;
    expect(mongoClient.db).toHaveBeenCalledOnce();
    expect(mongoClient.db).toHaveBeenCalledWith('test');
  });

  test('[dropDatabase]', async () => {
    await databaseClient.dropDatabase();
    expect(mongoClient.db().dropDatabase).toHaveBeenCalledOnce();
    expect(databaseClient.isConnected).toBe(false);
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      '[MongoDatabaseClient][dropDatabase] Dropping database test...',
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[MongoDatabaseClient][dropDatabase] Successfully dropped database test.',
    );
  });

  test('[createDatabase]', async () => {
    await databaseClient.createDatabase();
    expect(mongoClient.db).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      '[MongoDatabaseClient][createDatabase] Creating database test...',
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[MongoDatabaseClient][createDatabase] Successfully created database test.',
    );
  });

  test('[createMissingStructures]', async () => {
    databaseClient.resourcesMetadata = {
      otherTest: {
        fields: {},
        indexes: [
          { path: 'optionalRelation', unique: false },
          { path: 'data.optionalRelation', unique: false },
          { path: 'data.optionalFlatArray', unique: true },
        ],
        constraints: [],
        subStructures: [],
        structure: 'otherTest',
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      },
    };
    await databaseClient.createMissingStructures();
    const log = '[MongoDatabaseClient][createMissingStructures] Creating collection "otherTest"...';
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(log);
    expect(mongoClient.db().createCollection).toHaveBeenCalledTimes(2);
    expect(mongoClient.db().createCollection).toHaveBeenCalledWith('otherTest', { validator: { $jsonSchema: {} } });
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
    expect(mongoClient.db().collection('_config').insertOne).toHaveBeenCalledOnce();
    expect(mongoClient.db().collection('_config').insertOne).toHaveBeenCalledWith({});
    expect(mongoClient.db().collection('otherTest').createIndexes).toHaveBeenCalledOnce();
    expect(mongoClient.db().collection('otherTest').createIndexes).toHaveBeenCalledWith([
      { key: { optionalRelation: 1 }, unique: false },
      { key: { 'data.optionalRelation': 1 }, unique: false },
      { key: { 'data.optionalFlatArray': 1 }, unique: true },
    ]);
  });

  test('[reset]', async () => {
    vi.spyOn(databaseClient, 'dropDatabase').mockImplementation(vi.fn());
    vi.spyOn(databaseClient, 'createDatabase').mockImplementation(vi.fn());
    vi.spyOn(databaseClient, 'createMissingStructures').mockImplementation(vi.fn());
    await databaseClient.reset();
    expect(databaseClient.dropDatabase).toHaveBeenCalledOnce();
    expect(databaseClient.createDatabase).toHaveBeenCalledOnce();
    expect(databaseClient.createMissingStructures).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('[MongoDatabaseClient][reset] Initializing collections...');
    expect(logger.info).toHaveBeenCalledWith('[MongoDatabaseClient][reset] Successfully initialized collections.');
  });

  describe('[checkForeignIds]', () => {
    test('NO_RESOURCE error', async () => {
      process.env.MISSING_FOREIGN_IDS = 'true';
      await expect(async () => {
        await databaseClient.checkForeignIds('otherTest', new Map<string, {
          resource: keyof DataModel;
          filters: SearchFilters;
        }>([
          ['data.optionalRelation', {
            resource: 'test',
            filters: {
              'objectOne.objectTwo.optionalIndexedString': 'test',
              _id: [
                new Id('000000000000000000000001'),
                new Id('000000000000000000000002'),
              ],
            },
          }],
          ['optionalRelation', {
            resource: 'test',
            filters: {
              indexedString: 'test2',
              _id: [
                new Id('000000000000000000000002'),
              ],
            },
          }],
        ]));
      }).rejects.toThrow(new DatabaseError('NO_RESOURCE'));
    });

    test('no error', async () => {
      vi.spyOn(databaseClient, 'generateQuery').mockImplementation(vi.fn(() => [{ pipeline: true }]));
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      vi.spyOn(databaseClient, 'parseFields').mockImplementation(vi.fn(() => ({
        projections: {},
        formattedQuery: { match: { filters: [{ indexedString: 'test' }] } } as unknown as FormattedQuery,
      })));
      await databaseClient.checkForeignIds('otherTest', new Map<string, {
        resource: keyof DataModel;
        filters: SearchFilters;
      }>([
        ['data.optionalRelation', {
          resource: 'test',
          filters: {
            'objectOne.objectTwo.optionalIndexedString': 'test',
            _id: [
              new Id('000000000000000000000001'),
              new Id('000000000000000000000002'),
            ],
          },
        }],
        ['optionalRelation', {
          resource: 'test',
          filters: {
            indexedString: 'test2',
            _id: [
              new Id('000000000000000000000002'),
            ],
          },
        }],
      ]));
      expect(databaseClient.parseFields).toHaveBeenCalledTimes(2);
      expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set([
        '_id',
        '_isDeleted',
        'indexedString',
      ]), Infinity, {
        query: null,
        filters: {
          _isDeleted: false,
          indexedString: 'test2',
          _id: [
            new Id('000000000000000000000002'),
          ],
        },
      });
      expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set([
        '_id',
        '_isDeleted',
        'objectOne.objectTwo.optionalIndexedString',
      ]), Infinity, {
        query: null,
        filters: {
          _isDeleted: false,
          'objectOne.objectTwo.optionalIndexedString': 'test',
          _id: [
            new Id('000000000000000000000001'),
            new Id('000000000000000000000002'),
          ],
        },
      });
      const log = '[MongoDatabaseClient][checkForeignIds] Calling MongoDB aggregate with pipeline:';
      const pipeline = [
        { $limit: 1 },
        {
          $project: {
            'data.optionalRelation': [
              new ObjectId('000000000000000000000001'),
              new ObjectId('000000000000000000000002'),
            ],
            optionalRelation: [
              new ObjectId('000000000000000000000002'),
            ],
          },
        },
        {
          $lookup: {
            as: 'data.optionalRelation',
            foreignField: '_id',
            from: 'test',
            localField: 'data.optionalRelation',
            pipeline: [{ pipeline: true }],
          },
        },
        {
          $lookup: {
            as: 'optionalRelation',
            foreignField: '_id',
            from: 'test',
            localField: 'optionalRelation',
            pipeline: [{ pipeline: true }],
          },
        },
      ];
      expect(logger.debug).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith(log);
      expect(logger.debug).toHaveBeenCalledWith(pipeline);
      expect(databaseClient.databaseConnection.collection('_config').aggregate).toHaveBeenCalledOnce();
      expect(databaseClient.databaseConnection.collection('_config').aggregate).toHaveBeenCalledWith(pipeline);
    });
  });

  describe('[create]', () => {
    test('error', async () => {
      process.env.DATABASE_ERROR = 'true';
      vi.spyOn(databaseClient, 'structurePayload').mockImplementation(vi.fn(() => ({
        test: [{ _id: new Id('000000000000000000000001') }],
      })));
      vi.spyOn(databaseClient, 'handleError').mockImplementation(((callback) => callback()));
      await expect(async () => {
        const payload = { _id: new Id('000000000000000000000001') } as DataModel['test'];
        await databaseClient.create('test', payload);
      }).rejects.toEqual(new Error('ERROR'));
    });

    test('no error', async () => {
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      vi.spyOn(databaseClient, 'structurePayload').mockImplementation(vi.fn(() => ({
        test: [{ _id: new Id('000000000000000000000001') }],
      })));
      const payload = { _id: new Id('000000000000000000000001') } as DataModel['test'];
      await databaseClient.create('test', payload);
      const log = '[MongoDatabaseClient][create] Inserting document in collection "test":';
      expect(logger.debug).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith(log);
      expect(logger.debug).toHaveBeenCalledWith(payload);
      expect(mongoClient.db().collection('test').insertOne).toHaveBeenCalledOnce();
      expect(mongoClient.db().collection('test').insertOne).toHaveBeenCalledWith(payload);
    });
  });

  describe('[update]', () => {
    test('error', async () => {
      process.env.DATABASE_ERROR = 'true';
      vi.spyOn(databaseClient, 'structurePayload').mockImplementation(vi.fn(() => ({
        test: [{ indexedString: 'test' }],
      })));
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      await expect(async () => {
        const payload = { indexedString: 'test' } as DataModel['test'];
        await databaseClient.update('test', new Id('000000000000000000000001'), payload);
      }).rejects.toEqual(new Error('ERROR'));
    });

    test('no error', async () => {
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      vi.spyOn(databaseClient, 'structurePayload').mockImplementation(vi.fn(() => ({
        test: [{ indexedString: 'test' }],
      })));
      const payload = { indexedString: 'test' } as DataModel['test'];
      await databaseClient.update('test', new Id('000000000000000000000001'), payload);
      const log = '[MongoDatabaseClient][update] Updating document in collection "test":';
      expect(logger.debug).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith(log);
      expect(logger.debug).toHaveBeenCalledWith({ indexedString: 'test' });
      expect(mongoClient.db().collection('test').updateOne).toHaveBeenCalledOnce();
      expect(mongoClient.db().collection('test').updateOne).toHaveBeenCalledWith({
        _id: new ObjectId('000000000000000000000001'),
        _isDeleted: false,
      }, { $set: { indexedString: 'test' } });
    });
  });

  test('[view]', async () => {
    vi.spyOn(databaseClient, 'parseFields').mockImplementation(vi.fn(() => ({
      projections: 'PROJECTIONS' as unknown as Document,
      formattedQuery: 'FORMATTED_QUERY' as unknown as FormattedQuery,
    })));
    vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
    vi.spyOn(databaseClient, 'generateQuery').mockImplementation(vi.fn(() => [{ pipeline: true }]));
    vi.spyOn(databaseClient, 'formatResources').mockImplementation(vi.fn(() => []));
    await databaseClient.view('test', new Id('000000000000000000000001'));
    expect(databaseClient.parseFields).toHaveBeenCalledOnce();
    expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set(), 3);
    const log = '[MongoDatabaseClient][view] Performing aggregation on collection "test" with pipeline:';
    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith(log);
    expect(logger.debug).toHaveBeenCalledWith([
      { $match: { _id: new ObjectId('000000000000000000000001'), _isDeleted: false } },
      { pipeline: true },
    ]);
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledOnce();
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledWith([
      { $match: { _id: new ObjectId('000000000000000000000001'), _isDeleted: false } },
      { pipeline: true },
    ]);
  });

  test('[search]', async () => {
    vi.spyOn(databaseClient, 'parseFields').mockImplementation(vi.fn(() => ({
      projections: 'PROJECTIONS' as unknown as Document,
      formattedQuery: 'FORMATTED_QUERY' as unknown as FormattedQuery,
    })));
    vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
    vi.spyOn(databaseClient, 'generateQuery').mockImplementation(vi.fn(() => [{ pipeline: true }]));
    vi.spyOn(databaseClient, 'formatResources').mockImplementation(vi.fn(() => []));
    await databaseClient.search('test', { filters: null, query: null }, { sortBy: { _id: -1 } });
    expect(databaseClient.parseFields).toHaveBeenCalledOnce();
    expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set(), 3, {
      query: null,
      filters: null,
    }, { _id: -1 });
    const pipeline = [
      { $match: { _isDeleted: false } },
      { pipeline: true },
      {
        $facet: {
          results: [
            { $skip: 0 },
            { $limit: 20 },
          ],
          total: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
              },
            },
          ],
        },
      },
    ];
    const log = '[MongoDatabaseClient][search] Performing aggregation on collection "test" with pipeline:';
    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith(log);
    expect(logger.debug).toHaveBeenCalledWith(pipeline);
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledOnce();
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledWith(pipeline);
    // Covers other specific use cases.
    process.env.NO_RESULT = 'true';
    await databaseClient.search('otherTest', { filters: null, query: null }, { limit: 0 });
  });

  test('[list]', async () => {
    vi.spyOn(databaseClient, 'parseFields').mockImplementation(vi.fn(() => ({
      projections: 'PROJECTIONS' as unknown as Document,
      formattedQuery: 'FORMATTED_QUERY' as unknown as FormattedQuery,
    })));
    vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
    vi.spyOn(databaseClient, 'generateQuery').mockImplementation(vi.fn(() => [{ pipeline: true }]));
    vi.spyOn(databaseClient, 'formatResources').mockImplementation(vi.fn(() => []));
    await databaseClient.list('test', { sortBy: { _id: -1 } });
    expect(databaseClient.parseFields).toHaveBeenCalledOnce();
    expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set(), 3, null, { _id: -1 });
    const pipeline = [
      { $match: { _isDeleted: false } },
      { pipeline: true },
      {
        $facet: {
          results: [
            { $skip: 0 },
            { $limit: 20 },
          ],
          total: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
              },
            },
          ],
        },
      },
    ];
    const log = '[MongoDatabaseClient][list] Performing aggregation on collection "test" with pipeline:';
    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith(log);
    expect(logger.debug).toHaveBeenCalledWith(pipeline);
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledOnce();
    expect(mongoClient.db().collection('test').aggregate).toHaveBeenCalledWith(pipeline);
    // Covers other specific use cases.
    process.env.NO_RESULT = 'true';
    await databaseClient.list('otherTest', { limit: 0 });
  });

  describe('[delete]', () => {
    test('error', async () => {
      process.env.DATABASE_ERROR = 'true';
      vi.spyOn(databaseClient, 'checkReferencesTo').mockImplementation(vi.fn());
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      await expect(async () => (
        databaseClient.delete('test', new Id('000000000000000000000001'))
      )).rejects.toEqual(new Error('ERROR'));
    });

    test('no error', async () => {
      vi.spyOn(databaseClient, 'checkReferencesTo').mockImplementation(vi.fn());
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      const response = await databaseClient.delete('test', new Id('000000000000000000000001'));
      const log = '[MongoDatabaseClient][delete] Deleting document with id 000000000000000000000001 from collection "test"...';
      expect(logger.debug).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(log);
      expect(mongoClient.db().collection('test').deleteOne).toHaveBeenCalledOnce();
      expect(mongoClient.db().collection('test').deleteOne).toHaveBeenCalledWith({
        _id: new ObjectId('000000000000000000000001'),
      });
      expect(response).toBe(true);
    });
  });
});
