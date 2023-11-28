/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type Id,
  type Model,
  type Engine,
  type Logger,
  type CacheClient,
  type BucketClient,
  type CommandContext,
  type CommandOptions,
  type DatabaseClientSettings,
  type DatabaseClient as BaseDatabaseClient,
} from '@perseid/server';
import { Payload, type Ids, type Timestamps } from '@perseid/core';

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

/**
 * MongoDB database client.
 */
export class DatabaseClient extends BaseDatabaseClient<DataModel> {
  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   *
   * @param cache Cache client instance to use for results caching.
   *
   * @param settings Database client settings.
   */
  constructor(
    logger: Logger,
    cache: CacheClient,
    settings: DatabaseClientSettings,
  );

  /**
   * Fetches list of running tasks.
   *
   * @returns Running tasks list.
   */
  public getRunningTasks(): Promise<Task[]>;

  /**
   * Fetches the list of pending tasks that are candidate for execution.
   *
   * @returns Pending tasks list.
   */
  public getCandidatePendingTasks(): Promise<Task[]>;

  /**
   * Resets the whole underlying database, re-creating collections, indexes, and such.
   */
  public reset(): Promise<void>;
}

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
    _status: Task['_status'];
  }>;

  /**
   * Schedules next execution for the given task, if it is periodic.
   *
   * @param task Task to re-schedule.
   *
   * @param taskCompleted Whether task successfully completed.
   */
  protected reSchedulePeriodicTask(task: Task, taskCompleted: boolean): Promise<void>;

  /**
   * Uploads logs file of `task` to a persistent storage.
   *
   * @param task Task for which to upload logs file.
   */
  protected uploadLogs(task: Task): Promise<void>;

  /**
   * Executes `task`.
   *
   * @param task Task to execute.
   */
  protected executeTask(task: Task): Promise<void>;

  /**
   * Closes `task`, performing all post-processing operations.
   *
   * @param task Task to close.
   *
   * @param status Status to update task with.
   */
  protected closeTask(task: Task, status: Task['_status']): Promise<void>;

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
   * Runs the job passed as a command line argument to the script. This method is meant to be called
   * in its own dedicated script, and should not be mixed up with `run`.
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

  /**
   * Creates a new resource into `collection`.
   *
   * @param collection Name of the collection to create resource into.
   *
   * @param payload New resource payload.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Newly created resource.
   */
  public create<Collection extends keyof DataModel>(
    collection: Collection,
    payload: Payload<DataModel[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<DataModel[Collection]>;
}
