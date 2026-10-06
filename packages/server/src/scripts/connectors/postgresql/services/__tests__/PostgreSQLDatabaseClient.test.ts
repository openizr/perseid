/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import PostgreSQLDatabaseClient, {
  type PostgreSQLDatabaseClientSettings,
} from 'scripts/connectors/postgresql/services/PostgreSQLDatabaseClient';
import { Id } from '@perseid/core';
import Model from 'scripts/core/services/Model';
import type { SearchFilters } from 'scripts/core';
import { resetIdCount } from '__mocks__/@perseid/core';
import Telemetry from 'scripts/core/services/Telemetry';
import CacheClient from 'scripts/core/services/CacheClient';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';
import {
  Pool,
  emit,
  pool,
  poolClient,
} from '__mocks__/pg';

// Exposes protected methods subclasses rely on.
type TestClient = PostgreSQLDatabaseClient<DataModel> & {
  registerModule: PostgreSQLDatabaseClient<DataModel>['registerModule'];
  compileQueries: PostgreSQLDatabaseClient<DataModel>['compileQueries'];
  resourcesMetadata: Record<string, { fields: Record<string, { type: string; }>; }>;
};

vi.mock('pg');
vi.mock('@perseid/core');
vi.mock('scripts/core/errors/Database');
vi.mock('scripts/core/services/Model');
vi.mock('scripts/core/services/Telemetry');
vi.mock('scripts/core/services/CacheClient');

