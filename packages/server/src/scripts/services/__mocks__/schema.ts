/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id, type DefaultDataModel, type DataModelSchema } from '@perseid/core';

export interface DataModel extends DefaultDataModel {
  test: {
    primitiveOne: Id;
    primitiveTwo: ArrayBuffer;
    primitiveThree: string;
    arrayOne: {
      object: {
        fieldOne: string;
        fieldTwo: Id | DataModel['externalRelation'];
      }
    }[];
    arrayTwo: (Id | null | DataModel['externalRelation'])[];
    arrayThree: (Id | DataModel['externalRelation'])[];
    arrayFour: string[];
    arrayFive: ({
      fieldOne: string;
    } | null)[];
    objectOne: Record<string, Id | {
      test: string;
    } | DataModel['externalRelation']>;
  };
  test2: {
    null: null;
  };
  externalRelation: {
    _id: Id;
    name: string;
    relations: (Id | DataModel['otherExternalRelation'])[];
  };
  otherExternalRelation: {
    _id: Id;
    type: string;
  };
}

export default {
  test: {
    enableDeletion: true,
    fields: {
      _id: { type: 'id', index: true },
      primitiveOne: { type: 'id', unique: true },
      primitiveTwo: { type: 'binary', default: Buffer.from('testtest') },
      primitiveThree: { type: 'string' },
      arrayOne: {
        type: 'array',
        fields: {
          type: 'object',
          fields: {
            object: {
              type: 'object',
              required: true,
              fields: {
                fieldOne: { type: 'string' },
                fieldTwo: {
                  type: 'id',
                  index: true,
                  relation: 'externalRelation',
                },
              },
            },
          },
        },
      },
      arrayTwo: {
        type: 'array',
        fields: {
          type: 'id',
          index: true,
          relation: 'externalRelation',
        },
      },
      arrayThree: {
        type: 'array',
        fields: {
          type: 'id',
          index: true,
          relation: 'otherExternalRelation',
        },
      },
      arrayFour: {
        type: 'array',
        fields: {
          type: 'string',
        },
      },
      arrayFive: {
        type: 'array',
        fields: {
          type: 'object',
          fields: {
            fieldOne: { type: 'string' },
          },
        },
      },
      objectOne: {
        type: 'object',
        fields: {
          testOne: {
            type: 'id',
            relation: 'externalRelation',
          },
        },
      },
    },
  },
  test2: {
    enableDeletion: true,
    fields: {
      float: {
        enum: [1],
        maximum: 10,
        minimum: 0,
        default: 4,
        type: 'float',
        multipleOf: 2,
        required: true,
        exclusiveMinimum: 0,
        exclusiveMaximum: 10,
      },
      floatTwo: { type: 'float', enum: [2] },
      integer: {
        enum: [1],
        maximum: 10,
        minimum: 0,
        default: 4,
        multipleOf: 2,
        required: true,
        type: 'integer',
        exclusiveMinimum: 0,
        exclusiveMaximum: 10,
      },
      integerTwo: { type: 'integer', enum: [2] },
      string: {
        type: 'string',
        default: '',
        minLength: 1,
        maxLength: 10,
        enum: ['test'],
        pattern: 'test',
      },
      _id: { type: 'id' },
      null: { type: 'null' },
      binary: { type: 'binary', required: true },
      enum: { type: 'string', required: true, enum: ['test'] },
      booleanTwo: { type: 'boolean' },
      relation: { type: 'id', relation: 'externalRelation' },
      boolean: { type: 'boolean', default: false, required: true },
      date: {
        type: 'date',
        required: true,
        enum: [new Date('2023-01-01')],
        default: new Date('2023-01-01'),
      },
      dateTwo: { type: 'date', enum: [new Date('2023-01-01')] },
      id: {
        type: 'id',
        required: true,
        enum: [new Id('6478a6c5392350aaced68cf9')],
        default: new Id('6478a6c5392350aaced68cf9'),
      },
      idTwo: {
        type: 'id',
        enum: [new Id('6478a6c5392350aaced68cf9')],
        default: new Id('6478a6c5392350aaced68cf9'),
      },
      array: {
        type: 'array',
        minItems: 3,
        maxItems: 10,
        uniqueItems: true,
        fields: { type: 'string' },
      },
      arrayTwo: {
        type: 'array',
        minItems: 1,
        maxItems: 1,
        required: true,
        uniqueItems: true,
        fields: { type: 'string' },
      },
    },
  },
  externalRelation: {
    version: 1,
    enableAuthors: true,
    enableDeletion: false,
    enableTimestamps: true,
    fields: {
      _id: { type: 'id', index: true },
      name: { type: 'string' },
      _version: { type: 'integer' },
      _isDeleted: { type: 'boolean' },
      _updatedBy: { type: 'id' },
      _createdBy: { type: 'id' },
      _updatedAt: { type: 'date' },
      _createdAt: { type: 'date' },
      relations: {
        type: 'array',
        fields: { type: 'id', relation: 'otherExternalRelation' },
      },
    },
  },
  otherExternalRelation: {
    enableDeletion: true,
    fields: {
      _id: { type: 'id', required: true, index: true },
      type: { type: 'string', errorMessages: { type: 'Error' } },
    },
  },
} as DataModelSchema<unknown>;
