/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Pool,
  emit,
  pool,
  poolClient,
} from '__mocks__/pg';
import PostgreSQLDatabaseClient, {
  type Query,
  type SelectQuery,
  type PostgreSQLDatabaseClientSettings,
} from 'scripts/connectors/postgresql/services/PostgreSQLDatabaseClient';
import { Id } from '@perseid/core';
import Model from 'scripts/core/services/Model';
import type { SearchBody } from 'scripts/core';
import { resetIdCount } from '__mocks__/@perseid/core';
import Telemetry from 'scripts/core/services/Telemetry';
import CacheClient from 'scripts/core/services/CacheClient';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';

type TestClient = PostgreSQLDatabaseClient<DataModel> & {
  query: PostgreSQLDatabaseClient<DataModel>['query'];
  formatRows: PostgreSQLDatabaseClient<DataModel>['formatRows'];
  planQueries: PostgreSQLDatabaseClient<DataModel>['planQueries'];
  compileQueries: PostgreSQLDatabaseClient<DataModel>['compileQueries'];
  resourcesMetadata: PostgreSQLDatabaseClient<DataModel>['resourcesMetadata'];
};

type Observe = (observe: (value: number, attributes?: Record<string, unknown>) => void) => void;

/**
 * Returns the callback the `name` metric observes its values with.
 */
const observeMetric = (telemetry: Telemetry, name: string): Observe => {
  const [, , callback] = vi.mocked(telemetry.createUpDownCounter).mock.calls
    .find(([metric]) => metric === name) as [string, unknown, Observe];
  return callback;
};