describe('connectors/postgresql/services/PostgreSQLDatabaseClient', () => {
  const resourceId = new Id('000000000000000000000001');
  const relationId = new Id('000000000000000000000009');

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
    telemetry: Telemetry;
    cache: CacheClient;
    model: Model<DataModel>;
    client: TestClient;
  }>({
    telemetry: async ({ onTestFinished }, use) => {
      onTestFinished(() => {
        vi.clearAllMocks();
      });
      await use(new Telemetry());
    },
    cache: async ({ telemetry }, use) => {
      await use(new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 }));
    },
    model: async ({ onTestFinished }, use) => {
      onTestFinished(() => {
        resetIdCount();
      });
      await use(new Model<DataModel>());
    },
    client: async ({ model, telemetry, cache }, use) => {
      const client = new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, settings);
      await use(client as TestClient);
    },
  });

  describe('[constructor]', () => {
    test('registers database telemetry instruments, observing pools state', async ({ client, telemetry }) => {
      expect(telemetry.createHistogram).toHaveBeenCalledWith('db.client.connection.wait_time', {
        unit: 's',
        valueType: 1,
        description: 'The time it took to obtain an open connection from the pool.',
        advice: { explicitBucketBoundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10] },
      });
      expect(telemetry.createHistogram).toHaveBeenCalledWith('db.client.operation.duration', {
        unit: 's',
        valueType: 1,
        description: 'Duration of database client operations.',
        advice: { explicitBucketBoundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10] },
      });
      expect(telemetry.createUpDownCounter).toHaveBeenCalledWith('db.client.connection.count', {
        description: 'The number of connections that are currently in state described by the state attribute.',
        unit: '{connection}',
      }, expect.any(Function));
      expect(telemetry.createUpDownCounter).toHaveBeenCalledWith('db.client.connection.pending_requests', {
        description: 'The number of current pending requests for an open connection.',
        unit: '{request}',
      }, expect.any(Function));

      // Connections metrics are observed at collection time, so that a pool stuck with no free
      // connection still reports its real state, even though no event is emitted for it.
      await client.delete('otherTest', resourceId);
      const observe = vi.fn();
      vi.mocked(telemetry.createUpDownCounter).mock.calls.forEach(([, , callback]) => {
        callback?.(observe);
      });
      expect(observe.mock.calls).toEqual([
        [2, { 'db.client.connection.state': 'used', 'db.client.connection.pool.name': 'default' }],
        [1, { 'db.client.connection.state': 'idle', 'db.client.connection.pool.name': 'default' }],
        [2, { 'db.client.connection.pool.name': 'default' }],
      ]);
    });

    test('maps ids SQL type to the configured ids format', ({
      model,
      telemetry,
      cache,
      client,
    }) => {
      expect(client.resourcesMetadata.test.fields._id.type).toBe('UUID');
      Id.FORMAT = 'SNOWFLAKE';
      const other = new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, settings);
      Id.FORMAT = 'UUID';
      expect((other as TestClient).resourcesMetadata.test.fields._id.type)
        .toBe('VARCHAR(24)');
    });

    // @TODO resources metadata (and the SQL types, which depend on `Id.FORMAT`) are generated but
    // never used by any public method since structures creation has been commented out.
    test('throws if a string field is too long to be indexed', ({ model, telemetry, cache }) => {
      vi.spyOn(model, 'get').mockImplementation((path: string) => ({
        depth: 1,
        permissions: [],
        canonicalPath: [path],
        schema: {
          fields: {
            tooLong: { type: 'string', isUnique: true, maxLength: 3000 },
          },
        },
      }) as never);

      expect(() => new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, settings))
        .toThrow(new Error('INDEXED_FIELD_VALUE_TOO_LONG'));
    });
  });

  describe('[withSession]', () => {
    test('runs operations in a transaction, re-using the session for nested ones', async ({ client }) => {
      const response = await client.withSession(async (session) => client.withSession(
        async (sameSession) => client.delete('otherTest', resourceId, { poolOrSession: sameSession }),
        session,
      ));

      expect(response).toBe(true);
      expect(poolClient.query.mock.calls).toEqual([
        ['BEGIN;', []],
        [`DELETE FROM
  "otherTest"
WHERE
  "otherTest"."_id" = $1;`, ['000000000000000000000001']],
        ['COMMIT;', []],
      ]);
      expect(pool.connect).toHaveBeenCalledOnce();
      expect(poolClient.release).toHaveBeenCalledOnce();
      expect(poolClient.release).toHaveBeenCalledWith(undefined);
    });

    test('rolls the transaction back and rethrows when the callback fails', async ({ client }) => {
      const error = new Error('CALLBACK_ERROR');

      await expect(client.withSession(() => Promise.reject(error))).rejects.toThrow(error);
      expect(poolClient.query.mock.calls).toEqual([['BEGIN;', []], ['ROLLBACK;', []]]);
      // Rollback succeeded: connection is clean and goes back to the pool.
      expect(poolClient.release).toHaveBeenCalledWith(undefined);
    });

    test('rolls the transaction back when it cannot be committed', async ({ client }) => {
      const error = new Error('COMMIT_ERROR');
      poolClient.query
        .mockResolvedValueOnce({ rowCount: null, rows: [] })
        .mockRejectedValueOnce(error);

      await expect(client.withSession(() => Promise.resolve())).rejects.toThrow(error);
      expect(poolClient.query.mock.calls).toEqual([['BEGIN;', []], ['COMMIT;', []], ['ROLLBACK;', []]]);
      expect(poolClient.release).toHaveBeenCalledWith(undefined);
    });

    test('destroys the connection and rethrows the original error when rolling back fails', async ({ client }) => {
      const error = new Error('CALLBACK_ERROR');
      poolClient.query
        .mockResolvedValueOnce({ rowCount: null, rows: [] })
        .mockRejectedValueOnce(new Error('ROLLBACK_ERROR'));

      await expect(client.withSession(() => Promise.reject(error))).rejects.toThrow(error);
      expect(poolClient.query.mock.calls).toEqual([['BEGIN;', []], ['ROLLBACK;', []]]);
      expect(poolClient.release).toHaveBeenCalledWith(error);
    });
  });

  describe('[create]', () => {
    test('uses the module registered for the resource', async ({ client }) => {
      client.registerModule('otherTest', {
        create: (payload, options, baseCreate) => baseCreate({ ...payload, enum: 'TWO' }, options),
      });

      await client.create('otherTest', { ...otherTestPayload, data: { ...otherTestPayload.data, optionalFlatArray: [] } });

      expect(poolClient.query.mock.calls).toEqual([
        ['BEGIN;', []],
        [`INSERT INTO
  "otherTest" (
    "enum",
    "_id",
    "optionalRelation",
    "binary",
    "_createdAt",
    "data",
    "data_optionalRelation",
    "data_optionalFlatArray"
  )
VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
  );`, ['TWO', '000000000000000000000001', null, new ArrayBuffer(0), new Date('2025-01-01'), true, null, true]],
        ['COMMIT;', []],
      ]);
    });

    // @TODO arrays rows never get their "_resourceId" column, although resources metadata declare
    // it as required.
    test('inserts the resource row and its arrays rows in a single transaction', async ({ client }) => {
      await client.create('otherTest', otherTestPayload);

      expect(poolClient.query.mock.calls).toEqual([
        ['BEGIN;', []],
        [`INSERT INTO
  "otherTest" (
    "enum",
    "_id",
    "optionalRelation",
    "binary",
    "_createdAt",
    "data",
    "data_optionalRelation",
    "data_optionalFlatArray"
  )
VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
  );`, ['ONE', '000000000000000000000001', null, new ArrayBuffer(0), new Date('2025-01-01'), true, null, true]],
        [`INSERT INTO
  "_otherTest_data_optionalFlatArray" (
    "_id",
    "_parent",
    "value"
  )
VALUES
  (
    $1,
    $2,
    $3
  ),
  (
    $4,
    $5,
    $6
  );`, [
          '000000000000000000000002',
          '000000000000000000000001',
          'test1',
          '000000000000000000000003',
          '000000000000000000000001',
          'test2',
        ]],
        ['COMMIT;', []],
      ]);
    });

    test('flattens nested objects, marks null ones and nests arrays tables', async ({ client }) => {
      await client.create('test', {
        _id: resourceId,
        _isDeleted: false,
        indexedString: 'test',
        objectOne: {
          boolean: true,
          optionalRelations: null,
          objectTwo: {
            optionalIndexedString: null,
            optionalNestedArray: [null, {
              data: {
                optionalInteger: 1,
                flatArray: ['a'],
                nestedArray: [{ optionalRelation: relationId, key: 'k' }],
              },
            }],
          },
        },
      });

      expect(poolClient.query.mock.calls).toEqual([
        ['BEGIN;', []],
        [`INSERT INTO
  "test" (
    "_id",
    "_isDeleted",
    "indexedString",
    "objectOne",
    "objectOne_boolean",
    "objectOne_optionalRelations",
    "objectOne_objectTwo",
    "objectOne_objectTwo_optionalIndexedString",
    "objectOne_objectTwo_optionalNestedArray"
  )
VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
  );`, ['000000000000000000000001', false, 'test', true, true, null, true, null, true]],
        [`INSERT INTO
  "_test_objectOne_objectTwo_optionalNestedArray" (
    "_id",
    "_parent",
    "value",
    "value_data",
    "value_data_optionalInteger",
    "value_data_flatArray",
    "value_data_nestedArray"
  )
VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
  ),
  (
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14
  );`, [
          '000000000000000000000002',
          '000000000000000000000001',
          null,
          null,
          null,
          null,
          null,
          '000000000000000000000003',
          '000000000000000000000001',
          true,
          true,
          1,
          true,
          true,
        ]],
        [`INSERT INTO
  "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray" (
    "_id",
    "_parent",
    "value"
  )
VALUES
  (
    $1,
    $2,
    $3
  );`, ['000000000000000000000004', '000000000000000000000003', 'a']],
        [`INSERT INTO
  "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray" (
    "_id",
    "_parent",
    "value",
    "value_optionalRelation",
    "value_key"
  )
VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5
  );`, ['000000000000000000000005', '000000000000000000000003', true, '000000000000000000000009', 'k']],
        ['COMMIT;', []],
      ]);
    });

    test('splits large arrays insertions into several queries', async ({ client }) => {
      await client.create('otherTest', {
        ...otherTestPayload,
        data: { optionalRelation: null, optionalFlatArray: new Array<string>(65500).fill('test1') },
      });

      // PostgreSQL rejects queries binding more than 65,535 values.
      const values = poolClient.query.mock.calls.map(([, queryValues]) => queryValues?.length);
      expect(values).toEqual([0, 8, 65535, 65535, 65430, 0]);
      expect(poolClient.query.mock.calls[2][0]).toMatch(/^INSERT INTO\n {2}"_otherTest_data_optionalFlatArray" \(/);
      expect(poolClient.query.mock.calls[3][0]).toMatch(/^INSERT INTO\n {2}"_otherTest_data_optionalFlatArray" \(/);
      expect(poolClient.query.mock.calls[4][0]).toMatch(/^INSERT INTO\n {2}"_otherTest_data_optionalFlatArray" \(/);
    });

    test('throws when a payload field does not exist in data model', async ({ client }) => {
      await expect(client.create('otherTest', {
        ...otherTestPayload,
        unknownField: true,
      } as DataModel['otherTest'])).rejects.toMatchObject({
        code: 'UNKNOWN_FIELD',
        details: { path: 'unknownField' },
      });
      expect(poolClient.query.mock.calls).toEqual([['BEGIN;', []], ['ROLLBACK;', []]]);
    });

    test('throws when a payload is missing a required field', async ({ client }) => {
      await expect(client.create('otherTest', {
        ...otherTestPayload,
        data: { optionalRelation: null },
      } as DataModel['otherTest'])).rejects.toMatchObject({
        code: 'MISSING_FIELD',
        details: { path: 'data.optionalFlatArray' },
      });
      expect(poolClient.query.mock.calls).toEqual([['BEGIN;', []], ['ROLLBACK;', []]]);
    });
  });

  describe('[update]', () => {
    test('uses the module registered for the resource', async ({ client }) => {
      client.registerModule('otherTest', {
        update: (id, payload, options, baseUpdate) => baseUpdate(id, { ...payload, enum: 'THREE' }, options),
      });

      expect(await client.update('otherTest', resourceId, { enum: 'TWO' })).toBe(true);
      expect(poolClient.query.mock.calls).toEqual([
        ['BEGIN;', []],
        [`UPDATE
  "otherTest" AS "otherTest"
SET
  "enum" = $1
WHERE
  "otherTest"."_id" = $2;`, ['THREE', '000000000000000000000001']],
        ['COMMIT;', []],
      ]);
    });

    test('updates the resource row, then replaces its arrays rows', async ({ client }) => {
      expect(await client.update('otherTest', resourceId, {
        enum: 'TWO',
        data: { optionalFlatArray: ['test3'] },
      })).toBe(true);

      expect(poolClient.query.mock.calls).toEqual([
        ['BEGIN;', []],
        [`UPDATE
  "otherTest" AS "otherTest"
SET
  "enum" = $1,
  "data" = $2,
  "data_optionalFlatArray" = $3
WHERE
  "otherTest"."_id" = $4;`, ['TWO', true, true, '000000000000000000000001']],
        [`DELETE FROM
  "_otherTest_data_optionalFlatArray"
WHERE
  "_parent" = $1;`, ['000000000000000000000001']],
        [`INSERT INTO
  "_otherTest_data_optionalFlatArray" (
    "_id",
    "_parent",
    "value"
  )
VALUES
  (
    $1,
    $2,
    $3
  );`, ['000000000000000000000002', '000000000000000000000001', 'test3']],
        ['COMMIT;', []],
      ]);
    });

    test('locks the resource row when the payload does not change it', async ({ client }) => {
      expect(await client.update('test', resourceId, {})).toBe(true);

      expect(poolClient.query.mock.calls).toEqual([
        ['BEGIN;', []],
        [`SELECT
  1
FROM
  "test" AS "test"
WHERE
  "test"."_id" = $1
  AND "test"."_isDeleted" = FALSE FOR UPDATE;`, ['000000000000000000000001']],
        ['COMMIT;', []],
      ]);
    });

    test('returns false and cancels the transaction when the resource does not exist', async ({ client }) => {
      poolClient.query
        .mockResolvedValueOnce({ rowCount: null, rows: [] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] });

      expect(await client.update('otherTest', resourceId, { enum: 'TWO' })).toBe(false);
      expect(poolClient.query.mock.calls).toEqual([
        ['BEGIN;', []],
        [`UPDATE
  "otherTest" AS "otherTest"
SET
  "enum" = $1
WHERE
  "otherTest"."_id" = $2;`, ['TWO', '000000000000000000000001']],
        ['ROLLBACK;', []],
      ]);
      expect(poolClient.release).toHaveBeenCalledWith(undefined);
    });
  });

  describe('[delete]', () => {
    test('uses the module registered for the resource', async ({ client }) => {
      client.registerModule('otherTest', {
        delete: (_id, options, baseDelete) => baseDelete(relationId, options),
      });

      expect(await client.delete('otherTest', resourceId)).toBe(true);
      expect(poolClient.query.mock.calls).toEqual([
        [`DELETE FROM
  "otherTest"
WHERE
  "otherTest"."_id" = $1;`, ['000000000000000000000009']],
      ]);
    });

    test('compiles the query plans of the module registered for the resource', async ({ client }) => {
      client.registerModule('otherTest', {
        planQueries: () => ({
          projections: { _id: 1 },
          queries: {
            otherTest: {
              type: 'DELETE',
              table: 'otherTest',
              with: [{
                as: 'expired',
                query: { type: 'SELECT', table: 'test', fields: ['"test"."_id"'] },
              }],
              where: [
                { operator: 'EXISTS', value: 'SELECT 1 FROM "expired"' },
                { operator: 'NOT IN', column: '"otherTest"."_id"', value: 'SELECT "_id" FROM "expired"' },
                { operator: '!=', column: '"otherTest"."enum"', value: ['ONE', 'TWO'] },
                {
                  operator: '=',
                  column: '"otherTest"."optionalRelation"',
                  value: {
                    type: 'SELECT',
                    table: 'test',
                    fields: ['"test"."_id"'],
                    join: [{ type: 'INNER', table: 'roles', on: '"roles"."_id" = "test"."role"' }],
                    limit: 1,
                  },
                },
              ],
            },
          },
        }) as never,
      });

      await client.delete('otherTest', resourceId);

      expect(poolClient.query.mock.calls).toEqual([
        [`WITH
  "expired" AS (
    SELECT
      "test"."_id"
    FROM
      "test"
  )
DELETE FROM
  "otherTest"
WHERE
  EXISTS (
SELECT 1 FROM "expired"
  )
  AND "otherTest"."_id" NOT IN (SELECT "_id" FROM "expired")
  AND "otherTest"."enum" != ALL($1)
  AND "otherTest"."optionalRelation" = (
    SELECT
      "test"."_id"
    FROM
      "test"
    INNER JOIN
      "roles"
    ON
      "roles"."_id" = "test"."role"
    LIMIT $2
  );`, [['ONE', 'TWO'], 1]],
      ]);
    });

    test('throws when comparing a column to a list of values with an unsupported operator', async ({ client }) => {
      client.registerModule('otherTest', {
        planQueries: () => ({
          projections: { _id: 1 },
          queries: {
            otherTest: {
              type: 'DELETE',
              table: 'otherTest',
              where: [{ operator: '>', column: '"otherTest"."enum"', value: ['ONE'] }],
            },
          },
        }) as never,
      });

      await expect(client.delete('otherTest', resourceId))
        .rejects.toMatchObject({ code: 'UNSUPPORTED_ARRAY_OPERATOR', details: { operator: '>' } });
      expect(poolClient.query).not.toHaveBeenCalled();
    });

    test('returns true when the resource has been deleted', async ({ client }) => {
      expect(await client.delete('test', resourceId)).toBe(true);
      expect(poolClient.query.mock.calls).toEqual([
        [`DELETE FROM
  "test"
WHERE
  "test"."_id" = $1
  AND "test"."_isDeleted" = FALSE;`, ['000000000000000000000001']],
      ]);
    });

    test('returns false when the resource does not exist', async ({ client }) => {
      poolClient.query.mockResolvedValueOnce({ rowCount: null, rows: [] });

      expect(await client.delete('test', resourceId, { excludeDeletedResources: false })).toBe(false);
      expect(poolClient.query.mock.calls).toEqual([
        [`DELETE FROM
  "test"
WHERE
  "test"."_id" = $1;`, ['000000000000000000000001']],
      ]);
    });

    test('connects to each pool on its first query, then re-uses it', async ({ model, telemetry, cache }) => {
      const client = new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, {
        hashAliases: false,
        pools: {
          default: defaultPool,
          other: {
            ...defaultPool,
            port: null,
            user: null,
            password: null,
            options: '-c search_path=test',
          },
        },
      });

      await client.delete('otherTest', resourceId);
      await client.delete('otherTest', resourceId, { poolOrSession: 'default' });
      await client.delete('otherTest', resourceId, { poolOrSession: 'other' });

      expect(vi.mocked(Pool).mock.calls).toEqual([
        [{
          ...defaultPool,
          max: 10,
          lock_timeout: 5000,
          query_timeout: 5000,
          statement_timeout: 5000,
          connectionTimeoutMillis: 2000,
          options: undefined,
        }],
        [{
          ...defaultPool,
          max: 10,
          lock_timeout: 5000,
          query_timeout: 5000,
          statement_timeout: 5000,
          connectionTimeoutMillis: 2000,
          // Lets the database server apply its own defaults.
          port: undefined,
          user: undefined,
          password: undefined,
          options: '-c search_path=test',
        }],
      ]);
      // A connection is acquired, then released, for each query.
      expect(pool.connect).toHaveBeenCalledTimes(3);
      expect(poolClient.release).toHaveBeenCalledTimes(3);
      expect(telemetry.measure).toHaveBeenCalledWith('db.client.connection.wait_time', 0.5, {
        'db.client.connection.pool.name': 'other',
      });
      expect(telemetry.measure).toHaveBeenCalledWith('db.client.operation.duration', 0.5, {
        'db.system.name': 'postgresql',
        'server.port': null,
        'server.address': 'localhost',
        'db.namespace': 'test',
        'error.type': undefined,
        'db.response.status_code': undefined,
      });
    });

    test('does not crash on errors happening on idle connections', async ({ client }) => {
      await client.delete('otherTest', resourceId);

      expect(() => { emit('error', new Error('CONNECTION_LOST')); }).not.toThrow();
    });

    test('throws when the targeted pool has no connection settings registered', async ({ client }) => {
      await expect(client.delete('otherTest', resourceId, { poolOrSession: 'unknown' }))
        .rejects.toMatchObject({ code: 'POOL_NOT_FOUND', details: { pool: 'unknown' } });
      expect(Pool).not.toHaveBeenCalled();
    });

    test('translates constraint violations', async ({ client }) => {
      poolClient.query.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), {
        code: '23505',
        table: 'otherTest',
        constraint: 'otherTest_indexedString_key',
      }));

      await expect(client.delete('otherTest', resourceId)).rejects.toMatchObject({
        code: 'RESOURCE_EXISTS',
        details: { table: 'otherTest', constraint: 'otherTest_indexedString_key' },
      });
      expect(poolClient.release).toHaveBeenCalledOnce();
    });

    test('translates foreign key violations', async ({ client }) => {
      poolClient.query.mockRejectedValueOnce(Object.assign(new Error('still referenced'), {
        code: '23503',
      }));

      await expect(client.delete('otherTest', resourceId)).rejects.toMatchObject({
        code: 'RESOURCE_REFERENCED',
      });
    });

    test('translates any other database error', async ({ client }) => {
      poolClient.query.mockRejectedValueOnce(Object.assign(new Error('out of memory'), {
        code: '53200',
        detail: 'Key (indexedString)=(test).',
      }));

      await expect(client.delete('otherTest', resourceId)).rejects.toMatchObject({
        code: 'DATABASE_ERROR',
        details: { code: '53200', message: 'out of memory' },
      });
    });

    test('rethrows an error that does not come from the database server', async ({ client }) => {
      const error = new Error('SOCKET_CLOSED');
      poolClient.query.mockRejectedValueOnce(error);

      await expect(client.delete('otherTest', resourceId)).rejects.toThrow(error);
      expect(poolClient.release).toHaveBeenCalledOnce();
    });

    test('rethrows the original error when no connection can be acquired', async ({ client }) => {
      const error = new Error('CONNECTION_TIMEOUT');
      pool.connect.mockRejectedValueOnce(error);

      await expect(client.delete('otherTest', resourceId)).rejects.toThrow(error);
      expect(poolClient.query).not.toHaveBeenCalled();
      expect(poolClient.release).not.toHaveBeenCalled();
    });
  });

  describe('[view]', () => {
    test('uses the module registered for the resource', async ({ client }) => {
      client.registerModule('otherTest', {
        view: (_id, options, baseView) => baseView(relationId, options),
        planQueries: (type, id, payload, options, basePlanQueries) => (
          basePlanQueries(type, id, payload, { ...options, fields: ['enum'] } as never)
        ),
      });
      poolClient.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ otherTest__id: '000000000000000000000009', otherTest_enum: 'ONE' }],
      });

      expect(await client.view('otherTest', resourceId)).toEqual({ _id: relationId, enum: 'ONE' });
      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  "otherTest"."_id" AS "otherTest__id",
  "otherTest"."enum" AS "otherTest_enum"
