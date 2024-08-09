/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type Logger,
  type Payload,
  type CacheClient,
  type SearchFilters,
  type DatabaseClientSettings,
} from '@perseid/server';
import { Id } from '@perseid/core';
import model from 'scripts/core/model/index';
import { ObjectId, type Document } from 'mongodb';
import BaseDatabaseClient from '@perseid/server/mongodb';

/**
 * MongoDB database client.
 */
export default class MongoDatabaseClient extends BaseDatabaseClient<DataModel> {
  /**
   * Formats `results` into a database-agnostic tasks.
   *
   * @param results List of database raw results to format.
   *
   * @returns Formatted results.
   */
  protected formatTasks(results: Record<string, unknown>[]): DataModel['tasks'][] {
    this.logger.silent('');
    return results.map((result) => {
      const startAfterId = (result.startAfter instanceof ObjectId)
        ? new Id(String(result.startAfter))
        : null;
      const job = result.job as Record<string, unknown>;
      const startAfter = result.startAfter as Record<string, unknown> | null | undefined;
      return {
        _id: new Id(String(result._id)),
        _createdAt: result._createdAt,
        _updatedAt: result._updatedAt,
        _runBy: (result._runBy === null) ? null : new Id(String(result._runBy)),
        _status: result._status,
        _endedAt: result._endedAt,
        _startedAt: result._startedAt,
        _parent: (result._parent === null) ? null : new Id(String(result._parent)),
        job: {
          _id: new Id(String(job._id)),
          _createdAt: job._createdAt,
          _updatedAt: job._updatedAt,
          scriptPath: job.scriptPath,
          requiredSlots: job.requiredSlots,
          maximumExecutionTime: job.maximumExecutionTime,
        },
        metadata: result.metadata,
        startAt: result.startAt,
        recurrence: result.recurrence,
        startAfter: (startAfter === null || startAfter === undefined) ? null : startAfterId ?? {
          _id: new Id(String(startAfter._id)),
          _createdAt: startAfter._createdAt,
          _updatedAt: startAfter._updatedAt,
          _runBy: (startAfter._runBy === null)
            ? null
            : new Id(String(startAfter._runBy)),
          _status: startAfter._status,
          _endedAt: startAfter._endedAt,
          _startedAt: startAfter._startedAt,
          _parent: (startAfter._parent === null)
            ? null
            : new Id(String(startAfter._parent)),
          job: new Id(String(startAfter.job)),
          metadata: startAfter.metadata,
          startAt: startAfter.startAt,
          recurrence: startAfter.recurrence,
          startAfter: (startAfter.startAfter === null)
            ? null
            : new Id(String(startAfter.startAfter)),
        },
      } as DataModel['tasks'];
    });
  }

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
   * Updates task that matches `filters` with `payload`.
   *
   * @param filters Filters to apply to match task.
   *
   * @param payload Updated task payload.
   *
   * @returns `true` if task was updated, `false` otherwise.
   */
  public async updateMatchingTask(
    filters: SearchFilters,
    payload: Payload<DataModel['tasks']>,
  ): Promise<boolean> {
    return this.handleError(async () => {
      const formattedFilters: Document = {};
      Object.keys(filters).forEach((fieldName) => {
        const value = filters[fieldName];
        formattedFilters[fieldName] = value instanceof Id ? new ObjectId(String(value)) : value;
      });
      const [formattedPayload] = this.structurePayload('tasks', new Id(), payload, 'UPDATE').tasks;
      const connection = this.databaseConnection.collection('tasks');
      this.logger.debug('[MongoDatabaseClient][updateMatchingTask] Updating documents in collection "tasks":');
      this.logger.debug(formattedFilters);
      this.logger.debug(formattedPayload);
      const response = await connection.updateOne(formattedFilters, { $set: formattedPayload });
      return response.modifiedCount === 1;
    });
  }

  /**
   * Fetches list of running tasks.
   *
   * @returns Running tasks list.
   */
  public async getRunningTasks(): Promise<DataModel['tasks'][]> {
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
      const connection = this.databaseConnection.collection('tasks');
      this.logger.debug('[MongoDatabaseClient][getRunningTasks] Performing aggregation on collection "tasks" with pipeline:');
      this.logger.debug(pipeline);
      return this.formatTasks(await connection.aggregate(pipeline).toArray());
    });
  }

  /**
   * Fetches the list of pending tasks that are candidate for execution.
   *
   * @returns Pending tasks list.
   */
  public async getCandidatePendingTasks(): Promise<DataModel['tasks'][]> {
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
      this.logger.debug('[MongoDatabaseClient][getCandidatePendingTasks] Performing aggregation on collection "tasks" with pipeline:');
      this.logger.debug(pipeline);
      const connection = this.databaseConnection.collection('tasks');
      return this.formatTasks(await connection.aggregate(pipeline).toArray());
    });
  }
}
