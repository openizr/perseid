/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '__mocks__/@perseid/core';

/**
 * `scripts/services/DatabaseClient` mock.
 */
export default class DatabaseClient {
  public create = vi.fn();

  public update = vi.fn();

  public exclusiveUpdate = vi.fn((_collection, filters: { _id: unknown; }) => (
    String(filters._id) === '626adcd0bfffbd0fec9e1467'
  ));

  public getCandidatePendingTasks = vi.fn(() => (process.env.NO_TASK === 'true' ? [] : [
    {
      _runBy: null,
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1467'),
      _parent: null,
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('626adcd0bfffbd0fec9e1465'),
        _createdAt: new Date(),
        scriptPath: '/var/www/html/test.js test',
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 1000,
      },
      metaData: '{}',
      recurrence: 4000,
      startAfter: null,
      startAt: new Date('2022-01-01T01:06:40.000Z'),
    },
    {
      _runBy: null,
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1468'),
      _parent: null,
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('626adcd0bfffbd0fec9e1465'),
        _createdAt: new Date(),
        scriptPath: '/var/www/html/test.js test',
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 1000,
      },
      metaData: '{}',
      recurrence: 4000,
      startAfter: null,
      startAt: new Date('2022-01-01T01:06:40.000Z'),
    },
    {
      _runBy: null,
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1469'),
      _parent: null,
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('626adcd0bfffbd0fec9e1465'),
        _createdAt: new Date(),
        scriptPath: '/var/www/html/test.js test',
        _updatedAt: null,
        requiredSlots: 512,
        maximumExecutionTime: 1000,
      },
      metaData: '{}',
      recurrence: 4000,
      startAfter: {
        _createdAt: new Date(),
        _endedAt: null,
        _id: new Id('626adcd0bfffbd0fec9e1463'),
        _parent: null,
        _startedAt: null,
        _status: 'FAILED',
        _updatedAt: null,
        job: {
          _id: new Id('626adcd0bfffbd0fec9e1465'),
          _createdAt: new Date(),
          scriptPath: '/var/www/html/test.js test',
          _updatedAt: null,
          requiredSlots: 512,
          maximumExecutionTime: 1000,
        },
        metaData: '{}',
        recurrence: 4000,
        startAfter: null,
        startAt: null,
      },
      startAt: null,
    },
  ]));

  public getRunningTasks = vi.fn(() => (process.env.NO_TASK === 'true' ? [] : [
    // Timed-out task.
    {
      _runBy: new Id(),
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1467'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('626adcd0bfffbd0fec9e1465'),
        _createdAt: new Date(),
        scriptPath: '/var/www/html/test.js',
        _updatedAt: null,
        maximumExecutionTime: -1,
      },
      metaData: '{}',
      recurrence: 4000,
      startAfter: null,
      startAt: new Date('2022-01-01T01:06:40.000Z'),
    },
    // Task from a crashed job scheduler.
    {
      _runBy: new Id('626adcd0bfffbd0fec977777'),
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1468'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('626adcd0bfffbd0fec9e1465'),
        _createdAt: new Date(),
        scriptPath: '/var/www/html/test.js',
        _updatedAt: null,
        maximumExecutionTime: -100,
      },
      metaData: '{}',
      recurrence: 4000,
      startAfter: {
        _createdAt: new Date(),
        _endedAt: null,
        _id: new Id('626adcd0bfffbd0fec9e1463'),
        _parent: null,
        _startedAt: new Date(),
        _status: 'COMPLETED',
        _updatedAt: null,
        job: {
          _id: new Id('626adcd0bfffbd0fec9e1465'),
          _createdAt: new Date(),
          scriptPath: '/var/www/html/test.js',
          _updatedAt: null,
          maximumExecutionTime: 60,
        },
        metaData: '{}',
        recurrence: 4000,
        startAfter: null,
        startAt: null,
      },
      startAt: null,
    },
    // Failed task.
    {
      _runBy: new Id(),
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1469'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('626adcd0bfffbd0fec9e1465'),
        _createdAt: new Date(),
        scriptPath: '/var/www/html/test.js',
        _updatedAt: null,
        maximumExecutionTime: 1000,
      },
      metaData: '{}',
      recurrence: 4000,
      startAfter: null,
      startAt: new Date('2022-01-01T01:06:40.000Z'),
    },
    // Canceled task.
    {
      _runBy: new Id(),
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1470'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('626adcd0bfffbd0fec9e1465'),
        _createdAt: new Date(),
        scriptPath: '/var/www/html/test.js',
        _updatedAt: null,
        maximumExecutionTime: 1000,
      },
      metaData: '{}',
      recurrence: 4000,
      startAfter: null,
      startAt: new Date('2022-01-01T01:06:40.000Z'),
    },
    // Completed task.
    {
      _runBy: new Id(),
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1471'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('626adcd0bfffbd0fec9e1465'),
        _createdAt: new Date(),
        scriptPath: '/var/www/html/test.js',
        _updatedAt: null,
        maximumExecutionTime: 1000,
      },
      metaData: '{}',
      recurrence: 4000,
      startAfter: null,
      startAt: new Date('2022-01-01T01:06:40.000Z'),
    },
    // Still running task.
    {
      _runBy: new Id(),
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1472'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('626adcd0bfffbd0fec9e1465'),
        _createdAt: new Date(),
        scriptPath: '/var/www/html/test.js',
        _updatedAt: null,
        maximumExecutionTime: 1000,
      },
      metaData: '{}',
      recurrence: 4000,
      startAfter: null,
      startAt: new Date('2022-01-01T01:06:40.000Z'),
    },
  ]));

  public search = vi.fn(() => ({
    total: 1,
    results: [{
      _runBy: new Id(),
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('626adcd0bfffbd0fec9e1467'),
      _parent: null,
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: null,
      job: new Id('626adcd0bfffbd0fec9e1465'),
      metaData: '{}',
      recurrence: 4000,
      startAfter: null,
      startAt: new Date('2022-01-01T01:06:40.000Z'),
    }],
  }));
}
