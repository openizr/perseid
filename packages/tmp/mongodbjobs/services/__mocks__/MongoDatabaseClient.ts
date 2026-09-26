/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '__mocks__/@perseid/core';

/**
 * `scripts/mongodb/services/MongoDatabaseClient` mock.
 */
export default class MongoDatabaseClient {
  public create = vi.fn();

  public update = vi.fn();

  public updateMatchingTask = vi.fn((filters: { _id: unknown; }) => (
    String(filters._id) === '000000000000000000000001'
  ));

  public getCandidatePendingTasks = vi.fn(() => (process.env.NO_TASK === 'true' ? [] : [
    {
      _runBy: null,
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('000000000000000000000001'),
      _parent: null,
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000002'),
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
      _id: new Id('000000000000000000000003'),
      _parent: null,
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000002'),
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
      _id: new Id('000000000000000000000004'),
      _parent: null,
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000002'),
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
        _id: new Id('000000000000000000000005'),
        _parent: null,
        _startedAt: null,
        _status: 'FAILED',
        _updatedAt: null,
        job: {
          _id: new Id('000000000000000000000002'),
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
      _id: new Id('000000000000000000000001'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000002'),
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
      _runBy: new Id('000000000000000000000006'),
      _createdAt: new Date(),
      _endedAt: null,
      _id: new Id('000000000000000000000003'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000002'),
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
        _id: new Id('000000000000000000000005'),
        _parent: null,
        _startedAt: new Date(),
        _status: 'COMPLETED',
        _updatedAt: null,
        job: {
          _id: new Id('000000000000000000000002'),
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
      _id: new Id('000000000000000000000004'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000002'),
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
      _id: new Id('000000000000000000000007'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000002'),
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
      _id: new Id('000000000000000000000008'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000002'),
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
      _id: new Id('000000000000000000000009'),
      _parent: null,
      _startedAt: new Date(),
      _status: 'IN_PROGRESS',
      _updatedAt: null,
      job: {
        _id: new Id('000000000000000000000002'),
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
      _id: new Id('000000000000000000000001'),
      _parent: null,
      _startedAt: null,
      _status: 'PENDING',
      _updatedAt: null,
      job: new Id('000000000000000000000002'),
      metaData: '{}',
      recurrence: 4000,
      startAfter: null,
      startAt: new Date('2022-01-01T01:06:40.000Z'),
    }],
  }));
}
