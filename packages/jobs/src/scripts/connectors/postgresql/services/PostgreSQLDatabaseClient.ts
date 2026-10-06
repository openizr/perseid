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
import { Id, type Ids } from '@perseid/core';
import model from 'scripts/core/model/index';
import type { Attributes } from '@opentelemetry/api';
import type { FullPendingTask, FullRunningTask, JobsDataModel } from 'scripts/core/types';
import BaseDatabaseClient, {
  type SelectQuery,
  type UpdateQuery,
  type PostgreSQLDatabaseClientSettings,
} from '@perseid/server/postgresql';

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

// Base query fetching tasks along with their job.
const TASKS_QUERY: SelectQuery & { join: NonNullable<SelectQuery['join']>; } = {
  type: 'SELECT',
  table: 'tasks',
  fields: [
    '"tasks"."_id" AS "_id"',
    '"tasks"."_runBy" AS "_runBy"',
    '"tasks"."_status" AS "_status"',
    '"tasks"."_startedAt" AS "_startedAt"',
    '"tasks"."metadata" AS "metadata"',
    '"tasks"."startAt" AS "startAt"',
    '"tasks"."recurrence" AS "recurrence"',
    '"tasks"."startAfter" AS "startAfter"',
    '"job"."_id" AS "job__id"',
    '"job"."scriptPath" AS "job_scriptPath"',
    '"job"."requiredSlots" AS "job_requiredSlots"',
    '"job"."maximumExecutionTime" AS "job_maximumExecutionTime"',
  ],
  join: [{ table: 'jobs', as: 'job', on: '"tasks"."job" = "job"."_id"' }],
};

/**
 * Formats `results` into database-agnostic tasks.
 *
 * @param results List of database raw results to format.
 *
 * @returns Formatted results.
 */
function formatTasks(results: PendingSQLTaskRow[]): FullPendingTask[];

function formatTasks(results: RunningSQLTaskRow[]): FullRunningTask[];

function formatTasks(
  results: (RunningSQLTaskRow | PendingSQLTaskRow)[],
): (FullPendingTask | FullRunningTask)[] {
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
 * PostgreSQL database client.
 */
export default class PostgreSQLDatabaseClient<
  QueryResults extends Record<string, Ids> = Record<string, Ids>,
> extends BaseDatabaseClient<JobsDataModel, QueryResults> {
  /**
   * Default attributes to inject in all telemetry spans.
   */
  protected defaultAttributes: Attributes = {
    'code.class.name': this.constructor.name,
  };

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
      attributes: { ...this.defaultAttributes },
    }, async () => {
      const where: UpdateQuery['where'] = Object.keys(filters).map((fieldName) => (
        (filters[fieldName] === null)
          ? `"${fieldName}" IS NULL`
          : { column: `"${fieldName}"`, operator: '=', value: filters[fieldName] }
      ));
      const { update } = this.compileQueries({
        update: {
          type: 'UPDATE', table: 'tasks', fields: payload, where,
        },
      });
      const response = await this.query(update);
      return response.rowCount === 1;
    });
  }

  /**
   * Fetches list of running tasks.
   *
   * @returns Running tasks list.
   */
  public async getRunningTasks(): Promise<FullRunningTask[]> {
    return this.telemetry.span(`${this.constructor.name}.getRunningTasks`, {
      attributes: { ...this.defaultAttributes },
    }, async (span) => {
      const { tasks } = this.compileQueries({
        tasks: {
          ...TASKS_QUERY,
          where: [{ column: '"tasks"."_status"', operator: '=', value: 'IN_PROGRESS' }],
        },
      });
      const response = await this.query<RunningSQLTaskRow>(tasks);

      span.setAttributes({ 'app.tasks.count': response.rows.length });

      return formatTasks(response.rows);
    });
  }

  /**
   * Fetches the list of pending tasks that are candidate for execution.
   *
   * @returns Pending tasks list.
   */
  public async getCandidatePendingTasks(): Promise<FullPendingTask[]> {
    return this.telemetry.span(`${this.constructor.name}.getCandidatePendingTasks`, {
      attributes: { ...this.defaultAttributes },
    }, async (span) => {
      // Candidates either start at a given time, or after another task completed.
      const { tasks } = this.compileQueries({
        tasks: {
          ...TASKS_QUERY,
          fields: [
            ...TASKS_QUERY.fields,
            '"startAfter"."_id" AS "startAfter__id"',
            '"startAfter"."_status" AS "startAfter__status"',
          ],
          join: [
            ...TASKS_QUERY.join,
            { table: 'tasks', as: 'startAfter', on: '"tasks"."startAfter" = "startAfter"."_id"' },
          ],
          where: [
            { column: '"tasks"."_status"', operator: '=', value: 'PENDING' },
            {
              operator: 'OR',
              conditions: [
                { column: '"tasks"."startAt"', operator: '<=', value: new Date() },
                { column: '"startAfter"."_status"', operator: '=', value: 'COMPLETED' },
              ],
            },
          ],
        },
      });
      const response = await this.query<PendingSQLTaskRow>(tasks);

      span.setAttributes({ 'app.tasks.count': response.rows.length });

      return formatTasks(response.rows);
    });
  }
}
