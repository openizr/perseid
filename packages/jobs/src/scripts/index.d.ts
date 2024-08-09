/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {
  Id,
  Ids,
  Timestamps,
  DefaultDataModel,
} from '@perseid/core';
import { Logger } from '@perseid/server';

declare global {
  /**
   * Metadata passed to each running job.
   */
  export type JobMetadata = Record<string, unknown> & { lastCompletedAt: Date | null; }

  /**
   * Function that contains the actual job logic.
   */
  export type JobScript = (
    taskId: Id,
    metadata: JobMetadata,
    logger: Logger,
  ) => Promise<void>;

  /**
   * Job scheduler data model.
   */
  export interface DataModel extends DefaultDataModel {
    /**
     * Job.
     */
    jobs: Ids & Timestamps & {
      /** Path to the script to execute for that job. */
      scriptPath: string;

      /** Minimum required number of free slots on job scheduler to run this job. */
      requiredSlots: number;

      /**
       * Job maximum execution time, in seconds.
       * After this duration, task will be stopped, and marked as failed.
       */
      maximumExecutionTime: number;
    };

    /**
     * Job task.
     */
    tasks: Ids & Timestamps & {
      /** Id of the job scheduler instance that run this task. */
      _runBy: Id | null;

      /** Task execution status. */
      _status: 'PENDING' | 'IN_PROGRESS' | 'CANCELED' | 'COMPLETED' | 'FAILED';

      /** Task execution end date. */
      _endedAt: Date | null;

      /** Task execution start date. */
      _startedAt: Date | null;

      /** Task parent (previous execution of that job). */
      _parent: DataModel['tasks'] | Id | null;

      /** Task job. */
      job: Id | DataModel['jobs'];

      /** Task execution metadata. */
      metadata: string;

      /** Task desired start date. You must either define this field, or `startAfter`. */
      startAt: Date | null;

      /** Task recurrence, in seconds. */
      recurrence: number | null;

      /**
       * Task after which this task should start.
       * You must either define this field, or `startAt`.
       */
      startAfter: DataModel['tasks'] | Id | null;
    };
  }
}
