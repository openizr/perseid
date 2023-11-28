/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Logger,
  Profiler,
  CacheClient,
  BucketClient,
  type CommandContext,
} from '@perseid/server';
import { Id } from '@perseid/core';
import { promises as fs } from 'fs';
import { Worker } from 'worker_threads';
import JobScheduler from 'scripts/services/JobScheduler';
import DatabaseClient from 'scripts/services/DatabaseClient';

type TestJobScheduler = JobScheduler & {
  availableSlots: number;
  tasksRegistry: unknown;
  closeTask: () => Promise<void>;
  processRunningTasks: () => Promise<void>;
  processPendingTasks: () => Promise<void>;
  uploadLogs: (task: Task) => Promise<void>;
  executeTask: (task: Task) => Promise<void>;
  reSchedulePeriodicTask: (task: Task, taskIsCompleted: boolean) => Promise<void>;
};

describe('services/JobScheduler', () => {
  vi.mock('fs');
  vi.mock('pino');
  vi.mock('@perseid/core');
  vi.mock('worker_threads');
  vi.mock('@perseid/server');
  vi.mock('scripts/model/index');
  vi.mock('scripts/services/DatabaseClient');

  const jobScript = vi.fn();
  const cache = new CacheClient({ cachePath: '/var/www/html/.cache' });
  const logger = new Logger({ logLevel: 'debug', prettyPrint: false });
  const bucketClient = new BucketClient(logger);
  const databaseClient = new DatabaseClient(logger, cache, {
    protocol: '',
    host: '',
    port: null,
    user: null,
    password: null,
    database: '',
    maxPoolSize: 0,
    queueLimit: 0,
    cacheDuration: 0,
    connectTimeout: 0,
    connectionLimit: 0,
  });
  let jobScheduler: JobScheduler;
  const job = {
    _id: new Id('626adcd0bfffbd0fec9e1465'),
    _createdAt: new Date(),
    _updatedAt: null,
    requiredSlots: 512,
    maximumExecutionTime: 60,
    scriptPath: '/var/www/html/test.js',
  };
  const task: Task = {
    _id: new Id('626adcd0bfffbd0fec9e1464'),
    _runBy: new Id(),
    _createdAt: new Date(),
    _endedAt: new Date(),
    _startedAt: new Date(),
    _status: 'PENDING',
    _updatedAt: null,
    job,
    metaData: '{}',
    recurrence: null,
    startAt: null,
    _parent: null,
    startAfter: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2022, 0, 1));
    delete process.env.NO_TASK;
    delete process.env.FS_ERROR;
    jobScheduler = new JobScheduler(logger, databaseClient, bucketClient, {
      availableSlots: 1024,
      logsPath: '/logs/',
      jobs: { test: jobScript },
    });
  });

  test('[reSchedulePeriodicTask] no recurrence', async () => {
    await (jobScheduler as TestJobScheduler).reSchedulePeriodicTask(task, true);
    expect(databaseClient.create).not.toHaveBeenCalled();
    expect(databaseClient.search).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][reSchedulePeriodicTask] Task with id "626adcd0bfffbd0fec9e1464" is not periodic, re-scheduling skipped.');
  });

  test('[reSchedulePeriodicTask] recurrence and fixed starting time', async () => {
    await (jobScheduler as TestJobScheduler).reSchedulePeriodicTask({
      ...task,
      startAt: new Date(),
      recurrence: 3600,
    }, true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][reSchedulePeriodicTask] Creating next recurrence for task with id "626adcd0bfffbd0fec9e1464"...');
    expect(databaseClient.search).not.toHaveBeenCalled();
    expect(databaseClient.create).toHaveBeenCalledTimes(1);
    expect(databaseClient.create).toHaveBeenCalledWith('tasks', {
      _runBy: null,
      _endedAt: null,
      _parent: new Id('626adcd0bfffbd0fec9e1464'),
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: new Date('2022-01-01T00:00:00.000Z'),
      job: new Id('626adcd0bfffbd0fec9e1465'),
      startAt: new Date('2022-01-01T00:00:00.000Z'),
      startAfter: null,
      metaData: '{"lastCompletedAt":"2022-01-01T00:00:00.000Z"}',
      recurrence: 3600,
    });
  });

  test('[reSchedulePeriodicTask] recurrence and dependency to another task', async () => {
    const startAfter = new Id('626adcd0bfffbd0fec9e1463');
    await (jobScheduler as TestJobScheduler).reSchedulePeriodicTask({ ...task, startAfter }, true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][reSchedulePeriodicTask] Creating next recurrence for task with id "626adcd0bfffbd0fec9e1464"...');
    expect(databaseClient.create).toHaveBeenCalledTimes(1);
    expect(databaseClient.search).toHaveBeenCalledTimes(1);
    expect(databaseClient.search).toHaveBeenCalledWith('tasks', { filters: { _parent: startAfter } });
    expect(databaseClient.create).toHaveBeenCalledWith('tasks', {
      _runBy: null,
      _endedAt: null,
      _parent: new Id('626adcd0bfffbd0fec9e1464'),
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: new Date('2022-01-01T00:00:00.000Z'),
      job: new Id('626adcd0bfffbd0fec9e1465'),
      startAt: null,
      startAfter: new Id('626adcd0bfffbd0fec9e1467'),
      metaData: '{"lastCompletedAt":"2022-01-01T00:00:00.000Z"}',
      recurrence: null,
    });
  });

  test('[uploadLogs] file exists', async () => {
    await (jobScheduler as TestJobScheduler).uploadLogs(task);
    expect(bucketClient.upload).toHaveBeenCalledTimes(1);
    expect(bucketClient.upload).toHaveBeenCalledWith(
      'text/x-log',
      'logs/626adcd0bfffbd0fec9e1464.log',
      '/logs/626adcd0bfffbd0fec9e1464.log',
    );
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledWith('/logs/626adcd0bfffbd0fec9e1464.log');
  });

  test('[uploadLogs] file does not exist', async () => {
    process.env.FS_ERROR = 'true';
    await (jobScheduler as TestJobScheduler).uploadLogs(task);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('[JobScheduler][uploadLogs] Failed to upload logs for task with id "626adcd0bfffbd0fec9e1464".');
    expect(logger.error).toHaveBeenCalledWith(new Error('FS_ERROR'));
  });

  test('[executeTask] exit code 0', async () => {
    const taskId = new Id('626adcd0bfffbd0fec9e1664');
    const promise = (jobScheduler as TestJobScheduler).executeTask({ ...task, _id: taskId });
    vi.runAllTimersAsync().catch(() => null);
    await promise;
    expect((jobScheduler as TestJobScheduler).availableSlots).toBe(512);
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Successfully created new thread for task with id "626adcd0bfffbd0fec9e1664".');
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Thread for task with id "626adcd0bfffbd0fec9e1664" exited with code 0.');
  });

  test('[executeTask] exit code 100', async () => {
    const taskId = new Id('626adcd0bfffbd0fec9e1668');
    const promise = (jobScheduler as TestJobScheduler).executeTask({ ...task, _id: taskId });
    vi.runAllTimersAsync().catch(() => null);
    await promise;
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Successfully created new thread for task with id "626adcd0bfffbd0fec9e1668".');
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Thread for task with id "626adcd0bfffbd0fec9e1668" exited with code 100.');
  });

  test('[executeTask] exit code 1', async () => {
    const taskId = new Id('626adcd0bfffbd0fec9e1666');
    const promise = (jobScheduler as TestJobScheduler).executeTask({ ...task, _id: taskId });
    vi.runAllTimersAsync().catch(() => null);
    await promise;
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Successfully created new thread for task with id "626adcd0bfffbd0fec9e1666".');
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Thread for task with id "626adcd0bfffbd0fec9e1666" exited with code 1.');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(new Error('Test'));
  });

  test('[closeTask] job scheduler own task', async () => {
    const uploadLogs = vi.fn();
    const reSchedule = vi.fn();
    (jobScheduler as TestJobScheduler).availableSlots = 512;
    const newTask = { ...task, _id: new Id('626adcd0bfffbd0fec9e1467') };
    vi.spyOn(jobScheduler as TestJobScheduler, 'uploadLogs').mockImplementation(uploadLogs);
    vi.spyOn(jobScheduler as TestJobScheduler, 'reSchedulePeriodicTask').mockImplementation(reSchedule);
    await (jobScheduler as TestJobScheduler).closeTask(newTask, 'FAILED');
    expect((jobScheduler as TestJobScheduler).availableSlots).toBe(1024);
    expect(reSchedule).toHaveBeenCalledTimes(1);
    expect(reSchedule).toHaveBeenCalledWith(newTask, false);
    expect(uploadLogs).toHaveBeenCalledTimes(1);
    expect(uploadLogs).toHaveBeenCalledWith(newTask);
    expect(databaseClient.exclusiveUpdate).toHaveBeenCalledTimes(1);
    expect(databaseClient.exclusiveUpdate).toHaveBeenCalledWith('tasks', {
      _status: 'IN_PROGRESS',
      _id: new Id('626adcd0bfffbd0fec9e1467'),
    }, {
      _status: 'FAILED',
      _endedAt: new Date(),
      _updatedAt: new Date(),
    });
  });

  test('[closeTask] crashed job scheduler task', async () => {
    const uploadLogs = vi.fn();
    const reSchedule = vi.fn();
    (jobScheduler as TestJobScheduler).availableSlots = 512;
    const newTask = {
      ...task,
      _id: new Id('626adcd0bfffbd0fec9e1467'),
      _runBy: new Id('626adcd0bfffbd0fec977777'),
    };
    vi.spyOn(jobScheduler as TestJobScheduler, 'uploadLogs').mockImplementation(uploadLogs);
    vi.spyOn(jobScheduler as TestJobScheduler, 'reSchedulePeriodicTask').mockImplementation(reSchedule);
    await (jobScheduler as TestJobScheduler).closeTask(newTask, 'FAILED');
    expect((jobScheduler as TestJobScheduler).availableSlots).toBe(512);
    expect(reSchedule).toHaveBeenCalledTimes(1);
    expect(reSchedule).toHaveBeenCalledWith(newTask, false);
    expect(uploadLogs).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      '[JobScheduler][processRunningTasks] Task with id "626adcd0bfffbd0fec9e1467" timed out more '
      + 'than a minute ago - jobs scheduler with id "626adcd0bfffbd0fec977777" probably crashed.',
    );
    expect(databaseClient.exclusiveUpdate).toHaveBeenCalledTimes(1);
    expect(databaseClient.exclusiveUpdate).toHaveBeenCalledWith('tasks', {
      _status: 'IN_PROGRESS',
      _id: new Id('626adcd0bfffbd0fec9e1467'),
    }, {
      _status: 'FAILED',
      _endedAt: new Date(),
      _updatedAt: new Date(),
    });
  });

  test('[runJob] no error', async () => {
    Object.assign(process, { argv: [null, null, 'test', '632cdbdf71bc1db513a0c8e5'] });
    vi.spyOn(process, 'exit').mockImplementation((code: number | undefined) => code as unknown as never);
    vi.clearAllMocks();
    const NewJobScheduler = (await import('scripts/services/JobScheduler')).default;
    await NewJobScheduler.runJob({ test: jobScript }, '/logs/', 'info');
    expect(logger.waitForReady).toHaveBeenCalledTimes(1);
    expect(jobScript).toHaveBeenCalledTimes(1);
    expect(jobScript).toHaveBeenCalledWith('632cdbdf71bc1db513a0c8e5', {}, expect.any(Logger));
    expect(logger.close).toHaveBeenCalledTimes(1);
    expect(Profiler.formatMetrics).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  test('[runJob] job error', async () => {
    Object.assign(process, { argv: [null, null, 'unknown', '632cdbdf71bc1db513a0c8e5'] });
    vi.spyOn(process, 'exit').mockImplementation((code: number | undefined) => code as unknown as never);
    vi.clearAllMocks();
    const NewJobScheduler = (await import('scripts/services/JobScheduler')).default;
    await NewJobScheduler.runJob({ test: jobScript }, '/logs/', 'info');
    expect(logger.waitForReady).toHaveBeenCalledTimes(1);
    expect(jobScript).not.toHaveBeenCalled();
    expect(logger.close).toHaveBeenCalledTimes(1);
    expect(Profiler.formatMetrics).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('[run]', async () => {
    process.env.NO_TASK = 'true';
    const processPendingTasks = vi.fn();
    const processRunningTasks = vi.fn();
    vi.spyOn(global, 'setTimeout');
    vi.spyOn(jobScheduler as TestJobScheduler, 'processPendingTasks').mockImplementation(processPendingTasks);
    vi.spyOn(jobScheduler as TestJobScheduler, 'processRunningTasks').mockImplementation(processRunningTasks);
    await jobScheduler.run();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][run] Executing main thread, 1024 slots available...');
    expect((jobScheduler as TestJobScheduler).processPendingTasks).toHaveBeenCalledTimes(1);
    expect((jobScheduler as TestJobScheduler).processRunningTasks).toHaveBeenCalledTimes(1);
    expect((jobScheduler as TestJobScheduler).availableSlots).toBe(1024);
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  });

  test('[processPendingTasks] slots available', async () => {
    const promise = (jobScheduler as TestJobScheduler).processPendingTasks();
    vi.runAllTimersAsync().catch(() => null);
    await promise;
    expect(logger.info).toHaveBeenCalledTimes(4);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] Processing pending tasks...');
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] Executing task with id "626adcd0bfffbd0fec9e1467"...');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] Canceling task with id "626adcd0bfffbd0fec9e1469" (related task failed or was canceled)...');
    expect(databaseClient.getCandidatePendingTasks).toHaveBeenCalledTimes(1);
    expect(databaseClient.exclusiveUpdate).toHaveBeenCalledTimes(2);
    expect(databaseClient.exclusiveUpdate).toHaveBeenCalledWith('tasks', {
      _runBy: null,
      _id: new Id('626adcd0bfffbd0fec9e1467'),
      _status: 'PENDING',
    }, {
      _runBy: new Id(),
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: new Date(),
    });
    expect(databaseClient.exclusiveUpdate).toHaveBeenCalledWith('tasks', {
      _runBy: null,
      _id: new Id('626adcd0bfffbd0fec9e1468'),
      _status: 'PENDING',
    }, {
      _runBy: new Id(),
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: new Date(),
    });
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('tasks', new Id('626adcd0bfffbd0fec9e1469'), {
      _status: 'CANCELED',
      _updatedAt: new Date('2022-01-01T00:00:00.000Z'),
    });
  });

  test('[processPendingTasks] no slot available', async () => {
    (jobScheduler as TestJobScheduler).availableSlots = 256;
    await (jobScheduler as TestJobScheduler).processPendingTasks();
    expect(logger.info).toHaveBeenCalledTimes(3);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] Processing pending tasks...');
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] No available slot to run task "626adcd0bfffbd0fec9e1467".');
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('tasks', new Id('626adcd0bfffbd0fec9e1469'), {
      _status: 'CANCELED',
      _updatedAt: new Date('2022-01-01T00:00:00.000Z'),
    });
    expect(databaseClient.exclusiveUpdate).not.toHaveBeenCalled();
  });

  test('[processRunningTasks]', async () => {
    const closeTask = vi.fn();
    const worker = new Worker('');
    vi.spyOn(jobScheduler as TestJobScheduler, 'closeTask').mockImplementation(closeTask);
    (jobScheduler as TestJobScheduler).tasksRegistry = {
      '626adcd0bfffbd0fec9e1467': {
        worker,
        _status: 'IN_PROGRESS',
      },
      '626adcd0bfffbd0fec9e1469': {
        worker,
        _status: 'FAILED',
      },
      '626adcd0bfffbd0fec9e1470': {
        worker,
        _status: 'CANCELED',
      },
      '626adcd0bfffbd0fec9e1471': {
        worker,
        _status: 'COMPLETED',
      },
      '626adcd0bfffbd0fec9e1472': {
        worker,
        _status: 'IN_PROGRESS',
      },
    };
    const promise = (jobScheduler as TestJobScheduler).processRunningTasks();
    vi.runAllTimersAsync().catch(() => null);
    await promise;
    expect(databaseClient.getRunningTasks).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Processing running tasks...');
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Task with id "626adcd0bfffbd0fec9e1471" successfully ended.');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Task with id "626adcd0bfffbd0fec9e1470" canceled itself.');
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Task with id "626adcd0bfffbd0fec9e1469" failed.');
    expect(logger.error).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Task with id "626adcd0bfffbd0fec9e1467" timed out.');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Task with id "626adcd0bfffbd0fec9e1470" canceled itself.');
    expect(closeTask.mock.calls).toMatchSnapshot();
  });

  test('[create] tasks', async () => {
    await jobScheduler.create('tasks', {
      job: new Id(),
      metaData: '{}',
      recurrence: null,
      startAfter: null,
      startAt: new Date(),
    }, {}, {} as unknown as CommandContext);
    expect(databaseClient.create).toHaveBeenCalledTimes(1);
    expect(databaseClient.create).toHaveBeenCalledWith('tasks', {
      job: new Id(),
      metaData: '{}',
      recurrence: null,
      startAfter: null,
      startAt: new Date(),
      _endedAt: null,
      _parent: null,
      _runBy: null,
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: new Date('2022-01-01T00:00:00.000Z'),
    });
  });

  test('[create] jobs', async () => {
    await jobScheduler.create('jobs', {
      maximumExecutionTime: 0,
      requiredSlots: 100,
      scriptPath: '',
    }, {}, {} as unknown as CommandContext);
    expect(databaseClient.create).not.toHaveBeenCalled();
  });
});
