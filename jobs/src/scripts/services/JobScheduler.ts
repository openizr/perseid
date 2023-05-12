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
  type WithoutAutomaticFields,
} from '@perseid/server';
import { pino } from 'pino';
import model from 'scripts/model/index';
import { Id, forEach } from '@perseid/core';
import { Worker, workerData } from 'worker_threads';
import { promises as fs, createReadStream } from 'fs';
import type DatabaseClient from 'scripts/services/DatabaseClient';

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
export default class JobScheduler extends Engine<DataModel, Model, DatabaseClient> {
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
  protected tasksRegistry: {
    [taskId: string]: {
      worker: Worker;
      _status: Task['_status'];
    }
  };

  /**
   * Schedules next execution for the given task, if it is periodic.
   *
   * @param task Task to re-schedule.
   *
   * @param taskCompleted Whether task successfully completed.
   */
  protected async reSchedulePeriodicTask(task: Task, taskCompleted: boolean): Promise<void> {
    if (task.recurrence === null && task.startAfter === null) {
      this.logger.info(`[JobScheduler][reSchedulePeriodicTask] Task with id "${task._id}" is not periodic, re-scheduling skipped.`);
    } else {
      const job = <Job>task.job;
      this.logger.info(`[JobScheduler][reSchedulePeriodicTask] Creating next recurrence for task with id "${task._id}"...`);

      const parsedMetaData = JSON.parse(task.metaData);
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

        await this.databaseClient.create('tasks', {
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
          ...this.generateAutomaticFields('tasks', {} as unknown as CommandContext),
        });
      } else {
        const childTask = await this.databaseClient.search('tasks', {
          filters: { _parent: task.startAfter },
        });
        await this.databaseClient.create('tasks', {
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
          ...this.generateAutomaticFields('tasks', {} as unknown as CommandContext),
        });
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
      const filePath = `${this.logsPath}${task._id}.log`;
      await this.bucketClient.upload('text/x-log', `logs/${task._id}.log`, createReadStream(filePath));
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error(`[JobScheduler][uploadLogs] Failed to upload logs for task with id "${task._id}".`);
      this.logger.error(error);
    }
  }