FROM
  "otherTest" AS "otherTest"
WHERE
  "otherTest"."_id" = $1;`, ['000000000000000000000009']],
      ]);
    });

    test('returns the resource, fetching its arrays in their own queries', async ({ client }) => {
      poolClient.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            test__id: '000000000000000000000001',
            test_indexedString: 'test',
            test_objectOne: true,
            test_objectOne_objectTwo: true,
            test_objectOne_objectTwo_optionalIndexedString: null,
            test_objectOne_optionalRelations: true,
            test_objectOne_objectTwo_optionalNestedArray: true,
          }],
        })
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: [
            {
              test_objectOne_optionalRelations__itemId: '000000000000000000000011',
              test_objectOne_optionalRelations__parent: '000000000000000000000001',
              test_objectOne_optionalRelations: '000000000000000000000009',
              test_objectOne_optionalRelations__id: '000000000000000000000009',
              test_objectOne_optionalRelations__createdAt: new Date('2025-01-01'),
            },
            {
              test_objectOne_optionalRelations__itemId: '000000000000000000000012',
              test_objectOne_optionalRelations__parent: '000000000000000000000001',
              test_objectOne_optionalRelations: '000000000000000000000008',
              test_objectOne_optionalRelations__id: null,
              test_objectOne_optionalRelations__createdAt: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          rowCount: 4,
          rows: [
            {
              test_objectOne_objectTwo_optionalNestedArray__itemId: '000000000000000000000021',
              test_objectOne_objectTwo_optionalNestedArray__parent: '000000000000000000000001',
              test_objectOne_objectTwo_optionalNestedArray: null,
              test_objectOne_objectTwo_optionalNestedArray_data: null,
              test_objectOne_objectTwo_optionalNestedArray_data_flatArray: null,
              test_objectOne_objectTwo_optionalNestedArray_data_nestedArray: null,
            },
            {
              test_objectOne_objectTwo_optionalNestedArray__itemId: '000000000000000000000024',
              test_objectOne_objectTwo_optionalNestedArray__parent: '000000000000000000000001',
              test_objectOne_objectTwo_optionalNestedArray: true,
              test_objectOne_objectTwo_optionalNestedArray_data: true,
              test_objectOne_objectTwo_optionalNestedArray_data_flatArray: true,
              test_objectOne_objectTwo_optionalNestedArray_data_nestedArray: true,
            },
            {
              test_objectOne_objectTwo_optionalNestedArray__itemId: '000000000000000000000022',
              test_objectOne_objectTwo_optionalNestedArray__parent: '000000000000000000000001',
              test_objectOne_objectTwo_optionalNestedArray: true,
              test_objectOne_objectTwo_optionalNestedArray_data: true,
              test_objectOne_objectTwo_optionalNestedArray_data_flatArray: true,
              test_objectOne_objectTwo_optionalNestedArray_data_nestedArray: true,
            },
            {
              test_objectOne_objectTwo_optionalNestedArray__itemId: '000000000000000000000023',
              test_objectOne_objectTwo_optionalNestedArray__parent: '000000000000000000000001',
              test_objectOne_objectTwo_optionalNestedArray: true,
              test_objectOne_objectTwo_optionalNestedArray_data: true,
              test_objectOne_objectTwo_optionalNestedArray_data_flatArray: true,
              test_objectOne_objectTwo_optionalNestedArray_data_nestedArray: true,
            },
          ],
        })
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: [
            {
              _bb76f1127b49ba1487: '000000000000000000000031',
              _bf2654d3ffa8611f38: '000000000000000000000022',
              test_objectOne_objectTwo_optionalNestedArray_data_flatArray: 'a',
            },
            {
              _bb76f1127b49ba1487: '000000000000000000000032',
              _bf2654d3ffa8611f38: '000000000000000000000022',
              test_objectOne_objectTwo_optionalNestedArray_data_flatArray: 'b',
            },
          ],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            _d0f97f26cc24059852: '000000000000000000000041',
            _b193a067581c642c04: '000000000000000000000022',
            test_objectOne_objectTwo_optionalNestedArray_data_nestedArray: true,
            _e84dadc8c6622de85f: '000000000000000000000009',
          }],
        });

      expect(await client.view('test', resourceId, {
        fields: [
          'indexedString',
          'objectOne.objectTwo.optionalIndexedString',
          'objectOne.optionalRelations._createdAt',
          'objectOne.objectTwo.optionalNestedArray.data.flatArray',
          'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation',
        ],
      })).toEqual({
        _id: resourceId,
        indexedString: 'test',
        objectOne: {
          optionalRelations: [{ _id: relationId, _createdAt: new Date('2025-01-01') }, null],
          objectTwo: {
            optionalIndexedString: null,
            optionalNestedArray: [
              null,
              { data: { flatArray: [], nestedArray: [] } },
              { data: { flatArray: ['a', 'b'], nestedArray: [{ optionalRelation: relationId }] } },
              { data: { flatArray: [], nestedArray: [] } },
            ],
          },
        },
      });
      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  "test"."_id" AS "test__id",
  "test"."indexedString" AS "test_indexedString",
  "test"."objectOne" AS "test_objectOne",
  "test"."objectOne_objectTwo" AS "test_objectOne_objectTwo",
  "test"."objectOne_objectTwo_optionalIndexedString" AS "test_objectOne_objectTwo_optionalIndexedString",
  "test"."objectOne_optionalRelations" AS "test_objectOne_optionalRelations",
  "test"."objectOne_objectTwo_optionalNestedArray" AS "test_objectOne_objectTwo_optionalNestedArray"
FROM
  "test" AS "test"
WHERE
  "test"."_id" = $1
  AND "test"."_isDeleted" = FALSE;`, ['000000000000000000000001']],
        [`SELECT
  "_test_objectOne_optionalRelations"."_id" AS "test_objectOne_optionalRelations__itemId",
  "_test_objectOne_optionalRelations"."_parent" AS "test_objectOne_optionalRelations__parent",
  "_test_objectOne_optionalRelations"."value" AS "test_objectOne_optionalRelations",
  "test_objectOne_optionalRelations"."_id" AS "test_objectOne_optionalRelations__id",
  "test_objectOne_optionalRelations"."_createdAt" AS "test_objectOne_optionalRelations__createdAt"
FROM
  "_test_objectOne_optionalRelations" AS "_test_objectOne_optionalRelations"
LEFT JOIN
  "otherTest" AS "test_objectOne_optionalRelations"
ON
  "test_objectOne_optionalRelations"."_id" = "_test_objectOne_optionalRelations"."value"
WHERE
  "_test_objectOne_optionalRelations"."_parent" = $1
ORDER BY
  "_test_objectOne_optionalRelations"."_id" ASC;`, ['000000000000000000000001']],
        [`SELECT
  "_test_objectOne_objectTwo_optionalNestedArray"."_id" AS "test_objectOne_objectTwo_optionalNestedArray__itemId",
  "_test_objectOne_objectTwo_optionalNestedArray"."_parent" AS "test_objectOne_objectTwo_optionalNestedArray__parent",
  "_test_objectOne_objectTwo_optionalNestedArray"."value" AS "test_objectOne_objectTwo_optionalNestedArray",
  "_test_objectOne_objectTwo_optionalNestedArray"."value_data" AS "test_objectOne_objectTwo_optionalNestedArray_data",
  "_test_objectOne_objectTwo_optionalNestedArray"."value_data_flatArray" AS "test_objectOne_objectTwo_optionalNestedArray_data_flatArray",
  "_test_objectOne_objectTwo_optionalNestedArray"."value_data_nestedArray" AS "test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"
FROM
  "_test_objectOne_objectTwo_optionalNestedArray" AS "_test_objectOne_objectTwo_optionalNestedArray"
WHERE
  "_test_objectOne_objectTwo_optionalNestedArray"."_parent" = $1
ORDER BY
  "_test_objectOne_objectTwo_optionalNestedArray"."_id" ASC;`, ['000000000000000000000001']],
        [`SELECT
  "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray"."_id" AS "_bb76f1127b49ba1487",
  "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray"."_parent" AS "_bf2654d3ffa8611f38",
  "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray"."value" AS "test_objectOne_objectTwo_optionalNestedArray_data_flatArray"
FROM
  "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray" AS "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray"
WHERE
  "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray"."_parent" IN (
    SELECT
      "_test_objectOne_objectTwo_optionalNestedArray"."_id"
    FROM
      "_test_objectOne_objectTwo_optionalNestedArray" AS "_test_objectOne_objectTwo_optionalNestedArray"
    WHERE
      "_test_objectOne_objectTwo_optionalNestedArray"."_parent" = $1
  )
ORDER BY
  "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray"."_id" ASC;`, ['000000000000000000000001']],
        [`SELECT
  "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"."_id" AS "_d0f97f26cc24059852",
  "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"."_parent" AS "_b193a067581c642c04",
  "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"."value" AS "test_objectOne_objectTwo_optionalNestedArray_data_nestedArray",
  "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"."value_optionalRelation" AS "_e84dadc8c6622de85f"
FROM
  "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray" AS "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"
WHERE
  "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"."_parent" IN (
    SELECT
      "_test_objectOne_objectTwo_optionalNestedArray"."_id"
    FROM
      "_test_objectOne_objectTwo_optionalNestedArray" AS "_test_objectOne_objectTwo_optionalNestedArray"
    WHERE
      "_test_objectOne_objectTwo_optionalNestedArray"."_parent" = $1
  )
ORDER BY
  "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"."_id" ASC;`, ['000000000000000000000001']],
      ]);
    });

    test('returns null when the resource does not exist', async ({ client }) => {
      poolClient.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      expect(await client.view('otherTest', resourceId, { fields: ['data.optionalFlatArray'] }))
        .toBeNull();
      // Arrays are not fetched for a resource that does not exist.
      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  "otherTest"."_id" AS "otherTest__id",
  "otherTest"."data" AS "otherTest_data",
  "otherTest"."data_optionalFlatArray" AS "otherTest_data_optionalFlatArray"
FROM
  "otherTest" AS "otherTest"
WHERE
  "otherTest"."_id" = $1;`, ['000000000000000000000001']],
      ]);
    });

    test('generates opaque SQL aliases by default', async ({ model, telemetry, cache }) => {
      const client = new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, {
        ...settings,
        hashAliases: true,
      });
      poolClient.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ _95919f72fd0fb9d3b9: '000000000000000000000001' }],
      });

      expect(await client.view('otherTest', resourceId)).toEqual({ _id: resourceId });
      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  "_e1bfe8f56ed864cf8e"."_id" AS "_95919f72fd0fb9d3b9"
FROM
  "otherTest" AS "_e1bfe8f56ed864cf8e"
WHERE
  "_e1bfe8f56ed864cf8e"."_id" = $1;`, ['000000000000000000000001']],
      ]);
    });

    test('joins a required related resource with an inner join', async ({ model, telemetry, cache }) => {
      vi.spyOn(model, 'get').mockImplementation((path: string) => ({
        depth: 1,
        permissions: [],
        canonicalPath: [path],
        schema: {
          enableDeletion: true,
          fields: (path === 'test')
            ? {
              _id: { type: 'id', isRequired: true },
              requiredRelation: { type: 'id', isRequired: true, relation: 'otherTest' },
            }
            : {
              _id: { type: 'id', isRequired: true },
              enum: { type: 'string', maxLength: 10 },
            },
        },
      }) as never);
      const client = new PostgreSQLDatabaseClient<DataModel>(model, telemetry, cache, settings);
      poolClient.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await client.view('test', resourceId, { fields: ['requiredRelation.enum'] });

      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  "test"."_id" AS "test__id",
  "test_requiredRelation"."_id" AS "test_requiredRelation__id",
  "test_requiredRelation"."enum" AS "test_requiredRelation_enum"
FROM
  "test" AS "test"
INNER JOIN
  "otherTest" AS "test_requiredRelation"
ON
  "test_requiredRelation"."_id" = "test"."requiredRelation"
WHERE
  "test"."_id" = $1;`, ['000000000000000000000001']],
      ]);
    });
  });

  describe('[list]', () => {
    test('uses the module registered for the resource', async ({ client }) => {
      client.registerModule('otherTest', {
        list: (_searchBody, options, baseList) => baseList(null, { ...options, limit: 5 }),
        formatRows: (projections, resultsPerQuery, baseFormatRows) => [
          ...(baseFormatRows(projections, resultsPerQuery) as unknown[]),
          'FORMATTED',
        ] as never,
      });
      poolClient.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ _id: '000000000000000000000001', __total: '1' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ otherTest__id: '000000000000000000000001' }] });

      expect(await client.list('otherTest', { query: null, filters: { _createdAt: new Date() } }))
        .toEqual({ total: 1, results: [{ _id: resourceId }, 'FORMATTED'] });
      expect(poolClient.query.mock.calls[0]).toEqual([`SELECT
  "otherTest"."_id",
  COUNT(*) OVER () AS __total
FROM
  "otherTest" AS "otherTest"
ORDER BY
  "otherTest"."_id" ASC
LIMIT $1
OFFSET $2;`, [5, 0]]);
    });

    test('paginates, filters, searches and sorts resources', async ({ client }) => {
      poolClient.query
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: [
            { _id: '000000000000000000000001', __total: '22' },
            { _id: '000000000000000000000002', __total: '22' },
          ],
        })
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: [
            { test__id: '000000000000000000000001', test_indexedString: 'first' },
            { test__id: '000000000000000000000002', test_indexedString: null },
          ],
        });

      expect(await client.list('test', {
        query: {
          on: ['indexedString', 'objectOne.objectTwo.optionalIndexedString'],
          text: 'jo(hn 100%',
        },
        filters: {
          indexedString: ['first', null],
          'objectOne.objectTwo.optionalIndexedString': null,
          'objectOne.objectTwo.optionalNestedArray.data.optionalInteger': [1],
          'objectOne.objectTwo.optionalNestedArray.data.flatArray': [],
        },
      }, {
        limit: 10,
        offset: 20,
        fields: ['indexedString'],
        sortBy: { indexedString: 1, 'objectOne.objectTwo.optionalIndexedString': -1 },
      })).toEqual({
        total: 22,
        results: [
          { _id: resourceId, indexedString: 'first' },
          { _id: new Id('000000000000000000000002'), indexedString: null },
        ],
      });
      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  "test"."_id",
  COUNT(*) OVER () AS __total
FROM
  "test" AS "test"
WHERE
  "test"."_isDeleted" = FALSE
  AND (
    (
      "test"."indexedString" ILIKE $1
      AND "test"."indexedString" ILIKE $2
      AND "test"."indexedString" ILIKE $3
    )
    OR (
      "test"."objectOne_objectTwo_optionalIndexedString" ILIKE $4
      AND "test"."objectOne_objectTwo_optionalIndexedString" ILIKE $5
      AND "test"."objectOne_objectTwo_optionalIndexedString" ILIKE $6
    )
  )
  AND (
    "test"."indexedString" = ANY($7)
    OR "test"."indexedString" IS NULL
  )
  AND "test"."objectOne_objectTwo_optionalIndexedString" IS NULL
  AND EXISTS (
    SELECT
      1
    FROM
      "_test_objectOne_objectTwo_optionalNestedArray" AS "_test_objectOne_objectTwo_optionalNestedArray"
    WHERE
      "_test_objectOne_objectTwo_optionalNestedArray"."value_data_optionalInteger" = ANY($8)
      AND "_test_objectOne_objectTwo_optionalNestedArray"."_parent" IN ("test"."_id")
  )
  AND EXISTS (
    SELECT
      1
    FROM
      "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray" AS "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray"
    WHERE
      FALSE
      AND "_test_objectOne_objectTwo_optionalNestedArray_data_flatArray"."_parent" IN (
        SELECT
          "_test_objectOne_objectTwo_optionalNestedArray"."_id"
        FROM
          "_test_objectOne_objectTwo_optionalNestedArray" AS "_test_objectOne_objectTwo_optionalNestedArray"
        WHERE
          "_test_objectOne_objectTwo_optionalNestedArray"."_parent" IN ("test"."_id")
      )
  )
ORDER BY
  "test"."indexedString" ASC,
  "test"."objectOne_objectTwo_optionalIndexedString" DESC,
  "test"."_id" ASC
LIMIT $9
OFFSET $10;`, ['%jo%', '%hn%', '%100\\%%', '%jo%', '%hn%', '%100\\%%', ['first'], [1], 10, 20]],
        [`SELECT
  "test"."_id" AS "test__id",
  "test"."indexedString" AS "test_indexedString"
FROM
  "test" AS "test"
WHERE
  "test"."_id" = ANY($1)
ORDER BY
  array_position($1, "test"."_id") ASC;`, [['000000000000000000000001', '000000000000000000000002']]],
      ]);
    });

    test('filters, searches and sorts resources on their relations', async ({ client }) => {
      poolClient.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await client.list('otherTest', {
        query: null,
        filters: { 'optionalRelation.indexedString': 'test', 'data.optionalRelation': null },
      }, {
        fields: ['optionalRelation.indexedString'],
        sortBy: { 'optionalRelation.indexedString': -1 },
      });

      // Soft-deleted resources must not be reachable through filters, search or sorting.
      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  "otherTest"."_id",
  COUNT(*) OVER () AS __total
FROM
  "otherTest" AS "otherTest"
LEFT JOIN
  "test" AS "otherTest_optionalRelation"
ON
  "otherTest_optionalRelation"."_id" = "otherTest"."optionalRelation" AND "otherTest_optionalRelation"."_isDeleted" = FALSE
WHERE
  "otherTest_optionalRelation"."indexedString" = $1
  AND "otherTest"."data_optionalRelation" IS NULL
ORDER BY
  "otherTest_optionalRelation"."indexedString" DESC,
  "otherTest"."_id" ASC
LIMIT $2
OFFSET $3;`, ['test', 20, 0]],
      ]);
    });

    test('filters and searches resources on their arrays items', async ({ client }) => {
      poolClient.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      expect(await client.list('test', {
        query: { on: ['objectOne.optionalRelations.data.optionalFlatArray'], text: 'test1' },
        filters: {
          'objectOne.optionalRelations._createdAt': new Date('2025-01-01'),
          'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation.optionalRelation': resourceId,
        },
      })).toEqual({ total: 0, results: [] });
      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  "test"."_id",
  COUNT(*) OVER () AS __total
FROM
  "test" AS "test"
WHERE
  "test"."_isDeleted" = FALSE
  AND EXISTS (
      SELECT
        1
      FROM
        "_otherTest_data_optionalFlatArray" AS "_otherTest_data_optionalFlatArray"
      WHERE
        "_otherTest_data_optionalFlatArray"."value" ILIKE $1
        AND "_otherTest_data_optionalFlatArray"."_parent" IN (
          SELECT
            "_test_objectOne_optionalRelations"."value"
          FROM
            "_test_objectOne_optionalRelations" AS "_test_objectOne_optionalRelations"
          WHERE
            "_test_objectOne_optionalRelations"."_parent" IN ("test"."_id")
        )
    )
  AND EXISTS (
    SELECT
      1
    FROM
      "otherTest" AS "test_objectOne_optionalRelations"
    WHERE
      "test_objectOne_optionalRelations"."_createdAt" = $2
      AND "test_objectOne_optionalRelations"."_id" IN (
        SELECT
          "_test_objectOne_optionalRelations"."value"
        FROM
          "_test_objectOne_optionalRelations" AS "_test_objectOne_optionalRelations"
        WHERE
          "_test_objectOne_optionalRelations"."_parent" IN ("test"."_id")
      )
  )
  AND EXISTS (
    SELECT
      1
    FROM
      "otherTest" AS "_e84dadc8c6622de85f"
    WHERE
      "_e84dadc8c6622de85f"."optionalRelation" = $3
      AND "_e84dadc8c6622de85f"."_id" IN (
        SELECT
          "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"."value_optionalRelation"
        FROM
          "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray" AS "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"
        WHERE
          "_test_objectOne_objectTwo_optionalNestedArray_data_nestedArray"."_parent" IN (
            SELECT
              "_test_objectOne_objectTwo_optionalNestedArray"."_id"
            FROM
              "_test_objectOne_objectTwo_optionalNestedArray" AS "_test_objectOne_objectTwo_optionalNestedArray"
            WHERE
              "_test_objectOne_objectTwo_optionalNestedArray"."_parent" IN ("test"."_id")
          )
      )
  )
ORDER BY
  "test"."_id" ASC
LIMIT $4
OFFSET $5;`, ['%test1%', new Date('2025-01-01'), '000000000000000000000001', 20, 0]],
      ]);
    });

    test('reports no resource at all when the total is missing from the results', async ({ client }) => {
      poolClient.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ _id: '000000000000000000000001', __total: null }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ otherTest__id: '000000000000000000000001' }] });

      expect(await client.list('otherTest', null)).toEqual({ total: 0, results: [{ _id: resourceId }] });
    });

    test('counts the total number of resources when the requested page is past the last one', async ({ client }) => {
      poolClient.query
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ __total: '3' }] });

      expect(await client.list('otherTest', {
        query: { on: ['data.optionalFlatArray'], text: ' , ' },
        filters: null,
      }, { offset: 20 })).toEqual({ total: 3, results: [] });
      // A search query without any usable token is ignored.
      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  "otherTest"."_id",
  COUNT(*) OVER () AS __total
