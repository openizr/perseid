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
    fields: {
      requiredSlots: {
        type: 'integer',
        required: true,
        enum: [256, 512, 1024, 2048, 4096],
      },
      maximumExecutionTime: {
        type: 'integer',
        required: true,
        exclusiveMinimum: 0,
      },
      scriptPath: {
        type: 'string',
        required: true,
      },
    },
  },
  tasks: {
    enableAuthors: false,
    enableTimestamps: true,
    fields: {
      _endedAt: { type: 'date' },
      _startedAt: { type: 'date' },
      _parent: {
        type: 'id',
        index: true,
        relation: 'tasks',
      },
      _status: {
        type: 'string',
        index: true,
        required: true,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'IN_PROGRESS'],
      },
      _runBy: {
        type: 'id',
      },
      startAfter: {
        type: 'id',
        relation: 'tasks',
      },
      job: {
        type: 'id',
        index: true,
        required: true,
        relation: 'jobs',
      },
      recurrence: {
        type: 'integer',
        exclusiveMinimum: 0,
      },
      metaData: {
        type: 'string',
        required: true,
      },
      startAt: {
        type: 'date',
        required: true,
      },
    },
  },
});
