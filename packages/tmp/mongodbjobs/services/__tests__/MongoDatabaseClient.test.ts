/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';
import { ObjectId } from 'mongodb';
import { CacheClient, Logger } from '@perseid/server';
import MongoDatabaseClient from 'scripts/mongodb/services/MongoDatabaseClient';

type TestDatabase = MongoDatabaseClient & {
  database: MongoDatabaseClient['database'];
  formatTasks: MongoDatabaseClient['formatTasks'];
  databaseConnection: MongoDatabaseClient['databaseConnection'];
};

describe('mongodb/services/MongoDatabaseClient', () => {
  vi.mock('mongodb');
  vi.mock('@perseid/core');
  vi.mock('@perseid/server');
  vi.mock('@perseid/server/mongodb');
  vi.mock('scripts/core/model/index');
  vi.setSystemTime(new Date(2022, 0, 1));

  let databaseClient: TestDatabase;
  const cache = new CacheClient({ cachePath: '/var/www/html', connectTimeout: 0 });
  const logger = new Logger({ logLevel: 'debug', prettyPrint: false });

  beforeEach(() => {
    vi.clearAllMocks();
    databaseClient = new MongoDatabaseClient(logger, cache, {
      protocol: '',
      host: '',
      port: null,
      user: null,
      password: null,
      database: '',
      connectTimeout: 0,
      connectionLimit: 0,
    }) as TestDatabase;
  });

  test('[formatTasks]', () => {
    expect(databaseClient.formatTasks([{
      _id: new ObjectId('00000000000000000000001'),
      _runBy: new ObjectId('000000000000000000000002'),
      _createdAt: new Date(),
      _endedAt: new Date(),
      _startedAt: new Date(),
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new ObjectId('000000000000000000000003'),
        _createdAt: new Date(),
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 60,
        scriptPath: '/var/www/html/test.js',
      },
      metadata: '{}',
      recurrence: null,
      startAt: null,
      _parent: null,
      startAfter: null,
    }])).toEqual([{
      _id: new Id('00000000000000000000001'),
      _runBy: new Id('000000000000000000000002'),
      _createdAt: new Date(),
      _endedAt: new Date(),
      _startedAt: new Date(),
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000003'),
        _createdAt: new Date(),
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 60,
        scriptPath: '/var/www/html/test.js',
      },
      metadata: '{}',
      recurrence: null,
      startAt: null,
      _parent: null,
      startAfter: null,
    }]);
    expect(databaseClient.formatTasks([{
      _id: new ObjectId('00000000000000000000001'),
      _runBy: new ObjectId('000000000000000000000002'),
      _createdAt: new Date(),
      _endedAt: new Date(),
      _startedAt: new Date(),
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new ObjectId('000000000000000000000003'),
        _createdAt: new Date(),
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 60,
        scriptPath: '/var/www/html/test.js',
      },
      metadata: '{}',
      recurrence: null,
      startAt: null,
      _parent: null,
      startAfter: {
        _id: new ObjectId('00000000000000000000004'),
        _runBy: new ObjectId('000000000000000000000002'),
        _createdAt: new Date(),
        _endedAt: new Date(),
        _startedAt: new Date(),
        _status: 'PENDING',
        _updatedAt: null,
        job: new ObjectId('000000000000000000000003'),
        metadata: '{}',
        recurrence: null,
        startAt: null,
        _parent: null,
        startAfter: null,
      },
    }])).toEqual([{
      _id: new Id('00000000000000000000001'),
      _runBy: new Id('000000000000000000000002'),
      _createdAt: new Date(),
      _endedAt: new Date(),
      _startedAt: new Date(),
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000003'),
        _createdAt: new Date(),
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 60,
        scriptPath: '/var/www/html/test.js',
      },
      metadata: '{}',
      recurrence: null,
      startAt: null,
      _parent: null,
      startAfter: {
        _id: new Id('00000000000000000000004'),
        _runBy: new Id('000000000000000000000002'),
        _createdAt: new Date(),
        _endedAt: new Date(),
        _startedAt: new Date(),
        _status: 'PENDING',
        _updatedAt: null,
        job: new Id('000000000000000000000003'),
        metadata: '{}',
        recurrence: null,
        startAt: null,
        _parent: null,
        startAfter: null,
      },
    }]);
    expect(databaseClient.formatTasks([{
      _id: new ObjectId('00000000000000000000001'),
      _runBy: new ObjectId('000000000000000000000002'),
      _createdAt: new Date(),
      _endedAt: new Date(),
      _startedAt: new Date(),
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new ObjectId('000000000000000000000003'),
        _createdAt: new Date(),
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 60,
        scriptPath: '/var/www/html/test.js',
      },
      metadata: '{}',
      recurrence: null,
      startAt: null,
      _parent: null,
      startAfter: {
        _id: new ObjectId('00000000000000000000004'),
        _runBy: null,
        _createdAt: new Date(),
        _endedAt: new Date(),
        _startedAt: new Date(),
        _status: 'PENDING',
        _updatedAt: null,
        job: new ObjectId('000000000000000000000003'),
        metadata: '{}',
        recurrence: null,
        startAt: null,
        _parent: new ObjectId('000000000000000000000002'),
        startAfter: new ObjectId('000000000000000000000005'),
      },
    }])).toEqual([{
      _id: new Id('00000000000000000000001'),
      _runBy: new Id('000000000000000000000002'),
      _createdAt: new Date(),
      _endedAt: new Date(),
      _startedAt: new Date(),
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000003'),
        _createdAt: new Date(),
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 60,
        scriptPath: '/var/www/html/test.js',
      },
      metadata: '{}',
      recurrence: null,
      startAt: null,
      _parent: null,
      startAfter: {
        _id: new Id('00000000000000000000004'),
        _runBy: null,
        _createdAt: new Date(),
        _endedAt: new Date(),
        _startedAt: new Date(),
        _status: 'PENDING',
        _updatedAt: null,
        job: new Id('000000000000000000000003'),
        metadata: '{}',
        recurrence: null,
        startAt: null,
        _parent: new Id('000000000000000000000002'),
        startAfter: new Id('000000000000000000000005'),
      },
    }]);
    expect(databaseClient.formatTasks([{
      _id: new ObjectId('00000000000000000000001'),
      _runBy: null,
      _createdAt: new Date(),
      _endedAt: new Date(),
      _startedAt: new Date(),
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new ObjectId('000000000000000000000003'),
        _createdAt: new Date(),
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 60,
        scriptPath: '/var/www/html/test.js',
      },
      metadata: '{}',
      recurrence: null,
      startAt: null,
      _parent: new ObjectId('000000000000000000000002'),
      startAfter: new ObjectId('00000000000000000000004'),
    }])).toEqual([{
      _id: new Id('00000000000000000000001'),
      _runBy: null,
      _createdAt: new Date(),
      _endedAt: new Date(),
      _startedAt: new Date(),
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000003'),
        _createdAt: new Date(),
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 60,
        scriptPath: '/var/www/html/test.js',
      },
      metadata: '{}',
      recurrence: null,
      startAt: null,
      _parent: new Id('000000000000000000000002'),
      startAfter: new Id('00000000000000000000004'),
    }]);
  });

  test('[updateMatchingTask]', async () => {
    const results = await databaseClient.updateMatchingTask({
      _runBy: null,
      _id: new Id('000000000000000000000010'),
    }, { _status: 'CANCELED' });
    expect(results).toBe(true);
    const filters = { _runBy: null, _id: new ObjectId('000000000000000000000010') };
    const payload = { _status: 'PENDING' };
    const log = '[MongoDatabaseClient][updateMatchingTask] Updating documents in collection "tasks":';
    expect(logger.debug).toHaveBeenCalledTimes(3);
    expect(logger.debug).toHaveBeenCalledWith(log);
    expect(logger.debug).toHaveBeenCalledWith(filters);
    expect(logger.debug).toHaveBeenCalledWith(payload);
    expect(databaseClient.databaseConnection.collection('tasks').updateOne).toHaveBeenCalledOnce();
    expect(databaseClient.databaseConnection.collection('tasks').updateOne).toHaveBeenCalledWith(filters, {
      $set: payload,
    });
  });

  test('[getRunningTasks]', async () => {
    vi.spyOn(databaseClient, 'formatTasks').mockImplementation(vi.fn(() => []));
    const results = await databaseClient.getRunningTasks();
    expect(results).toEqual([]);
    const pipeline = [
      { $match: { _status: 'IN_PROGRESS' } },
      {
        $lookup: {
          as: 'job',
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
        },
      },
      {
        $addFields: {
          job: { $arrayElemAt: ['$job', 0] },
        },
      },
    ];
    const log = '[MongoDatabaseClient][getRunningTasks] Performing aggregation on collection "tasks" with pipeline:';
    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith(log);
    expect(logger.debug).toHaveBeenCalledWith(pipeline);
    expect(databaseClient.databaseConnection.collection('tasks').aggregate).toHaveBeenCalledOnce();
    expect(databaseClient.databaseConnection.collection('tasks').aggregate).toHaveBeenCalledWith(pipeline);
  });

  test('[getCandidatePendingTasks]', async () => {
    vi.spyOn(databaseClient, 'formatTasks').mockImplementation(vi.fn(() => []));
    const results = await databaseClient.getCandidatePendingTasks();
    expect(results).toEqual([]);
    const pipeline = [
      { $match: { _status: 'PENDING' } },
      {
        $lookup: {
          as: 'startAfter',
          from: 'tasks',
          foreignField: '_id',
          localField: 'startAfter',
        },
      },
      {
        $lookup: {
          as: 'job',
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
        },
      },
      {
        $addFields: {
          job: { $arrayElemAt: ['$job', 0] },
          startAfter: { $arrayElemAt: ['$startAfter', 0] },
        },
      },
      {
        $match: {
          $or: [
            { startAt: { $lte: new Date('2022-01-01T00:00:00.000Z') } },
            { 'startAfter._status': 'COMPLETED' },
          ],
        },
      },
    ];
    const log = '[MongoDatabaseClient][getCandidatePendingTasks] Performing aggregation on collection "tasks" with pipeline:';
    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith(log);
    expect(logger.debug).toHaveBeenCalledWith(pipeline);
    expect(databaseClient.databaseConnection.collection('tasks').aggregate).toHaveBeenCalledOnce();
    expect(databaseClient.databaseConnection.collection('tasks').aggregate).toHaveBeenCalledWith(pipeline);
  });
});
