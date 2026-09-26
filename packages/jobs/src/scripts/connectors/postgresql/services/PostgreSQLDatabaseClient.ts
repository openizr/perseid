/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Telemetry,
  type Payload,
  type CacheClient,
  type SearchFilters,
} from '@perseid/server';
import { Id } from '@perseid/core';
import model from 'scripts/core/model/index';
import type { Attributes, AttributeValue } from '@opentelemetry/api';
import type { FullPendingTask, FullRunningTask, JobsDataModel } from 'scripts/core/types';
import BaseDatabaseClient, { type PostgreSQLDatabaseClientSettings } from '@perseid/server/postgresql';

interface PendingSQLTaskRow {
  _id: string;
  _startedAt: null;
  _runBy: string | null;
  _status: 'PENDING' | 'IN_PROGRESS' | 'CANCELED' | 'COMPLETED' | 'FAILED';
  metadata: string;
  startAt: Date | null;
  recurrence: number | null;
  job__id: string;
  job_scriptPath: string;
  job_requiredSlots: number;
  job_maximumExecutionTime: number;
  startAfter__id?: string | null;
  startAfter__status?: string;
  startAfter?: string | null;
}

 type RunningSQLTaskRow = Omit<PendingSQLTaskRow, '_startedAt'> & {
  _startedAt: Date;
 }

/**
 * PostgreSQL database client.
 */
// @ts-expect-error ----------
export default class PostgreSQLDatabaseClient extends BaseDatabaseClient<JobsDataModel> {
  /**
   * Default attributes to inject in all telemetry spans.
   */
  protected DEFAULT_ATTRIBUTES: Attributes = {
    'code.class.name': this.constructor.name,
  };

  /**
   * Formats "results" into a database-agnostic tasks.
   *
   * @param results List of database raw results to format.
   *
   * @returns Formatted results.
   */
  protected formatTasks(results: PendingSQLTaskRow[]): FullPendingTask[];

  protected formatTasks(results: RunningSQLTaskRow[]): FullRunningTask[];

  protected formatTasks(
    results: (RunningSQLTaskRow | PendingSQLTaskRow)[],
  ): (FullPendingTask | FullRunningTask)[] {
    this.telemetry.debug('');
    return results.map((row) => {
      let startAfter = null;
      if (row.startAfter__id !== undefined && row.startAfter__id !== null) {
        startAfter = {
          _id: new Id(row.startAfter__id),
          _status: row.startAfter__status,
        };
      } else if (row.startAfter !== undefined && row.startAfter !== null) {
        startAfter = {
          _id: new Id(row.startAfter),
          _status: 'PENDING',
        };
      }
      return ({
        _id: new Id(row._id),
        _status: row._status,
        _startedAt: row._startedAt,
        _runBy: (row._runBy === null) ? null : new Id(row._runBy),
        job: {
          _id: new Id(row.job__id),
          scriptPath: row.job_scriptPath,
          requiredSlots: row.job_requiredSlots,
          maximumExecutionTime: row.job_maximumExecutionTime,
        },
        startAfter,
        startAt: row.startAt,
        metadata: row.metadata,
        recurrence: row.recurrence,
      }) as FullPendingTask | FullRunningTask;
    });
  }

  /**
   * Class constructor.
   *
   * @param telemetry Telemetry instance to use.
   *
   * @param cache Cache client instance to use for results caching.
   *
   * @param settings Database client settings.
   */
  public constructor(
    telemetry: Telemetry,
    cache: CacheClient,
    settings: PostgreSQLDatabaseClientSettings,
  ) {
    super(model, telemetry, cache, settings);
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
    payload: Payload<JobsDataModel['tasks']>,
  ): Promise<boolean> {
    return this.telemetry.span(`${this.constructor.name}.updateMatchingTask`, {
      attributes: {
        ...this.DEFAULT_ATTRIBUTES,
        payload: payload as AttributeValue,
        filters: filters as unknown as AttributeValue,
      },
    }, async () => (
      this.handleError(async () => {
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
        this.telemetry.info('Performing SQL query...', { sqlQuery, values: values as string[] });
        const connection = await this.client.connect();
        try {
          const response = await connection.query(sqlQuery, values);
          connection.release();
          return response.rowCount === 1;
        } catch (error) {
          connection.release();
          throw error;
        }
      })
    ));
  }

  /**
   * Fetches list of running tasks.
   *
   * @returns Running tasks list.
   */
  public async getRunningTasks(): Promise<FullRunningTask[]> {
    return this.telemetry.span(`${this.constructor.name}.getRunningTasks`, {
      attributes: {
        ...this.DEFAULT_ATTRIBUTES,
      },
    }, async () => (
      this.handleError(async () => {
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
        this.telemetry.info('Performing SQL query...', { sqlQuery: fullSQLQuery, values });
        const response = await this.client.query<RunningSQLTaskRow>(fullSQLQuery, values);
        return this.formatTasks(response.rows);
      })
    ));
  }

  /**
   * Fetches the list of pending tasks that are candidate for execution.
   *
   * @returns Pending tasks list.
   */
  public async getCandidatePendingTasks(): Promise<FullPendingTask[]> {
    return this.telemetry.span(`${this.constructor.name}.getCandidatePendingTasks`, {
      attributes: {
        ...this.DEFAULT_ATTRIBUTES,
      },
    }, async () => (
      this.handleError(async () => {
        const values = ['PENDING', (new Date()).toISOString(), 'COMPLETED'];
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
        this.telemetry.info('Performing SQL query...', { sqlQuery: fullSQLQuery, values });
        const response = await this.client.query<PendingSQLTaskRow>(fullSQLQuery, values);
        return this.formatTasks(response.rows);
      })
    ));
  }
}
