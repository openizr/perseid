/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/core/services/Model';
import Engine from 'scripts/core/services/Engine';
import Logger from 'scripts/core/services/Logger';
import EngineError from 'scripts/core/errors/Engine';
import { type ResourceSchema, Id } from '@perseid/core';
import CacheClient from 'scripts/core/services/CacheClient';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';
import MongoDatabaseClient from 'scripts/mongodb/services/MongoDatabaseClient';

type Fn = (fn: unknown) => void;

type TestEngine = Engine<DataModel> & {
  rbac: Engine<DataModel>['rbac'];
  parseFields: Engine<DataModel>['parseFields'];
  getResourceFields: Engine<DataModel>['getResourceFields'];
  withAutomaticFields: Engine<DataModel>['withAutomaticFields'];
  checkAndUpdatePayload: Engine<DataModel>['checkAndUpdatePayload'];
  getRelationFilters: Engine<DataModel>['getRelationFilters'];
};

describe('core/services/Engine', () => {
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/mongodb/services/MongoDatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));
  const mockedRbac = vi.fn(() => Promise.resolve());
  const mockedView = vi.fn(() => Promise.resolve({}));
  const mockedParseFields = vi.fn(() => ({ fields: new Set(['_id']), permissions: new Set([]) }));
  const mockedCheckAndUpdatePayload = vi.fn((_, __, payload) => Promise.resolve({
    ...payload,
    updated: true,
  }));

  let engine: TestEngine;
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const context = {
    user: {
      _id: new Id('000000000000000000000001'),
      _permissions: new Set([
        'UPDATE_USERS',
        'VIEW_SNAKE_CASED_test',
        'VIEW_SNAKE_CASED_otherTest',
      ]),
    },
  } as CommandContext<DataModel>;
  const cacheClient = new CacheClient({ cachePath: '/.cache', connectTimeout: 0 });
  const model = new Model<DataModel>({} as Record<keyof DataModel, ResourceSchema<DataModel>>);
  const databaseClient = new MongoDatabaseClient<DataModel>(model, logger, cacheClient, {
    connectionLimit: 0,
    connectTimeout: 0,
    database: '',
    host: '',
    password: '',
    port: 0,
    protocol: '',
    user: '',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NO_RESULT;
    engine = new Engine<DataModel>(model, logger, databaseClient) as TestEngine;
  });

  test('[getRelationFilters]', () => {
    expect(engine.getRelationFilters('test', {} as DataModel['test'], '', [], {}, context)).toEqual({
      _id: [],
    });
  });

  describe('[rbac]', () => {
    test('USER_NOT_VERIFIED error', async () => {
      const fullContext = { ...context, user: { ...context.user, _verifiedAt: null } };
      await expect(async () => (
        engine.rbac(new Set(['VIEW_TEST']), null, null, fullContext)
      )).rejects.toThrow(new EngineError('USER_NOT_VERIFIED'));
    });

    test('FORBIDDEN error', async () => {
      await expect(async () => (
        engine.rbac(new Set(['_PRIVATE']), null, null, context)
      )).rejects.toThrow(new EngineError('FORBIDDEN', { permission: null }));
      await expect(async () => (
        engine.rbac(new Set(['VIEW_TEST']), null, null, context)
      )).rejects.toThrow(new EngineError('FORBIDDEN', { permission: 'VIEW_TEST' }));
      await expect(async () => (
        engine.rbac(new Set(['UPDATE_USERS']), null, { roles: [] }, context)
      )).rejects.toThrow(new EngineError('FORBIDDEN', { permission: 'UPDATE_USERS_ROLES' }));
    });

    test('no error', async () => {
      await expect(engine.rbac(new Set(['UPDATE_USERS']), {
        _id: new Id('000000000000000000000001'),
      } as DataModel['users'], {}, context)).resolves.toBeUndefined();
    });
  });

  describe('[parseFields]', () => {
    test('UNKNOWN_FIELD error', () => {
      expect(() => (
        engine.parseFields('test', new Set(['_id', 'indexedString', 'invalid']))
      )).toThrow(new EngineError('UNKNOWN_FIELD', { path: 'invalid' }));
      expect(() => (
        engine.parseFields('test', new Set(['objectOne.objectTwo.optionalNestedArray.data.flatArray.*']))
      )).toThrow(new EngineError('UNKNOWN_FIELD', { path: 'objectOne.objectTwo.optionalNestedArray.data.flatArray.*' }));
    });

    test('MAXIMUM_DEPTH_EXCEEDED error', () => {
      expect(() => (
        engine.parseFields('test', new Set([
          'indexedString',
          'objectOne.optionalRelations.optionalRelation',
        ]), 1)
      )).toThrow(new EngineError('MAXIMUM_DEPTH_EXCEEDED', { path: 'invalid' }));
    });

    test('root *', () => {
      expect(engine.parseFields('test', new Set(['*']))).toEqual({
        permissions: new Set(),
        fields: new Set([
          '_id',
          '_isDeleted',
          'indexedString',
          'objectOne.boolean',
          'objectOne.optionalRelations',
          'objectOne.objectTwo.optionalIndexedString',
          'objectOne.objectTwo.optionalNestedArray.data.optionalInteger',
          'objectOne.objectTwo.optionalNestedArray.data.flatArray',
          'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation',
          'objectOne.objectTwo.optionalNestedArray.data.nestedArray.key',
        ]),
      });
    });

    test('root primitive and array of primitives', () => {
      expect(engine.parseFields('test', new Set([
        'indexedString',
        'objectOne.objectTwo.optionalNestedArray.data.flatArray',
      ]))).toEqual({
        permissions: new Set(),
        fields: new Set([
          '_id',
          'indexedString',
          'objectOne.objectTwo.optionalNestedArray.data.flatArray',
        ]),
      });
    });

    test('array of objects with *', () => {
      expect(engine.parseFields('test', new Set([
        'objectOne.objectTwo.optionalNestedArray.data.*',
      ]))).toEqual({
        permissions: new Set(),
        fields: new Set([
          '_id',
          'objectOne.objectTwo.optionalNestedArray.data.optionalInteger',
          'objectOne.objectTwo.optionalNestedArray.data.flatArray',
          'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation',
          'objectOne.objectTwo.optionalNestedArray.data.nestedArray.key',
        ]),
      });
    });

    test('array of objects without *', () => {
      expect(engine.parseFields('test', new Set([
        'objectOne.objectTwo.optionalNestedArray.data',
      ]))).toEqual({
        permissions: new Set(),
        fields: new Set([
          '_id',
          'objectOne.objectTwo.optionalNestedArray.data.optionalInteger',
          'objectOne.objectTwo.optionalNestedArray.data.flatArray',
          'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation',
          'objectOne.objectTwo.optionalNestedArray.data.nestedArray.key',
        ]),
      });
    });

    test('array of external relations with *', () => {
      expect(engine.parseFields('test', new Set([
        'objectOne.optionalRelations.*',
      ]))).toEqual({
        permissions: new Set(['VIEW_SNAKE_CASED_otherTest']),
        fields: new Set([
          '_id',
          'objectOne.optionalRelations._id',
          'objectOne.optionalRelations._createdAt',
          'objectOne.optionalRelations.binary',
          'objectOne.optionalRelations.optionalRelation',
          'objectOne.optionalRelations.data.optionalRelation',
          'objectOne.optionalRelations.data.optionalFlatArray',
        ]),
      });
    });

    test('array of external relations without *', () => {
      expect(engine.parseFields('test', new Set([
        'objectOne.optionalRelations',
      ]))).toEqual({
        permissions: new Set(),
        fields: new Set([
          'objectOne.optionalRelations',
          '_id',
        ]),
      });
    });

    test('external relation with *', () => {
      expect(engine.parseFields('otherTest', new Set([
        'optionalRelation.*',
      ]))).toEqual({
        permissions: new Set(['VIEW_SNAKE_CASED_test']),
        fields: new Set([
          '_id',
          'optionalRelation._id',
          'optionalRelation._isDeleted',
          'optionalRelation.indexedString',
          'optionalRelation.objectOne.boolean',
          'optionalRelation.objectOne.optionalRelations',
          'optionalRelation.objectOne.objectTwo.optionalIndexedString',
          'optionalRelation.objectOne.objectTwo.optionalNestedArray.data.optionalInteger',
          'optionalRelation.objectOne.objectTwo.optionalNestedArray.data.flatArray',
          'optionalRelation.objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation',
          'optionalRelation.objectOne.objectTwo.optionalNestedArray.data.nestedArray.key',
        ]),
      });
    });

    test('external relation without *', () => {
      expect(engine.parseFields('otherTest', new Set([
        'optionalRelation',
      ]))).toEqual({
        permissions: new Set(),
        fields: new Set([
          'optionalRelation',
          '_id',
        ]),
      });
    });

    test('users resource with specific permissions', () => {
      expect(engine.parseFields('users', new Set([
        'roles',
        'password',
        '_verifiedAt',
      ]))).toEqual({
        permissions: new Set([
          'VIEW_USERS_ROLES',
          '_PRIVATE',
          'VIEW_USERS_AUTH_DETAILS',
        ]),
        fields: new Set([
          'roles',
          'password',
          '_verifiedAt',
          '_id',
        ]),
      });
    });
  });

  describe('[withAutomaticFields]', () => {
    test('create mode', async () => {
      const newContext = { user: {} } as CommandContext<DataModel>;
      expect(await engine.withAutomaticFields('test', null, {}, newContext)).toEqual({
        _id: new Id('000000000000000000000001'),
        _version: 1,
        _updatedAt: null,
        _updatedBy: null,
        _createdBy: null,
        _isDeleted: false,
        _createdAt: new Date('2023-01-01T00:00:00.000Z'),
      });
    });

    test('update mode', async () => {
      const existingResource = {} as DataModel['test'];
      const newContext = {} as CommandContext<DataModel>;
      expect(await engine.withAutomaticFields('test', existingResource, {}, newContext)).toEqual({
        _updatedBy: null,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
    });
  });

  describe('[checkAndUpdatePayload]', () => {
    test('no error', async () => {
      vi.spyOn(engine, 'withAutomaticFields').mockImplementation((_, __, payload) => (
        Promise.resolve(payload)
      ));
      expect(await engine.checkAndUpdatePayload('test', null, {
        indexedString: 'test',
        objectOne: {
          boolean: true,
          optionalRelations: [new Id('000000000000000000000004'), new Id('000000000000000000000005')],
          objectTwo: {
            optionalIndexedString: 'test',
            optionalNestedArray: [{ data: { flatArray: [], optionalInteger: 1 } }],
          },
        },
      }, context)).toEqual({
        indexedString: 'test',
        objectOne: {
          boolean: true,
          optionalRelations: [new Id('000000000000000000000004'), new Id('000000000000000000000005')],
          objectTwo: {
            optionalIndexedString: 'test',
            optionalNestedArray: [{ data: { flatArray: [], optionalInteger: 1 } }],
          },
        },
      });
      expect(databaseClient.checkForeignIds).toHaveBeenCalledOnce();
      expect(databaseClient.checkForeignIds).toHaveBeenCalledWith('test', new Map([[
        'objectOne.optionalRelations',
        {
          resource: 'otherTest',
          filters: {
            _id: [new Id('000000000000000000000004'), new Id('000000000000000000000005')],
          },
        },
      ]]));
    });
  });

  test('[reset]', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    const promise = engine.reset();
    vi.runAllTimers();
    await promise;
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      '[Engine][reset] 🕐 Resetting system in 5 seconds, it\'s still time to abort...',
    );
    expect(databaseClient.reset).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  describe('[generateContext]', () => {
    test('NO_RESOURCE error', async () => {
      process.env.NO_RESULT = 'true';
      const userId = new Id('000000000000000000000001');
      await expect(async () => {
        await engine.generateContext(new Id());
      }).rejects.toEqual(new EngineError('NO_RESOURCE', { id: userId }));
    });

    test('no error', async () => {
      const userId = new Id('000000000000000000000001');
      const fullContext = await engine.generateContext(userId, 'valid', 'UNKNOWN');
      expect(fullContext).toEqual({
        deviceId: 'valid',
        userAgent: 'UNKNOWN',
        user: {
          _id: userId,
          roles: [{
            name: 'TEST',
            permissions: ['TEST'],
          }],
          _permissions: new Set(['TEST']),
        },
      });
    });
  });

  test('[create]', async () => {
    const permissions = new Set(['CREATE_SNAKE_CASED_test']);
    vi.spyOn(engine, 'rbac').mockImplementation(mockedRbac);
    (vi.spyOn(engine, 'view').mockImplementation as Fn)(mockedView);
    vi.spyOn(engine, 'parseFields').mockImplementation(mockedParseFields);
    vi.spyOn(engine, 'withAutomaticFields').mockImplementation(mockedCheckAndUpdatePayload);
    vi.spyOn(engine, 'checkAndUpdatePayload').mockImplementation(mockedCheckAndUpdatePayload);
    const updatedPayload = { indexedString: 'test', updated: true };
    const payload = { indexedString: 'test' } as CreatePayload<DataModel['test']>;
    await engine.create('test', payload, {}, context);
    expect(engine.rbac).toHaveBeenCalledOnce();
    expect(engine.rbac).toHaveBeenCalledWith(permissions, null, payload, context);
    expect(engine.parseFields).toHaveBeenCalledOnce();
    expect(engine.parseFields).toHaveBeenCalledWith('test', new Set(), undefined);
    expect(engine.checkAndUpdatePayload).toHaveBeenCalledOnce();
    expect(engine.checkAndUpdatePayload).toHaveBeenCalledWith('test', null, payload, context);
    expect(engine.withAutomaticFields).toHaveBeenCalledOnce();
    expect(engine.withAutomaticFields).toHaveBeenCalledWith('test', null, updatedPayload, context);
    expect(databaseClient.create).toHaveBeenCalledOnce();
    expect(databaseClient.create).toHaveBeenCalledWith('test', updatedPayload);
    expect(engine.view).toHaveBeenCalledOnce();
    expect(engine.view).toHaveBeenCalledWith('test', undefined, { fields: new Set(['_id']) }, context);
  });

  describe('[update]', () => {
    test('NO_RESOURCE error', async () => {
      process.env.NO_RESULT = 'true';
      const id = new Id('000000000000000000000002');
      vi.spyOn(engine, 'getResourceFields').mockImplementation(vi.fn(() => new Set(['indexedString'])));
      await expect(async () => (
        engine.update('test', id, { indexedString: 'test' }, {}, context)
      )).rejects.toThrow(new EngineError('NO_RESOURCE', { id }));
    });

    test('no error', async () => {
      const id = new Id('000000000000000000000002');
      const permissions = new Set(['UPDATE_SNAKE_CASED_test']);
      vi.spyOn(engine, 'rbac').mockImplementation(mockedRbac);
      (vi.spyOn(engine, 'view').mockImplementation as Fn)(mockedView);
      vi.spyOn(engine, 'parseFields').mockImplementation(mockedParseFields);
      vi.spyOn(engine, 'withAutomaticFields').mockImplementation(mockedCheckAndUpdatePayload);
      vi.spyOn(engine, 'checkAndUpdatePayload').mockImplementation(mockedCheckAndUpdatePayload);
      const currentResource = { _id: id };
      const updatedPayload = { indexedString: 'test', updated: true };
      const payload = { indexedString: 'test' } as UpdatePayload<DataModel['test']>;
      await engine.update('test', id, payload, {}, context);
      expect(engine.rbac).toHaveBeenCalledOnce();
      expect(engine.rbac).toHaveBeenCalledWith(permissions, currentResource, payload, context);
      expect(engine.parseFields).toHaveBeenCalledOnce();
      expect(engine.parseFields).toHaveBeenCalledWith('test', new Set(), undefined);
      expect(engine.checkAndUpdatePayload).toHaveBeenCalledOnce();
      expect(engine.checkAndUpdatePayload).toHaveBeenCalledWith('test', currentResource, payload, context);
      expect(engine.withAutomaticFields).toHaveBeenCalledOnce();
      expect(engine.withAutomaticFields).toHaveBeenCalledWith('test', currentResource, updatedPayload, context);
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('test', id, updatedPayload);
      expect(engine.view).toHaveBeenCalledOnce();
      expect(engine.view).toHaveBeenCalledWith('test', id, { fields: new Set(['_id']) }, context);
    });
  });

  describe('[view]', () => {
    test('NO_RESOURCE error', async () => {
      process.env.NO_RESULT = 'true';
      const id = new Id('000000000000000000000002');
      vi.spyOn(engine, 'rbac').mockImplementation(() => Promise.resolve());
      await expect(async () => {
        await engine.view('test', id, {}, context);
      }).rejects.toThrow(new EngineError('NO_RESOURCE'));
    });

    test('no error', async () => {
      const id = new Id('000000000000000000000002');
      vi.spyOn(engine, 'rbac').mockImplementation(() => Promise.resolve());
      vi.spyOn(engine, 'parseFields').mockImplementation(() => ({ fields: new Set(['_id']), permissions: new Set() }));
      await engine.view('test', id, {}, context);
      expect(databaseClient.view).toHaveBeenCalledOnce();
      expect(databaseClient.view).toHaveBeenCalledWith('test', id, { fields: new Set(['_id']) });
    });
  });

  test('[list]', async () => {
    vi.spyOn(engine, 'rbac').mockImplementation(() => Promise.resolve());
    vi.spyOn(engine, 'parseFields').mockImplementation(() => ({ fields: new Set(['_id']), permissions: new Set() }));
    await engine.list('test', {}, context);
    expect(databaseClient.list).toHaveBeenCalledOnce();
    expect(databaseClient.list).toHaveBeenCalledWith('test', { fields: new Set(['_id']) });
  });

  test('[search]', async () => {
    const searchBody = { query: { on: new Set(['indexedString']), text: 'test' }, filters: null };
    vi.spyOn(engine, 'rbac').mockImplementation(() => Promise.resolve());
    vi.spyOn(engine, 'parseFields').mockImplementation(() => ({ fields: new Set(['_id']), permissions: new Set() }));
    await engine.search('test', searchBody, {}, context);
    expect(databaseClient.search).toHaveBeenCalledOnce();
    expect(databaseClient.search).toHaveBeenCalledWith('test', searchBody, {
      fields: new Set(['_id']),
    });
    // Covers other specific cases.
    await engine.search('test', { query: null, filters: null }, {}, context);
  });

  describe('[delete]', () => {
    test('NO_RESOURCE error', async () => {
      process.env.NO_RESULT = 'true';
      const id = new Id('000000000000000000000002');
      vi.spyOn(engine, 'rbac').mockImplementation(() => Promise.resolve());
      await expect(async () => {
        await engine.delete('test', id, context);
      }).rejects.toThrow(new EngineError('NO_RESOURCE'));
    });

    test('hard deletion', async () => {
      const id = new Id('000000000000000000000002');
      vi.spyOn(engine, 'rbac').mockImplementation(() => Promise.resolve());
      await engine.delete('otherTest', id, context);
      expect(databaseClient.delete).toHaveBeenCalledOnce();
      expect(databaseClient.delete).toHaveBeenCalledWith('otherTest', id);
    });

    test('soft deletion', async () => {
      const id = new Id('000000000000000000000002');
      vi.spyOn(engine, 'withAutomaticFields').mockImplementation(mockedCheckAndUpdatePayload);
      vi.spyOn(engine, 'checkAndUpdatePayload').mockImplementation(mockedCheckAndUpdatePayload);
      vi.spyOn(engine, 'rbac').mockImplementation(() => Promise.resolve());
      await engine.delete('test', id, context);
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('test', id, {
        _isDeleted: true,
        updated: true,
      });
    });
  });
});
