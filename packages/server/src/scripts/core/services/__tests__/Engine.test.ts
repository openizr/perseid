/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';
import Model from 'scripts/core/services/Model';
import Engine from 'scripts/core/services/Engine';
import EngineError from 'scripts/core/errors/Engine';
import Telemetry from 'scripts/core/services/Telemetry';
import CacheClient from 'scripts/core/services/CacheClient';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';
import type { CommandContext, CreatePayload, UpdatePayload } from 'scripts/core';
import PostgresqlDatabaseClient from 'scripts/postgresql/services/PostgreSQLDatabaseClient';

type TestEngine = Engine<DataModel> & {
  getRelationFilters: Engine<DataModel>['getRelationFilters'];
  prepareUpdatePayload: Engine<DataModel>['prepareUpdatePayload'];
  prepareCreatePayload: Engine<DataModel>['prepareCreatePayload'];
};

describe('core/services/Engine', () => {
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Telemetry');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/postgresql/services/PostgreSQLDatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  let engine: TestEngine;
  const telemetry = new Telemetry();
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
  const model = new Model<DataModel>(Model.USERS_MODEL);
  const cacheClient = new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 });
  const databaseClient = new PostgresqlDatabaseClient<DataModel>(model, telemetry, cacheClient, {
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
    engine = new Engine<DataModel>(model, telemetry, databaseClient) as TestEngine;
  });

  test('[getRelationFilters]', () => {
    expect(engine.getRelationFilters('test', '', [], {})).toEqual({
      _id: [],
    });
  });

  test('[prepareCreatePayload] correctly prepares the creation payload', async () => {
    const id1 = new Id();
    const id2 = new Id();
    const payload: CreatePayload<DataModel['test']> = {
      indexedString: 'test',
      objectOne: {
        boolean: true,
        optionalRelations: [id1, id2],
        objectTwo: {
          optionalIndexedString: 'test',
          optionalNestedArray: [{
            data: {
              flatArray: [],
              optionalInteger: 1,
              nestedArray: [],
            },
          }],
        },
      },
    };
    const updatedPayload = await engine.prepareCreatePayload('test', payload);
    expect(updatedPayload).toEqual({
      _id: expect.any(Id) as Id,
      _updatedAt: null,
      _isDeleted: false,
      _createdAt: new Date('2023-01-01T00:00:00.000Z'),
      ...payload,
    });
    expect(databaseClient.checkRelations).toHaveBeenCalledOnce();
    expect(databaseClient.checkRelations).toHaveBeenCalledWith('test', new Map(
      [['objectOne.optionalRelations', {
        resource: 'otherTest',
        filters: {
          _id: [id1, id2],
        },
      }]],
    ));
  });

  test('[prepareUpdatePayload] correctly prepares the update payload', async () => {
    const id1 = new Id();
    const id2 = new Id();
    const payload: UpdatePayload<DataModel['test']> = {
      indexedString: 'test',
      objectOne: {
        optionalRelations: [id1, id2],
        objectTwo: {
          optionalNestedArray: [{
            data: {
              flatArray: [],
              optionalInteger: 1,
              nestedArray: [],
            },
          }],
        },
      },
    };
    const updatedPayload = await engine.prepareUpdatePayload('test', payload);
    expect(updatedPayload).toEqual({
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      ...payload,
    });
    expect(databaseClient.checkRelations).toHaveBeenCalledOnce();
    expect(databaseClient.checkRelations).toHaveBeenCalledWith('test', new Map(
      [['objectOne.optionalRelations', {
        resource: 'otherTest',
        filters: {
          _id: [id1, id2],
        },
      }]],
    ));
  });

  describe('[create]', () => {
    test('throws an error if the operation is not allowed', async () => {
      await expect(
        engine.create('notImplemented', {}, {}, context),
      ).rejects.toThrow(new EngineError('OPERATION_NOT_ALLOWED', { operation: 'CREATE' }));
    });

    test('creates the specified resource', async () => {
      const resourceId = new Id();
      const payload = {
        indexedString: 'test',
        objectOne: {
          boolean: true,
          optionalRelations: [new Id('000000000000000000000004'), new Id('000000000000000000000005')],
          objectTwo: {
            optionalIndexedString: 'test',
            optionalNestedArray: [{ data: { flatArray: [], optionalInteger: 1, nestedArray: [] } }],
          },
        },
      };
      vi.spyOn(databaseClient, 'create');
      vi.spyOn(engine, 'view').mockResolvedValue({ _id: resourceId });
      vi.spyOn(engine, 'prepareCreatePayload').mockResolvedValue({ _id: resourceId });
      const result = await engine.create('test', payload, {}, context);
      expect(result).toEqual({ _id: resourceId });
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('test', { _id: resourceId });
      expect(engine.view).toHaveBeenCalledOnce();
      expect(engine.view).toHaveBeenCalledWith('test', resourceId, {});
      expect(engine.prepareCreatePayload).toHaveBeenCalledOnce();
      expect(engine.prepareCreatePayload).toHaveBeenCalledWith('test', payload);
    });
  });

  describe('[update]', () => {
    test('throws an error if the operation is not allowed', async () => {
      const resourceId = new Id();
      await expect(
        engine.update('notImplemented', resourceId, { _id: resourceId }, {}, context),
      ).rejects.toThrow(new EngineError('OPERATION_NOT_ALLOWED', { operation: 'UPDATE' }));
    });

    test('throws an error if the resource does not exist', async () => {
      const resourceId = new Id();
      vi.spyOn(databaseClient, 'update').mockResolvedValue(false);
      vi.spyOn(engine, 'prepareUpdatePayload').mockResolvedValue({});
      await expect(
        engine.update('test', resourceId, { indexedString: 'test' }, {}, context),
      ).rejects.toThrow(new EngineError('NO_RESOURCE', { id: resourceId }));
    });

    test('updates the specified resource', async () => {
      const resourceId = new Id();
      vi.spyOn(databaseClient, 'update').mockResolvedValue(true);
      vi.spyOn(engine, 'view').mockResolvedValue({ _id: resourceId });
      vi.spyOn(engine, 'prepareUpdatePayload').mockResolvedValue({ indexedString: 'test' });
      const result = await engine.update('test', resourceId, { indexedString: 'test' }, {}, context);
      expect(result).toEqual({ _id: resourceId });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('test', resourceId, { indexedString: 'test' });
      expect(engine.view).toHaveBeenCalledOnce();
      expect(engine.view).toHaveBeenCalledWith('test', resourceId, {});
      expect(engine.prepareUpdatePayload).toHaveBeenCalledOnce();
      expect(engine.prepareUpdatePayload).toHaveBeenCalledWith('test', { indexedString: 'test' });
    });
  });

  describe('[view]', () => {
    test('throws an error if the operation is not allowed', async () => {
      const resourceId = new Id();
      await expect(
        engine.view('notImplemented', resourceId, {}, context),
      ).rejects.toThrow(new EngineError('OPERATION_NOT_ALLOWED', { operation: 'VIEW' }));
    });

    test('throws an error if the resource does not exist', async () => {
      const resourceId = new Id();
      vi.spyOn(databaseClient, 'view').mockResolvedValue(null);
      await expect(
        engine.view('test', resourceId, {}, context),
      ).rejects.toThrow(new EngineError('NO_RESOURCE', { id: resourceId }));
    });

    test('fetches the requested resource', async () => {
      const resourceId = new Id();
      vi.spyOn(databaseClient, 'view').mockResolvedValue({ _id: resourceId });
      const result = await engine.view('test', resourceId, {}, context);
      expect(result).toEqual({ _id: resourceId });
      expect(databaseClient.view).toHaveBeenCalledOnce();
      expect(databaseClient.view).toHaveBeenCalledWith('test', resourceId, {});
    });
  });

  describe('[list]', () => {
    test('throws an error if the operation is not allowed', async () => {
      await expect(
        engine.list('notImplemented', { query: null, filters: null }, {}, context),
      ).rejects.toThrow(new EngineError('OPERATION_NOT_ALLOWED', { operation: 'LIST' }));
    });

    test('correctly returns a list of resources', async () => {
      const searchBody = { query: { on: new Set(['indexedString']), text: 'test' }, filters: null };
      await engine.list('test', searchBody, { limit: 10, offset: 2 }, context);
      expect(databaseClient.list).toHaveBeenCalledOnce();
      expect(databaseClient.list).toHaveBeenCalledWith('test', searchBody, { offset: 2, limit: 10 });
    });
  });

  describe('[delete]', () => {
    test('throws an error if the operation is not allowed', async () => {
      await expect(
        engine.delete('notImplemented', new Id(), {}, context),
      ).rejects.toThrow(new EngineError('OPERATION_NOT_ALLOWED', { operation: 'DELETE' }));
    });

    test('throws an error if the resource does not exist', async () => {
      const resourceId = new Id();
      vi.spyOn(databaseClient, 'delete').mockResolvedValue(false);
      vi.spyOn(engine, 'prepareUpdatePayload').mockResolvedValue({});
      await expect(
        engine.delete('otherTest', resourceId, {}, context),
      ).rejects.toThrow(new EngineError('NO_RESOURCE', { id: resourceId }));
    });

    test('deletes the specified resource', async () => {
      const resourceId = new Id();
      vi.spyOn(databaseClient, 'delete').mockResolvedValue(true);
      await engine.delete('otherTest', resourceId, {}, context);
      expect(databaseClient.delete).toHaveBeenCalledOnce();
      expect(databaseClient.delete).toHaveBeenCalledWith('otherTest', resourceId);
    });

    test('soft deletes the specified resource', async () => {
      const resourceId = new Id();
      vi.spyOn(databaseClient, 'update').mockResolvedValue(true);
      vi.spyOn(engine, 'prepareUpdatePayload').mockResolvedValue({
        _isDeleted: true,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      await engine.delete('test', resourceId, {}, context);
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('test', resourceId, {
        _isDeleted: true,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      expect(engine.prepareUpdatePayload).toHaveBeenCalledOnce();
      expect(engine.prepareUpdatePayload).toHaveBeenCalledWith('test', {});
    });
  });
});
