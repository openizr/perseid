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
import BaseDatabaseClient from '@perseid/server/postgresql';

/**
 * PostgreSQL database client.
 */
export default class PostgreSQLDatabaseClient extends BaseDatabaseClient<DataModel> {
  /**
   * Formats "results" into a database-agnostic tasks.
   *
   * @param results List of database raw results to format.
   *
   * @returns Formatted results.
   */
  protected formatTasks(results: unknown[]): DataModel['tasks'][] {
    this.logger.silent('');
    return results.map((row) => {
      const result = row as Record<string, unknown>;
      const startAfterId = (result.startAfter__id === undefined)
        ? new Id(result.startAfter as string)
        : null;
      return {
        _id: new Id(result._id as string),
        _createdAt: result._createdAt,
        _updatedAt: result._updatedAt,
        _runBy: (result._runBy === null) ? null : new Id(result._runBy as string),
        _status: result._status,
        _endedAt: result._endedAt,
        _startedAt: result._startedAt,
        _parent: (result._parent === null) ? null : new Id(result._parent as string),
        job: {
          _id: new Id(result.job__id as string),
          _createdAt: result.job__createdAt,
          _updatedAt: result.job__updatedAt,
          scriptPath: result.job_scriptPath,
          requiredSlots: result.job_requiredSlots,
          maximumExecutionTime: result.job_maximumExecutionTime,
        },
        metadata: result.metadata,
        startAt: result.startAt,
        recurrence: result.recurrence,
        startAfter: (result.startAfter === null) ? null : startAfterId ?? {
          _id: new Id(result.startAfter__id as string),
          _createdAt: result.startAfter__createdAt,
          _updatedAt: result.startAfter__updatedAt,
          _runBy: (result.startAfter__runBy === null)
            ? null
            : new Id(result.startAfter__runBy as string),
          _status: result.startAfter__status,
          _endedAt: result.startAfter__endedAt,
          _startedAt: result.startAfter__startedAt,
          _parent: (result.startAfter__parent === null)
            ? null
            : new Id(result.startAfter__parent as string),
          job: new Id(result.startAfter_job as string),
          metadata: result.startAfter_metadata,
          startAt: result.startAfter_startAt,
          recurrence: result.startAfter_recurrence,
          startAfter: (result.startAfter_startAfter === null)
            ? null
            : new Id(result.startAfter_startAfter as string),
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
   * Updates task that matches "filters" with "payload".
   *
   * @param filters Filters to apply to match task.
   *
   * @param payload Updated task payload.
   *
   * @returns "true" if task was updated, "false" otherwise.
   */
  public async updateMatchingTask(
    filters: SearchFilters,
    payload: Payload<DataModel['tasks']>,
  ): Promise<boolean> {
    return this.handleError(async () => {
      let placeholderIndex = 0;
      const values: unknown[] = [];
      const sqlFilters: string[] = [];
      const fields = Object.keys(payload);
      const fieldPlaceholders: string[] = [];
      fields.forEach((fieldName) => {
        placeholderIndex += 1;
        const value = payload[fieldName as '_id'];
        values.push(value instanceof Id ? String(value) : value);
        fieldPlaceholders.push(`"${fieldName}" = $${String(placeholderIndex)}`);
      });
      const filterFields = Object.keys(filters);
      filterFields.forEach((fieldName) => {
        const value = filters[fieldName];
        if (value === null) {
          sqlFilters.push(`"${fieldName}" IS NULL`);
        } else {
          placeholderIndex += 1;
          values.push(value instanceof Id ? String(value) : value);
          sqlFilters.push(`"${fieldName}" = $${String(placeholderIndex)}`);
        }
      });
      const placeholders = fieldPlaceholders.join(',\n  ');
      const sqlQuery = `UPDATE "tasks" SET\n  ${placeholders}\nWHERE\n  ${sqlFilters.join('\n  AND ')};`;
      this.logger.debug('[PostgreSQLDatabaseClient][updateMatchingTask] Performing the following SQL query on database:');
      this.logger.debug(`[PostgreSQLDatabaseClient][updateMatchingTask]\n\n${sqlQuery}\n`);
      this.logger.debug(`[PostgreSQLDatabaseClient][updateMatchingTask] [\n  ${values.join(',\n  ')}\n]\n`);
      const connection = await this.client.connect();
      try {
        const response = await connection.query(sqlQuery, values);
        connection.release();
        return response.rowCount === 1;
      } catch (error) {
        connection.release();
        throw error;
      }
    });
  }

  /**
   * Fetches list of running tasks.
   *
   * @returns Running tasks list.
   */
  public async getRunningTasks(): Promise<DataModel['tasks'][]> {
    return this.handleError(async () => {
      const values = ['IN_PROGRESS'];
      const fullSQLQuery = 'SELECT\n  "tasks"."_id" AS "_id",\n  "tasks"."_createdAt" AS '
        + '"_createdAt",\n  "tasks"."_updatedAt" AS "_updatedAt",\n  "tasks"."_runBy" AS "_runBy",'
        + '\n  "tasks"."_status" AS "_status",\n  "tasks"."_endedAt" AS "_endedAt",\n  '
        + '"tasks"."_startedAt" AS "_startedAt",\n  "tasks"."_parent" AS "_parent",\n  '
        + '"tasks"."metadata" AS "metadata",\n  "tasks"."startAt" AS "startAt",\n  '
        + '"tasks"."recurrence" AS "recurrence",\n  "tasks"."job" AS "job",\n  "tasks"."startAfter"'
        + ' AS "startAfter",\n  "job"."_id" AS "job__id",\n  "job"."_createdAt" AS "job__createdAt"'
        + ',\n  "job"."_updatedAt" AS "job__updatedAt",\n  "job"."scriptPath" AS "job_scriptPath",'
        + '\n  "job"."requiredSlots" AS "job_requiredSlots",\n  "job"."maximumExecutionTime" AS '
        + '"job_maximumExecutionTime"\nFROM\n  "tasks"\nLEFT JOIN\n  "jobs" AS "job"\nON "tasks"."job" = '
        + '"job"."_id"\nWHERE\n  "tasks"."_status" = $1;';
      this.logger.debug('[PostgreSQLDatabaseClient][getRunningTasks] Performing the following SQL query on database:');
      this.logger.debug(`[PostgreSQLDatabaseClient][getRunningTasks]\n\n${fullSQLQuery}\n`);
      this.logger.debug(`[PostgreSQLDatabaseClient][getRunningTasks] [\n  ${values.join(',\n  ')}\n]\n`);
      const response = await this.client.query(fullSQLQuery, values);
      return this.formatTasks(response.rows);
    });
  }

  /**
   * Fetches the list of pending tasks that are candidate for execution.
   *
   * @returns Pending tasks list.
   */
  public async getCandidatePendingTasks(): Promise<DataModel['tasks'][]> {
    return this.handleError(async () => {
      const values = ['PENDING', new Date(), 'COMPLETED'];
      // We aggregate 2 different types of tasks:
      // - pending tasks starting after another task
      // - pending tasks starting at a specific time
      const fullSQLQuery = 'SELECT\n  "tasks"."_id" AS "_id",\n  "tasks"."_createdAt" AS '
        + '"_createdAt",\n  "tasks"."_updatedAt" AS "_updatedAt",\n  "tasks"."_runBy" AS "_runBy",'
        + '\n  "tasks"."_status" AS "_status",\n  "tasks"."_endedAt" AS "_endedAt",\n  '
        + '"tasks"."_startedAt" AS "_startedAt",\n  "tasks"."_parent" AS "_parent",\n  '
        + '"tasks"."metadata" AS "metadata",\n  "tasks"."startAt" AS "startAt",\n  '
        + '"tasks"."recurrence" AS "recurrence",\n  "tasks"."job" AS "job",\n  "tasks"."startAfter"'
        + ' AS "startAfter",\n  "job"."_id" AS "job__id",\n  "job"."_createdAt" AS "job__createdAt"'
        + ',\n  "job"."_updatedAt" AS "job__updatedAt",\n  "job"."scriptPath" AS "job_scriptPath",'
        + '\n  "job"."requiredSlots" AS "job_requiredSlots",\n  "job"."maximumExecutionTime" AS '
        + '"job_maximumExecutionTime",\n  "startAfter"."_id" AS "startAfter__id",\n  '
        + '"startAfter"."_createdAt" AS "startAfter__createdAt",\n  "startAfter"."_updatedAt" AS '
        + '"startAfter__updatedAt",\n  "startAfter"."_runBy" AS "startAfter__runBy",\n  '
        + '"startAfter"."_status" AS "startAfter__status",\n  "startAfter"."_startedAt" AS '
        + '"startAfter__startedAt",\n  "startAfter"."_endedAt" AS "startAfter__endedAt",\n  '
        + '"startAfter"."_parent" AS "startAfter__parent",\n  "startAfter"."job" AS '
        + '"startAfter_job",\n  "startAfter"."metadata" AS "startAfter_metadata",\n  '
        + '"startAfter"."startAt" AS "startAfter_startAt",\n  "startAfter"."recurrence" AS '
        + '"startAfter_recurrence",\n  "startAfter"."startAfter" AS "startAfter_startAfter"\nFROM'
        + '\n  "tasks"\nLEFT JOIN\n  "tasks" AS "startAfter"\nON "tasks"."startAfter" = '
        + '"startAfter"."_id"\nLEFT JOIN\n  "jobs" AS "job"\nON "tasks"."job" = "job"."_id"\nWHERE'
        + '\n  "tasks"."_status" = $1\n'
        + '  AND ("tasks"."startAt" <= $2 OR "startAfter"."_status" = $3);';
      this.logger.debug('[PostgreSQLDatabaseClient][getCandidatePendingTasks] Performing the following SQL query on database:');
      this.logger.debug(`[PostgreSQLDatabaseClient][getCandidatePendingTasks]\n\n${fullSQLQuery}\n`);
      this.logger.debug(`[PostgreSQLDatabaseClient][getCandidatePendingTasks] [\n  ${values.join(',\n  ')}\n]\n`);
      const response = await this.client.query(fullSQLQuery, values);
      return this.formatTasks(response.rows);
    });
  }
}
