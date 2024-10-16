/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import mysql from 'mysql2/promise';
import Model from 'scripts/core/services/Model';
import Logger from 'scripts/core/services/Logger';
import { type ResourceSchema, Id } from '@perseid/core';
import DatabaseError from 'scripts/core/errors/Database';
import CacheClient from 'scripts/core/services/CacheClient';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';
import MySQLDatabaseClient from 'scripts/mysql/services/MySQLDatabaseClient';
import type { FormattedQuery } from 'scripts/core/services/AbstractDatabaseClient';

type TestMySQLDatabaseClient = MySQLDatabaseClient<DataModel> & {
  client: MySQLDatabaseClient<DataModel>['client'];
  isConnected: MySQLDatabaseClient<DataModel>['isConnected'];
  handleError: MySQLDatabaseClient<DataModel>['handleError'];
  parseFields: MySQLDatabaseClient<DataModel>['parseFields'];
  generateQuery: MySQLDatabaseClient<DataModel>['generateQuery'];
  formatResources: MySQLDatabaseClient<DataModel>['formatResources'];
  structurePayload: MySQLDatabaseClient<DataModel>['structurePayload'];
  resourcesMetadata: MySQLDatabaseClient<DataModel>['resourcesMetadata'];
  generateResourceMetadata: MySQLDatabaseClient<DataModel>['generateResourceMetadata'];
};

