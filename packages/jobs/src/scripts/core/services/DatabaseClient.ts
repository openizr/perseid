/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { AbstractDatabaseClient, type Payload, type SearchFilters } from '@perseid/server';

/**
 * Abstract database client, to use as a blueprint for DBMS-specific implementations.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/jobs/src/scripts/core/services/DatabaseClient.ts
 */
export default abstract class DatabaseClient extends AbstractDatabaseClient<DataModel> {
  /**
   * Updates task that matches `filters` with `payload`.
   *
   * @param filters Filters to apply to match task.
   *
   * @param payload Updated task payload.
   *
   * @returns `true` if task was updated, `false` otherwise.
   */
  public abstract updateMatchingTask(
    filters: SearchFilters,
    payload: Payload<DataModel['tasks']>,
  ): Promise<boolean>;

  /**
   * Fetches list of running tasks.
   *
   * @returns Running tasks list.
   */
  public abstract getRunningTasks(): Promise<DataModel['tasks'][]>;

  /**
   * Fetches the list of pending tasks that are candidate for execution.
   *
   * @returns Pending tasks list.
   */
  public abstract getCandidatePendingTasks(): Promise<DataModel['tasks'][]>;
}
