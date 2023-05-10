/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id, Logger } from '@perseid/server';
import { type Ids, type Timestamps } from '@perseid/core';

declare global {
  /** Function that contains the actual job logic. */
  export type JobScript = (
    taskId: string,
    metaData: Record<string, unknown>,
    logger: Logger,
  ) => Promise<void>;

  /**
   * Job.
   */
  export interface Job extends Ids, Timestamps {
    /** Path to the script to execute for that job. */
    scriptPath: string;

    /** Minimum required number of free slots on job scheduler to run this job. */
    requiredSlots: number;

    /**
     * Job maximum execution time, in seconds.
     * After this duration, task will be stopped, and marked as failed.
     */
    maximumExecutionTime: number;
  }

  /**
   * Job task.
   */
  export interface Task extends Ids, Timestamps {
    /** Id of the job scheduler instance that run this task. */
    _runBy: Id | null;

    /** Task execution status. */
    _status: 'PENDING' | 'IN_PROGRESS' | 'CANCELED' | 'COMPLETED' | 'FAILED';

    /** Task execution end date. */
    _endedAt: Date | null;

    /** Task execution start date. */
    _startedAt: Date | null;

    /** Task parent (previous execution of that job). */
    _parent: Task | Id | null;

    /** Task job. */
    job: Id | Job;

    /** Task execution metadata. */
    metaData: string;

    /** Task desired start date. You must either define this field, or `startAfter`. */
    startAt: Date | null;

    /** Task recurrence, in seconds. */
    recurrence: number | null;

    /** Task after which this task should start. You must either define this field, or `startAt`. */
    startAfter: Task | Id | null;
  }

  /**
   * Job scheduler data model.
   */
  export interface DataModel {
    jobs: Job;
    tasks: Task;
  }
}
