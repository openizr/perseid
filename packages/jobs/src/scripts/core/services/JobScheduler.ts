/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Engine,
  Telemetry,
  EngineError,
  type CommandContext,
  type CreatePayload,
} from '@perseid/server';
import type {
  JobScript,
  JobMetadata,
  JobsDataModel,
  FullRunningTask,
  FullPendingTask,
} from 'scripts/core/types';
import model from 'scripts/core/model/index';
import { Worker, workerData } from 'worker_threads';
import type { Attributes } from '@opentelemetry/api';
import { Id, forEach, type Ids } from '@perseid/core';
import type DatabaseClient from 'scripts/core/services/DatabaseClient';

/**
 * Metadata passed to each running job.
 */
export type JobWorkerData = {
  /**
   * Task id.
   */
  id: string | undefined;

  /**
   * Job id.
   */
  jobId: string | undefined;

  /**
   * Task metadata.
   */
  metadata: string | undefined;
} | undefined;

/**
 * Registered task.
 */
export interface RegisteredTask {
  /**
   * Worker instance.
   */
  worker: Worker;

  /**
   * Task status.
   */
  _status: JobsDataModel['tasks']['_status'];
}

/**
 * Job scheduler settings.
 */
export interface JobSchedulerSettings {
  /**
   * Amount of initially available slots for that scheduler to run jobs.
   */
  availableSlots: number;

  /**
   * List of jobs to register.
   */
  jobs: Record<string, JobScript>;
}

/**
 * Handles tasks lifecycle.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/jobs/src/scripts/core/services/JobScheduler.ts
 */
export default class JobScheduler extends Engine<
  JobsDataModel,
  Record<string, Ids>,
  DatabaseClient
