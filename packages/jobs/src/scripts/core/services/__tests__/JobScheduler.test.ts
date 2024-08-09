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
import JobScheduler from 'scripts/core/services/JobScheduler';
import MongoDatabaseClient from 'scripts/mongodb/services/MongoDatabaseClient';

type TestJobScheduler = JobScheduler & {
  closeTask: JobScheduler['closeTask'];
  uploadLogs: JobScheduler['uploadLogs'];
  executeTask: JobScheduler['executeTask'];
  tasksRegistry: JobScheduler['tasksRegistry'];
  availableSlots: JobScheduler['availableSlots'];
  withAutomaticFields: JobScheduler['withAutomaticFields'];
  processPendingTasks: JobScheduler['processPendingTasks'];
  processRunningTasks: JobScheduler['processRunningTasks'];
  reSchedulePeriodicTask: JobScheduler['reSchedulePeriodicTask'];
};

describe('core/services/JobScheduler', () => {
  vi.mock('fs');
  vi.mock('pino');
  vi.mock('@perseid/core');
  vi.mock('worker_threads');
  vi.mock('@perseid/server');
  vi.mock('scripts/core/model/index');
  vi.mock('scripts/mongodb/services/MongoDatabaseClient');

  const jobScript = vi.fn();
  const mockedWithAutomaticFields = vi.fn((_, __, payload) => Promise.resolve({
    ...payload,
    updated: true,
  }));
  const cache = new CacheClient({ cachePath: '/var/www/html/.cache', connectTimeout: 0 });
  const logger = new Logger({ logLevel: 'debug', prettyPrint: false });
  const bucketClient = new BucketClient(logger, { connectTimeout: 0 });
  const databaseClient = new MongoDatabaseClient(logger, cache, {
    protocol: '',
    host: '',
    port: null,
    user: null,
    password: null,
    database: '',
    connectTimeout: 0,
    connectionLimit: 0,
  });
  let jobScheduler: TestJobScheduler;
  const job = {
    _id: new Id('000000000000000000000011'),
    _createdAt: new Date(),
    _updatedAt: null,
    requiredSlots: 512,
    maximumExecutionTime: 60,
    scriptPath: '/var/www/html/test.js',
  };
  const task: DataModel['tasks'] = {
    _id: new Id('000000000000000000000010'),
    _runBy: new Id(),
    _createdAt: new Date(),
    _endedAt: new Date(),
    _startedAt: new Date(),
    _status: 'PENDING',
    _updatedAt: null,
    job,
    metadata: '{}',
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
      logsPath: '/logs',
      jobs: { test: jobScript },
    }) as TestJobScheduler;
  });

  test('[withAutomaticFields]', async () => {
    expect(await jobScheduler.withAutomaticFields('tasks', null, {
      job: new Id(),
      metadata: '{}',
      recurrence: null,
      startAfter: null,
      startAt: new Date(),
    }, {} as unknown as CommandContext<DataModel>)).toEqual({
      _endedAt: null,
      _parent: null,
      _runBy: null,
      _startedAt: null,
      _status: 'PENDING',
      job: new Id(),
      metadata: '{}',
      recurrence: null,
      startAfter: null,
      startAt: new Date(),
      updated: true,
    });
  });

  describe('[reSchedulePeriodicTask]', () => {
    test('no recurrence', async () => {
      await jobScheduler.reSchedulePeriodicTask(task, true);
      expect(databaseClient.create).not.toHaveBeenCalled();
      expect(databaseClient.search).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledOnce();
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][reSchedulePeriodicTask] Task with id "000000000000000000000010" is not periodic, re-scheduling skipped.');
    });

    test('recurrence and fixed starting time', async () => {
      vi.spyOn(jobScheduler, 'withAutomaticFields').mockImplementation(mockedWithAutomaticFields);
      await jobScheduler.reSchedulePeriodicTask({
        ...task,
        startAt: new Date(),
        recurrence: 3600,
      }, true);
      expect(logger.info).toHaveBeenCalledOnce();
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][reSchedulePeriodicTask] Creating next recurrence for task with id "000000000000000000000010"...');
      expect(databaseClient.search).not.toHaveBeenCalled();
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledOnce();
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledWith('tasks', null, {
        _runBy: null,
        _endedAt: null,
        _startedAt: null,
        _status: 'PENDING',
        job: new Id('000000000000000000000011'),
        _parent: new Id('000000000000000000000010'),
        startAt: new Date('2022-01-01T00:00:00.000Z'),
        startAfter: null,
        metadata: '{"lastCompletedAt":"2022-01-01T00:00:00.000Z"}',
        recurrence: 3600,
      }, {});
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('tasks', {
        _runBy: null,
        _endedAt: null,
        _startedAt: null,
        _status: 'PENDING',
        job: new Id('000000000000000000000011'),
        _parent: new Id('000000000000000000000010'),
        startAt: new Date('2022-01-01T00:00:00.000Z'),
        startAfter: null,
        metadata: '{"lastCompletedAt":"2022-01-01T00:00:00.000Z"}',
        recurrence: 3600,
        updated: true,
      });
    });

    test('recurrence and dependency to another task', async () => {
      const startAfter = new Id('626adcd0bfffbd0fec9e1463');
      vi.spyOn(jobScheduler, 'withAutomaticFields').mockImplementation(mockedWithAutomaticFields);
      await jobScheduler.reSchedulePeriodicTask({ ...task, startAfter }, true);
      expect(logger.info).toHaveBeenCalledOnce();
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][reSchedulePeriodicTask] Creating next recurrence for task with id "000000000000000000000010"...');
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.search).toHaveBeenCalledOnce();
      expect(databaseClient.search).toHaveBeenCalledWith('tasks', { filters: { _parent: startAfter }, query: null });
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledOnce();
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledWith('tasks', null, {
        _runBy: null,
        _endedAt: null,
        _parent: new Id('000000000000000000000010'),
        _startedAt: null,
        _status: 'PENDING',
        job: new Id('000000000000000000000011'),
        startAt: null,
        startAfter: new Id('000000000000000000000001'),
        metadata: '{"lastCompletedAt":"2022-01-01T00:00:00.000Z"}',
        recurrence: null,
      }, {});
      expect(databaseClient.create).toHaveBeenCalledWith('tasks', {
        _runBy: null,
        _endedAt: null,
        _parent: new Id('000000000000000000000010'),
        _startedAt: null,
        _status: 'PENDING',
        job: new Id('000000000000000000000011'),
        startAt: null,
        startAfter: new Id('000000000000000000000001'),
        metadata: '{"lastCompletedAt":"2022-01-01T00:00:00.000Z"}',
        recurrence: null,
        updated: true,
      });
    });
  });

  describe('[uploadLogs]', () => {
    test('file exists', async () => {
      await jobScheduler.uploadLogs(task);
      expect(bucketClient.upload).toHaveBeenCalledOnce();
      expect(bucketClient.upload).toHaveBeenCalledWith(
        'text/x-log',
        'logs/000000000000000000000010.log',
        '/logs/000000000000000000000010.log',
      );
      expect(fs.unlink).toHaveBeenCalledOnce();
      expect(fs.unlink).toHaveBeenCalledWith('/logs/000000000000000000000010.log');
    });

    test('file does not exist', async () => {
      process.env.FS_ERROR = 'true';
      await jobScheduler.uploadLogs(task);
      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith('[JobScheduler][uploadLogs] Failed to upload logs for task with id "000000000000000000000010".');
      expect(logger.error).toHaveBeenCalledWith(new Error('FS_ERROR'));
    });
  });

  describe('[executeTask]', () => {
    test('exit code 0', async () => {
      const taskId = new Id('626adcd0bfffbd0fec9e1664');
      const promise = jobScheduler.executeTask({ ...task, _id: taskId });
      vi.runAllTimersAsync().catch(() => null);
      await promise;
      expect(jobScheduler.availableSlots).toBe(512);
      expect(logger.info).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Successfully created new thread for task with id "626adcd0bfffbd0fec9e1664".');
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Thread for task with id "626adcd0bfffbd0fec9e1664" exited with code 0.');
    });

    test('exit code 100', async () => {
      const taskId = new Id('626adcd0bfffbd0fec9e1668');
      const promise = jobScheduler.executeTask({ ...task, _id: taskId });
      vi.runAllTimersAsync().catch(() => null);
      await promise;
      expect(logger.info).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Successfully created new thread for task with id "626adcd0bfffbd0fec9e1668".');
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Thread for task with id "626adcd0bfffbd0fec9e1668" exited with code 100.');
    });

    test('exit code 1', async () => {
      const taskId = new Id('626adcd0bfffbd0fec9e1666');
      const promise = jobScheduler.executeTask({ ...task, _id: taskId });
      vi.runAllTimersAsync().catch(() => null);
      await promise;
      expect(logger.info).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Successfully created new thread for task with id "626adcd0bfffbd0fec9e1666".');
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][executeTask] Thread for task with id "626adcd0bfffbd0fec9e1666" exited with code 1.');
      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledWith(new Error('Test'));
    });
  });

  describe('[closeTask]', () => {
    test('job scheduler own task', async () => {
      const uploadLogs = vi.fn();
      const reSchedule = vi.fn();
      vi.spyOn(jobScheduler, 'withAutomaticFields').mockImplementation(mockedWithAutomaticFields);
      jobScheduler.availableSlots = 512;
      const newTask = { ...task, _id: new Id('000000000000000000000001') };
      vi.spyOn(jobScheduler, 'uploadLogs').mockImplementation(uploadLogs);
      vi.spyOn(jobScheduler, 'reSchedulePeriodicTask').mockImplementation(reSchedule);
      await jobScheduler.closeTask(newTask, 'FAILED');
      expect(jobScheduler.availableSlots).toBe(1024);
      expect(reSchedule).toHaveBeenCalledOnce();
      expect(reSchedule).toHaveBeenCalledWith(newTask, false);
      expect(uploadLogs).toHaveBeenCalledOnce();
      expect(uploadLogs).toHaveBeenCalledWith(newTask);
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledOnce();
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledWith('tasks', {}, {
        _status: 'FAILED',
        _endedAt: new Date(),
      }, {});
      expect(databaseClient.updateMatchingTask).toHaveBeenCalledOnce();
      expect(databaseClient.updateMatchingTask).toHaveBeenCalledWith({
        _status: 'IN_PROGRESS',
        _id: new Id('000000000000000000000001'),
      }, {
        _status: 'FAILED',
        _endedAt: new Date(),
        updated: true,
      });
    });

    test('crashed job scheduler task', async () => {
      const uploadLogs = vi.fn();
      const reSchedule = vi.fn();
      vi.spyOn(jobScheduler, 'withAutomaticFields').mockImplementation(mockedWithAutomaticFields);
      jobScheduler.availableSlots = 512;
      const newTask = {
        ...task,
        _id: new Id('000000000000000000000001'),
        _runBy: new Id('626adcd0bfffbd0fec977777'),
      };
      vi.spyOn(jobScheduler, 'uploadLogs').mockImplementation(uploadLogs);
      vi.spyOn(jobScheduler, 'reSchedulePeriodicTask').mockImplementation(reSchedule);
      await jobScheduler.closeTask(newTask, 'FAILED');
      expect(jobScheduler.availableSlots).toBe(512);
      expect(reSchedule).toHaveBeenCalledOnce();
      expect(reSchedule).toHaveBeenCalledWith(newTask, false);
      expect(uploadLogs).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledWith(
        '[JobScheduler][processRunningTasks] Task with id "000000000000000000000001" timed out more '
        + 'than a minute ago - jobs scheduler with id "626adcd0bfffbd0fec977777" probably crashed.',
      );
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledOnce();
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledWith('tasks', {}, {
        _status: 'FAILED',
        _endedAt: new Date(),
      }, {});
      expect(databaseClient.updateMatchingTask).toHaveBeenCalledOnce();
      expect(databaseClient.updateMatchingTask).toHaveBeenCalledWith({
        _status: 'IN_PROGRESS',
        _id: new Id('000000000000000000000001'),
      }, {
        _status: 'FAILED',
        _endedAt: new Date(),
        updated: true,
      });
    });
  });

  describe('[runJob]', () => {
    test('no error', async () => {
      Object.assign(process, { argv: [null, null, 'test', '000000000000000000000001'] });
      vi.spyOn(process, 'exit').mockImplementation((code) => code as unknown as never);
      vi.clearAllMocks();
      const NewJobScheduler = (await import('scripts/core/services/JobScheduler')).default;
      await NewJobScheduler.runJob({ test: jobScript }, '/logs', 'info');
      expect(logger.waitForReady).toHaveBeenCalledOnce();
      expect(jobScript).toHaveBeenCalledOnce();
      expect(jobScript).toHaveBeenCalledWith(new Id('000000000000000000000001'), { lastCompletedAt: null }, expect.any(Logger));
      expect(logger.close).toHaveBeenCalledOnce();
      expect(Profiler.formatMetrics).toHaveBeenCalledOnce();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    test('job error', async () => {
      Object.assign(process, { argv: [null, null, 'unknown', '000000000000000000000001', '{"lastCompletedAt":0}'] });
      vi.spyOn(process, 'exit').mockImplementation((code) => code as unknown as never);
      vi.clearAllMocks();
      const NewJobScheduler = (await import('scripts/core/services/JobScheduler')).default;
      await NewJobScheduler.runJob({ test: jobScript }, '/logs/', 'info');
      expect(logger.waitForReady).toHaveBeenCalledOnce();
      expect(jobScript).not.toHaveBeenCalled();
      expect(logger.close).toHaveBeenCalledOnce();
      expect(Profiler.formatMetrics).not.toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  test('[run]', async () => {
    process.env.NO_TASK = 'true';
    const processPendingTasks = vi.fn();
    const processRunningTasks = vi.fn();
    vi.spyOn(global, 'setTimeout');
    vi.spyOn(jobScheduler, 'processPendingTasks').mockImplementation(processPendingTasks);
    vi.spyOn(jobScheduler, 'processRunningTasks').mockImplementation(processRunningTasks);
    await jobScheduler.run();
    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][run] Executing main thread, 1024 slots available...');
    expect(jobScheduler.processPendingTasks).toHaveBeenCalledOnce();
    expect(jobScheduler.processRunningTasks).toHaveBeenCalledOnce();
    expect(jobScheduler.availableSlots).toBe(1024);
    expect(setTimeout).toHaveBeenCalledOnce();
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  });

  describe('[processPendingTasks]', () => {
    test('slots available', async () => {
      vi.spyOn(jobScheduler, 'withAutomaticFields').mockImplementation(mockedWithAutomaticFields);
      const promise = jobScheduler.processPendingTasks();
      vi.runAllTimersAsync().catch(() => null);
      await promise;
      expect(logger.info).toHaveBeenCalledTimes(4);
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] Processing pending tasks...');
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] Executing task with id "000000000000000000000001"...');
      expect(logger.warn).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] Canceling task with id "000000000000000000000004" (related task failed or was canceled)...');
      expect(databaseClient.getCandidatePendingTasks).toHaveBeenCalledOnce();
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledTimes(3);
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledWith('tasks', {}, {
        _runBy: new Id(),
        _startedAt: new Date(),
        _status: 'IN_PROGRESS',
      }, {});
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledWith('tasks', {}, {
        _runBy: new Id(),
        _startedAt: new Date(),
        _status: 'IN_PROGRESS',
      }, {});
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledWith('tasks', {}, {
        _status: 'CANCELED',
      }, {});
      expect(databaseClient.updateMatchingTask).toHaveBeenCalledTimes(2);
      expect(databaseClient.updateMatchingTask).toHaveBeenCalledWith({
        _runBy: null,
        _id: new Id('000000000000000000000001'),
        _status: 'PENDING',
      }, {
        _runBy: new Id(),
        _startedAt: new Date(),
        _status: 'IN_PROGRESS',
        updated: true,
      });
      expect(databaseClient.updateMatchingTask).toHaveBeenCalledWith({
        _runBy: null,
        _id: new Id('000000000000000000000001'),
        _status: 'PENDING',
      }, {
        _runBy: new Id(),
        _startedAt: new Date(),
        _status: 'IN_PROGRESS',
        updated: true,
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('tasks', new Id('000000000000000000000004'), {
        _status: 'CANCELED',
        updated: true,
      });
    });

    test('no slot available', async () => {
      jobScheduler.availableSlots = 256;
      vi.spyOn(jobScheduler, 'withAutomaticFields').mockImplementation(mockedWithAutomaticFields);
      await jobScheduler.processPendingTasks();
      expect(logger.info).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] Processing pending tasks...');
      expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processPendingTasks] No available slot to run task "000000000000000000000001".');
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledOnce();
      expect(jobScheduler.withAutomaticFields).toHaveBeenCalledWith('tasks', {}, {
        _status: 'CANCELED',
      }, {});
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('tasks', new Id('000000000000000000000004'), {
        _status: 'CANCELED',
        updated: true,
      });
      expect(databaseClient.updateMatchingTask).not.toHaveBeenCalled();
    });
  });

  test('[processRunningTasks]', async () => {
    const closeTask = vi.fn();
    const worker = new Worker('');
    vi.spyOn(jobScheduler, 'closeTask').mockImplementation(closeTask);
    jobScheduler.tasksRegistry = {
      '000000000000000000000001': {
        worker,
        _status: 'IN_PROGRESS',
      },
      '000000000000000000000007': {
        worker,
        _status: 'FAILED',
      },
      '000000000000000000000008': {
        worker,
        _status: 'CANCELED',
      },
      '000000000000000000000009': {
        worker,
        _status: 'COMPLETED',
      },
      '000000000000000000000003': {
        worker,
        _status: 'IN_PROGRESS',
      },
      '000000000000000000000004': {
        worker,
        _status: 'IN_PROGRESS',
      },
    };
    const promise = jobScheduler.processRunningTasks();
    vi.runAllTimersAsync().catch(() => null);
    await promise;
    expect(databaseClient.getRunningTasks).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Processing running tasks...');
    expect(logger.info).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Task with id "000000000000000000000009" successfully ended.');
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Task with id "000000000000000000000008" canceled itself.');
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Task with id "000000000000000000000007" failed.');
    expect(logger.error).toHaveBeenCalledWith('[JobScheduler][processRunningTasks] Task with id "000000000000000000000001" timed out.');
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(closeTask.mock.calls).toMatchSnapshot();
  });
});
