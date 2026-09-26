/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Model } from '@perseid/server';

/**
 * Job scheduler data model.
 */
export default new Model({
  jobs: {
    enableAuthors: false,
    enableTimestamps: true,
    description: 'Job.',
    fields: {
      requiredSlots: {
        type: 'integer',
        isRequired: true,
        description: 'Minimum required number of free slots on job scheduler to run this job.',
        enum: [256, 512, 1024, 2048, 4096],
      },
      maximumExecutionTime: {
        type: 'integer',
        isRequired: true,
        exclusiveMinimum: 0,
        description: 'Job maximum execution time, in seconds.\nAfter this duration, task will be stopped, and marked as failed.',
      },
      scriptPath: {
        type: 'string',
        maxLength: 255,
        isRequired: true,
        description: 'Path to the script to execute for that job.',
      },
    },
  },
  tasks: {
    enableAuthors: false,
    enableTimestamps: true,
    description: 'Job task.',
    fields: {
      _endedAt: {
        type: 'date',
        description: 'Task execution end date.',
      },
      _startedAt: {
        type: 'date',
        description: 'Task execution start date.',
      },
      _parent: {
        type: 'id',
        isIndexed: true,
        relation: 'tasks',
        description: 'Task parent (previous execution of that job).',
      },
      _status: {
        type: 'string',
        maxLength: 11,
        isIndexed: true,
        isRequired: true,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'IN_PROGRESS'],
        description: 'Task execution status.',
      },
      _runBy: {
        type: 'id',
        isIndexed: true,
        description: 'Id of the job scheduler instance that run this task.',
      },
      startAfter: {
        type: 'id',
        relation: 'tasks',
        description: 'Task after which this task should start.',
      },
      job: {
        type: 'id',
        isIndexed: true,
        isRequired: true,
        relation: 'jobs',
        description: 'Task job.',
      },
      recurrence: {
        type: 'integer',
        exclusiveMinimum: 0,
        description: 'Task recurrence, in seconds.',
      },
      metadata: {
        type: 'string',
        isRequired: true,
        maxLength: 10000,
        description: 'Task execution metadata.',
      },
      startAt: {
        type: 'date',
        isRequired: true,
        description: 'Task desired start date. You must either define this field, or `startAfter`.',
      },
    },
  },
});
