/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Engine,
  Logger,
  Profiler,
  type Model,
  type BucketClient,
  type CommandContext,
  type CommandOptions,
} from '@perseid/server';
import { pino } from 'pino';
import model from 'scripts/model/index';
import { Id, Payload, forEach } from '@perseid/core';
import { Worker, workerData } from 'worker_threads';
import { promises as fs, createReadStream } from 'fs';
import type DatabaseClient from 'scripts/services/DatabaseClient';

type JobWorkerData = {
  id: string | undefined;
  jobId: string | undefined;
  metaData: string | undefined;
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
 */
export default class JobScheduler extends Engine<DataModel, Model<DataModel>, DatabaseClient> {
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
  protected async reSchedulePeriodicTask(task: Task, taskCompleted: boolean): Promise<void> {
    if (task.recurrence === null && task.startAfter === null) {
      this.logger.info(`[JobScheduler][reSchedulePeriodicTask] Task with id "${String(task._id)}" is not periodic, re-scheduling skipped.`);
    } else {
      const job = task.job as Job;
      this.logger.info(`[JobScheduler][reSchedulePeriodicTask] Creating next recurrence for task with id "${String(task._id)}"...`);

      const parsedMetaData = JSON.parse(task.metaData) as { lastCompletedAt: Date; };
      if (taskCompleted) {
        parsedMetaData.lastCompletedAt = new Date();
      }

      if (task.startAt !== null && task.recurrence !== null) {
        // When the job scheduler hasn't run for some time (e.g because of a downtime), we don't
        // want it to run all the missed executions one by one, but only to re-schedule tasks that
        // are in the future.
        const startAt = task.startAt.getTime();
        const recurrenceInMilliseconds = task.recurrence * 1000;
        const executionsToSkip = Math.ceil((Date.now() - startAt) / recurrenceInMilliseconds);
        const nextStartAt = new Date(startAt + executionsToSkip * recurrenceInMilliseconds);

        await this.databaseClient.create('tasks', await this.withAutomaticFields('tasks', {
          _runBy: null,
          _endedAt: null,
          _startedAt: null,
          _parent: task._id,
          _status: 'PENDING',
          job: job._id,
          startAfter: null,
          startAt: nextStartAt,
          recurrence: task.recurrence,
          metaData: JSON.stringify(parsedMetaData),
        }, { mode: 'CREATE' } as CommandContext & { mode: 'CREATE' | 'UPDATE'; }));
      } else {
        const childTask = await this.databaseClient.search('tasks', {
          filters: { _parent: task.startAfter as Id },
        });
        await this.databaseClient.create('tasks', await this.withAutomaticFields('tasks', {
          _runBy: null,
          _endedAt: null,
          _startedAt: null,
          _parent: task._id,
          _status: 'PENDING',
          job: job._id,
          startAt: null,
          recurrence: task.recurrence,
          startAfter: childTask.results[0]._id,
          metaData: JSON.stringify(parsedMetaData),
        }, { mode: 'CREATE' } as CommandContext & { mode: 'CREATE' | 'UPDATE'; }));
      }
    }
  }

  /**
   * Uploads logs file of `task` to a persistent storage.
   *
   * @param task Task for which to upload logs file.
   */
  protected async uploadLogs(task: Task): Promise<void> {
    try {
      const filePath = `${this.logsPath}${String(task._id)}.log`;
      await this.bucketClient.upload('text/x-log', `logs/${String(task._id)}.log`, createReadStream(filePath));
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error(`[JobScheduler][uploadLogs] Failed to upload logs for task with id "${String(task._id)}".`);
      this.logger.error(error);
    }
  }

  /**
   * Executes `task`.
   *
   * @param task Task to execute.
   */
  protected async executeTask(task: Task): Promise<void> {
    const job = task.job as Job;
    this.availableSlots -= job.requiredSlots;
    const splittedPath = job.scriptPath.split(' ');

    await new Promise<void>((resolve) => {
      const worker = new Worker(splittedPath[0], {
        workerData: { id: String(task._id), jobId: splittedPath[1], metaData: task.metaData },
      });

      // Registering the task here prevents "Cannot set properties of undefined (setting '_status')"
      // errors (sometimes worker exists so fast that the registry hasn't been updated yet
      // and thus reference to the task doesn't exist).
      this.tasksRegistry[String(task._id)] = { worker, _status: 'IN_PROGRESS' };

      worker.on('online', () => {
        this.logger.info(`[JobScheduler][executeTask] Successfully created new thread for task with id "${String(task._id)}".`);
        resolve();
      });

      worker.on('error', (error) => {
        this.logger.error(error);
        this.tasksRegistry[String(task._id)]._status = 'FAILED';
      });

      worker.on('exit', (code) => {
        this.logger.info(`[JobScheduler][executeTask] Thread for task with id "${String(task._id)}" exited with code ${code}.`);
        if (code === 0) {
          this.tasksRegistry[String(task._id)]._status = 'COMPLETED';
        } else if (code === 100) {
          this.tasksRegistry[String(task._id)]._status = 'CANCELED';
        } else {
          this.tasksRegistry[String(task._id)]._status = 'FAILED';
        }
        resolve();
      });
    });
  }

  /**
   * Closes `task`, performing all post-processing operations.
   *
   * @param task Task to close.
   *
   * @param status Status to update task with.
   */
  protected async closeTask(task: Task, status: Task['_status']): Promise<void> {
    // We use `exclusiveUpdate` here as we want to prevent several job schedulers from
    // re-scheduling the same periodic task.
    const taskWasUpdated = await this.databaseClient.exclusiveUpdate('tasks', {
      _status: 'IN_PROGRESS',
      _id: task._id,
    }, await this.withAutomaticFields('tasks', {
      _status: status,
      _endedAt: new Date(),
    }, { mode: 'UPDATE' } as CommandContext & { mode: 'CREATE' | 'UPDATE'; }));
    if (taskWasUpdated) {
      await this.reSchedulePeriodicTask(task, status === 'COMPLETED');
    }
    if (String(task._runBy) === String(this.instanceId)) {
      await this.uploadLogs(task);
      delete this.tasksRegistry[String(task._id)];
      this.availableSlots += (task.job as Job).requiredSlots;
    } else if (taskWasUpdated) {
      this.logger.error(`[JobScheduler][processRunningTasks] Task with id "${String(task._id)}" timed out more than a minute ago - jobs scheduler with id "${String(task._runBy)}" probably crashed.`);
    }
  }

  /**
   * Processes candidate pending tasks.
   */
  protected async processPendingTasks(): Promise<void> {
    this.logger.info('[JobScheduler][processPendingTasks] Processing pending tasks...');
    const pendingTasks = await this.databaseClient.getCandidatePendingTasks();

    await forEach(pendingTasks, async (task) => {
      // Task must be executed...
      if (task.startAt !== null || (task.startAfter !== null && (task.startAfter as Task)._status === 'COMPLETED')) {
        if (this.availableSlots < (task.job as Job).requiredSlots) {
          this.logger.info(`[JobScheduler][processPendingTasks] No available slot to run task "${String(task._id)}".`);
          return Promise.resolve();
        }
        const now = new Date();
        // We use `exclusiveUpdate` here as we want to prevent several job schedulers from running
        // the same task.
        const taskWasAssigned = await this.databaseClient.exclusiveUpdate('tasks', {
          _runBy: null,
          _id: task._id,
          _status: 'PENDING',
        }, {
          _startedAt: now,
          _updatedAt: now,
          _status: 'IN_PROGRESS',
          _runBy: this.instanceId,
        });
        if (taskWasAssigned) {
          this.logger.info(`[JobScheduler][processPendingTasks] Executing task with id "${String(task._id)}"...`);
          return this.executeTask(task);
        }
        return Promise.resolve();
      }

      // Task must be canceled...
      this.logger.warn(`[JobScheduler][processPendingTasks] Canceling task with id "${String(task._id)}" (related task failed or was canceled)...`);
      return this.databaseClient.update('tasks', task._id, await this.withAutomaticFields('tasks', {
        _status: 'CANCELED',
      }, { mode: 'UPDATE' } as CommandContext & { mode: 'CREATE' | 'UPDATE'; }));
    });
  }

  /**
   * Processes tasks in progress.
   */
  protected async processRunningTasks(): Promise<void> {
    this.logger.info('[JobScheduler][processRunningTasks] Processing running tasks...');
    const runningTasks = await this.databaseClient.getRunningTasks();

    await forEach(runningTasks, async (task) => {
      const job = task.job as Job;
      const now = Date.now();
      const startedAt = (task as { _startedAt: Date; })._startedAt;

      if (String(task._runBy) === String(this.instanceId)) {
        // Tasks timed out...
        if (startedAt.getTime() + (job.maximumExecutionTime * 1000) < now) {
          this.logger.error(`[JobScheduler][processRunningTasks] Task with id "${String(task._id)}" timed out.`);
          await this.tasksRegistry[String(task._id)].worker.terminate();
          return this.closeTask(task, 'FAILED');
        }

        // Task exited with an error...
        if (this.tasksRegistry[String(task._id)]._status === 'FAILED') {
          this.logger.error(`[JobScheduler][processRunningTasks] Task with id "${String(task._id)}" failed.`);
          return this.closeTask(task, 'FAILED');
        }

        // Task canceled itself...
        if (this.tasksRegistry[String(task._id)]._status === 'CANCELED') {
          this.logger.warn(`[JobScheduler][processRunningTasks] Task with id "${String(task._id)}" canceled itself.`);
          return this.closeTask(task, 'CANCELED');
        }

        // Task successfully ended...
        if (this.tasksRegistry[String(task._id)]._status === 'COMPLETED') {
          this.logger.info(`[JobScheduler][processRunningTasks] Task with id "${String(task._id)}" successfully ended.`);
          return this.closeTask(task, 'COMPLETED');
        }
      }

      // Task related job scheduler crashed...
      if ((startedAt.getTime() + ((job.maximumExecutionTime + 60) * 1000)) < now) {
        return this.closeTask(task, 'FAILED');
      }

      return undefined;
    });
  }

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
  ) {
    super(model, logger, databaseClient);
    this.tasksRegistry = {};
    this.jobs = settings.jobs;
    this.instanceId = new Id();
    this.bucketClient = bucketClient;
    this.logsPath = settings.logsPath;
    this.availableSlots = settings.availableSlots;
  }

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
  public static async runJob(
    jobs: JobSchedulerSettings['jobs'],
    logsPath: string,
    logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  ): Promise<void> {
    const jobWorkerData = workerData as JobWorkerData;
    const jobId = jobWorkerData?.jobId ?? process.argv[2];
    const taskId = jobWorkerData?.id ?? process.argv[3];
    const stringifiedMetaData = jobWorkerData?.metaData ?? process.argv[4] as string | undefined ?? '{}';
    const metaData = JSON.parse(stringifiedMetaData) as Record<string, unknown>;
    const profiler = new Profiler();
    const logger = new Logger({
      logLevel,
      prettyPrint: false,
      destination: pino.destination(`${logsPath}${taskId}.log`),
    });
    await logger.waitForReady();
    try {
      profiler.reset();
      if (typeof jobs[jobId] !== 'function') {
        throw new Error(`Job with id "${jobId}" does not exist.`);
      }
      await jobs[jobId](taskId, metaData, logger);
      logger.info(Profiler.formatMetrics(profiler.getMetrics()));
      await logger.close();
      process.exit(0);
    } catch (error) {
      logger.error(error);
      await logger.close();
      process.exit(1);
    }
  }

  /**
   * Executes job scheduler.
   */
  public async run(): Promise<void> {
    this.logger.info(`[JobScheduler][run] Executing main thread, ${this.availableSlots} slots available...`);
    await this.processPendingTasks();
    await this.processRunningTasks();
    setTimeout(this.run.bind(this) as unknown as () => void, 5000);
  }

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
  public async create<Collection extends keyof DataModel>(
    collection: Collection,
    payload: Payload<DataModel[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<DataModel[Collection]> {
    if (collection === 'tasks') {
      const newTask = await this.withAutomaticFields('tasks', {
        ...payload,
        _runBy: null,
        _parent: null,
        _endedAt: null,
        _startedAt: null,
        _status: 'PENDING',
      }, { mode: 'CREATE' } as CommandContext & { mode: 'CREATE' | 'UPDATE'; });
      await this.databaseClient.create('tasks', newTask);
      return this.view(collection, newTask._id, options);
    }

    return super.create(collection, payload, options, context);
  }
}
