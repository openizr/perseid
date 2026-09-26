/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';
import type { CreatePayload } from 'scripts/core';
import Model from 'scripts/core/services/Model';
import Engine from 'scripts/core/services/Engine';
import EngineError from 'scripts/core/errors/Engine';
import Telemetry from 'scripts/core/services/Telemetry';
import schema, { type DataModel } from 'scripts/core/services/__mocks__/schema';
import type AbstractDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';
import DatabaseClient from 'scripts/core/services/__mocks__/AbstractDatabaseClient';

vi.mock('scripts/core/services/Model');
vi.mock('scripts/core/services/Telemetry');

// `registerModule` is the extension point subclasses use to override generic methods.
type TestEngine = Engine<DataModel> & {
  registerModule: Engine<DataModel>['registerModule'];
};

describe('core/services/Engine', () => {
  vi.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));

  const userId = new Id('00000000-0000-7000-8000-000000000001');
  const resourceId = new Id('00000000-0000-7000-8000-000000000002');
  const otherResourceId = new Id('00000000-0000-7000-8000-000000000003');
  const relationId1 = new Id('00000000-0000-7000-8000-000000000004');
  const relationId2 = new Id('00000000-0000-7000-8000-000000000005');
  const relationId3 = new Id('00000000-0000-7000-8000-000000000006');

  const testPayload: CreatePayload<DataModel['test']> = {
    indexedString: 'test',
    objectOne: {
      boolean: true,
      optionalRelations: [relationId1, relationId2],
      objectTwo: {
        optionalIndexedString: null,
        optionalNestedArray: [{
          data: {
            optionalInteger: null,
            flatArray: ['test'],
            nestedArray: [
              { optionalRelation: relationId3, key: 'first' },
              { optionalRelation: null, key: 'second' },
            ],
          },
        }],
      },
    },
  };

  const otherTestPayload: CreatePayload<DataModel['otherTest']> = {
    enum: 'ONE',
    binary: new ArrayBuffer(0),
    optionalRelation: null,
    data: { optionalRelation: null, optionalFlatArray: null },
  };

  const test = it.extend<{
    telemetry: Telemetry;
    databaseClient: DatabaseClient;
    engine: TestEngine;
  }>({
    telemetry: async ({ onTestFinished }, use) => {
      onTestFinished(() => { vi.restoreAllMocks(); });
      await use(new Telemetry());
    },
    databaseClient: async ({ telemetry }, use) => {
      await use(new DatabaseClient(new Model<DataModel>(schema), telemetry, null));
    },
    engine: async ({ telemetry, databaseClient }, use) => {
      const model = new Model<DataModel>(schema);
      const client = databaseClient as unknown as AbstractDatabaseClient<DataModel>;
      await use(new Engine<DataModel>(model, telemetry, client) as TestEngine);
    },
  });

  describe('[create]', () => {
    test('creates a resource with its automatic fields', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'view').mockImplementation((resource, id, options) => Promise.resolve((
        resource === 'test'
        && options?.fields?.includes('indexedString') === true
        && !options.fields.includes('_isDeleted')
      ) ? { _id: id, indexedString: 'test' } : null));
      const result = await engine.create('test', testPayload, {
        queryOptions: { fields: ['*'] },
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.CREATE', 'TEST.VIEW']),
          },
        },
      });
      expect(result).toEqual({ _id: expect.any(Id) as Id, indexedString: 'test' });
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('test', {
        ...testPayload,
        _id: (result as { _id: Id; })._id,
        _isDeleted: false,
        _updatedAt: null,
        _updatedBy: null,
        _createdBy: userId,
        _createdAt: new Date('2023-01-01T00:00:00.000Z'),
      }, {
        fields: ['_id', 'indexedString', 'objectOne.boolean', 'objectOne.objectTwo'],
        poolOrSession: 'SESSION',
      });
    });

    test('creates a resource without author when there is no session', async ({ engine, databaseClient }) => {
      const result = await engine.create('test', testPayload, {});
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('test', {
        ...testPayload,
        _id: (result as { _id: Id; })._id,
        _isDeleted: false,
        _updatedAt: null,
        _createdAt: new Date('2023-01-01T00:00:00.000Z'),
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });

    test('creates a resource without timestamps nor deletion flag', async ({ engine, databaseClient }) => {
      const result = await engine.create('otherTest', otherTestPayload, {});
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('otherTest', {
        ...otherTestPayload,
        _id: (result as { _id: Id; })._id,
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });

    test('rejects a payload referencing a resource that does not exist', async ({ engine, databaseClient }) => {
      const error = new EngineError('NO_RESOURCE', { id: relationId2 });
      vi.spyOn(databaseClient, 'checkRelations').mockImplementation((resource, relations) => (
        (resource === 'test' && relations.get('objectOne.optionalRelations')?.filters?._id.includes(relationId2))
          ? Promise.reject(error)
          : Promise.resolve()
      ));
      await expect(engine.create('test', testPayload, {})).rejects.toBe(error);
      expect(databaseClient.create).not.toHaveBeenCalled();
    });

    test('rejects a payload referencing a nested resource that does not exist', async ({ engine, databaseClient }) => {
      const error = new EngineError('NO_RESOURCE', { id: relationId3 });
      const path = 'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation';
      vi.spyOn(databaseClient, 'checkRelations').mockImplementation((resource, relations) => (
        (resource === 'test' && relations.get(path)?.filters?._id.includes(relationId3))
          ? Promise.reject(error)
          : Promise.resolve()
      ));
      await expect(engine.create('test', testPayload, {})).rejects.toBe(error);
      expect(databaseClient.create).not.toHaveBeenCalled();
    });

    test('rejects a resource that cannot be viewed', async ({ engine, databaseClient }) => {
      await expect(engine.create('notImplemented', {}, {})).rejects.toMatchObject({
        code: 'OPERATION_NOT_ALLOWED',
        details: { operation: 'VIEW' },
      });
      expect(databaseClient.create).not.toHaveBeenCalled();
    });

    test('lets a registered module override creation', async ({ engine, databaseClient }) => {
      engine.registerModule('test', {
        create: (payload, context, baseCreate) => baseCreate({ ...payload, indexedString: 'overridden' }, context),
      });
      const result = await engine.create('test', testPayload, {});
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('test', {
        ...testPayload,
        indexedString: 'overridden',
        _id: (result as { _id: Id; })._id,
        _isDeleted: false,
        _updatedAt: null,
        _createdAt: new Date('2023-01-01T00:00:00.000Z'),
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });
  });

  describe('[update]', () => {
    test('updates a resource with its automatic fields', async ({ engine, databaseClient }) => {
      const result = await engine.update('test', resourceId, { indexedString: 'updated' }, {
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.UPDATE', 'TEST.VIEW']),
          },
        },
      });
      expect(result).toEqual({ _id: resourceId });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('test', resourceId, {
        _updatedBy: userId,
        indexedString: 'updated',
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });

    test('updates a resource without author when there is no session', async ({ engine, databaseClient }) => {
      await engine.update('test', resourceId, { indexedString: 'updated' }, {});
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('test', resourceId, {
        indexedString: 'updated',
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });

    test('updates a resource without timestamps', async ({ engine, databaseClient }) => {
      await engine.update('otherTest', resourceId, { enum: 'TWO' }, {});
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('otherTest', resourceId, {
        enum: 'TWO',
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });

    test('returns the resource untouched when the payload is empty', async ({ engine, databaseClient }) => {
      expect(await engine.update('test', resourceId, {}, {})).toEqual({ _id: resourceId });
      expect(databaseClient.update).not.toHaveBeenCalled();
    });

    test('rejects a payload referencing a resource that does not exist', async ({ engine, databaseClient }) => {
      const error = new EngineError('NO_RESOURCE', { id: relationId1 });
      vi.spyOn(databaseClient, 'checkRelations').mockImplementation((resource, relations) => (
        (resource === 'test' && relations.get('objectOne.optionalRelations')?.filters?._id.includes(relationId1))
          ? Promise.reject(error)
          : Promise.resolve()
      ));
      await expect(engine.update('test', resourceId, testPayload, {})).rejects.toBe(error);
      expect(databaseClient.update).not.toHaveBeenCalled();
    });

    test('rejects a resource that does not exist', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'update').mockResolvedValueOnce(false);
      await expect(engine.update('test', resourceId, { indexedString: 'updated' }, {})).rejects.toMatchObject({
        code: 'NO_RESOURCE',
        details: { id: resourceId },
      });
    });

    test('rejects a resource that cannot be viewed', async ({ engine, databaseClient }) => {
      await expect(engine.update('notImplemented', resourceId, {}, {})).rejects.toMatchObject({
        code: 'OPERATION_NOT_ALLOWED',
        details: { operation: 'VIEW' },
      });
      expect(databaseClient.update).not.toHaveBeenCalled();
    });

    test('lets a registered module override update', async ({ engine, databaseClient }) => {
      engine.registerModule('test', {
        update: (_id, payload, context, baseUpdate) => (
          baseUpdate(otherResourceId, payload, context)
        ),
      });
      expect(await engine.update('test', resourceId, { indexedString: 'updated' }, {})).toEqual({
        _id: otherResourceId,
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('test', otherResourceId, {
        indexedString: 'updated',
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });
  });

  describe('[view]', () => {
    test('fetches a resource with the fields user is allowed to view', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'view').mockImplementation((resource, id, options) => Promise.resolve((
        resource === 'test'
        && String(id) === String(resourceId)
        && options?.fields?.includes('objectOne.optionalRelations._id') === true
        && !options.fields.includes('_isDeleted')
      ) ? { _id: id, indexedString: 'test' } : null));
      expect(await engine.view('test', resourceId, {
        queryOptions: { fields: ['*', 'objectOne.optionalRelations.*'] },
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.VIEW', 'OTHER_TEST.VIEW']),
          },
        },
      })).toEqual({ _id: resourceId, indexedString: 'test' });
    });

    test('rejects a field user is not allowed to view', async ({ engine }) => {
      await expect(engine.view('test', resourceId, {
        queryOptions: { fields: ['_isDeleted'] },
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.VIEW']),
          },
        },
      })).rejects.toMatchObject({ code: 'FORBIDDEN', details: { permission: 'TEST.IS_DELETED.VIEW' } });
    });

    test('rejects a field nobody is allowed to view', async ({ engine }) => {
      await expect(engine.view('users', resourceId, {
        queryOptions: { fields: ['password'] },
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['USERS.VIEW']),
          },
        },
      })).rejects.toMatchObject({ code: 'FORBIDDEN', details: { permission: null } });
    });

    test('rejects an unknown field', async ({ engine }) => {
      await expect(engine.view('test', resourceId, {
        queryOptions: { fields: ['objectOne.invalid'] },
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.VIEW']),
          },
        },
      })).rejects.toMatchObject({ code: 'UNKNOWN_QUERY_FIELD', details: { path: 'objectOne.invalid' } });
    });

    test('rejects a wildcard on a field that is not a relation', async ({ engine }) => {
      await expect(engine.view('test', resourceId, {
        queryOptions: { fields: ['_id.*'] },
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.VIEW']),
          },
        },
      })).rejects.toMatchObject({ code: 'UNKNOWN_QUERY_FIELD', details: { path: '_id.*' } });
    });

    test('rejects an unverified user', async ({ engine }) => {
      await expect(engine.view('test', resourceId, {
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: null,
            _permissions: new Set(['TEST.VIEW']),
          },
        },
      })).rejects.toMatchObject({ code: 'USER_NOT_VERIFIED' });
    });

    test('rejects a user missing the operation permission', async ({ engine }) => {
      await expect(engine.view('otherTest', resourceId, {
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.VIEW']),
          },
        },
      })).rejects.toMatchObject({ code: 'FORBIDDEN', details: { permission: 'OTHER_TEST.VIEW' } });
    });

    test('rejects a resource that does not exist', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'view').mockResolvedValueOnce(null);
      await expect(engine.view('test', resourceId, {})).rejects.toMatchObject({
        code: 'NO_RESOURCE',
        details: { id: resourceId },
      });
    });

    test('rejects a resource that cannot be viewed', async ({ engine }) => {
      await expect(engine.view('notImplemented', resourceId, {})).rejects.toMatchObject({
        code: 'OPERATION_NOT_ALLOWED',
        details: { operation: 'VIEW' },
      });
    });

    test('lets a registered module override view', async ({ engine }) => {
      engine.registerModule('test', {
        view: (_id, context, baseView) => baseView(otherResourceId, context),
      });
      expect(await engine.view('test', resourceId, {})).toEqual({ _id: otherResourceId });
    });
  });

  describe('[list]', () => {
    test('lists resources matching search body, with the fields user is allowed to view', async ({ engine, databaseClient }) => {
      const searchBody = {
        query: { text: 'test', on: ['enum'] },
        filters: { 'data.optionalFlatArray': 'test1' },
      };
      vi.spyOn(databaseClient, 'list').mockImplementation((resource, body, options) => Promise.resolve((
        resource === 'otherTest'
        && body === searchBody
        && options?.fields?.includes('enum') === true
      ) ? { total: 1, results: [{ _id: resourceId }] } : { total: 0, results: [] }));
      expect(await engine.list('otherTest', searchBody, {
        queryOptions: { fields: ['enum'], sortBy: { _createdAt: -1 } },
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['OTHER_TEST.LIST', 'OTHER_TEST.VIEW']),
          },
        },
      })).toEqual({ total: 1, results: [{ _id: resourceId }] });
    });

    test('lists all resources when there is no search criteria', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'list').mockImplementation((resource) => Promise.resolve((resource === 'test')
        ? { total: 1, results: [{ _id: resourceId }] }
        : { total: 0, results: [] }));
      expect(await engine.list('test', { query: null, filters: null }, {
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.LIST', 'TEST.VIEW']),
          },
        },
      })).toEqual({ total: 1, results: [{ _id: resourceId }] });
    });

    test('rejects a filter on a field user is not allowed to view', async ({ engine }) => {
      await expect(engine.list('test', { query: null, filters: { _isDeleted: true } }, {
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.LIST', 'TEST.VIEW']),
          },
        },
      })).rejects.toMatchObject({ code: 'FORBIDDEN', details: { permission: 'TEST.IS_DELETED.VIEW' } });
    });

    test('lists all resources when there is no search body', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'list').mockImplementation((resource) => Promise.resolve((resource === 'test')
        ? { total: 1, results: [{ _id: resourceId }] }
        : { total: 0, results: [] }));
      expect(await engine.list('test', null, {
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.LIST', 'TEST.VIEW']),
          },
        },
      })).toEqual({ total: 1, results: [{ _id: resourceId }] });
    });

    test('rejects a resource that cannot be listed', async ({ engine }) => {
      await expect(engine.list('notImplemented', null, {})).rejects.toMatchObject({
        code: 'OPERATION_NOT_ALLOWED',
        details: { operation: 'LIST' },
      });
    });

    test('lets a registered module override list', async ({ engine, databaseClient }) => {
      const searchBody = { query: null, filters: { indexedString: 'test' } };
      vi.spyOn(databaseClient, 'list').mockImplementation((resource, body) => Promise.resolve((
        resource === 'test' && body === searchBody
      ) ? { total: 1, results: [{ _id: resourceId }] } : { total: 0, results: [] }));
      engine.registerModule('test', {
        list: (_searchBody, context, baseList) => baseList(searchBody, context),
      });
      expect(await engine.list('test', null, {})).toEqual({ total: 1, results: [{ _id: resourceId }] });
    });
  });

  describe('[delete]', () => {
    test('flags a resource as deleted, with its automatic fields', async ({ engine, databaseClient }) => {
      await engine.delete('test', resourceId, {
        session: {
          user: {
            _id: userId,
            roles: [],
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['TEST.DELETE', 'TEST.VIEW']),
          },
        },
      });
      expect(databaseClient.delete).not.toHaveBeenCalled();
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('test', resourceId, {
        _isDeleted: true,
        _updatedBy: userId,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }, { fields: ['_id'] });
    });

    test('flags a resource as deleted without author when there is no session', async ({ engine, databaseClient }) => {
      await engine.delete('test', resourceId, {});
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('test', resourceId, {
        _isDeleted: true,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }, { fields: ['_id'] });
    });

    test('flags a resource without timestamps as deleted', async ({ engine, databaseClient }) => {
      await engine.delete('users', resourceId, {});
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', resourceId, {
        _isDeleted: true,
      }, { fields: ['_id'] });
    });

    test('deletes a resource for good when its schema allows it', async ({ engine, databaseClient }) => {
      await engine.delete('otherTest', resourceId, {});
      expect(databaseClient.update).not.toHaveBeenCalled();
      expect(databaseClient.delete).toHaveBeenCalledOnce();
      expect(databaseClient.delete).toHaveBeenCalledWith('otherTest', resourceId, { fields: ['_id'] });
    });

    test('rejects a resource that does not exist', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'delete').mockResolvedValueOnce(false);
      await expect(engine.delete('otherTest', resourceId, {})).rejects.toMatchObject({
        code: 'NO_RESOURCE',
        details: { id: resourceId },
      });
    });

    test('rejects a resource that cannot be deleted', async ({ engine, databaseClient }) => {
      await expect(engine.delete('notImplemented', resourceId, {})).rejects.toMatchObject({
        code: 'OPERATION_NOT_ALLOWED',
        details: { operation: 'DELETE' },
      });
      expect(databaseClient.update).not.toHaveBeenCalled();
      expect(databaseClient.delete).not.toHaveBeenCalled();
    });

    test('lets a registered module override deletion', async ({ engine, databaseClient }) => {
      engine.registerModule('otherTest', {
        delete: (_id, context, baseDelete) => baseDelete(otherResourceId, context),
      });
      await engine.delete('otherTest', resourceId, {});
      expect(databaseClient.delete).toHaveBeenCalledOnce();
      expect(databaseClient.delete).toHaveBeenCalledWith('otherTest', otherResourceId, { fields: ['_id'] });
    });
  });
});
