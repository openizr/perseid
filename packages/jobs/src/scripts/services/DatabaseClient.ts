/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type Logger,
  type CacheClient,
  type DatabaseClientSettings,
  DatabaseClient as BaseDatabaseClient,
} from '@perseid/server';
import model from 'scripts/model/index';

/**
 * MongoDB database client.
 */
export default class DatabaseClient extends BaseDatabaseClient<DataModel> {
  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   *
   * @param cache Cache client instance to use for results caching.
   *
   * @param settings Database client settings.
   */
  public constructor(
    logger: Logger,
    cache: CacheClient,
    settings: DatabaseClientSettings,
  ) {
    super(model, logger, cache, settings);
  }

  /**
   * Fetches list of running tasks.
   *
   * @returns Running tasks list.
   */
  public async getRunningTasks(): Promise<Task[]> {
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
    return this.handleError(async () => {
      this.logger.debug('[DatabaseClient][getRunningTasks] Calling MongoDB aggregate method with pipeline:');
      this.logger.debug(pipeline);

      const response = await this.database.collection('tasks').aggregate<Task>(pipeline).toArray();
      const formattedResults = response.map<Task>((task) => this.formatOutput(task, {
        _id: 1,
        _createdAt: 1,
        _updatedAt: 1,
        _runBy: 1,
        _status: 1,
        _endedAt: 1,
        _startedAt: 1,
        _parent: 1,
        job: 1,
        metaData: 1,
        startAt: 1,
        recurrence: 1,
        startAfter: 1,
      }) as Task);

      this.logger.debug('[DatabaseClient][getRunningTasks] Formatted results:');
      this.logger.debug(formattedResults);
      return formattedResults;
    });
  }

  /**
   * Fetches the list of pending tasks that are candidate for execution.
   *
   * @returns Pending tasks list.
   */
  public async getCandidatePendingTasks(): Promise<Task[]> {
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
      // We aggregate 2 different types of tasks:
      // - pending tasks starting after another task
      // - pending tasks starting at a specific time
      {
        $match: {
          $or: [
            { startAt: { $lte: new Date() } },
            { 'startAfter._status': 'COMPLETED' },
          ],
        },
      },
    ];
    return this.handleError(async () => {
      this.logger.debug('[DatabaseClient][getCandidatePendingTasks] Calling MongoDB aggregate method with pipeline:');
      this.logger.debug(pipeline);

      const response = await this.database.collection('tasks').aggregate<Task>(pipeline).toArray();
      const formattedResults = response.map<Task>((task) => this.formatOutput(task, {
        _id: 1,
        _createdAt: 1,
        _updatedAt: 1,
        _runBy: 1,
        _status: 1,
        _endedAt: 1,
        _startedAt: 1,
        _parent: 1,
        job: 1,
        metaData: 1,
        startAt: 1,
        recurrence: 1,
        startAfter: 1,
      }) as Task);

      this.logger.debug('[DatabaseClient][getCandidatePendingTasks] Formatted results:');
      this.logger.debug(formattedResults);
      return formattedResults;
    });
  }

  /**
   * Resets the whole underlying database, re-creating collections, indexes, and such.
   */
  public async reset(): Promise<void> {
    await this.handleError(async () => {
      this.logger.warn('[DatabaseClient][reset] 🕐 Resetting database in 5 seconds, it\'s still time to abort...');
      await new Promise((resolve) => { setTimeout(resolve, 5000); });
      this.logger.info('[DatabaseClient][reset] Dropping database...');
      await this.dropDatabase();
      this.logger.info('[DatabaseClient][reset] Re-creating database...');
      await this.createDatabase();
      this.logger.info('[DatabaseClient][reset] Initializing collections...');
      await this.resetCollection('jobs');
      await this.resetCollection('tasks');
    });
  }
}