describe('connectors/postgresql/services/PostgreSQLDatabaseClient', () => {
  vi.mock('pg');
  vi.mock('crypto');
  vi.mock('@perseid/core');
  vi.mock('scripts/core/errors/Database');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Telemetry');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/core/services/AbstractDatabaseClient');

  const resourceId = new Id('000000000000000000000001');

  const defaultPool = {
    ssl: false as const,
    port: 5432,
    user: 'root',
    host: 'localhost',
    database: 'test',
    queryTimeout: 5000,
    connectTimeout: 2000,
    connectionLimit: 10,
    password: 'Test123!',
    protocol: 'postgresql',
  };

  const settings: PostgreSQLDatabaseClientSettings = {
    hashAliases: false,
    pools: { default: defaultPool },
  };

  const otherTestPayload: DataModel['otherTest'] = {
    enum: 'ONE',
    _id: resourceId,
    optionalRelation: null,
    binary: new ArrayBuffer(0),
    _createdAt: new Date('2025-01-01'),
    data: {
      optionalRelation: null,
      optionalFlatArray: ['test1', 'test2'],
    },
  };

  const test = it.extend<{
    client: TestClient;
    telemetry: Telemetry;
    model: Model<DataModel>;
    connectedClient: TestClient;
  }>({
    model: async ({ task }, use) => {
      vi.fn(() => task);
      await use(new Model<DataModel>({}));
    },
    telemetry: async ({ task }, use) => {
      vi.fn(() => task);
      await use(new Telemetry());
    },
    client: async ({ model, telemetry }, use) => {
      const cache = new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 });
      await use(new PostgreSQLDatabaseClient<DataModel>(
        model,
        telemetry,
        cache,
        settings,
      ) as TestClient);
    },
    connectedClient: async ({ client }, use) => {
      await client.withSession(async () => Promise.resolve());
      vi.mocked(Pool).mockClear();
      poolClient.query.mockClear();
      await use(client);
    },
  });

  beforeEach(() => {
    resetIdCount();
    vi.clearAllMocks();
    poolClient.query.mockImplementation(() => Promise.resolve({
      rowCount: 1,
      rows: [{ __total: '10', _id: '000000000000000000000001' }],
    }));
  });

  afterEach(() => {
    Id.FORMAT = 'UUID';
  });

  describe('[constructor]', () => {
    test('registers database telemetry instruments', ({ client, telemetry }) => {
      expect(client).toBeInstanceOf(PostgreSQLDatabaseClient);
      expect(telemetry.createHistogram).toHaveBeenCalledWith('db.client.connection.wait_time', expect.objectContaining({ unit: 's' }));
      expect(telemetry.createHistogram).toHaveBeenCalledWith('db.client.operation.duration', expect.objectContaining({ unit: 's' }));
      // Connections metrics are observed at collection time, so that a pool stuck with no free
      // connection still reports its real state, even though no event is emitted for it.
      expect(telemetry.createUpDownCounter).toHaveBeenCalledWith('db.client.connection.count', expect.anything(), expect.any(Function));
      expect(telemetry.createUpDownCounter).toHaveBeenCalledWith('db.client.connection.pending_requests', expect.anything(), expect.any(Function));
    });

    test('generates the SQL structure of each resource of the data model', ({ client }) => {
      expect(client.resourcesMetadata.test.fields).toEqual(expect.objectContaining({
        _id: { type: 'UUID', isRequired: true },
        _isDeleted: { type: 'BOOLEAN', isRequired: true },
        indexedString: { type: 'VARCHAR(undefined)', isRequired: true },
        objectOne: { type: 'BOOLEAN', isRequired: true },
        objectOne_optionalRelations: { type: 'BOOLEAN', isRequired: false },
      }));
      expect(client.resourcesMetadata.otherTest.fields).toEqual(expect.objectContaining({
        binary: { type: 'BYTEA', isRequired: true },
        _createdAt: { type: 'TIMESTAMPTZ', isRequired: true },
        enum: { type: 'VARCHAR(5)', isRequired: true },
      }));
    });

    test('stores ids as fixed-length strings when using the snowflake format', ({ model, telemetry }) => {
      Id.FORMAT = 'SNOWFLAKE';
      const cache = new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 });
      const client = new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, settings);

      expect((client as unknown as {
        resourcesMetadata: Record<string, { fields: Record<string, unknown>; }>;
      }).resourcesMetadata.test.fields._id).toEqual({ type: 'VARCHAR(24)', isRequired: true });
    });

    test('throws if a string field is too long to be indexed', ({ model, telemetry }) => {
      const cache = new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 });
      vi.spyOn(model, 'get').mockReturnValue({
        depth: 1,
        permissions: [],
        canonicalPath: ['test'],
        schema: {
          fields: {
            tooLong: {
              type: 'string',
              isUnique: true,
              maxLength: 3000,
            },
          },
        },
      } as never);

      expect(() => new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, settings))
        .toThrow('INDEXED_FIELD_VALUE_TOO_LONG');
    });
  });

  describe('[planQueries]', () => {
    test('plans a DELETE command', ({ client }) => {
      const { queries } = client.planQueries('otherTest', 'DELETE', resourceId, null, {});

      expect(queries).toEqual({
        otherTest: {
          type: 'DELETE',
          table: 'otherTest',
          where: [{ column: '"otherTest"."_id"', operator: '=', value: resourceId }],
        },
      });
    });

    test('excludes soft-deleted resources unless explicitly asked not to', ({ client }) => {
      const { queries } = client.planQueries('test', 'LIST', null, null, {});
      const { queries: allQueries } = client.planQueries('test', 'LIST', null, null, {
        excludeDeletedResources: false,
      });

      expect(queries._search.where).toContainEqual('"test"."_isDeleted" = FALSE');
      expect(allQueries._search.where).not.toContainEqual('"test"."_isDeleted" = FALSE');
    });

    test('plans a CREATE command, splitting arrays into their own tables', ({ client }) => {
      const { queries } = client.planQueries('otherTest', 'CREATE', null, otherTestPayload, {});

      expect(Object.keys(queries)).toEqual(['otherTest', '_otherTest_data_optionalFlatArray']);
      expect(queries.otherTest).toEqual({
        type: 'INSERT',
        table: 'otherTest',
        fields: ['enum', '_id', 'optionalRelation', 'binary', '_createdAt', 'data', 'data_optionalRelation', 'data_optionalFlatArray'],
        values: [['ONE', resourceId, null, new ArrayBuffer(0), new Date('2025-01-01'), true, null, true]],
      });
      expect(queries._otherTest_data_optionalFlatArray).toEqual({
        type: 'INSERT',
        table: '_otherTest_data_optionalFlatArray',
        fields: ['_id', '_parentId', 'value'],
        values: [
          [expect.any(Id), resourceId, 'test1'],
          [expect.any(Id), resourceId, 'test2'],
        ],
      });
    });

    test('marks null arrays and nullifies all the columns of null objects', ({ client }) => {
      const { queries } = client.planQueries('test', 'CREATE', null, {
        _id: resourceId,
        _isDeleted: false,
        indexedString: 'test',
        objectOne: {
          boolean: true,
          optionalRelations: null,
          objectTwo: {
            optionalIndexedString: null,
            optionalNestedArray: [null],
          },
        },
      }, {});

      expect((queries.test).values).toEqual([[
        resourceId,
        false,
        'test',
        true,
        true,
        null,
        true,
        null,
        true,
      ]]);
      const insertQuery = queries._test_objectOne_objectTwo_optionalNestedArray;
      expect(insertQuery.values).toEqual([[
        expect.any(Id),
        resourceId,
        null,
        null,
        null,
        null,
        null,
      ]]);
    });

    test('splits large arrays insertions into several queries', ({ client }) => {
      const { queries } = client.planQueries('otherTest', 'CREATE', null, {
        ...otherTestPayload,
        data: { optionalRelation: null, optionalFlatArray: new Array(65500).fill('test1') },
      }, {});

      expect(Object.keys(queries)).toEqual([
        'otherTest',
        '_otherTest_data_optionalFlatArray',
        '_otherTest_data_optionalFlatArray_21845',
        '_otherTest_data_optionalFlatArray_43690',
      ]);
    });

    test('plans an UPDATE command, replacing the previous rows of its arrays', ({ client }) => {
      const { queries } = client.planQueries('otherTest', 'UPDATE', resourceId, {
        data: { optionalFlatArray: ['test3'] },
      }, {});

      expect(Object.keys(queries)).toEqual(['otherTest', '_delete_0', '_otherTest_data_optionalFlatArray']);
      expect(queries.otherTest).toEqual({
        type: 'UPDATE',
        as: 'otherTest',
        table: 'otherTest',
        fields: { data: true, data_optionalFlatArray: true },
        where: [{ column: '"otherTest"."_id"', operator: '=', value: resourceId }],
      });
      expect(queries._delete_0).toEqual({
        type: 'DELETE',
        table: '_otherTest_data_optionalFlatArray',
        where: [{ column: '"_parentId"', operator: '=', value: resourceId }],
      });
    });

    test('plans a VIEW command, fetching arrays and relations in their own queries', ({ client }) => {
      const { projections, queries } = client.planQueries('test', 'VIEW', resourceId, null, {
        fields: ['objectOne.optionalRelations._createdAt'],
      });

      expect(projections).toEqual({
        _id: 1,
        objectOne: { optionalRelations: { _id: 1, _createdAt: 1 } },
      });
      expect((queries.test).where).toEqual([
        { column: '"test"."_id"', operator: '=', value: resourceId },
        '"test"."_isDeleted" = FALSE',
      ]);
      expect((queries.test).orderBy).toBeUndefined();
      expect((queries.test_objectOne_optionalRelations).orderBy).toEqual([
        { field: '"_test_objectOne_optionalRelations"."_id"', direction: 'ASC' },
      ]);
      expect((queries.test_objectOne_optionalRelations).join).toEqual([{
        type: 'LEFT',
        table: 'otherTest',
        as: 'test_objectOne_optionalRelations',
        on: '"test_objectOne_optionalRelations"."_id" = "_test_objectOne_optionalRelations"."value"',
      }]);
    });

    test('keeps the aliases of long field paths within the database identifier limit', ({ client }) => {
      const { queries } = client.planQueries('test', 'VIEW', resourceId, null, {
        fields: ['objectOne.objectTwo.optionalNestedArray.data.optionalInteger'],
      });

      const nestedArray = queries.test_objectOne_objectTwo_optionalNestedArray;
      const [, fieldAlias] = /"value_data_optionalInteger" AS "([^"]+)"/.exec(nestedArray.fields.join()) as string[];
      // PostgreSQL silently truncates identifiers longer than 63 bytes, which would make two long
      // paths sharing a prefix collide.
      expect(fieldAlias.length).toBeLessThanOrEqual(63);
      expect(fieldAlias).toBe('_test_objealInteger');
    });

    test('generates opaque and stable aliases by default', ({ model, telemetry }) => {
      const cache = new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 });
      const client = new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, {
        hashAliases: false,
        pools: settings.pools,
      }) as TestClient;
      const plan = (): Record<string, Query> => client.planQueries('test', 'VIEW', resourceId, null, {
        fields: ['indexedString'],
      }).queries;

      expect((plan().test as SelectQuery).fields.join()).not.toContain('indexedString AS');
      expect(plan()).toEqual(plan());
    });

    test('joins a required related resource with an inner join', ({ model, telemetry }) => {
      const cache = new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 });
      vi.spyOn(model, 'get').mockImplementation((resource: string) => ({
        depth: 1,
        permissions: [],
        canonicalPath: [resource],
        schema: {
          enableDeletion: true,
          fields: (resource === 'test')
            ? {
              _id: { type: 'id', isRequired: true },
              requiredRelation: { type: 'id', isRequired: true, relation: 'otherTest' },
            }
            : {
              _id: { type: 'id', isRequired: true },
              enum: { type: 'string', isIndexed: true, maxLength: 10 },
            },
        },
      }) as never);
      const client = new PostgreSQLDatabaseClient<DataModel>(
        model,
        telemetry,
        cache,
        settings,
      ) as TestClient;

      const { queries } = client.planQueries('test', 'VIEW', resourceId, null, {
        fields: ['requiredRelation.enum'],
      });

      expect((queries.test).join).toEqual([expect.objectContaining({ type: 'INNER' })]);
    });

    test('paginates, filters, searches and sorts resources', ({ client }) => {
      const { queries } = client.planQueries('test', 'LIST', null, {
        filters: { indexedString: ['first', 'second'] },
        query: { on: ['indexedString'], text: 'jo(hn 100%' },
      } as SearchBody, {
        limit: 10,
        offset: 20,
        sortBy: { indexedString: 1 },
      });

      expect(queries._search.limit).toBe(10);
      expect(queries._search.offset).toBe(20);
      const column = '"test"."indexedString"';
      expect(queries._search.orderBy).toEqual([
        { field: column, direction: 'ASC' },
        { field: '"test"."_id"', direction: 'ASC' },
      ]);
      expect(queries._search.where).toEqual([
        '"test"."_isDeleted" = FALSE',
        {
          operator: 'OR',
          conditions: [{
            operator: 'AND',
            conditions: [
              { column, operator: 'ILIKE', value: '%jo%' },
              { column, operator: 'ILIKE', value: '%hn%' },
              { column, operator: 'ILIKE', value: '%100\\%%' },
            ],
          }],
        },
        { column, operator: '=', value: ['first', 'second'] },
      ]);
    });

    test('matches a null filter value with a dedicated condition', ({ client }) => {
      const { queries } = client.planQueries('test', 'LIST', null, {
        query: null,
        filters: { indexedString: ['first', null] },
      } as unknown as SearchBody, {});
      const { queries: noValue } = client.planQueries('test', 'LIST', null, {
        query: null,
        filters: { indexedString: [] },
      } as unknown as SearchBody, {});

      const column = '"test"."indexedString"';
      // `NULL` never compares equal to anything, not even to itself.
      expect(queries._search.where).toContainEqual({
        operator: 'OR',
        conditions: [
          { column, operator: '=', value: ['first'] },
          `${column} IS NULL`,
        ],
      });
      expect(noValue._search.where).toContainEqual('FALSE');
    });

    test('searches resources against a single token', ({ client }) => {
      const { queries } = client.planQueries('test', 'LIST', null, {
        filters: null,
        query: { on: ['indexedString'], text: 'john' },
      } as SearchBody, {});

      expect(queries._search.where).toContainEqual({
        operator: 'OR',
        conditions: [{
          operator: 'ILIKE',
          value: '%john%',
          column: '"test"."indexedString"',
        }],
      });
    });

    test('ignores a search query containing no usable token, or targeting no field', ({ client }) => {
      const { queries } = client.planQueries('test', 'LIST', null, {
        filters: null,
        query: { on: ['indexedString'], text: ' , ' },
      } as SearchBody, {});
      const { queries: untargeted } = client.planQueries('test', 'LIST', null, {
        filters: null,
        query: { text: 'john' },
      } as SearchBody, {});

      expect(queries._search.where).toEqual(['"test"."_isDeleted" = FALSE']);
      expect(untargeted._search.where).toEqual(['"test"."_isDeleted" = FALSE']);
    });

    test('filters resources on a field contained in an array', ({ client }) => {
      const { queries } = client.planQueries('test', 'LIST', null, {
        filters: { 'objectOne.optionalRelations._createdAt': new Date('2025-01-01') },
        query: null,
      } as SearchBody, {});

      const relationAlias = 'test_objectOne_optionalRelations';
      const [, condition] = queries._search.where as [unknown, { value: SelectQuery; }];
      expect(condition.value.table).toBe('otherTest');
      expect(condition.value.as).toBe(relationAlias);
      expect(condition.value.fields).toEqual(['1']);
      expect(condition.value.where?.[0]).toEqual({
        operator: '=',
        value: new Date('2025-01-01'),
        column: `"${relationAlias}"."_createdAt"`,
      });
      expect(condition.value.where?.[1]).toEqual({
        operator: 'IN',
        column: `"${relationAlias}"."_id"`,
        value: expect.objectContaining({
          table: '_test_objectOne_optionalRelations',
        }) as SelectQuery,
      });
    });

    test('excludes soft-deleted resources from filters and sorting on relations', ({ client }) => {
      const { queries } = client.planQueries('otherTest', 'LIST', null, {
        filters: { 'optionalRelation.indexedString': 'test', 'data.optionalRelation': null },
        query: null,
      } as SearchBody, {
        fields: ['optionalRelation.indexedString'],
        sortBy: { 'optionalRelation.indexedString': -1 },
      });

      const rootAlias = 'otherTest';
      const relationAlias = 'otherTest_optionalRelation';
      expect(queries._search.orderBy).toContainEqual({
        direction: 'DESC',
        field: `"${relationAlias}"."indexedString"`,
      });
      expect(queries._search.join).toEqual([{
        type: 'LEFT',
        table: 'test',
        as: relationAlias,
        on: `"${relationAlias}"."_id" = "${rootAlias}"."optionalRelation" AND "${relationAlias}"."_isDeleted" = FALSE`,
      }]);
      expect((queries.otherTest).join).toEqual([{
        type: 'LEFT',
        table: 'test',
        as: relationAlias,
        on: `"${relationAlias}"."_id" = "${rootAlias}"."optionalRelation"`,
      }]);
    });

    test('throws when a payload field does not exist in data model', ({ client }) => {
      expect(() => client.planQueries('otherTest', 'CREATE', null, {
        ...otherTestPayload,
        unknownField: true,
      } as DataModel['otherTest'], {})).toThrow('UNKNOWN_FIELD');
    });

    test('throws when a payload is missing a required field', ({ client }) => {
      expect(() => client.planQueries('otherTest', 'CREATE', null, {
        _id: resourceId,
      } as DataModel['otherTest'], {})).toThrow('MISSING_FIELD');
    });

    test('throws when a queried field does not exist in data model', ({ client }) => {
      expect(() => client.planQueries('test', 'LIST', null, null, { fields: ['unknownField'] }))
        .toThrow('UNKNOWN_QUERY_FIELD');
      expect(() => client.planQueries('test', 'LIST', null, null, { fields: ['__proto__'] }))
        .toThrow('UNKNOWN_QUERY_FIELD');
      expect(() => client.planQueries('test', 'LIST', null, null, { fields: ['indexedString.nested'] }))
        .toThrow('UNKNOWN_QUERY_FIELD');
    });

    test('throws when a queried field is not a leaf of the data model', ({ client }) => {
      expect(() => client.planQueries('test', 'LIST', null, null, { fields: ['objectOne'] }))
        .toThrow('INVALID_QUERY_FIELD');
    });

    test('throws when a filtered field is not indexed', ({ client }) => {
      expect(() => client.planQueries('otherTest', 'LIST', null, {
        filters: { enum: 'ONE' },
        query: null,
      } as SearchBody, {})).toThrow('UNINDEXED_FIELD');
    });

    test('throws when a searched field does not contain text', ({ client }) => {
      expect(() => client.planQueries('test', 'LIST', null, {
        filters: null,
        query: { on: ['objectOne.optionalRelations._createdAt'], text: 'john' },
      } as SearchBody, {})).toThrow('UNSEARCHABLE_FIELD');
    });

    test('throws when a sorted field is contained in an array', ({ client }) => {
      expect(() => client.planQueries('test', 'LIST', null, null, {
        sortBy: { 'objectOne.optionalRelations._createdAt': 1 },
      })).toThrow('UNSORTABLE_FIELD');
    });

    test('throws when maximum resources depth is exceeded', ({ client }) => {
      expect(() => client.planQueries('otherTest', 'LIST', null, null, {
        maximumDepth: 1,
        fields: ['optionalRelation.indexedString'],
      })).toThrow('MAXIMUM_QUERY_FIELDS_DEPTH_EXCEEDED');
    });
  });

  describe('[compileQueries]', () => {
    test('compiles a SELECT query', ({ client }) => {
      const { select } = client.compileQueries({
        select: {
          as: 'a',
          limit: 10,
          offset: 20,
          type: 'SELECT',
          table: 'test',
          fields: ['"a"."_id"'],
          join: [
            { table: 'other', as: 'b', on: '"b"."_id" = "a"."other"' },
            { table: 'other', as: 'b', on: '"b"."_id" = "a"."other"' },
            { table: 'third', type: 'INNER', on: '"third"."_id" = "a"."third"' },
          ],
          orderBy: [{ field: '"a"."_id"', direction: 'DESC' }],
          where: [{ column: '"a"."name"', operator: '=', value: 'test' }],
        },
      });

      expect(select.query).toBe(`SELECT
  "a"."_id"
FROM
  "test" AS "a"
LEFT JOIN
  "other" AS "b"
ON
  "b"."_id" = "a"."other"
INNER JOIN
  "third"
ON
  "third"."_id" = "a"."third"
WHERE
  "a"."name" = $1
ORDER BY
  "a"."_id" DESC
LIMIT $2
OFFSET $3;`);
      expect(select.values).toEqual(['test', 10, 20]);
    });

    test('compiles an INSERT query', ({ client }) => {
      const { insert } = client.compileQueries({
        insert: {
          type: 'INSERT',
          table: 'test',
          fields: ['_id', 'name'],
          values: [[resourceId, 'first'], [resourceId, 'second']],
        },
      });

      expect(insert.query).toBe(`INSERT INTO
  "test" (
    "_id",
    "name"
  )
VALUES
  (
    $1,
    $2
  ),
  (
    $3,
    $4
  );`);
      expect(insert.values).toEqual(['000000000000000000000001', 'first', '000000000000000000000001', 'second']);
    });

    test('compiles an UPDATE query', ({ client }) => {
      const { update } = client.compileQueries({
        update: {
          as: 'a',
          type: 'UPDATE',
          table: 'test',
          fields: { name: 'test' },
          where: [{ column: '"a"."_id"', operator: '=', value: resourceId }],
        },
      });

      expect(update.query).toBe(`UPDATE
  "test" AS "a"
SET
  "name" = $1
WHERE
  "a"."_id" = $2;`);
    });

    test('compiles a DELETE query', ({ client }) => {
      const { remove } = client.compileQueries({
        remove: {
          type: 'DELETE',
          table: 'test',
          where: [{ column: '"test"."_id"', operator: '=', value: resourceId }],
        },
      });

      expect(remove.query).toBe(`DELETE FROM
  "test"
WHERE
  "test"."_id" = $1;`);
      expect(remove.values).toEqual([String(resourceId)]);
    });

    test('compiles common table expressions', ({ client }) => {
      const { select } = client.compileQueries({
        select: {
          type: 'SELECT',
          table: 'ids',
          fields: ['"ids"."_id"'],
          with: [{
            as: 'ids',
            query: {
              type: 'SELECT',
              table: 'test',
              fields: ['"_id"'],
              where: [{ column: '"name"', operator: '=', value: 'test' }],
            },
          }],
        },
      });

      expect(select.query).toBe(`WITH
  "ids" AS (
    SELECT
      "_id"
    FROM
      "test"
    WHERE
      "name" = $1
  )
SELECT
  "ids"."_id"
FROM
  "ids";`);
      expect(select.values).toEqual(['test']);
    });

    test('compiles all kinds of conditions', ({ client }) => {
      const subQuery = {
        type: 'SELECT' as const,
        table: 'other',
        fields: ['"_id"'],
        where: [{ column: '"name"', operator: '=' as const, value: 'test' }],
      };
      const { select } = client.compileQueries({
        select: {
          type: 'SELECT',
          table: 'test',
          fields: ['"_id"'],
          where: [
            '"a"."raw" IS NULL',
            { operator: 'AND', conditions: [{ column: '"a"."single"', operator: '=', value: 1 }] },
            {
              operator: 'OR',
              conditions: [
                { column: '"a"."first"', operator: '=', value: 1 },
                { column: '"a"."second"', operator: '=', value: 2 },
              ],
            },
            { operator: 'EXISTS', value: subQuery },
            { operator: 'NOT EXISTS', value: '"a"."_id" IS NULL' },
            { operator: 'IN', column: '"a"."_id"', value: subQuery },
            { operator: 'NOT IN', column: '"a"."_id"', value: '"a"."other"' },
            { column: '"a"."sub"', operator: '=', value: subQuery },
          ],
        },
      });

      expect(select.query).toContain('  "a"."raw" IS NULL\n  AND "a"."single" = $1');
      expect(select.query).toContain('AND (\n    "a"."first" = $2\n    OR "a"."second" = $3\n  )');
      expect(select.query).toContain('AND EXISTS (\n    SELECT');
      expect(select.query).toContain('AND NOT EXISTS (\n"a"."_id" IS NULL\n  )');
      expect(select.query).toContain('AND "a"."_id" IN (\n    SELECT');
      expect(select.query).toContain('AND "a"."_id" NOT IN ("a"."other")');
      expect(select.query).toContain('AND "a"."sub" = (\n    SELECT');
    });

    test('compares a column to a list of values with a quantifier', ({ client }) => {
      const { select } = client.compileQueries({
        select: {
          type: 'SELECT',
          table: 'test',
          fields: ['"_id"'],
          where: [
            { column: '"a"."any"', operator: '=', value: ['first', 'second'] },
            { column: '"a"."all"', operator: '!=', value: ['third'] },
          ],
        },
      });

      expect(select.query).toContain('"a"."any" = ANY($1)');
      expect(select.query).toContain('"a"."all" != ALL($2)');
    });

    test('throws when comparing a column to a list of values with an unsupported operator', ({ client }) => {
      expect(() => client.compileQueries({
        select: {
          type: 'SELECT',
          table: 'test',
          fields: ['"_id"'],
          where: [{ column: '"a"."name"', operator: 'ILIKE', value: ['first'] }],
        },
      })).toThrow('UNSUPPORTED_ARRAY_OPERATOR');
    });

    test('throws when a query binds too many values', ({ client }) => {
      expect(() => client.compileQueries({
        insert: {
          type: 'INSERT',
          table: 'test',
          fields: ['name'],
          values: new Array<unknown[]>(65536).fill(['test']),
        },
      })).toThrow('TOO_MANY_QUERY_PARAMETERS');
    });
  });

  describe('[formatRows]', () => {
    test('formats rows into resources, with their relations and arrays', ({ client }) => {
      const formatted = client.formatRows('test', {
        _id: 1,
        indexedString: 1,
        objectOne: { boolean: 1, optionalRelations: { _id: 1, _createdAt: 1 } },
      }, {
        test: [{
          test__id: '000000000000000000000001',
          test_indexedString: 'test',
          test_objectOne_boolean: true,
          test_objectOne_optionalRelations: true,
        }],
        test_objectOne_optionalRelations: [
          {
            test_objectOne_optionalRelations__itemId: '000000000000000000000010',
            test_objectOne_optionalRelations__parentId: '000000000000000000000001',
            test_objectOne_optionalRelations__id: '000000000000000000000020',
            test_objectOne_optionalRelations__value: '000000000000000000000020',
            test_objectOne_optionalRelations__createdAt: new Date('2025-01-01'),
          },
          {
            test_objectOne_optionalRelations__itemId: '000000000000000000000011',
            test_objectOne_optionalRelations__parentId: '000000000000000000000001',
            test_objectOne_optionalRelations__id: null,
          },
        ],
      });

      expect(formatted).toEqual([{
        _id: new Id('000000000000000000000001'),
        indexedString: 'test',
        objectOne: {
          boolean: true,
          optionalRelations: [
            { _id: new Id('000000000000000000000020'), _createdAt: new Date('2025-01-01') },
            null,
          ],
        },
      }]);
    });

    test('groups the rows of an array by the row owning it', ({ client }) => {
      const formatted = client.formatRows('test', {
        _id: 1,
        objectOne: { optionalRelations: 1 },
      }, {
        test: [
          {
            test__id: '000000000000000000000001',
            test_objectOne_optionalRelations: true,
          },
          {
            test__id: '000000000000000000000002',
            test_objectOne_optionalRelations: true,
          },
          {
            test__id: '000000000000000000000003',
            test_objectOne_optionalRelations: true,
          },
        ],
        test_objectOne_optionalRelations: [{
          test_objectOne_optionalRelations__id: '000000000000000000000010',
          test_objectOne_optionalRelations__parentId: '000000000000000000000002',
          test_objectOne_optionalRelations: '000000000000000000000020',
        }],
      });

      expect(formatted).toEqual([
        {
          _id: new Id('000000000000000000000001'),
          objectOne: { optionalRelations: [] },
        },
        {
          _id: new Id('000000000000000000000002'),
          objectOne: { optionalRelations: [new Id('000000000000000000000020')] },
        },
        {
          _id: new Id('000000000000000000000003'),
          objectOne: { optionalRelations: [] },
        },
      ]);
    });

    test('formats a null relation and a null object as null', ({ client }) => {
      const formatted = client.formatRows('otherTest', {
        _id: 1,
        optionalRelation: { indexedString: 1 },
        data: { optionalRelation: 1 },
      }, {
        otherTest: [{
          otherTest__id: '000000000000000000000001',
          otherTest_data: null,
          otherTest_optionalRelation: null,
        }],
      });

      expect(formatted).toEqual([{
        _id: new Id('000000000000000000000001'),
        optionalRelation: null,
        data: null,
      }]);
    });
  });

  describe('[query]', () => {
    test('runs the query on the given pool', async ({ connectedClient }) => {
      const response = await connectedClient.query({ query: 'SELECT 1;', values: [1] });

      expect(poolClient.query).toHaveBeenCalledWith('SELECT 1;', [1]);
      expect(response.rowCount).toBe(1);
    });

    test('runs the query on the given session', async ({ client }) => {
      await client.withSession(async (session) => {
        poolClient.query.mockClear();
        await client.query({ query: 'SELECT 1;', poolOrSession: session });
      });

      expect(poolClient.query).toHaveBeenCalledWith('SELECT 1;', []);
    });

    test('connects to the pool a query targets when it is not connected yet', async ({ telemetry, client }) => {
      expect(await client.delete('otherTest', resourceId, { poolOrSession: 'default' })).toBe(true);
      expect(Pool).toHaveBeenCalledOnce();
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        max: 10,
        database: 'test',
        query_timeout: 5000,
        statement_timeout: 5000,
        connectionTimeoutMillis: 2000,
        options: ' -c lc_messages=C',
      }));
      expect(telemetry.info).toHaveBeenCalledWith('Connecting to database...', expect.objectContaining({
        'db.namespace': 'test',
        'server.port': 5432,
      }));
    });

    test('lets the database server apply its own defaults for unset connection settings', async ({ model, telemetry }) => {
      const cache = new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 });
      const client = new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, {
        ...settings,
        pools: {
          default: {
            ...defaultPool,
            port: null,
            user: null,
            password: null,
          },
        },
      });

      await client.delete('otherTest', resourceId, {});

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        port: undefined,
        user: undefined,
        password: undefined,
      }));
    });

    test('re-uses the pool it is already connected to', async ({ connectedClient }) => {
      await connectedClient.delete('otherTest', resourceId, {});
      await connectedClient.withSession(async () => Promise.resolve());

      expect(Pool).not.toHaveBeenCalled();
      expect(pool.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('logs errors happening on idle connections instead of crashing', ({ connectedClient, telemetry }) => {
      const error = new Error('CONNECTION_LOST');

      expect(() => { emit('error', error); }).not.toThrow();
      expect(telemetry.error).toHaveBeenCalledWith(error, expect.objectContaining({
        'db.client.connection.pool.name': 'default',
      }));
      expect(connectedClient).toBeInstanceOf(PostgreSQLDatabaseClient);
    });

    test('observes the connections of each pool when metrics are collected', async ({ client, telemetry }) => {
      const observe = vi.fn();
      await client.withSession(async () => Promise.resolve());

      observeMetric(telemetry, 'db.client.connection.count')(observe);

      expect(observe).toHaveBeenCalledWith(2, {
        'db.client.connection.state': 'used',
        'db.client.connection.pool.name': 'default',
      });
      expect(observe).toHaveBeenCalledWith(1, {
        'db.client.connection.state': 'idle',
        'db.client.connection.pool.name': 'default',
      });
    });

    test('observes the requests waiting for a connection when metrics are collected', async ({ client, telemetry }) => {
      const observe = vi.fn();
      await client.withSession(async () => Promise.resolve());

      observeMetric(telemetry, 'db.client.connection.pending_requests')(observe);

      expect(observe).toHaveBeenCalledWith(2, { 'db.client.connection.pool.name': 'default' });
    });

    test('records the time it took to obtain a connection from the pool', async ({ connectedClient, telemetry }) => {
      vi.mocked(pool.connect).mockClear();
      poolClient.release.mockClear();

      await connectedClient.query({ query: 'SELECT 1;' });

      // Connections are acquired manually, which is what makes that wait measurable: it is the
      // signal telling that the pool ran out of connections, whatever the collection interval.
      expect(pool.connect).toHaveBeenCalledOnce();
      expect(poolClient.release).toHaveBeenCalledOnce();
      expect(telemetry.measure).toHaveBeenCalledWith('db.client.connection.wait_time', 0.5, {
        'db.client.connection.pool.name': 'default',
      });
    });

    test('does not acquire a new connection for a query running within a session', async ({ client, telemetry }) => {
      await client.withSession(async (session) => {
        vi.mocked(pool.connect).mockClear();
        vi.mocked(telemetry.measure).mockClear();
        await client.query({ query: 'SELECT 1;', poolOrSession: session });
      });

      expect(pool.connect).not.toHaveBeenCalled();
      expect(telemetry.measure).not.toHaveBeenCalledWith('db.client.connection.wait_time', expect.anything(), expect.anything());
    });

    test('throws when the targeted pool has no connection settings registered', async ({ client }) => {
      await expect(client.query({ query: 'SELECT 1;', poolOrSession: 'unknown' }))
        .rejects.toThrow('POOL_NOT_FOUND');
    });

    test('translates a unique constraint violation', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.reject(Object.assign(new Error('duplicate key'), {
        code: '23505',
        detail: 'Key (indexedString)=(test) already exists.',
      })));

      await expect(connectedClient.query({ query: 'SELECT 1;' })).rejects.toEqual(
        expect.objectContaining({ code: 'RESOURCE_EXISTS', details: { path: 'indexedString' } }),
      );
    });

    test('translates a foreign key constraint violation', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.reject(Object.assign(new Error('still referenced'), {
        code: '23503',
        detail: 'Key (_id)=(000000000000000000000001) is still referenced.',
      })));

      await expect(connectedClient.query({ query: 'SELECT 1;' })).rejects.toEqual(
        expect.objectContaining({ code: 'RESOURCE_REFERENCED', details: { path: '_id' } }),
      );
    });

    test('translates any other database error', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.reject(Object.assign(new Error('out of memory'), {
        code: '53200',
      })));

      await expect(connectedClient.query({ query: 'SELECT 1;' })).rejects.toEqual(
        expect.objectContaining({
          code: 'DATABASE_ERROR',
          details: { code: '53200', message: 'out of memory' },
        }),
      );
    });

    test('translates a constraint violation whose details cannot be parsed', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.reject(Object.assign(new Error('duplicate key'), {
        code: '23505',
      })));

      await expect(connectedClient.query({ query: 'SELECT 1;' })).rejects.toThrow('DATABASE_ERROR');
    });

    test('propagates a failure happening while recording the query metrics', async ({ connectedClient, telemetry }) => {
      const error = new Error('TELEMETRY_ERROR');
      vi.mocked(telemetry.measure).mockImplementationOnce(() => { throw error; });

      await expect(connectedClient.query({ query: 'SELECT 1;' })).rejects.toThrow(error);
    });

    test('rethrows an error that does not come from the database server', async ({ connectedClient }) => {
      const error = new Error('SOCKET_CLOSED');
      poolClient.query.mockImplementation(() => Promise.reject(error));

      await expect(connectedClient.query({ query: 'SELECT 1;' })).rejects.toThrow(error);
    });
  });

  describe('[withSession]', () => {
    test('commits the transaction and returns the callback result', async ({ client }) => {
      const response = await client.withSession(async (session) => Promise.resolve(session));

      expect(response).toEqual(expect.any(String));
      expect(poolClient.query).toHaveBeenCalledWith('BEGIN;', []);
      expect(poolClient.query).toHaveBeenCalledWith('COMMIT;', []);
      expect(poolClient.release).toHaveBeenCalledWith(undefined);
    });

    test('rolls the transaction back and rethrows when the callback fails', async ({ client }) => {
      const error = new Error('CALLBACK_ERROR');

      await expect(client.withSession(() => Promise.reject(error))).rejects.toThrow(error);
      expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK;', []);
      expect(poolClient.query).not.toHaveBeenCalledWith('COMMIT;', []);
      // The rollback succeeded, so the connection is back to a clean state and can be re-used:
      // releasing it with an error would destroy it for nothing.
      expect(poolClient.release).toHaveBeenCalledWith(undefined);
    });

    test('does not commit the transaction when it has been cancelled', async ({ client }) => {
      await client.withSession(async (_, cancel) => cancel());

      expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK;', []);
      expect(poolClient.query).not.toHaveBeenCalledWith('COMMIT;', []);
    });

    test('propagates a failure happening while releasing the connection', async ({ client }) => {
      const error = new Error('RELEASE_ERROR');
      poolClient.release.mockImplementationOnce(() => { throw error; });

      await expect(client.withSession(async () => Promise.resolve())).rejects.toThrow(error);
    });

    test('propagates the original error when rolling back also fails', async ({ client, telemetry }) => {
      const error = new Error('CALLBACK_ERROR');
      poolClient.query.mockImplementation((sqlQuery: string) => (
        (sqlQuery === 'ROLLBACK;')
          ? Promise.reject(new Error('ROLLBACK_ERROR'))
          : Promise.resolve({ rowCount: 1, rows: [] })
      ));

      await expect(client.withSession(() => Promise.reject(error))).rejects.toThrow(error);
      expect(telemetry.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'ROLLBACK_ERROR' }), expect.anything());
    });

    test('rolls the transaction back when it cannot be committed', async ({ client }) => {
      const error = new Error('COMMIT_ERROR');
      poolClient.query.mockImplementation((sqlQuery: string) => (
        (sqlQuery === 'COMMIT;')
          ? Promise.reject(error)
          : Promise.resolve({ rowCount: 1, rows: [] })
      ));

      await expect(client.withSession(async () => Promise.resolve())).rejects.toThrow(error);
      expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK;', []);
    });
  });

  describe('[create]', () => {
    test('inserts the resource row and its arrays rows in a single transaction', async ({ client }) => {
      await client.create('otherTest', otherTestPayload as never, {});

      expect(poolClient.query).toHaveBeenCalledWith('BEGIN;', []);
      expect(poolClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO\n  "otherTest"'), expect.any(Array));
      expect(poolClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO\n  "_otherTest_data_optionalFlatArray"'), expect.any(Array));
      expect(poolClient.query).toHaveBeenCalledWith('COMMIT;', []);
    });

    test('re-uses the given session instead of opening a new one', async ({ client }) => {
      await client.withSession(async (session) => {
        poolClient.query.mockClear();
        await client.create('otherTest', otherTestPayload as never, { poolOrSession: session });
      });

      expect(poolClient.query).not.toHaveBeenCalledWith('BEGIN;', []);
    });
  });

  describe('[update]', () => {
    test('updates the resource row, then replaces its arrays rows', async ({ client }) => {
      const calls: string[] = [];
      poolClient.query.mockImplementation((sqlQuery: string) => {
        calls.push(sqlQuery.split('\n')[0]);
        return Promise.resolve({ rowCount: 1, rows: [] });
      });

      expect(await client.update('otherTest', resourceId, { data: { optionalFlatArray: ['test3'] } } as never, {})).toBe(true);
      expect(calls).toEqual(['BEGIN;', 'UPDATE', 'DELETE FROM', 'INSERT INTO', 'COMMIT;']);
    });

    test('locks the resource row when the payload does not change it', async ({ client }) => {
      await client.update('otherTest', resourceId, {} as never, {});

      expect(poolClient.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE;'), expect.any(Array));
    });

    test('returns false and cancels the transaction when the resource does not exist', async ({ client }) => {
      poolClient.query.mockImplementation(() => Promise.resolve({ rowCount: 0, rows: [] }));

      expect(await client.update('otherTest', resourceId, otherTestPayload as never, {})).toBe(false);
      expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK;', []);
    });

    test('re-uses the given session instead of opening a new one', async ({ client }) => {
      await client.withSession(async (session) => {
        poolClient.query.mockClear();
        expect(await client.update('otherTest', resourceId, otherTestPayload as never, {
          poolOrSession: session,
        })).toBe(true);
      });

      expect(poolClient.query).not.toHaveBeenCalledWith('BEGIN;', []);
    });
  });

  describe('[delete]', () => {
    test('returns true when the resource has been deleted', async ({ connectedClient }) => {
      expect(await connectedClient.delete('otherTest', resourceId, {})).toBe(true);
      expect(poolClient.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM'), ['000000000000000000000001']);
    });

    test('returns false when the resource does not exist', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.resolve({ rowCount: null, rows: [] }));

      expect(await connectedClient.delete('otherTest', resourceId, {})).toBe(false);
    });
  });

  describe('[view]', () => {
    test('returns the resource', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.resolve({
        rowCount: 1,
        rows: [{
          test__id: '000000000000000000000001',
          test_indexedString: 'test',
        }],
      }));

      expect(await connectedClient.view('test', resourceId, { fields: ['indexedString'] })).toEqual({
        _id: new Id('000000000000000000000001'),
        indexedString: 'test',
      });
    });

    test('fetches the arrays of the resource in their own queries', async ({ connectedClient }) => {
      poolClient.query.mockImplementation((sqlQuery: string) => (
        sqlQuery.includes('FROM\n  "_test_objectOne_optionalRelations"')
          ? Promise.resolve({
            rowCount: 1,
            rows: [{
              test_objectOne_optionalRelations__itemId: '000000000000000000000010',
              test_objectOne_optionalRelations__parentId: '000000000000000000000001',
              test_objectOne_optionalRelations: '000000000000000000000020',
            }],
          })
          : Promise.resolve({
            rowCount: 1,
            rows: [{
              test__id: '000000000000000000000001',
              test_objectOne_optionalRelations: true,
            }],
          })
      ));

      expect(await connectedClient.view('test', resourceId, {
        fields: ['objectOne.optionalRelations'],
      })).toEqual({
        _id: new Id('000000000000000000000001'),
        objectOne: { optionalRelations: [new Id('000000000000000000000020')] },
      });
    });

    test('returns null when the resource does not exist', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.resolve({ rowCount: 0, rows: [] }));

      expect(await connectedClient.view('test', resourceId, { fields: ['indexedString'] })).toBeNull();
    });
  });

  describe('[list]', () => {
    test('returns the total number of resources, along with the current page', async ({ connectedClient }) => {
      poolClient.query.mockImplementation((sqlQuery: string) => (
        sqlQuery.includes('COUNT(*) OVER ()')
          ? Promise.resolve({ rowCount: 1, rows: [{ __total: '42', _id: '000000000000000000000001' }] })
          : Promise.resolve({
            rowCount: 1,
            rows: [{
              test__id: '000000000000000000000001',
              test_indexedString: 'test',
            }],
          })
      ));

      expect(await connectedClient.list('test', { filters: null, query: null }, {
        fields: ['indexedString'],
      })).toEqual({
        total: 42,
        results: [{ _id: new Id('000000000000000000000001'), indexedString: 'test' }],
      });
    });

    test('reports no resource at all when the total is missing from the results', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.resolve({
        rowCount: 1,
        rows: [{ __total: null, _id: '000000000000000000000001', test__id: '000000000000000000000001' }],
      }));

      expect(await connectedClient.list('test', { filters: null, query: null }, {})).toEqual({
        total: 0,
        results: [{ _id: new Id('000000000000000000000001') }],
      });
    });

    test('returns an empty list when no resource matches', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.resolve({ rowCount: 0, rows: [] }));

      expect(await connectedClient.list('test', { filters: null, query: null }, {
        fields: ['indexedString'],
      })).toEqual({ total: 0, results: [] });
    });

    test('counts the total number of resources when the requested page is past the last one', async ({ connectedClient }) => {
      poolClient.query.mockImplementation((sqlQuery: string) => (
        sqlQuery.includes('COUNT(*) AS __total')
          ? Promise.resolve({ rowCount: 1, rows: [{ __total: '42' }] })
          : Promise.resolve({ rowCount: 0, rows: [] })
      ));

      expect(await connectedClient.list('test', { filters: null, query: null }, {
        offset: 100,
        fields: ['indexedString'],
      })).toEqual({ total: 42, results: [] });
      expect(poolClient.query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*) AS __total'), expect.any(Array));
    });

    test('reports no resource at all when the count of a page past the last one is missing', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.resolve({ rowCount: 0, rows: [] }));

      expect(await connectedClient.list('test', { filters: null, query: null }, {
        offset: 100,
        fields: ['indexedString'],
      })).toEqual({ total: 0, results: [] });
    });
  });

  describe('[checkRelations]', () => {
    test('does nothing when there is no relation to check', async ({ connectedClient }) => {
      await connectedClient.checkRelations('test', new Map());

      expect(poolClient.query).not.toHaveBeenCalled();
    });

    test('checks all relations in a single query', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.resolve({
        rowCount: 1,
        rows: [{ _id: '000000000000000000000001', path: 'optionalRelation' }],
      }));

      await connectedClient.checkRelations('otherTest', new Map([
        ['optionalRelation', { resource: 'test', filters: { _id: [resourceId] } }],
      ]), { excludeDeletedResources: false });

      const [[sqlQuery]] = poolClient.query.mock.calls;
      expect(sqlQuery).toContain('DISTINCT "test"."_id"');
      expect(sqlQuery).not.toContain('ORDER BY');
      expect(sqlQuery).not.toContain('LIMIT');
      expect(sqlQuery).not.toContain('_isDeleted');
    });

    test('throws when a relation references a resource that does not exist', async ({ connectedClient }) => {
      poolClient.query.mockImplementation(() => Promise.resolve({ rowCount: 0, rows: [] }));

      await expect(connectedClient.checkRelations('otherTest', new Map([
        ['optionalRelation', { resource: 'test', filters: { _id: [resourceId] } }],
        ['data.optionalRelation', { resource: 'test', filters: { _id: [resourceId] } }],
      ]))).rejects.toThrow('NO_RESOURCE');
    });
  });

  describe('[shutdown]', () => {
    test('ends all the pools it is connected to', async ({ connectedClient }) => {
      await connectedClient.shutdown();

      expect(pool.end).toHaveBeenCalledOnce();
    });
  });
});