FROM
  "otherTest" AS "otherTest"
ORDER BY
  "otherTest"."_id" ASC
LIMIT $1
OFFSET $2;`, [20, 20]],
        [`SELECT
  COUNT(*) AS __total
FROM
  "otherTest" AS "otherTest"
LIMIT $1
OFFSET $2;`, [1, 0]],
      ]);
    });

    test('reports no resource at all when the count of a page past the last one is missing', async ({ client }) => {
      poolClient.query
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] });

      expect(await client.list('otherTest', { query: { text: 'test' } as never, filters: null }, {
        offset: 20,
      })).toEqual({ total: 0, results: [] });
    });

    test('throws when a queried field does not exist in data model', async ({ client }) => {
      await expect(client.list('test', null, { fields: ['unknownField'] }))
        .rejects.toMatchObject({ code: 'UNKNOWN_QUERY_FIELD', details: { path: 'unknownField' } });
      // Fields named after an `Object.prototype` member must not resolve to it.
      await expect(client.list('test', null, { fields: ['__proto__'] }))
        .rejects.toMatchObject({ code: 'UNKNOWN_QUERY_FIELD', details: { path: '__proto__' } });
      await expect(client.list('test', null, { fields: ['indexedString.nested'] }))
        .rejects.toMatchObject({ code: 'UNKNOWN_QUERY_FIELD', details: { path: 'indexedString.nested' } });
      expect(poolClient.query).not.toHaveBeenCalled();
    });

    test('throws when a queried field is not a leaf of the data model', async ({ client }) => {
      await expect(client.list('test', null, { fields: ['objectOne'] }))
        .rejects.toMatchObject({ code: 'INVALID_QUERY_FIELD', details: { path: 'objectOne' } });
    });

    test('throws when a filtered field is not indexed', async ({ client }) => {
      await expect(client.list('otherTest', { filters: { enum: 'ONE' }, query: null }))
        .rejects.toMatchObject({ code: 'UNINDEXED_FIELD', details: { path: 'enum' } });
    });

    test('throws when a searched field does not contain text', async ({ client }) => {
      await expect(client.list('otherTest', {
        filters: null,
        query: { on: ['_createdAt'], text: 'john' },
      })).rejects.toMatchObject({ code: 'UNSEARCHABLE_FIELD', details: { path: '_createdAt' } });
    });

    test('throws when a sorted field is contained in an array', async ({ client }) => {
      await expect(client.list('test', null, { sortBy: { 'objectOne.optionalRelations._createdAt': 1 } }))
        .rejects.toMatchObject({
          code: 'UNSORTABLE_FIELD',
          details: { path: 'objectOne.optionalRelations._createdAt' },
        });
    });

    test('throws when maximum resources depth is exceeded', async ({ client }) => {
      await expect(client.list('otherTest', null, {
        maximumDepth: 1,
        fields: ['optionalRelation.indexedString'],
      })).rejects.toMatchObject({
        code: 'MAXIMUM_QUERY_FIELDS_DEPTH_EXCEEDED',
        details: { path: 'optionalRelation.indexedString' },
      });
    });
  });

  describe('[checkRelations]', () => {
    test('uses the module registered for the resource', async ({ client }) => {
      client.registerModule('test', {
        checkRelations: (_relations, options, baseCheckRelations) => (
          baseCheckRelations(new Map(), options)
        ),
      });

      await client.checkRelations('test', new Map([
        ['objectOne.optionalRelations', { resource: 'otherTest', filters: { _id: [relationId] } }],
      ]));

      expect(poolClient.query).not.toHaveBeenCalled();
    });

    test('does nothing when there is no relation to check', async ({ client }) => {
      await client.checkRelations('test', new Map());

      expect(poolClient.query).not.toHaveBeenCalled();
    });

    test('checks all relations in a single query', async ({ client }) => {
      poolClient.query.mockResolvedValueOnce({
        rowCount: 3,
        rows: [
          { _id: '000000000000000000000001', path: 'objectOne.optionalRelations' },
          { _id: '000000000000000000000002', path: 'objectOne.optionalRelations' },
          { _id: '000000000000000000000001', path: 'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation' },
        ],
      });

      await client.checkRelations('test', new Map<string, {
        resource: 'test' | 'otherTest';
        filters: SearchFilters & { _id: Id[]; };
      }>([
        ['objectOne.optionalRelations', {
          resource: 'otherTest',
          filters: { _id: [resourceId, new Id('000000000000000000000002')] },
        }],
        ['objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation', {
          resource: 'test',
          filters: { _id: [resourceId], indexedString: 'test' },
        }],
      ]), { poolOrSession: 'default' });

      expect(poolClient.query.mock.calls).toEqual([
        [`SELECT
  DISTINCT "otherTest"."_id",
  $1 as path
