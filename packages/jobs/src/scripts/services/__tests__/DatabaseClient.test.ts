/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { CacheClient, Logger } from '@perseid/server';
import DatabaseClient from 'scripts/services/DatabaseClient';

type TestDatabase = DatabaseClient & {
  database: DatabaseClient['database'];
  handleConnection: unknown;
};

describe('services/DatabaseClient', () => {
  vi.mock('@perseid/server');
  vi.mock('scripts/model/index');
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2022, 0, 1));

  let databaseClient: DatabaseClient;
  const cache = new CacheClient({ cachePath: '/var/www/html' });
  const logger = new Logger({ logLevel: 'debug', prettyPrint: false });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NOT_FOUND;
    delete process.env.CONNECTION_ERROR;

    databaseClient = new DatabaseClient(logger, cache, {
      protocol: '',
      host: '',
      port: null,
      user: null,
      password: null,
      database: '',
      maxPoolSize: 0,
      queueLimit: 0,
      cacheDuration: 0,
      connectTimeout: 0,
      connectionLimit: 0,
    });
  });

  test('[getRunningTasks] correctly fetches running tasks', async () => {
    const results = await databaseClient.getRunningTasks();
    expect(results).toEqual([{ formatted: true }, { formatted: true }, { formatted: true }]);
    expect((databaseClient as TestDatabase).database.collection('tasks').aggregate).toHaveBeenCalledTimes(1);
    expect((databaseClient as TestDatabase).database.collection('tasks').aggregate).toHaveBeenCalledWith([
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
    ]);
  });

  test('[getCandidatePendingTasks] correctly fetches candidate pending tasks', async () => {
    const results = await databaseClient.getCandidatePendingTasks();
    expect(results).toEqual([{ formatted: true }, { formatted: true }, { formatted: true }]);
    expect((databaseClient as TestDatabase).database.collection('tasks').aggregate).toHaveBeenCalledTimes(1);
    expect((databaseClient as TestDatabase).database.collection('tasks').aggregate).toHaveBeenCalledWith([
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
    ]);
  });

  test('[reset] correctly resets database', async () => {
    const promise = databaseClient.reset();
    vi.runAllTimersAsync().catch(() => null);
    await promise;
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('[DatabaseClient][reset] 🕐 Resetting database in 5 seconds, it\'s still time to abort...');
    expect(logger.info).toHaveBeenCalledTimes(3);
    expect(logger.info).toHaveBeenNthCalledWith(1, '[DatabaseClient][reset] Dropping database...');
    expect(logger.info).toHaveBeenNthCalledWith(2, '[DatabaseClient][reset] Re-creating database...');
    expect(logger.info).toHaveBeenNthCalledWith(3, '[DatabaseClient][reset] Initializing collections...');
    expect(databaseClient.dropDatabase).toHaveBeenCalledTimes(1);
    expect(databaseClient.createDatabase).toHaveBeenCalledTimes(1);
    expect(databaseClient.resetCollection).toHaveBeenCalledTimes(2);
    expect(databaseClient.resetCollection).toHaveBeenCalledWith('jobs');
    expect(databaseClient.resetCollection).toHaveBeenCalledWith('tasks');
  });
});
