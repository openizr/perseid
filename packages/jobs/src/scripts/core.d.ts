/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/jobs' {
  import type {
    Id,
    Ids,
    Timestamps,
    DefaultDataModel,
  } from '@perseid/core';
  import type {
    Model,
    Engine,
    Logger,
    Payload,
    BucketClient,
    SearchFilters,
    CommandContext,
    AbstractDatabaseClient,
  } from '@perseid/server';

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

  /**
   * Abstract database client, to use as a blueprint for DBMS-specific implementations.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/jobs/src/scripts/core/services/DatabaseClient.ts
   */
  export abstract class DatabaseClient extends AbstractDatabaseClient<DataModel> {
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

  type JobWorkerData = {
    id: string | undefined;
    jobId: string | undefined;
    metadata: string | undefined;
  } | undefined;

  /**
   * Job scheduler settings.
   */
  export interface JobSchedulerSettings {
    /** Path to the tasks logs directory. */
    logsPath: string;

    /** Amount of initially available slots for that scheduler to run jobs. */
    availableSlots: number;

    /** List of jobs to register. */
    jobs: Record<string, JobScript>;
  }

  /**
   * Handles tasks lifecycle.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/jobs/src/scripts/core/services/JobScheduler.ts
   */
  export class JobScheduler extends Engine<DataModel, Model<DataModel>, DatabaseClient> {
    /** Job scheduler instance unique id. */
    protected instanceId: Id;

    /** Path to the tasks logs directory. */
    protected logsPath: string;

    /** Bucket client. */
    protected bucketClient: BucketClient;

    /** Amount of initially available slots for that scheduler to run jobs. */
    protected availableSlots: number;

    /** List of registered jobs. */
    protected jobs: Record<string, JobScript>;

    /** Running tasks registry. */
    protected tasksRegistry: Record<string, {
      worker: Worker;
      _status: DataModel['tasks']['_status'];
    }>;

    /**
     * Returns updated `payload` with automatic fields.
     *
     * @param resource Type of resource for which to generate automatic fields.
     *
     * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
     *
     * @param payload Payload to update.
     *
     * @param context Command context.
     *
     * @returns Payload with automatic fields.
     */
    protected withAutomaticFields<Resource extends keyof DataModel>(
      resource: Resource,
      existingResource: DataModel[Resource] | null,
      payload: Payload<DataModel[Resource]>,
      context: CommandContext<DataModel>,
    ): Promise<Payload<DataModel[Resource]>>;

    /**
     * Schedules next execution for the given task, if it is periodic.
     *
     * @param task Task to re-schedule.
     *
     * @param taskCompleted Whether task successfully completed.
     */
    protected reSchedulePeriodicTask(task: DataModel['tasks'], taskCompleted: boolean): Promise<void>;

    /**
     * Uploads logs file of `task` to a persistent storage.
     *
     * @param task Task for which to upload logs file.
     */
    protected uploadLogs(task: DataModel['tasks']): Promise<void>;

    /**
     * Executes `task`.
     *
     * @param task Task to execute.
     */
    protected executeTask(task: DataModel['tasks']): Promise<void>;

    /**
     * Closes `task`, performing all post-processing operations.
     *
     * @param task Task to close.
     *
     * @param status Status to update task with.
     */
    protected closeTask(
      task: DataModel['tasks'],
      status: DataModel['tasks']['_status'],
    ): Promise<void>;

    /**
     * Processes candidate pending tasks.
     */
    protected processPendingTasks(): Promise<void>;

    /**
     * Processes tasks in progress.
     */
    protected processRunningTasks(): Promise<void>;

    /**
     * Class constructor.
     *
     * @param logger Logger to use.
     *
     * @param databaseClient Database client to use to store/fetch data.
     *
     * @param bucketClient Bucket client to use to store logs files.
     *
     * @param settings Jobs scheduler settings.
     */
    public constructor(
      logger: Logger,
      databaseClient: DatabaseClient,
      bucketClient: BucketClient,
      settings: JobSchedulerSettings,
    );

    /**
     * Runs the job passed as a command line argument to the script. This method is meant to be
     * called in its own dedicated script, and should not be mixed up with `run`.
     *
     * @param jobs List of jobs to register.
     *
     * @param logsPath Path to the tasks logs directory.
     *
     * @param logLevel Minimum logging level (all logs below that level won't be logs).
     */
    public static runJob(
      jobs: JobSchedulerSettings['jobs'],
      logsPath: string,
      logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    ): Promise<void>;

    /**
     * Executes job scheduler.
     */
    public run(): Promise<void>;
  }
}