  /**
   * Executes `task`.
   *
   * @param task Task to execute.
   */
  protected async executeTask(task: Task): Promise<void> {
    const job = <Job>task.job;
    this.availableSlots -= job.requiredSlots;
    const splittedPath = job.scriptPath.split(' ');

    await new Promise<void>((resolve) => {
      const worker = new Worker(splittedPath[0], {
        workerData: { id: `${task._id}`, jobId: splittedPath[1], metaData: task.metaData },
      });

      worker.on('online', () => {
        this.logger.info(`[JobScheduler][executeTask] Successfully created new thread for task with id "${task._id}".`);
        resolve();
      });

      worker.on('error', (error) => {
        this.logger.error(error);
        this.tasksRegistry[`${task._id}`]._status = 'FAILED';
      });

      worker.on('exit', (code) => {
        this.logger.info(`[JobScheduler][executeTask] Thread for task with id "${task._id}" exited with code ${code}.`);
        if (code === 0) {
          this.tasksRegistry[`${task._id}`]._status = 'COMPLETED';
        } else if (code === 100) {
          this.tasksRegistry[`${task._id}`]._status = 'CANCELED';
        } else {
          this.tasksRegistry[`${task._id}`]._status = 'FAILED';
        }
        resolve();
      });

      this.tasksRegistry[`${task._id}`] = { worker, _status: 'IN_PROGRESS' };
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
    }, {
      _status: status,
      _endedAt: new Date(),
      ...this.generateAutomaticFields('tasks', {} as unknown as CommandContext, true),
    });
    if (taskWasUpdated) {
      await this.reSchedulePeriodicTask(task, status === 'COMPLETED');
    }
    if (`${task._runBy}` === `${this.instanceId}`) {
      this.uploadLogs(task); // No `await` here, we don't want logs uploading to block execution.
      delete this.tasksRegistry[`${task._id}`];
      this.availableSlots += (<Job>task.job).requiredSlots;
    } else if (taskWasUpdated) {
      this.logger.error(`[JobScheduler][processRunningTasks] Task with id "${task._id}" timed out more than a minute ago - jobs scheduler with id "${task._runBy}" probably crashed.`);
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
      if (task.startAt !== null || (task.startAfter !== null && (<Task>task.startAfter)._status === 'COMPLETED')) {
        if (this.availableSlots < (<Job>task.job).requiredSlots) {
          this.logger.info(`[JobScheduler][processPendingTasks] No available slot to run task "${task._id}".`);
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
          this.logger.info(`[JobScheduler][processPendingTasks] Executing task with id "${task._id}"...`);
          return this.executeTask(task);
        }
        return Promise.resolve();
      }

      // Task must be canceled...
      this.logger.warn(`[JobScheduler][processPendingTasks] Canceling task with id "${task._id}" (related task failed or was canceled)...`);
      return this.databaseClient.update('tasks', task._id, {
        _status: 'CANCELED',
        ...this.generateAutomaticFields('tasks', {} as unknown as CommandContext, true),
      });
    });
  }

  /**
   * Processes tasks in progress.
   */
  protected async processRunningTasks(): Promise<void> {
    this.logger.info('[JobScheduler][processRunningTasks] Processing running tasks...');
    const runningTasks = await this.databaseClient.getRunningTasks();

    await forEach(runningTasks, async (task) => {
      const job = <Job>task.job;
      const now = Date.now();
      const startedAt = <Date>task._startedAt;

      if (`${task._runBy}` === `${this.instanceId}`) {
        // Tasks timed out...
        if (startedAt.getTime() + (job.maximumExecutionTime * 1000) < now) {
          this.logger.error(`[JobScheduler][processRunningTasks] Task with id "${task._id}" timed out.`);
          this.tasksRegistry[`${task._id}`].worker.terminate();
          return this.closeTask(task, 'FAILED');
        }

        // Task exited with an error...
        if (this.tasksRegistry[`${task._id}`]._status === 'FAILED') {
          this.logger.error(`[JobScheduler][processRunningTasks] Task with id "${task._id}" failed.`);
          return this.closeTask(task, 'FAILED');
        }

        // Task canceled itself...
        if (this.tasksRegistry[`${task._id}`]._status === 'CANCELED') {
          this.logger.warn(`[JobScheduler][processRunningTasks] Task with id "${task._id}" canceled itself.`);
          return this.closeTask(task, 'CANCELED');
        }

        // Task successfully ended...
        if (this.tasksRegistry[`${task._id}`]._status === 'COMPLETED') {
          this.logger.info(`[JobScheduler][processRunningTasks] Task with id "${task._id}" successfully ended.`);
          return this.closeTask(task, 'COMPLETED');
        }
      }

      // Task related job scheduler crashed...
      if ((startedAt.getTime() + ((job.maximumExecutionTime + 60) * 1000)) < now) {
        return this.closeTask(task, 'FAILED');
      }

      // Task is still running or is not run by this job scheduler...
      return Promise.resolve();
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
   * @param logsLevel Minimum logging level (all logs below that level won't be logs).
   */
  public static async runJob(
    jobs: JobSchedulerSettings['jobs'],
    logsPath: string,
    logsLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  ): Promise<void> {
    const jobId = workerData?.jobId ?? process.argv[2];
    const taskId = workerData?.id ?? process.argv[3];
    const metaData = JSON.parse(workerData?.metaData ?? process.argv[4] ?? '{}');
    const profiler = new Profiler();
    const logger = new Logger({
      prettyPrint: false,
      logLevel: logsLevel,
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
      logger.close();
      process.exit(0);
    } catch (error) {
      logger.error(error);
      logger.close();
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
    setTimeout(this.run.bind(this), 5000);
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
  public async create<U extends keyof DataModel>(
    collection: U,
    payload: WithoutAutomaticFields<DataModel[U]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<DataModel[U]> {
    if (collection === 'tasks') {
      const newTask: Task = {
        _runBy: null,
        _parent: null,
        _endedAt: null,
        _startedAt: null,
        _status: 'PENDING',
        ...payload as WithoutAutomaticFields<Task>,
        ...this.generateAutomaticFields('tasks', {} as unknown as CommandContext),
      };
      await this.databaseClient.create('tasks', newTask);
      return this.view(collection, newTask._id as Id, options);
    }

    return super.create(collection, payload, options, context);
  }
}