describe('mysql/services/MySQLDatabaseClient', () => {
  vi.mock('@perseid/core');
  vi.mock('mysql2/promise');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/core/services/AbstractDatabaseClient');

  let databaseClient: TestMySQLDatabaseClient;
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const cacheClient = new CacheClient({ cachePath: '/.cache', connectTimeout: 0 });
  const model = new Model<DataModel>({} as Record<keyof DataModel, ResourceSchema<DataModel>>);

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NO_RESULT;
    delete process.env.DATABASE_ERROR;
    delete process.env.MISSING_FOREIGN_IDS;

    databaseClient = new MySQLDatabaseClient<DataModel>(model, logger, cacheClient, {
      protocol: 'http',
      host: 'localhost',
      port: null,
      user: null,
      password: null,
      database: 'test',
      connectTimeout: 0,
      connectionLimit: 0,
    }) as TestMySQLDatabaseClient;
  });

  test('[generateResourceMetadata]', () => {
    databaseClient.resourcesMetadata = {
      test: {
        fields: {},
        indexes: [],
        constraints: [],
        structure: 'test',
        subStructures: [],
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      },
      otherTest: {
        fields: {},
        indexes: [],
        constraints: [],
        subStructures: [],
        structure: 'otherTest',
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      },
    };
    databaseClient.generateResourceMetadata('test');
    databaseClient.generateResourceMetadata('otherTest');
    expect(databaseClient.resourcesMetadata).toEqual({
      test: {
        fields: {
          _id: { type: 'CHAR(24)', isRequired: true },
          _isDeleted: { type: 'BIT', isRequired: true },
          indexedString: { type: 'VARCHAR(255)', isRequired: true },
          objectOne: { type: 'BIT', isRequired: true },
          objectOne_boolean: { type: 'BIT', isRequired: true },
          objectOne_optionalRelations: { type: 'BIT', isRequired: false },
          objectOne_objectTwo: { type: 'BIT', isRequired: true },
          objectOne_objectTwo_optionalIndexedString: { type: 'VARCHAR(255)', isRequired: false },
          objectOne_objectTwo_optionalNestedArray: { type: 'BIT', isRequired: false },
        },
        indexes: [
          { path: '_isDeleted', unique: false },
          { path: 'indexedString', unique: false },
          {
            path: 'objectOne_objectTwo_optionalIndexedString',
            unique: true,
          },
        ],
        constraints: [],
        structure: 'test',
        subStructures: [
          '_test_objectOne_optionalRelations',
          '_test_objectOne_objectTwo_optionalNestedArray',
          '_test_objectOne_objectTwo_optionalNestedArray_value_data_flatArray',
          '_test_objectOne_objectTwo_optionalNestedArray_value_data_nestedArray',
        ],
        subStructuresPerPath: {
          objectOne_optionalRelations: new Set(['_test_objectOne_optionalRelations']),
          objectOne_objectTwo_optionalNestedArray: new Set([
            '_test_objectOne_objectTwo_optionalNestedArray',
            '_test_objectOne_objectTwo_optionalNestedArray_value_data_flatArray',
            '_test_objectOne_objectTwo_optionalNestedArray_value_data_nestedArray',
          ]),
          objectOne_objectTwo_optionalNestedArray_value_data_flatArray: new Set([
            '_test_objectOne_objectTwo_optionalNestedArray_value_data_flatArray',
          ]),
          objectOne_objectTwo_optionalNestedArray_value_data_nestedArray: new Set([
            '_test_objectOne_objectTwo_optionalNestedArray_value_data_nestedArray',
          ]),
        },
        invertedRelations: new Map(),
      },
      otherTest: {
        fields: {
          _id: { type: 'CHAR(24)', isRequired: true },
          _createdAt: { type: 'TIMESTAMP', isRequired: true },
          binary: { type: 'MEDIUMBLOB', isRequired: true },
          enum: { type: 'VARCHAR(5)', isRequired: true },
          optionalRelation: { type: 'CHAR(24)', isRequired: false },
          data: { type: 'BIT', isRequired: true },
          data_optionalRelation: { type: 'CHAR(24)', isRequired: false },
          data_optionalFlatArray: { type: 'BIT', isRequired: false },
        },
        indexes: [
          { path: '_createdAt', unique: false },
          { path: 'optionalRelation', unique: false },
          { path: 'data_optionalRelation', unique: false },
        ],
        constraints: [
          { path: 'optionalRelation', relation: 'test' },
          { path: 'data_optionalRelation', relation: 'test' },
        ],
        subStructures: ['_otherTest_data_optionalFlatArray'],
        structure: 'otherTest',
        subStructuresPerPath: {
          data_optionalFlatArray: new Set(['_otherTest_data_optionalFlatArray']),
        },
        invertedRelations: new Map(),
      },
      _test_objectOne_optionalRelations: {
        fields: {
          _id: { type: 'CHAR(24)', isRequired: true },
          _parentId: { type: 'CHAR(24)', isRequired: true },
          _resourceId: { type: 'CHAR(24)', isRequired: true },
          value: { type: 'CHAR(24)', isRequired: false },
        },
        structure: '_test_1',
        constraints: [
          { path: '_parentId', relation: 'test' },
          { path: '_resourceId', relation: 'test' },
          { path: 'value', relation: 'otherTest' },
        ],
        indexes: [
          { path: '_parentId', unique: false },
          { path: '_resourceId', unique: false },
          { path: 'value', unique: false },
        ],
        subStructures: [],
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      },
      _test_objectOne_objectTwo_optionalNestedArray: {
        fields: {
          _id: { type: 'CHAR(24)', isRequired: true },
          _parentId: { type: 'CHAR(24)', isRequired: true },
          _resourceId: { type: 'CHAR(24)', isRequired: true },
          value: { type: 'BIT', isRequired: false },
          value_data: { type: 'BIT', isRequired: false },
          value_data_optionalInteger: { type: 'INT', isRequired: false },
          value_data_flatArray: { type: 'BIT', isRequired: false },
          value_data_nestedArray: { type: 'BIT', isRequired: false },
        },
        structure: '_test_2',
        constraints: [
          { path: '_parentId', relation: 'test' },
          { path: '_resourceId', relation: 'test' },
        ],
        indexes: [
          { path: '_parentId', unique: false },
          { path: '_resourceId', unique: false },
          { path: 'value_data_optionalInteger', unique: false },
        ],
        subStructures: [],
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      },
      _test_objectOne_objectTwo_optionalNestedArray_value_data_flatArray: {
        fields: {
          _id: { type: 'CHAR(24)', isRequired: true },
          _parentId: { type: 'CHAR(24)', isRequired: true },
          _resourceId: { type: 'CHAR(24)', isRequired: true },
          value: { type: 'VARCHAR(255)', isRequired: false },
        },
        structure: '_test_3',
        constraints: [
          {
            path: '_parentId',
            relation: '_test_objectOne_objectTwo_optionalNestedArray',
          },
          { path: '_resourceId', relation: 'test' },
        ],
        indexes: [
          { path: '_parentId', unique: false },
          { path: '_resourceId', unique: false },
          { path: 'value', unique: false },
        ],
        subStructures: [],
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      },
      _test_objectOne_objectTwo_optionalNestedArray_value_data_nestedArray: {
        fields: {
          _id: { type: 'CHAR(24)', isRequired: true },
          _parentId: { type: 'CHAR(24)', isRequired: true },
          _resourceId: { type: 'CHAR(24)', isRequired: true },
          value: { type: 'BIT', isRequired: true },
          value_optionalRelation: { type: 'CHAR(24)', isRequired: false },
          value_key: { type: 'TEXT', isRequired: true },
        },
        structure: '_test_4',
        constraints: [
          {
            path: '_parentId',
            relation: '_test_objectOne_objectTwo_optionalNestedArray',
          },
          { path: '_resourceId', relation: 'test' },
          { path: 'value_optionalRelation', relation: 'otherTest' },
        ],
        indexes: [
          { path: '_parentId', unique: false },
          { path: '_resourceId', unique: false },
        ],
        subStructures: [],
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      },
      _otherTest_data_optionalFlatArray: {
        fields: {
          _id: { type: 'CHAR(24)', isRequired: true },
          _parentId: { type: 'CHAR(24)', isRequired: true },
          _resourceId: { type: 'CHAR(24)', isRequired: true },
          value: { type: 'VARCHAR(5)', isRequired: true },
        },
        structure: '_otherTest_1',
        constraints: [
          { path: '_parentId', relation: 'otherTest' },
          { path: '_resourceId', relation: 'otherTest' },
        ],
        indexes: [
          { path: '_parentId', unique: false },
          { path: '_resourceId', unique: false },
          { path: 'value', unique: true },
        ],
        subStructures: [],
        subStructuresPerPath: {},
        invertedRelations: new Map(),
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
          match: {
            query: [
              { objectOne_objectTwo_optionalNestedArray_value_data_flatArray_value: '(?=.*test)' },
              { objectOne_objectTwo_optionalIndexedString: '(?=.*test)' },
            ],
            filters: [
              { objectOne_objectTwo_optionalIndexedString: new Date('2024-06-26T10:57:09.820Z') },
              { objectOne_objectTwo_optionalNestedArray_value_data_optionalInteger: 3 },
              { objectOne_optionalRelations_value: '000000000000000000000001' },
              { objectOne_optionalRelations_value_data_optionalRelation_objectOne_objectTwo_optionalIndexedString: 'test' },
            ],
          },
          lookups: {
            objectOne_optionalRelations: {
              sort: null,
              match: null,
              lookups: {
                value: {
                  lookups: {
                    data_optionalFlatArray: {
                      sort: null,
                      match: null,
                      lookups: {},
                      localField: '_id',
                      structure: '_otherTest_data_optionalFlatArray',
                      foreignField: 'objectOne_optionalRelations_value_data_optionalFlatArray__parentId',
                      fields: {
                        _id: 'objectOne_optionalRelations_value_data_optionalFlatArray__id',
                        _parentId: 'objectOne_optionalRelations_value_data_optionalFlatArray__parentId',
                        value: 'objectOne_optionalRelations_value_data_optionalFlatArray_value',
                      },
                    },
                    data_optionalRelation: {
                      lookups: {},
                      sort: null,
                      match: null,
                      structure: 'test',
                      localField: 'data_optionalRelation',
                      foreignField: 'objectOne_optionalRelations_value_data_optionalRelation__id',
                      fields: {
                        _id: 'objectOne_optionalRelations_value_data_optionalRelation__id',
                        objectOne: 'objectOne_optionalRelations_value_data_optionalRelation_objectOne',
                        objectOne_objectTwo: 'objectOne_optionalRelations_value_data_optionalRelation_objectOne_objectTwo',
                        objectOne_objectTwo_optionalIndexedString: 'objectOne_optionalRelations_value_data_optionalRelation_objectOne_objectTwo_optionalIndexedString',
                      },
                    },
                  },
                  sort: null,
                  match: null,
                  structure: 'otherTest',
                  localField: 'value',
                  foreignField: 'objectOne_optionalRelations_value__id',
                  fields: {
                    _id: 'objectOne_optionalRelations_value__id',
                    data: 'objectOne_optionalRelations_value_data',
                    data_optionalFlatArray: 'objectOne_optionalRelations_value_data_optionalFlatArray',
                    data_optionalRelation: 'objectOne_optionalRelations_value_data_optionalRelation',
                  },
                },
              },
              localField: '_id',
              structure: '_test_objectOne_optionalRelations',
              foreignField: 'objectOne_optionalRelations__parentId',
              fields: {
                _id: 'objectOne_optionalRelations__id',
                _parentId: 'objectOne_optionalRelations__parentId',
                value: 'objectOne_optionalRelations_value',
              },
            },
            objectOne_objectTwo_optionalNestedArray: {
              sort: null,
              match: null,
              lookups: {
                value_data_flatArray: {
                  sort: null,
                  match: null,
                  lookups: {},
                  localField: '_id',
                  structure: '_test_objectOne_objectTwo_optionalNestedArray_value_data_flatArray',
                  foreignField: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray__parentId',
                  fields: {
                    _id: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray__id',
                    _parentId: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray__parentId',
                    value: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray_value',
                  },
                },
                value_data_nestedArray: {
                  sort: null,
                  match: null,
                  lookups: {},
                  localField: '_id',
                  structure: '_test_objectOne_objectTwo_optionalNestedArray_value_data_nestedArray',
                  foreignField: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray__parentId',
                  fields: {
                    _id: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray__id',
                    _parentId: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray__parentId',
                    value: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray_value',
                    value_key: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray_value_key',
                    value_optionalRelation: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray_value_optionalRelation',
                  },
                },
              },
              localField: '_id',
              structure: '_test_objectOne_objectTwo_optionalNestedArray',
              foreignField: 'objectOne_objectTwo_optionalNestedArray__parentId',
              fields: {
                _id: 'objectOne_objectTwo_optionalNestedArray__id',
                _parentId: 'objectOne_objectTwo_optionalNestedArray__parentId',
                value: 'objectOne_objectTwo_optionalNestedArray_value',
                value_data: 'objectOne_objectTwo_optionalNestedArray_value_data',
                value_data_flatArray: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray',
                value_data_optionalInteger: 'objectOne_objectTwo_optionalNestedArray_value_data_optionalInteger',
                value_data_nestedArray: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray',
              },
            },
          },
          localField: null,
          foreignField: null,
          fields: {
            _id: '_id',
            indexedString: 'indexedString',
            objectOne: 'objectOne',
            objectOne_objectTwo: 'objectOne_objectTwo',
            objectOne_objectTwo_optionalIndexedString: 'objectOne_objectTwo_optionalIndexedString',
            objectOne_optionalRelations: 'objectOne_optionalRelations',
            objectOne_objectTwo_optionalNestedArray: 'objectOne_objectTwo_optionalNestedArray',
          },
        },
        projections: new Map([['_id', '_id']]),
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
            data_optionalFlatArray: {
              sort: null,
              match: null,
              lookups: {},
              foreignField: 'data_optionalFlatArray__parentId',
              localField: '_id',
              fields: {
                _id: 'data_optionalFlatArray__id',
                _parentId: 'data_optionalFlatArray__parentId',
                value: 'data_optionalFlatArray_value',
              },
              structure: '_otherTest_data_optionalFlatArray',
            },
            data_optionalRelation: {
              fields: {
                _id: 'data_optionalRelation__id',
                indexedString: 'data_optionalRelation_indexedString',
              },
              structure: 'test',
              foreignField: 'data_optionalRelation__id',
              localField: 'data_optionalRelation',
              lookups: {},
              match: null,
              sort: null,
            },
          },
          sort: null,
          match: {
            query: [],
            filters: [
              { _id: ['000000000000000000000001'] },
              { data_optionalFlatArray_value: [new Date('2024-06-26T10:57:08.820Z'), new Date('2024-06-26T10:57:09.820Z')] },
              { _createdAt: [new Date('2024-06-26T10:57:08.820Z')] },
              { data_optionalRelation: ['000000000000000000000002'] },
            ],
          },
          localField: null,
          foreignField: null,
          fields: {
            _id: '_id',
            data: 'data',
            _createdAt: '_createdAt',
            data_optionalRelation: 'data_optionalRelation',
            data_optionalFlatArray: 'data_optionalFlatArray',
          },
        },
        projections: new Map([['_id', '_id']]),
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
          fields: { _id: '_id' },
          lookups: {},
          match: null,
        },
        projections: new Map([['_id', '_id']]),
      });
    });
  });

  test('[generateQuery]', () => {
    databaseClient.generateResourceMetadata('test');
    databaseClient.generateResourceMetadata('otherTest');
    expect(databaseClient.generateQuery('test', {
      structure: 'test',
      sort: { indexedString: -1 },
      match: {
        query: [
          { objectOne_objectTwo_optionalNestedArray_value_data_flatArray_value: '(?=.*test)' },
          { objectOne_objectTwo_optionalIndexedString: '(?=.*test)' },
        ],
        filters: [
          { objectOne_objectTwo_optionalIndexedString: new Date('2024-06-26T10:57:09.820Z') },
          { objectOne_objectTwo_optionalNestedArray_value_data_optionalInteger: 3 },
          { objectOne_optionalRelations_value: '000000000000000000000001' },
          { objectOne_optionalRelations_value_data_optionalRelation_objectOne_objectTwo_optionalIndexedString: 'test' },
        ],
      },
      lookups: {
        objectOne_optionalRelations: {
          sort: null,
          match: null,
          lookups: {
            value: {
              lookups: {
                data_optionalFlatArray: {
                  sort: null,
                  match: null,
                  lookups: {},
                  localField: '_id',
                  structure: '_otherTest_data_optionalFlatArray',
                  foreignField: 'objectOne_optionalRelations_value_data_optionalFlatArray__parentId',
                  fields: {
                    _id: 'objectOne_optionalRelations_value_data_optionalFlatArray__id',
                    _parentId: 'objectOne_optionalRelations_value_data_optionalFlatArray__parentId',
                    value: 'objectOne_optionalRelations_value_data_optionalFlatArray_value',
                  },
                },
                data_optionalRelation: {
                  lookups: {},
                  sort: null,
                  match: null,
                  structure: 'test',
                  localField: 'data_optionalRelation',
                  foreignField: 'objectOne_optionalRelations_value_data_optionalRelation__id',
                  fields: {
                    _id: 'objectOne_optionalRelations_value_data_optionalRelation__id',
                    objectOne: 'objectOne_optionalRelations_value_data_optionalRelation_objectOne',
                    objectOne_objectTwo: 'objectOne_optionalRelations_value_data_optionalRelation_objectOne_objectTwo',
                    objectOne_objectTwo_optionalIndexedString: 'objectOne_optionalRelations_value_data_optionalRelation_objectOne_objectTwo_optionalIndexedString',
                  },
                },
              },
              sort: null,
              match: null,
              structure: 'otherTest',
              localField: 'value',
              foreignField: 'objectOne_optionalRelations_value__id',
              fields: {
                _id: 'objectOne_optionalRelations_value__id',
                data: 'objectOne_optionalRelations_value_data',
                data_optionalFlatArray: 'objectOne_optionalRelations_value_data_optionalFlatArray',
                data_optionalRelation: 'objectOne_optionalRelations_value_data_optionalRelation',
              },
            },
          },
          localField: '_id',
          structure: '_test_objectOne_optionalRelations',
          foreignField: 'objectOne_optionalRelations__parentId',
          fields: {
            _id: 'objectOne_optionalRelations__id',
            _parentId: 'objectOne_optionalRelations__parentId',
            value: 'objectOne_optionalRelations_value',
          },
        },
        objectOne_objectTwo_optionalNestedArray: {
          sort: null,
          match: null,
          lookups: {
            value_data_flatArray: {
              sort: null,
              match: null,
              lookups: {},
              localField: '_id',
              structure: '_test_objectOne_objectTwo_optionalNestedArray_value_data_flatArray',
              foreignField: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray__parentId',
              fields: {
                _id: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray__id',
                _parentId: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray__parentId',
                value: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray_value',
              },
            },
            value_data_nestedArray: {
              sort: null,
              match: null,
              lookups: {},
              localField: '_id',
              structure: '_test_objectOne_objectTwo_optionalNestedArray_value_data_nestedArray',
              foreignField: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray__parentId',
              fields: {
                _id: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray__id',
                _parentId: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray__parentId',
                value: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray_value',
                value_key: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray_value_key',
                value_optionalRelation: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray_value_optionalRelation',
              },
            },
          },
          localField: '_id',
          structure: '_test_objectOne_objectTwo_optionalNestedArray',
          foreignField: 'objectOne_objectTwo_optionalNestedArray__parentId',
          fields: {
            _id: 'objectOne_objectTwo_optionalNestedArray__id',
            _parentId: 'objectOne_objectTwo_optionalNestedArray__parentId',
            value: 'objectOne_objectTwo_optionalNestedArray_value',
            value_data: 'objectOne_objectTwo_optionalNestedArray_value_data',
            value_data_flatArray: 'objectOne_objectTwo_optionalNestedArray_value_data_flatArray',
            value_data_optionalInteger: 'objectOne_objectTwo_optionalNestedArray_value_data_optionalInteger',
            value_data_nestedArray: 'objectOne_objectTwo_optionalNestedArray_value_data_nestedArray',
          },
        },
      },
      localField: null,
      foreignField: null,
      fields: {
        _id: '_id',
        indexedString: 'indexedString',
        objectOne: 'objectOne',
        objectOne_objectTwo: 'objectOne_objectTwo',
        objectOne_objectTwo_optionalIndexedString: 'objectOne_objectTwo_optionalIndexedString',
        objectOne_optionalRelations: 'objectOne_optionalRelations',
        objectOne_objectTwo_optionalNestedArray: 'objectOne_objectTwo_optionalNestedArray',
      },
    })).toEqual(
      `SELECT
  DISTINCT \`test\`.\`_id\`, \`indexedString\`
FROM
  \`test\`
LEFT JOIN (
  SELECT
    \`_test_5\`.\`_id\` AS \`objectOne_optionalRelations__id\`,
    \`_test_5\`.\`_parentId\` AS \`objectOne_optionalRelations__parentId\`,
    \`_test_5\`.\`value\` AS \`objectOne_optionalRelations_value\`,
    \`value\`.*
  FROM
    \`_test_5\`
  LEFT JOIN (
    SELECT
      \`otherTest\`.\`_id\` AS \`objectOne_optionalRelations_value__id\`,
      \`otherTest\`.\`data\` AS \`objectOne_optionalRelations_value_data\`,
      \`otherTest\`.\`data_optionalFlatArray\` AS \`objectOne_optionalRelations_value_data_optionalFlatArray\`,
      \`otherTest\`.\`data_optionalRelation\` AS \`objectOne_optionalRelations_value_data_optionalRelation\`,
      \`data_optionalFlatArray\`.*,
      \`data_optionalRelation\`.*
    FROM
      \`otherTest\`
    LEFT JOIN (
      SELECT
        \`_otherTest_2\`.\`_id\` AS \`objectOne_optionalRelations_value_data_optionalFlatArray__id\`,
        \`_otherTest_2\`.\`_parentId\` AS \`objectOne_optionalRelations_value_data_optionalFlatArray__parentId\`,
        \`_otherTest_2\`.\`value\` AS \`objectOne_optionalRelations_value_data_optionalFlatArray_value\`
      FROM
        \`_otherTest_2\`
    ) AS \`data_optionalFlatArray\`
    ON \`otherTest\`.\`_id\` = \`data_optionalFlatArray\`.\`objectOne_optionalRelations_value_data_optionalFlatArray__parentId\`
    LEFT JOIN (
      SELECT
        \`test\`.\`_id\` AS \`objectOne_optionalRelations_value_data_optionalRelation__id\`,
        \`test\`.\`objectOne\` AS \`objectOne_optionalRelations_value_data_optionalRelation_objectOne\`,
        \`test\`.\`objectOne_objectTwo\` AS \`objectOne_optionalRelations_value_data_optionalRelation_objectOne_objectTwo\`,
        \`test\`.\`objectOne_objectTwo_optionalIndexedString\` AS \`objectOne_optionalRelations_value_data_optionalRelation_objectOne_objectTwo_optionalIndexedString\`
      FROM
        \`test\`
    ) AS \`data_optionalRelation\`
    ON \`otherTest\`.\`data_optionalRelation\` = \`data_optionalRelation\`.\`objectOne_optionalRelations_value_data_optionalRelation__id\`
  ) AS \`value\`
  ON \`_test_5\`.\`value\` = \`value\`.\`objectOne_optionalRelations_value__id\`
) AS \`objectOne_optionalRelations\`
ON \`test\`.\`_id\` = \`objectOne_optionalRelations\`.\`objectOne_optionalRelations__parentId\`
LEFT JOIN (
  SELECT
    \`_test_6\`.\`_id\` AS \`objectOne_objectTwo_optionalNestedArray__id\`,
    \`_test_6\`.\`_parentId\` AS \`objectOne_objectTwo_optionalNestedArray__parentId\`,
    \`_test_6\`.\`value\` AS \`objectOne_objectTwo_optionalNestedArray_value\`,
    \`_test_6\`.\`value_data\` AS \`objectOne_objectTwo_optionalNestedArray_value_data\`,
    \`_test_6\`.\`value_data_flatArray\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_flatArray\`,
    \`_test_6\`.\`value_data_optionalInteger\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_optionalInteger\`,
    \`_test_6\`.\`value_data_nestedArray\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_nestedArray\`,
    \`value_data_flatArray\`.*,
    \`value_data_nestedArray\`.*
  FROM
    \`_test_6\`
  LEFT JOIN (
    SELECT
      \`_test_7\`.\`_id\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_flatArray__id\`,
      \`_test_7\`.\`_parentId\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_flatArray__parentId\`,
      \`_test_7\`.\`value\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_flatArray_value\`
    FROM
      \`_test_7\`
  ) AS \`value_data_flatArray\`
  ON \`_test_6\`.\`_id\` = \`value_data_flatArray\`.\`objectOne_objectTwo_optionalNestedArray_value_data_flatArray__parentId\`
  LEFT JOIN (
    SELECT
      \`_test_8\`.\`_id\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_nestedArray__id\`,
      \`_test_8\`.\`_parentId\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_nestedArray__parentId\`,
      \`_test_8\`.\`value\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_nestedArray_value\`,
      \`_test_8\`.\`value_key\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_nestedArray_value_key\`,
      \`_test_8\`.\`value_optionalRelation\` AS \`objectOne_objectTwo_optionalNestedArray_value_data_nestedArray_value_optionalRelation\`
    FROM
      \`_test_8\`
  ) AS \`value_data_nestedArray\`
  ON \`_test_6\`.\`_id\` = \`value_data_nestedArray\`.\`objectOne_objectTwo_optionalNestedArray_value_data_nestedArray__parentId\`
) AS \`objectOne_objectTwo_optionalNestedArray\`
ON \`test\`.\`_id\` = \`objectOne_objectTwo_optionalNestedArray\`.\`objectOne_objectTwo_optionalNestedArray__parentId\`
WHERE
  (
    \`objectOne_objectTwo_optionalNestedArray_value_data_flatArray_value\` REGEXP ?
     OR \`objectOne_objectTwo_optionalIndexedString\` REGEXP ?
  )
  AND \`objectOne_objectTwo_optionalIndexedString\` = ?
  AND \`objectOne_objectTwo_optionalNestedArray_value_data_optionalInteger\` = ?
  AND \`objectOne_optionalRelations_value\` = ?
  AND \`objectOne_optionalRelations_value_data_optionalRelation_objectOne_objectTwo_optionalIndexedString\` = ?
GROUP BY \`test\`.\`_id\`, \`indexedString\`
ORDER BY
  \`indexedString\` DESC`,
    );

    expect(databaseClient.generateQuery('otherTest', {
      structure: 'otherTest',
      lookups: {
        data_optionalFlatArray: {
          sort: null,
          match: null,
          lookups: {},
          foreignField: 'data_optionalFlatArray__parentId',
          localField: '_id',
          fields: {
            _id: 'data_optionalFlatArray__id',
            _parentId: 'data_optionalFlatArray__parentId',
            value: 'data_optionalFlatArray_value',
          },
          structure: '_otherTest_data_optionalFlatArray',
        },
        data_optionalRelation: {
          fields: {
            _id: 'data_optionalRelation__id',
            indexedString: 'data_optionalRelation_indexedString',
          },
          structure: 'test',
          foreignField: 'data_optionalRelation__id',
          localField: 'data_optionalRelation',
          lookups: {},
          match: null,
          sort: null,
        },
      },
      sort: null,
      match: {
        query: [],
        filters: [
          { _id: ['000000000000000000000001'] },
          { data_optionalFlatArray_value: [new Date('2024-06-26T10:57:08.820Z'), new Date('2024-06-26T10:57:09.820Z')] },
          { _createdAt: [new Date('2024-06-26T10:57:08.820Z')] },
          { data_optionalRelation: ['000000000000000000000002'] },
        ],
      },
      localField: null,
      foreignField: null,
      fields: {
        _id: '_id',
        data: 'data',
        _createdAt: '_createdAt',
        data_optionalRelation: 'data_optionalRelation',
        data_optionalFlatArray: 'data_optionalFlatArray',
      },
    })).toEqual(
      `SELECT
  DISTINCT \`otherTest\`.\`_id\`
FROM
  \`otherTest\`
LEFT JOIN (
  SELECT
    \`_otherTest_2\`.\`_id\` AS \`data_optionalFlatArray__id\`,
    \`_otherTest_2\`.\`_parentId\` AS \`data_optionalFlatArray__parentId\`,
    \`_otherTest_2\`.\`value\` AS \`data_optionalFlatArray_value\`
  FROM
    \`_otherTest_2\`
) AS \`data_optionalFlatArray\`
ON \`otherTest\`.\`_id\` = \`data_optionalFlatArray\`.\`data_optionalFlatArray__parentId\`
LEFT JOIN (
  SELECT
    \`test\`.\`_id\` AS \`data_optionalRelation__id\`,
    \`test\`.\`indexedString\` AS \`data_optionalRelation_indexedString\`
  FROM
    \`test\`
) AS \`data_optionalRelation\`
ON \`otherTest\`.\`data_optionalRelation\` = \`data_optionalRelation\`.\`data_optionalRelation__id\`
WHERE
  \`_id\` IN (?)
  AND \`data_optionalFlatArray_value\` IN (?, ?)
  AND \`_createdAt\` IN (?)
  AND \`data_optionalRelation\` IN (?)`,
    );
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
        test: [
          {
            _id: '000000000000000000000001',
            _isDeleted: false,
            indexedString: 'test',
            objectOne: true,
            objectOne_boolean: true,
            objectOne_objectTwo: true,
            objectOne_objectTwo_optionalIndexedString: 'test1',
            objectOne_objectTwo_optionalNestedArray: true,
            objectOne_optionalRelations: true,
          },
        ],
        _test_objectOne_objectTwo_optionalNestedArray: [
          {
            _id: '000000000000000000000001',
            _parentId: '000000000000000000000001',
            _resourceId: '000000000000000000000001',
            value: null,
            value_data: null,
            value_data_optionalInteger: null,
            value_data_flatArray: null,
            value_data_nestedArray: null,
          },
          {
            _id: '000000000000000000000002',
            _parentId: '000000000000000000000001',
            _resourceId: '000000000000000000000001',
            value: true,
            value_data: true,
            value_data_flatArray: true,
            value_data_optionalInteger: null,
            value_data_nestedArray: true,
          },
          {
            _id: '000000000000000000000008',
            _parentId: '000000000000000000000001',
            _resourceId: '000000000000000000000001',
            value: true,
            value_data: true,
            value_data_flatArray: true,
            value_data_optionalInteger: 1,
            value_data_nestedArray: true,
          },
          {
            _id: '000000000000000000000013',
            _parentId: '000000000000000000000001',
            _resourceId: '000000000000000000000001',
            value: null,
            value_data: null,
            value_data_optionalInteger: null,
            value_data_flatArray: null,
            value_data_nestedArray: null,
          },
        ],
        _test_objectOne_objectTwo_optionalNestedArray_value_data_flatArray: [
          {
            _id: '000000000000000000000003',
            _parentId: '000000000000000000000002',
            _resourceId: '000000000000000000000001',
            value: 'test2',
          },
          {
            _id: '000000000000000000000004',
            _parentId: '000000000000000000000002',
            _resourceId: '000000000000000000000001',
            value: null,
          },
          {
            _id: '000000000000000000000005',
            _parentId: '000000000000000000000002',
            _resourceId: '000000000000000000000001',
            value: 'test3',
          },
          {
            _id: '000000000000000000000009',
            _parentId: '000000000000000000000008',
            _resourceId: '000000000000000000000001',
            value: 'test6',
          },
          {
            _id: '000000000000000000000010',
            _parentId: '000000000000000000000008',
            _resourceId: '000000000000000000000001',
            value: null,
          },
          {
            _id: '000000000000000000000011',
            _parentId: '000000000000000000000008',
            _resourceId: '000000000000000000000001',
            value: 'test7',
          },
        ],
        _test_objectOne_objectTwo_optionalNestedArray_value_data_nestedArray: [
          {
            _id: '000000000000000000000006',
            _parentId: '000000000000000000000002',
            _resourceId: '000000000000000000000001',
            value: true,
            value_key: 'test4',
            value_optionalRelation: '000000000000000000000022',
          },
          {
            _id: '000000000000000000000007',
            _parentId: '000000000000000000000002',
            _resourceId: '000000000000000000000001',
            value: true,
            value_key: 'test5',
            value_optionalRelation: null,
          },
          {
            _id: '000000000000000000000012',
            _parentId: '000000000000000000000008',
            _resourceId: '000000000000000000000001',
            value: true,
            value_key: 'test8',
            value_optionalRelation: '000000000000000000000023',
          },
        ],
        _test_objectOne_optionalRelations: [
          {
            _id: '000000000000000000000014',
            _parentId: '000000000000000000000001',
            _resourceId: '000000000000000000000001',
            value: null,
          },
        ],
      });

      expect(databaseClient.structurePayload('otherTest', new Id('000000000000000000000001'), {
        _id: new Id('000000000000000000000001'),
        _createdAt: new Date('2023-01-01'),
        binary: new ArrayBuffer(10),
        optionalRelation: null,
        enum: 'ONE',
        data: {
          optionalFlatArray: null,
          optionalRelation: new Id('000000000000000000000002'),
        },
      }, 'CREATE')).toEqual({
        _otherTest_data_optionalFlatArray: [],
        otherTest: [
          {
            _id: '000000000000000000000001',
            optionalRelation: null,
            enum: 'ONE',
            _createdAt: new Date('2023-01-01'),
            binary: expect.any(String) as string,
            data: true,
            data_optionalFlatArray: null,
            data_optionalRelation: '000000000000000000000002',
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
        _test_objectOne_objectTwo_optionalNestedArray: [],
        _test_objectOne_objectTwo_optionalNestedArray_value_data_flatArray: [],
        _test_objectOne_objectTwo_optionalNestedArray_value_data_nestedArray: [],
        _test_objectOne_optionalRelations: [
          {
            _id: '000000000000000000000015',
            _parentId: '000000000000000000000001',
            _resourceId: '000000000000000000000001',
            value: '000000000000000000000041',
          },
          {
            _id: '000000000000000000000016',
            _parentId: '000000000000000000000001',
            _resourceId: '000000000000000000000001',
            value: null,
          },
          {
            _id: '000000000000000000000017',
            _parentId: '000000000000000000000001',
            _resourceId: '000000000000000000000001',
            value: '000000000000000000000042',
          },
        ],
        test: [
          {
            objectOne: true,
            objectOne_objectTwo: true,
            objectOne_objectTwo_optionalNestedArray: null,
            objectOne_optionalRelations: true,
          },
        ],
      });
    });
  });

  test('[formatResources]', () => {
    const mapping = new Map([
      ['_id', '_id'],
      ['_isDeleted', 'test_24'],
      ['objectOne', 'test_0'],
      ['objectOne_objectTwo', 'test_1'],
      ['objectOne_objectTwo_optionalIndexedString', 'test_2'],
      ['objectOne_optionalRelations', 'test_3'],
      ['objectOne_objectTwo_optionalNestedArray', 'test_4'],
      ['objectOne_optionalRelations__id', 'test_5'],
      ['objectOne_optionalRelations__parentId', 'test_6'],
      ['objectOne_optionalRelations_value', 'test_7'],
      ['objectOne_optionalRelations_value__id', 'test_8'],
      ['objectOne_optionalRelations_value_data', 'test_9'],
      ['objectOne_optionalRelations_value_data_optionalFlatArray', 'test_10'],
      ['objectOne_optionalRelations_value_data_optionalFlatArray__id', 'test_11'],
      ['objectOne_optionalRelations_value_data_optionalFlatArray__parentId', 'test_12'],
      ['objectOne_optionalRelations_value_data_optionalFlatArray_value', 'test_13'],
      ['objectOne_objectTwo_optionalNestedArray__id', 'test_14'],
      ['objectOne_objectTwo_optionalNestedArray__parentId', 'test_15'],
      ['objectOne_objectTwo_optionalNestedArray_value', 'test_16'],
      ['objectOne_objectTwo_optionalNestedArray_value_data', 'test_17'],
      ['objectOne_objectTwo_optionalNestedArray_value_data_flatArray', 'test_18'],
      ['objectOne_objectTwo_optionalNestedArray_value_data_optionalInteger', 'test_19'],
      ['objectOne_objectTwo_optionalNestedArray_value_data_flatArray__id', 'test_20'],
      ['objectOne_objectTwo_optionalNestedArray_value_data_flatArray__parentId', 'test_21'],
      ['objectOne_objectTwo_optionalNestedArray_value_data_flatArray_value', 'test_22'],
      ['indexedString', 'test_23'],
    ]);
    expect(databaseClient.formatResources('test', [
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000002',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000003',
        test_8: '000000000000000000000003',
        test_9: true,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000004',
        test_15: '000000000000000000000001',
        test_16: null,
        test_17: null,
        test_18: null,
        test_19: null,
        test_20: null,
        test_21: null,
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000002',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000003',
        test_8: '000000000000000000000003',
        test_9: 1,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000006',
        test_21: '000000000000000000000005',
        test_22: 'test2',
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000002',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000003',
        test_8: '000000000000000000000003',
        test_9: 1,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000007',
        test_21: '000000000000000000000005',
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000002',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000003',
        test_8: '000000000000000000000003',
        test_9: 1,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000008',
        test_21: '000000000000000000000005',
        test_22: 'test3',
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000002',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000003',
        test_8: '000000000000000000000003',
        test_9: 1,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000009',
        test_15: '000000000000000000000001',
        test_16: null,
        test_17: null,
        test_18: null,
        test_19: null,
        test_20: null,
        test_21: null,
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000012',
        test_12: '000000000000000000000011',
        test_13: 'test1',
        test_14: '000000000000000000000004',
        test_15: '000000000000000000000001',
        test_16: null,
        test_17: null,
        test_18: null,
        test_19: null,
        test_20: null,
        test_21: null,
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000012',
        test_12: '000000000000000000000011',
        test_13: 'test1',
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000006',
        test_21: '000000000000000000000005',
        test_22: 'test2',
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000012',
        test_12: '000000000000000000000011',
        test_13: 'test1',
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000007',
        test_21: '000000000000000000000005',
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000012',
        test_12: '000000000000000000000011',
        test_13: 'test1',
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000008',
        test_21: '000000000000000000000005',
        test_22: 'test3',
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000012',
        test_12: '000000000000000000000011',
        test_13: 'test1',
        test_14: '000000000000000000000009',
        test_15: '000000000000000000000001',
        test_16: null,
        test_17: null,
        test_18: null,
        test_19: null,
        test_20: null,
        test_21: null,
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000013',
        test_12: '000000000000000000000011',
        test_13: 'test2',
        test_14: '000000000000000000000004',
        test_15: '000000000000000000000001',
        test_16: null,
        test_17: null,
        test_18: null,
        test_19: null,
        test_20: null,
        test_21: null,
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000013',
        test_12: '000000000000000000000011',
        test_13: 'test2',
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000006',
        test_21: '000000000000000000000005',
        test_22: 'test2',
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000013',
        test_12: '000000000000000000000011',
        test_13: 'test2',
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000007',
        test_21: '000000000000000000000005',
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000013',
        test_12: '000000000000000000000011',
        test_13: 'test2',
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000008',
        test_21: '000000000000000000000005',
        test_22: 'test3',
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000010',
        test_6: '000000000000000000000001',
        test_7: '000000000000000000000011',
        test_8: '000000000000000000000011',
        test_9: 1,
        test_10: 1,
        test_11: '000000000000000000000013',
        test_12: '000000000000000000000011',
        test_13: 'test2',
        test_14: '000000000000000000000009',
        test_15: '000000000000000000000001',
        test_16: null,
        test_17: null,
        test_18: null,
        test_19: null,
        test_20: null,
        test_21: null,
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000014',
        test_6: '000000000000000000000001',
        test_7: null,
        test_8: null,
        test_9: null,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000004',
        test_15: '000000000000000000000001',
        test_16: null,
        test_17: null,
        test_18: null,
        test_19: null,
        test_20: null,
        test_21: null,
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000014',
        test_6: '000000000000000000000001',
        test_7: null,
        test_8: null,
        test_9: null,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000006',
        test_21: '000000000000000000000005',
        test_22: 'test2',
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000014',
        test_6: '000000000000000000000001',
        test_7: null,
        test_8: null,
        test_9: null,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000007',
        test_21: '000000000000000000000005',
        test_22: null,
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000014',
        test_6: '000000000000000000000001',
        test_7: null,
        test_8: null,
        test_9: null,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000005',
        test_15: '000000000000000000000001',
        test_16: 1,
        test_17: 1,
        test_18: 1,
        test_19: null,
        test_20: '000000000000000000000008',
        test_21: '000000000000000000000005',
        test_22: 'test3',
      },
      {
        _id: '000000000000000000000001',
        test_23: 'test',
        test_24: Buffer.from('1'),
        test_0: true,
        test_1: true,
        test_2: 'test1',
        test_3: true,
        test_4: true,
        test_5: '000000000000000000000014',
        test_6: '000000000000000000000001',
        test_7: null,
        test_8: null,
        test_9: null,
        test_10: null,
        test_11: null,
        test_12: null,
        test_13: null,
        test_14: '000000000000000000000009',
        test_15: '000000000000000000000001',
        test_16: null,
        test_17: null,
        test_18: null,
        test_19: null,
        test_20: null,
        test_21: null,
        test_22: null,
      },
    ], new Set([
      '_id',
      '_isDeleted',
      'indexedString',
      'objectOne',
      'objectOne.objectTwo',
      'objectOne.optionalRelations',
      'objectOne.optionalRelations.data',
      'objectOne.objectTwo.optionalNestedArray',
      'objectOne.objectTwo.optionalIndexedString',
      'objectOne.objectTwo.optionalNestedArray.data',
      'objectOne.optionalRelations.data.optionalFlatArray',
      'objectOne.objectTwo.optionalNestedArray.data.flatArray',
    ]), mapping)).toEqual([
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
                  flatArray: [
                    'test2',
                    null,
                    'test3',
                  ],
                },
              },
              null,
            ],
          },
          optionalRelations: [
            {
              _id: new Id('000000000000000000000003'),
              data: {
                optionalFlatArray: null,
              },
            },
            {
              _id: new Id('000000000000000000000011'),
              data: {
                optionalFlatArray: [
                  'test1',
                  'test2',
                ],
              },
            },
            null,
          ],
        },
      },
    ]);

    expect(databaseClient.formatResources('otherTest', [{
      _id: '000000000000000000000001',
      otherTest_0: '',
      otherTest_1: true,
      otherTest_2: true,
      otherTest_3: null,
      otherTest_4: null,
      otherTest_5: null,
    }], new Set(['_id', 'binary', 'data.optionalFlatArray']), new Map([
      ['_id', '_id'],
      ['binary', 'otherTest_0'],
      ['data', 'otherTest_1'],
      ['data_optionalFlatArray', 'otherTest_2'],
      ['data_optionalFlatArray__id', 'otherTest_3'],
      ['data_optionalFlatArray__parentId', 'otherTest_4'],
      ['data_optionalFlatArray__value', 'otherTest_5'],
    ]))).toEqual([
      {
        _id: new Id('000000000000000000000001'),
        binary: new ArrayBuffer(0),
        data: {
          optionalFlatArray: [],
        },
      },
    ]);
  });

  describe('[handleError]', () => {
    test('foreign key constraing error', async () => {
      const callback = async (): Promise<void> => {
        await Promise.resolve();
        const error = new Error('FOREIGN KEY (`_id`)');
        (error as unknown as { code: string; }).code = 'ER_ROW_IS_REFERENCED_2';
        throw error;
      };
      const databaseError = new DatabaseError('RESOURCE_REFERENCED', { path: '_id' });
      await expect(async () => databaseClient.handleError(callback)).rejects.toEqual(databaseError);
    });

    test('unique index constraing error', async () => {
      const callback = async (): Promise<void> => {
        await Promise.resolve();
        const error = new Error('Duplicate entry \'test\' for key \'_id\'');
        (error as unknown as { code: string; }).code = 'ER_DUP_ENTRY';
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
      expect(mysql.createPool).toHaveBeenCalledTimes(2);
      expect(mysql.createPool).toHaveBeenCalledWith({
        maxIdle: 0,
        idleTimeout: 0,
        host: 'localhost',
        database: 'test',
        connectionLimit: 0,
      });
      expect(logger.debug).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledWith('[MySQLDatabaseClient][handleError] Connecting to database test...');
    });
  });

  test('[constructor]', () => {
    vi.clearAllMocks();
    databaseClient = new MySQLDatabaseClient<DataModel>(model, logger, cacheClient, {
      protocol: 'http',
      host: 'localhost',
      port: null,
      user: null,
      password: null,
      database: 'test',
      connectTimeout: 0,
      connectionLimit: 0,
    }) as TestMySQLDatabaseClient;
    expect(mysql.createPool).toHaveBeenCalledOnce();
    expect(mysql.createPool).toHaveBeenCalledWith({
      maxIdle: 0,
      idleTimeout: 0,
      host: 'localhost',
      connectionLimit: 0,
    });
  });

  test('[dropDatabase]', async () => {
    await databaseClient.dropDatabase();
    expect(databaseClient.client.execute).toHaveBeenCalledOnce();
    expect(databaseClient.client.execute).toHaveBeenCalledWith('DROP DATABASE IF EXISTS test;');
    expect(databaseClient.isConnected).toBe(false);
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      '[MySQLDatabaseClient][dropDatabase] Dropping database test...',
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[MySQLDatabaseClient][dropDatabase] Successfully dropped database test.',
    );
  });

  test('[createDatabase]', async () => {
    await databaseClient.createDatabase();
    expect(databaseClient.client.query).toHaveBeenCalledOnce();
    expect(databaseClient.client.query).toHaveBeenCalledWith(
      'CREATE DATABASE IF NOT EXISTS test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
    );
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      '[MySQLDatabaseClient][createDatabase] Creating database test...',
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[MySQLDatabaseClient][createDatabase] Successfully created database test.',
    );
  });

  test('[createMissingStructures]', async () => {
    vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
    databaseClient.resourcesMetadata = {
      test: {
        fields: {},
        indexes: [],
        constraints: [],
        structure: 'test',
        subStructures: [],
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      },
      otherTest: {
        fields: {},
        indexes: [],
        constraints: [],
        subStructures: [],
        structure: 'otherTest',
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      },
    };
    databaseClient.generateResourceMetadata('test');
    databaseClient.generateResourceMetadata('otherTest');
    await databaseClient.createMissingStructures();
    const log1 = '[MySQLDatabaseClient][createMissingStructures] Creating table test...';
    const log2 = '[MySQLDatabaseClient][createMissingStructures] Creating table _test_1...';
    const log3 = '[MySQLDatabaseClient][createMissingStructures] Creating table _test_2...';
    const log4 = '[MySQLDatabaseClient][createMissingStructures] Creating table _test_3...';
    const log5 = '[MySQLDatabaseClient][createMissingStructures] Creating table _test_4...';
    const log6 = '[MySQLDatabaseClient][createMissingStructures] Creating table otherTest...';
    const log7 = '[MySQLDatabaseClient][createMissingStructures] Creating table _otherTest_1...';
    const log8 = '[MySQLDatabaseClient][createMissingStructures] Creating table _config...';
    expect(logger.info).toHaveBeenCalledTimes(8);
    expect(logger.info).toHaveBeenCalledWith(log1);
    expect(logger.info).toHaveBeenCalledWith(log2);
    expect(logger.info).toHaveBeenCalledWith(log3);
    expect(logger.info).toHaveBeenCalledWith(log4);
    expect(logger.info).toHaveBeenCalledWith(log5);
    expect(logger.info).toHaveBeenCalledWith(log6);
    expect(logger.info).toHaveBeenCalledWith(log7);
    expect(logger.info).toHaveBeenCalledWith(log8);
    expect(logger.debug).toHaveBeenCalledTimes(82);
    const query1 = 'SHOW TABLES;';
    const query2 = 'CREATE TABLE `test` (\n  `_id` CHAR(24) NOT NULL,\n  `_isDeleted` BIT NOT'
      + ' NULL,\n  `indexedString` VARCHAR(255) NOT NULL,\n  `objectOne` BIT NOT NULL,\n  '
      + '`objectOne_boolean` BIT NOT NULL,\n  `objectOne_optionalRelations` BIT,\n  '
      + '`objectOne_objectTwo` BIT NOT NULL,\n  `objectOne_objectTwo_optionalIndexedString` '
      + 'VARCHAR(255),\n  `objectOne_objectTwo_optionalNestedArray` BIT,\n  PRIMARY KEY (`_id`)\n);';
    const query3 = 'CREATE INDEX index_test_1 ON `test` (`indexedString`);';
    const query4 = 'CREATE UNIQUE INDEX index_test_2 ON `test` (`objectOne_objectTwo_optionalIndexedString`);';
    const query5 = 'ALTER TABLE `_otherTest_1` ADD CONSTRAINT fk__otherTest_1_1 FOREIGN KEY (`_resourceId`) REFERENCES `otherTest`(`_id`)';
    const query6 = 'DROP TABLE IF EXISTS `_config`;';
    const query7 = 'CREATE TABLE `_config` (`key` VARCHAR(255) NOT NULL PRIMARY KEY, `value` LONGTEXT NOT NULL);';
    expect(databaseClient.client.query).toHaveBeenCalledTimes(44);
    expect(databaseClient.client.query).toHaveBeenCalledWith(query1);
    expect(databaseClient.client.query).toHaveBeenCalledWith(query2);
    expect(databaseClient.client.query).toHaveBeenCalledWith(query3);
    expect(databaseClient.client.query).toHaveBeenCalledWith(query4);
    expect(databaseClient.client.query).toHaveBeenCalledWith(query5);
    expect(databaseClient.client.query).toHaveBeenCalledWith(query6);
    expect(databaseClient.client.query).toHaveBeenCalledWith(query7);
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
    expect(logger.info).toHaveBeenCalledWith('[MySQLDatabaseClient][reset] Initializing tables...');
    expect(logger.info).toHaveBeenCalledWith('[MySQLDatabaseClient][reset] Successfully initialized tables.');
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
      vi.spyOn(databaseClient, 'generateQuery').mockImplementation(vi.fn(() => 'SQL_QUERY'));
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      vi.spyOn(databaseClient, 'parseFields').mockImplementation(vi.fn(() => ({
        projections: 'PROJECTIONS' as unknown,
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
      const query = 'SQL_QUERY\nUNION\nSQL_QUERY';
      const log1 = '[MySQLDatabaseClient][checkForeignIds] Performing the following SQL query on database:';
      const log2 = '[MySQLDatabaseClient][checkForeignIds]\n\nSQL_QUERY\nUNION\nSQL_QUERY\n';
      const log3 = '[MySQLDatabaseClient][checkForeignIds] [\n  test,\n  test\n]\n';
      expect(logger.debug).toHaveBeenCalledTimes(3);
      expect(logger.debug).toHaveBeenCalledWith(log1);
      expect(logger.debug).toHaveBeenCalledWith(log2);
      expect(logger.debug).toHaveBeenCalledWith(log3);
      expect(databaseClient.client.execute).toHaveBeenCalledOnce();
      expect(databaseClient.client.execute).toHaveBeenCalledWith(query, ['test', 'test']);
    });
  });

  describe('[create]', () => {
    test('error', async () => {
      process.env.DATABASE_ERROR = 'true';
      const connection = await databaseClient.client.getConnection();
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      vi.spyOn(databaseClient, 'structurePayload').mockImplementation(vi.fn(() => ({
        test: [
          // Keys order is important here, to make sure values are re-ordered in SQL query.
          { _id: new Id('000000000000000000000001'), key: 'test' },
          { key: 'test', _id: new Id('000000000000000000000002') },
        ],
        otherTest: [],
      })));
      await expect(async () => {
        const payload = { _id: new Id('000000000000000000000001') } as DataModel['test'];
        await databaseClient.create('test', payload);
      }).rejects.toEqual(new Error('ERROR'));
      expect(connection.rollback).toHaveBeenCalledOnce();
      expect(connection.release).toHaveBeenCalledOnce();
    });

    test('no error', async () => {
      const connection = await databaseClient.client.getConnection();
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      vi.spyOn(databaseClient, 'structurePayload').mockImplementation(vi.fn(() => ({
        test: [
          // Keys order is important here, to make sure values are re-ordered in SQL query.
          { _id: '000000000000000000000001', key: 'test' },
          { key: 'test', _id: '000000000000000000000002' },
        ],
        otherTest: [],
      })));
      const payload = { _id: new Id('000000000000000000000001') } as DataModel['test'];
      await databaseClient.create('test', payload);
      expect(connection.beginTransaction).toHaveBeenCalledOnce();
      const query = 'INSERT INTO `test` (\n  `_id`,\n  `key`\n)\nVALUES\n  (?, ?),\n  (?, ?);';
      const log1 = '[MySQLDatabaseClient][create] Performing the following SQL query on database:';
      const log2 = '[MySQLDatabaseClient][create]\n\nINSERT INTO `test` (\n  `_id`,\n  `key`\n)\nVALUES\n  (?, ?),\n  (?, ?);\n';
      const log3 = '[MySQLDatabaseClient][create] [\n  000000000000000000000001,\n  test,\n  000000000000000000000002,\n  test\n]\n';
      expect(logger.debug).toHaveBeenCalledTimes(3);
      expect(logger.debug).toHaveBeenCalledWith(log1);
      expect(logger.debug).toHaveBeenCalledWith(log2);
      expect(logger.debug).toHaveBeenCalledWith(log3);
      expect(connection.execute).toHaveBeenCalledOnce();
      expect(connection.execute).toHaveBeenCalledWith(query, [
        '000000000000000000000001',
        'test',
        '000000000000000000000002',
        'test',
      ]);
      expect(connection.commit).toHaveBeenCalledOnce();
      expect(connection.release).toHaveBeenCalledOnce();
    });
  });

  describe('[update]', () => {
    test('error', async () => {
      process.env.DATABASE_ERROR = 'true';
      const connection = await databaseClient.client.getConnection();
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      vi.spyOn(databaseClient, 'structurePayload').mockImplementation(vi.fn(() => ({
        test: [
          // Keys order is important here, to make sure values are re-ordered in SQL query.
          { _id: new Id('000000000000000000000001'), key: 'test' },
          { key: 'test', _id: new Id('000000000000000000000002') },
        ],
        otherTest: [],
      })));
      await expect(async () => {
        const payload = { indexedString: 'test' } as DataModel['test'];
        await databaseClient.update('test', new Id('000000000000000000000001'), payload);
      }).rejects.toEqual(new Error('ERROR'));
      expect(connection.rollback).toHaveBeenCalledOnce();
      expect(connection.release).toHaveBeenCalledOnce();
    });

    test('no error', async () => {
      const connection = await databaseClient.client.getConnection();
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      vi.spyOn(databaseClient, 'structurePayload').mockImplementation(vi.fn(() => ({
        test: [
          // Keys order is important here, to make sure values are re-ordered in SQL query.
          { _id: '000000000000000000000001', key: 'test' },
          { key: 'test', _id: '000000000000000000000002' },
        ],
        otherTest: [{ otherKey: 'test2' }],
      })));
      const payload = { indexedString: 'test' } as DataModel['test'];
      await databaseClient.update('test', new Id('000000000000000000000001'), payload);
      expect(connection.beginTransaction).toHaveBeenCalledOnce();
      const query1 = 'UPDATE `test` SET\n  `_id` = ?,\n  `key` = ?,\n  `_id` = ?,\n  `key` = ?\nWHERE\n  _id = ?\n  AND `_isDeleted` = false;';
      const query2 = 'DELETE FROM `otherTest` WHERE `_resourceId` = ?;';
      const query3 = 'INSERT INTO `otherTest` (\n  `otherKey`\n)\nVALUES\n  (?);';
      const log1 = '[MySQLDatabaseClient][update] Performing the following SQL query on database:';
      const log2 = `[MySQLDatabaseClient][update]\n\n${query1}\n`;
      const log3 = '[MySQLDatabaseClient][update] [\n  000000000000000000000001\n]\n';
      const log4 = `[MySQLDatabaseClient][update]\n\n${query2}\n`;
      const log5 = '[MySQLDatabaseClient][update] [\n  000000000000000000000001\n]\n';
      const log6 = `[MySQLDatabaseClient][update]\n\n${query3}\n`;
      const log7 = '[MySQLDatabaseClient][update] [\n  test2\n]\n';
      expect(logger.debug).toHaveBeenCalledTimes(9);
      expect(logger.debug).toHaveBeenCalledWith(log1);
      expect(logger.debug).toHaveBeenCalledWith(log2);
      expect(logger.debug).toHaveBeenCalledWith(log3);
      expect(logger.debug).toHaveBeenCalledWith(log4);
      expect(logger.debug).toHaveBeenCalledWith(log5);
      expect(logger.debug).toHaveBeenCalledWith(log6);
      expect(logger.debug).toHaveBeenCalledWith(log7);
      expect(connection.execute).toHaveBeenCalledTimes(3);
      expect(connection.execute).toHaveBeenCalledWith(query1, [
        '000000000000000000000001',
        'test',
        '000000000000000000000002',
        'test',
        '000000000000000000000001',
      ]);
      expect(connection.execute).toHaveBeenCalledWith(query2, [
        '000000000000000000000001',
      ]);
      expect(connection.execute).toHaveBeenCalledWith(query3, [
        'test2',
      ]);
      expect(connection.commit).toHaveBeenCalledOnce();
      expect(connection.rollback).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalledOnce();

      // Covers other specific cases.
      process.env.NO_RESULT = 'true';
      await databaseClient.update('otherTest', new Id('000000000000000000000001'), {});
      expect(connection.rollback).toHaveBeenCalledOnce();
    });
  });

  test('[view]', async () => {
    vi.spyOn(databaseClient, 'formatResources').mockImplementation(vi.fn(() => []));
    vi.spyOn(databaseClient, 'generateQuery').mockImplementation(vi.fn(() => 'SQL_QUERY'));
    vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
    vi.spyOn(databaseClient, 'parseFields').mockImplementation(vi.fn(() => ({
      projections: 'PROJECTIONS' as unknown,
      formattedQuery: { match: { filters: [] } } as unknown as FormattedQuery,
    })));
    await databaseClient.view('test', new Id('000000000000000000000001'));
    expect(databaseClient.parseFields).toHaveBeenCalledOnce();
    expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set(), 3);
    const query = 'SQL_QUERY\nWHERE `test`.`_id` = ? AND `test`.`_isDeleted` = false;';
    const log1 = '[MySQLDatabaseClient][view] Performing the following SQL query on database:';
    const log2 = `[MySQLDatabaseClient][view]\n\n${query}\n`;
    const log3 = '[MySQLDatabaseClient][view] [\n  000000000000000000000001\n]\n';
    expect(logger.debug).toHaveBeenCalledTimes(3);
    expect(logger.debug).toHaveBeenCalledWith(log1);
    expect(logger.debug).toHaveBeenCalledWith(log2);
    expect(logger.debug).toHaveBeenCalledWith(log3);
    expect(databaseClient.client.query).toHaveBeenCalledOnce();
    expect(databaseClient.client.query).toHaveBeenCalledWith(query, ['000000000000000000000001']);

    // Covers other specific cases.
    await databaseClient.view('otherTest', new Id('000000000000000000000001'));
  });

  test('[search]', async () => {
    vi.spyOn(databaseClient, 'formatResources').mockImplementation(vi.fn(() => []));
    vi.spyOn(databaseClient, 'generateQuery').mockImplementation(vi.fn(() => 'SQL_QUERY'));
    vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
    vi.spyOn(databaseClient, 'parseFields').mockImplementation(vi.fn(() => ({
      projections: 'PROJECTIONS' as unknown,
      formattedQuery: {
        match: {
          filters: [
            { _id: '000000000000000000000001' },
            { optionalRelation: [1, 2] },
            { _isDeleted: false },
          ],
          query: [
            { indexedString: 'test' },
          ],
        },
      } as unknown as FormattedQuery,
    })));
    const searchBody = {
      filters: { _id: new Id('000000000000000000000001') },
      query: { on: new Set(['indexedString']), text: 'test' },
    };
    const response = await databaseClient.search('test', searchBody);
    expect(databaseClient.parseFields).toHaveBeenCalledTimes(2);
    expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set(['_id', 'indexedString']), 3);
    expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set(['_id', 'indexedString']), 3, {
      query: { on: new Set(['indexedString']), text: 'test' },
      filters: { _id: new Id('000000000000000000000001'), _isDeleted: false },
    }, undefined);
    const query = 'WITH searchResults AS (\nSQL_QUERY\n),\ncount AS (\n  SELECT\n    COUNT(_id)'
      + ' AS total\n  FROM\n    searchResults\n),\npagination AS (\n  SELECT\n    _id,\n    '
      + 'ROW_NUMBER() OVER () AS row_num\n  FROM\n    searchResults\n  LIMIT 20\n  OFFSET 0\n)'
      + '\nSELECT\n  count.total AS __total,\n  results.*\nFROM\n  count\nLEFT JOIN\n  pagination'
      + '\nON 1 = 1\nLEFT JOIN (\nSQL_QUERY\n) AS results\nON results._id = pagination._id'
      + '\nORDER BY pagination.row_num;';
    const log1 = '[MySQLDatabaseClient][search] Performing the following SQL query on database:';
    const log2 = `[MySQLDatabaseClient][search]\n\n${query}\n`;
    const log3 = '[MySQLDatabaseClient][search] [\n  test,\n  000000000000000000000001,\n  1,\n  2,\n  false\n]\n';
    expect(logger.debug).toHaveBeenCalledTimes(3);
    expect(logger.debug).toHaveBeenCalledWith(log1);
    expect(logger.debug).toHaveBeenCalledWith(log2);
    expect(logger.debug).toHaveBeenCalledWith(log3);
    expect(databaseClient.client.query).toHaveBeenCalledOnce();
    expect(databaseClient.client.query).toHaveBeenCalledWith(query, [
      'test',
      '000000000000000000000001',
      1,
      2,
      false,
    ]);
    expect(response).toEqual({ total: 10, results: [] });
    // Covers other specific use cases.
    process.env.NO_RESULT = 'true';
    await databaseClient.search('test', { filters: null, query: null }, { limit: 0 });
  });

  test('[list]', async () => {
    vi.spyOn(databaseClient, 'formatResources').mockImplementation(vi.fn(() => []));
    vi.spyOn(databaseClient, 'generateQuery').mockImplementation(vi.fn(() => 'SQL_QUERY'));
    vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
    vi.spyOn(databaseClient, 'parseFields').mockImplementation(vi.fn(() => ({
      projections: 'PROJECTIONS' as unknown,
      formattedQuery: {
        match: {
          filters: [
            { _isDeleted: false },
          ],
          query: [],
        },
      } as unknown as FormattedQuery,
    })));
    const response = await databaseClient.list('test');
    expect(databaseClient.parseFields).toHaveBeenCalledTimes(2);
    expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set(), 3);
    expect(databaseClient.parseFields).toHaveBeenCalledWith('test', new Set(), 3);
    const query = 'WITH searchResults AS (\nSQL_QUERY\n),\ncount AS (\n  SELECT\n    COUNT(_id)'
      + ' AS total\n  FROM\n    searchResults\n),\npagination AS (\n  SELECT\n    _id,\n    '
      + 'ROW_NUMBER() OVER () AS row_num\n  FROM\n    searchResults\n  LIMIT 20\n  OFFSET 0\n)'
      + '\nSELECT\n  count.total AS __total,\n  results.*\nFROM\n  count\nLEFT JOIN\n  pagination'
      + '\nON 1 = 1\nLEFT JOIN (\nSQL_QUERY\n) AS results\nON results._id = pagination._id'
      + '\nORDER BY pagination.row_num;';
    const log1 = '[MySQLDatabaseClient][list] Performing the following SQL query on database:';
    const log2 = `[MySQLDatabaseClient][list]\n\n${query}\n`;
    const log3 = '[MySQLDatabaseClient][list] [\n  false\n]\n';
    expect(logger.debug).toHaveBeenCalledTimes(3);
    expect(logger.debug).toHaveBeenCalledWith(log1);
    expect(logger.debug).toHaveBeenCalledWith(log2);
    expect(logger.debug).toHaveBeenCalledWith(log3);
    expect(databaseClient.client.query).toHaveBeenCalledOnce();
    expect(databaseClient.client.query).toHaveBeenCalledWith(query, [
      false,
    ]);
    expect(response).toEqual({ total: 10, results: [] });
    // Covers other specific use cases.
    process.env.NO_RESULT = 'true';
    await databaseClient.list('test');
  });

  describe('[delete]', () => {
    test('error', async () => {
      process.env.DATABASE_ERROR = 'true';
      const connection = await databaseClient.client.getConnection();
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      await expect(async () => {
        await databaseClient.delete('test', new Id('000000000000000000000001'));
      }).rejects.toEqual(new Error('ERROR'));
      expect(connection.rollback).toHaveBeenCalledOnce();
      expect(connection.release).toHaveBeenCalledOnce();
    });

    test('no error', async () => {
      const connection = await databaseClient.client.getConnection();
      vi.spyOn(databaseClient, 'handleError').mockImplementation((callback) => callback());
      await databaseClient.delete('test', new Id('000000000000000000000001'));
      expect(connection.beginTransaction).toHaveBeenCalledOnce();
      const query1 = 'DELETE FROM `_test_4` WHERE `_resourceId` = ?;';
      const query2 = 'DELETE FROM `_test_3` WHERE `_resourceId` = ?;';
      const query3 = 'DELETE FROM `_test_2` WHERE `_resourceId` = ?;';
      const query4 = 'DELETE FROM `_test_1` WHERE `_resourceId` = ?;';
      const query5 = 'DELETE FROM `test` WHERE `_id` = ?;';
      const log1 = '[MySQLDatabaseClient][delete] Performing the following SQL query on database:';
      const log2 = `[MySQLDatabaseClient][delete]\n\n${query1}\n`;
      const log3 = '[MySQLDatabaseClient][delete] [\n  000000000000000000000001\n]\n';
      const log4 = `[MySQLDatabaseClient][delete]\n\n${query2}\n`;
      const log5 = '[MySQLDatabaseClient][delete] [\n  000000000000000000000001\n]\n';
      const log6 = `[MySQLDatabaseClient][delete]\n\n${query3}\n`;
      const log7 = '[MySQLDatabaseClient][delete] [\n  000000000000000000000001\n]\n';
      const log8 = `[MySQLDatabaseClient][delete]\n\n${query4}\n`;
      const log9 = '[MySQLDatabaseClient][delete] [\n  000000000000000000000001\n]\n';
      const log10 = `[MySQLDatabaseClient][delete]\n\n${query5}\n`;
      const log11 = '[MySQLDatabaseClient][delete] [\n  000000000000000000000001\n]\n';
      expect(logger.debug).toHaveBeenCalledTimes(15);
      expect(logger.debug).toHaveBeenCalledWith(log1);
      expect(logger.debug).toHaveBeenCalledWith(log2);
      expect(logger.debug).toHaveBeenCalledWith(log3);
      expect(logger.debug).toHaveBeenCalledWith(log4);
      expect(logger.debug).toHaveBeenCalledWith(log5);
      expect(logger.debug).toHaveBeenCalledWith(log6);
      expect(logger.debug).toHaveBeenCalledWith(log7);
      expect(logger.debug).toHaveBeenCalledWith(log8);
      expect(logger.debug).toHaveBeenCalledWith(log9);
      expect(logger.debug).toHaveBeenCalledWith(log10);
      expect(logger.debug).toHaveBeenCalledWith(log11);
      expect(connection.execute).toHaveBeenCalledTimes(5);
      expect(connection.execute).toHaveBeenCalledWith(query1, [
        '000000000000000000000001',
      ]);
      expect(connection.execute).toHaveBeenCalledWith(query2, [
        '000000000000000000000001',
      ]);
      expect(connection.execute).toHaveBeenCalledWith(query3, [
        '000000000000000000000001',
      ]);
      expect(connection.execute).toHaveBeenCalledWith(query4, [
        '000000000000000000000001',
      ]);
      expect(connection.execute).toHaveBeenCalledWith(query5, [
        '000000000000000000000001',
      ]);
      expect(connection.commit).toHaveBeenCalledOnce();
      expect(connection.release).toHaveBeenCalledOnce();
    });
  });
});
