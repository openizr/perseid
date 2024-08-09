/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/jobs/mysql' {
  import type {
    Logger,
    Payload,
    CacheClient,
    SearchFilters,
    DatabaseClientSettings,
  } from '@perseid/server';
  import type { DataModel } from '@perseid/jobs';
  import BaseDatabaseClient from '@perseid/server/mysql';

  /**
   * MySQL database client.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/jobs/src/scripts/mysql/services/MySQLDatabaseClient.ts
   */
  export default class MySQLDatabaseClient extends BaseDatabaseClient<DataModel> {
    /**
     * Formats `results` into a database-agnostic tasks.
     *
     * @param results List of database raw results to format.
     *
     * @returns Formatted results.
     */
    protected formatTasks(results: unknown[]): DataModel['tasks'][];

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
    );

    /**
     * Updates task that matches `filters` with `payload`.
     *
     * @param filters Filters to apply to match task.
     *
     * @param payload Updated task payload.
     *
     * @returns `true` if task was updated, `false` otherwise.
     */
    public updateMatchingTask(
      filters: SearchFilters,
      payload: Payload<DataModel['tasks']>,
    ): Promise<boolean>;

    /**
     * Fetches list of running tasks.
     *
     * @returns Running tasks list.
     */
    public getRunningTasks(): Promise<DataModel['tasks'][]>;

    /**
     * Fetches the list of pending tasks that are candidate for execution.
     *
     * @returns Pending tasks list.
     */
    public getCandidatePendingTasks(): Promise<DataModel['tasks'][]>;
  }
}