FROM
  "otherTest" AS "otherTest"
WHERE
  "otherTest"."_id" = ANY($2)
UNION ALL
SELECT
  DISTINCT "test"."_id",
  $3 as path
FROM
  "test" AS "test"
WHERE
  "test"."_isDeleted" = FALSE
  AND "test"."_id" = ANY($4)
  AND "test"."indexedString" = $5;`, [
          'objectOne.optionalRelations',
          ['000000000000000000000001', '000000000000000000000002'],
          'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation',
          ['000000000000000000000001'],
          'test',
        ]],
      ]);
    });

    test('throws when a relation references a resource that does not exist', async ({ client }) => {
      poolClient.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ _id: '000000000000000000000001', path: 'objectOne.optionalRelations' }],
      });

      await expect(client.checkRelations('test', new Map([
        ['objectOne.optionalRelations', {
          resource: 'otherTest',
          filters: { _id: [resourceId, relationId] },
        }],
      ]))).rejects.toMatchObject({ code: 'NO_RESOURCE', details: { id: '000000000000000000000009' } });
    });
  });

  describe('[compileQueries]', () => {
    // Inserts are batched upstream, this guards custom queries from modules.
    test('throws when a query exceeds the maximum number of parameters', ({ client }) => {
      expect(() => client.compileQueries({
        test: {
          type: 'INSERT',
          table: 'test',
          fields: ['value'],
          values: Array.from({ length: 65536 }, () => ['test']),
        },
      })).toThrow(expect.objectContaining({
        code: 'TOO_MANY_QUERY_PARAMETERS',
        details: { query: 'test', parameters: 65536 },
      }) as Error);
    });
  });

  describe('[shutdown]', () => {
    test('ends all the pools it is connected to', async ({ client }) => {
      await client.delete('otherTest', resourceId);
      await client.shutdown();
      await client.delete('otherTest', resourceId);

      expect(pool.end).toHaveBeenCalledOnce();
      // Pools are re-created on next query.
      expect(Pool).toHaveBeenCalledTimes(2);
    });
  });
});