> {
  /**
   * Interval between two executions of the job scheduler, in milliseconds.
   * Defaults to 5000 milliseconds.
   */
  protected EXECUTION_INTERVAL: number;

  /**
   * Default attributes to inject in all telemetry spans.
   */
  protected DEFAULT_ATTRIBUTES: Attributes = {
    'code.class.name': 'JobScheduler',
  };

  /**
   * Job scheduler instance unique id.
   */
  protected instanceId: Id;

  /**
  * Amount of initially available slots for that scheduler to run jobs.
  */
  protected availableSlots: number;

  /**
  * List of registered jobs.
  */
  protected jobs: Record<string, JobScript>;

  /**
  * Running tasks registry.
  */
  protected tasksRegistry: Map<string, RegisteredTask>;

  /**
   * In addition to `prepareCreatePayload` base behaviour, updates create payload for jobs-related
   * resources.
   */
  protected async prepareCreatePayload<Resource extends keyof JobsDataModel>(
    resource: Resource,
    payload: CreatePayload<JobsDataModel[Resource]>,
    context: CommandContext<JobsDataModel>,
  ): Promise<JobsDataModel[Resource]> {
    const updatedPayload = await super.prepareCreatePayload(resource, payload, context);

    if (this.isResourceCreatePayload(resource, 'tasks', updatedPayload)) {
      updatedPayload._runBy = null;
      updatedPayload._parent = null;
      updatedPayload._endedAt = null;
      updatedPayload._startedAt = null;
      updatedPayload._status = 'PENDING';
    }

    return updatedPayload;
  }

  /**
   * Schedules next execution for the given task, if it is periodic.
   *
   * @param task Task to re-schedule.
   *
   * @param taskCompleted Whether task successfully completed.
   */
  protected async reSchedulePeriodicTask(
    task: FullRunningTask,
    taskCompleted: boolean,
  ): Promise<void> {
    const taskId = String(task._id);
    if (task.recurrence === null && task.startAfter === null) {
      this.telemetry.info('Task is not periodic, re-scheduling skipped.', { taskId });
    } else {
      this.telemetry.info('Creating next recurrence for task...', { taskId });

      const parsedMetadata = JSON.parse(task.metadata) as { lastCompletedAt: Date; };
      if (taskCompleted) {
        parsedMetadata.lastCompletedAt = new Date();
      }

      if (task.startAt !== null && task.recurrence !== null) {
        // When the job scheduler hasn't run for some time (e.g because of a downtime), we don't
        // want it to run all the missed executions one by one, but only to re-schedule tasks that
        // are in the future.
        const startAt = task.startAt.getTime();
        const recurrenceInMilliseconds = task.recurrence * 1000;
        const executionsToSkip = Math.ceil((Date.now() - startAt) / recurrenceInMilliseconds);
        const nextStartAt = new Date(startAt + executionsToSkip * recurrenceInMilliseconds);

        await this.databaseClient.create('tasks', await this.prepareCreatePayload('tasks', {
          job: task.job._id,
          startAfter: null,
          startAt: nextStartAt,
          recurrence: task.recurrence,
          metadata: JSON.stringify(parsedMetadata),
        }, {}));
      } else {
        const childTask = await this.databaseClient.list('tasks', {
          query: null,
          filters: { _parent: task.startAfter?._id ?? null },
        });
        await this.databaseClient.create('tasks', await this.prepareCreatePayload('tasks', {
          job: task.job._id,
          startAt: null,
          recurrence: task.recurrence,
          startAfter: childTask.results[0]._id,
          metadata: JSON.stringify(parsedMetadata),
        }, {}));
      }
    }
  }

  /**
   * Executes `task`.
   *
   * @param task Task to execute.
   */
  protected async executeTask(task: FullPendingTask): Promise<void> {
    // TODO remove this span once the telemetry.getSpan method is implemented.
    return this.telemetry.span('executeTask', {
      attributes: {
        ...this.DEFAULT_ATTRIBUTES,
        taskId: String(task._id),
      },
    }, async (span) => {
      const key = String(task._id);
      this.availableSlots -= task.job.requiredSlots;
      const splittedPath = task.job.scriptPath.split(' ');

      await new Promise<void>((resolve) => {
        const metadata = JSON.parse(task.metadata) as Record<string, unknown>;
        const { traceId, spanId, ...rest } = span.getContext();
        const worker = new Worker(splittedPath[0], {
          workerData: {
            id: key,
            jobId: splittedPath[1],
            metadata: JSON.stringify({
              ...metadata,
              traceState: rest.traceState,
              traceParent: { traceId, spanId, traceFlags: rest.traceFlags },
            }),
          },
        });

        // Registering task here prevents "Cannot set properties of undefined (setting '_status')"
        // errors (sometimes worker exists so fast that the registry hasn't been updated yet
        // and thus reference to the task doesn't exist).
        const registeredTask: RegisteredTask = { worker, _status: 'IN_PROGRESS' };
        this.tasksRegistry.set(key, registeredTask);

        worker.on('online', () => {
          this.telemetry.info('Successfully created new thread.', { taskId: key });
          resolve();
        });

        worker.on('error', (error) => {
          this.telemetry.error(error);
          registeredTask._status = 'FAILED';
        });

        worker.on('exit', (code) => {
          this.telemetry.info('Thread exited.', { taskId: key, exitCode: code });
          if (code === 0) {
            registeredTask._status = 'COMPLETED';
          } else if (code === 100) {
            registeredTask._status = 'CANCELED';
          } else {
            registeredTask._status = 'FAILED';
          }
          resolve();
        });
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
  protected async closeTask(
    task: FullRunningTask,
    status: FullRunningTask['_status'],
  ): Promise<void> {
    const taskId = String(task._id);
    // We use `updateMatchingTask` here as we want to prevent several job schedulers from
    // re-scheduling the same periodic task.
    const taskWasUpdated = await this.databaseClient.updateMatchingTask({
      _status: 'IN_PROGRESS',
      _id: String(task._id),
    }, {
      ...await this.prepareUpdatePayload('tasks', {}, {}),
      _status: status,
      _endedAt: new Date(),
    });
    if (taskWasUpdated && status !== 'CANCELED') {
      await this.reSchedulePeriodicTask(task, status === 'COMPLETED');
    }
    if (String(task._runBy) === String(this.instanceId)) {
      this.tasksRegistry.delete(String(task._id));
      this.availableSlots += task.job.requiredSlots;
    } else if (taskWasUpdated) {
      this.telemetry.error('Task timed out more than a minute ago - jobs scheduler probably crashed.', {
        taskId,
        runBy: String(task._runBy),
      });
    }
  }

  /**
   * Processes candidate pending tasks.
   */
  protected async processPendingTasks(): Promise<void> {
    const pendingTasks = await this.databaseClient.getCandidatePendingTasks();

    await forEach(pendingTasks, async (task) => {
      const taskId = String(task._id);

      // Task must be executed...
      if (
        task.startAt !== null
          || task.startAfter?._status === 'COMPLETED'
      ) {
        if (this.availableSlots < task.job.requiredSlots) {
          this.telemetry.info('No available slot to run task.', { taskId });
          return Promise.resolve();
        }

        // We use `updateMatchingTask` here as we want to prevent several job schedulers from
        // running the same task.
        const taskWasAssigned = await this.databaseClient.updateMatchingTask({
          _runBy: null,
          _id: String(task._id),
          _status: 'PENDING',
        }, {
          ...await this.prepareUpdatePayload('tasks', {}, {}),
          _status: 'IN_PROGRESS',
          _runBy: this.instanceId,
          _startedAt: new Date(),
        });
        if (taskWasAssigned) {
          this.telemetry.info('Executing task...', { taskId });
          return this.executeTask(task);
        }
        return Promise.resolve();
      }

      // Task must be canceled...
      this.telemetry.warn('Canceling task (related task failed or was canceled)...', { taskId });
      await this.databaseClient.update('tasks', task._id, {
        ...await this.prepareUpdatePayload('tasks', {}, {}),
        _status: 'CANCELED',
      });
      return Promise.resolve();
    });
  }

  /**
   * Processes tasks in progress.
   */
  protected async processRunningTasks(): Promise<void> {
    const runningTasks = await this.databaseClient.getRunningTasks();

    await forEach(runningTasks, async (task) => {
      const { job } = task;
      const now = Date.now();
      const taskId = String(task._id);
      const registeredTask = this.tasksRegistry.get(String(task._id));

      if (String(task._runBy) === String(this.instanceId) && registeredTask !== undefined) {
        // Task timed out...
        if (task._startedAt.getTime() + (job.maximumExecutionTime * 1000) < now) {
          this.telemetry.error('Task timed out.', { taskId });
          // This race prevents the process from hanging indefinitely if the worker doesn't
          // terminate gracefully.
          await Promise.race([
            new Promise((resolve) => { setTimeout(resolve, 10 * 1000); }).then(() => {
              this.telemetry.error('Failed to terminate task worker.', { taskId });
            }),
            registeredTask.worker.terminate(),
          ]);
          return this.closeTask(task, 'FAILED');
        }

        // Task exited with an error...
        if (registeredTask._status === 'FAILED') {
          this.telemetry.error('Task failed.', { taskId });
          return this.closeTask(task, 'FAILED');
        }

        // Task canceled itself...
        if (registeredTask._status === 'CANCELED') {
          this.telemetry.warn('Task canceled itself.', { taskId });
          return this.closeTask(task, 'CANCELED');
        }

        // Task successfully ended...
        if (registeredTask._status === 'COMPLETED') {
          this.telemetry.info('Task successfully ended.', { taskId });
          return this.closeTask(task, 'COMPLETED');
        }
      }

      // Task related job scheduler crashed...
      if ((task._startedAt.getTime() + ((job.maximumExecutionTime + 60) * 1000)) < now) {
        return this.closeTask(task, 'FAILED');
      }

      return undefined;
    });
  }

  /**
   * Class constructor.
   *
   * @param telemetry Telemetry instance to use.
   *
   * @param databaseClient DatabaseClient instance to use.
   *
   * @param settings Jobs scheduler settings.
   */
  public constructor(
    telemetry: Telemetry,
    databaseClient: DatabaseClient,
    settings: JobSchedulerSettings,
  ) {
    super(model, telemetry, databaseClient);
    this.jobs = settings.jobs;
    this.instanceId = new Id();
    this.EXECUTION_INTERVAL = 5000;
    this.tasksRegistry = new Map();
    this.availableSlots = settings.availableSlots;
  }

  /**
   * Runs the task passed as a command line argument to the script. This method is meant to be
   * called in its own dedicated script, and should not be mixed up with `run`.
   *
   * @throws If task related job does not exist.
   */
  public async runTask(): Promise<void> {
    const jobWorkerData = workerData as JobWorkerData;
    const jobId = jobWorkerData?.jobId ?? process.argv[2];
    const taskId = new Id(jobWorkerData?.id ?? process.argv[3]);
    const stringifiedMetadata = jobWorkerData?.metadata ?? process.argv[4] as string | null ?? '{}';
    const parsedMetadata = JSON.parse(stringifiedMetadata) as {
      lastCompletedAt?: string;
      traceState?: Record<string, string>;
      traceParent?: { traceId: string; spanId: string; traceFlags: number; };
    };

    return this.telemetry.span('runTask', {
      links: (parsedMetadata.traceParent === undefined) ? [] : [{
        context: {
          spanId: parsedMetadata.traceParent.spanId,
          traceId: parsedMetadata.traceParent.traceId,
          traceFlags: parsedMetadata.traceParent.traceFlags,
        },
      }],
      attributes: {
        ...this.DEFAULT_ATTRIBUTES,
        jobId,
        taskId: String(taskId),
        instanceId: String(this.instanceId),
      },
    }, async () => {
      const metadata: JobMetadata = Object.assign(parsedMetadata, {
        lastCompletedAt: (parsedMetadata.lastCompletedAt !== undefined)
          ? new Date(parsedMetadata.lastCompletedAt)
          : null,
      });

      if (typeof this.jobs[jobId] !== 'function') {
        throw new EngineError('NO_RESOURCE', { id: new Id(jobId) });
      }
      return this.jobs[jobId](taskId, metadata);
    });
  }

  /**
   * Executes job scheduler.
   */
  public async run(): Promise<void> {
    await this.telemetry.span('run', {
      attributes: {
        ...this.DEFAULT_ATTRIBUTES,
        instanceId: String(this.instanceId),
        availableSlots: this.availableSlots,
      },
    }, async () => {
      await this.processPendingTasks();
      await this.processRunningTasks();
    });

    await new Promise((resolve) => { setTimeout(resolve, this.EXECUTION_INTERVAL); });

    return this.run();
  }

  /**
   * In addition to `create` base behaviour, updates create payload for jobs-related resources.
   */
  public async create<
    Key extends keyof Record<string, Ids>,
    Resource extends keyof JobsDataModel = keyof JobsDataModel
  >(
    resource: Resource,
    payload: CreatePayload<JobsDataModel[Resource]>,
    context: CommandContext<JobsDataModel>,
  ): Promise<Key extends keyof Record<string, Ids> ? Record<string, Ids>[Key] : Ids> {
    if (resource === 'tasks') {
      return super.create(resource, {
        ...payload,
        _runBy: null,
        _parent: null,
        _endedAt: null,
        _startedAt: null,
        _status: 'PENDING',
      }, context);
    }

    return super.create(resource, payload, context);
  }
}
