/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Model } from '@perseid/server';
import type { ResourceSchema } from '@perseid/core';

/**
 * Job scheduler data model.
 */
export default new Model<DataModel>({
  jobs: {
    enableAuthors: false,
    enableTimestamps: true,
    fields: {
      requiredSlots: {
        type: 'integer',
        isRequired: true,
        enum: [256, 512, 1024, 2048, 4096],
      },
      maximumExecutionTime: {
        type: 'integer',
        isRequired: true,
        exclusiveMinimum: 0,
      },
      scriptPath: {
        type: 'string',
        isRequired: true,
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
        isIndexed: true,
        relation: 'tasks',
      },
      _status: {
        type: 'string',
        isIndexed: true,
        isRequired: true,
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
        isIndexed: true,
        isRequired: true,
        relation: 'jobs',
      },
      recurrence: {
        type: 'integer',
        exclusiveMinimum: 0,
      },
      metadata: {
        type: 'string',
        isRequired: true,
      },
      startAt: {
        type: 'date',
        isRequired: true,
      },
    },
  },
} as unknown as Record<keyof DataModel, ResourceSchema<DataModel>>);
