/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';
import { type Document } from 'mongodb';

/** `services/Model` mock. */

export default class Model {
  protected defaultCollection = { fields: {} };

  public static email = vi.fn(() => ({ type: 'string' }));

  public static password = vi.fn(() => ({ type: 'string' }));

  public static tinyText = vi.fn(() => ({ type: 'string' }));

  public static shortText = vi.fn(() => ({ type: 'string' }));

  public static mediumText = vi.fn(() => ({ type: 'string' }));

  public static longText = vi.fn(() => ({ type: 'string' }));

  public static hugeText = vi.fn(() => ({ type: 'string' }));

  public static token = vi.fn(() => ({ type: 'string' }));

  public static credentials = vi.fn(() => ({ type: 'string' }));

  public getCollections = vi.fn(() => ['users', 'roles']);

  public getCollection(collection: string): CollectionDataModel<Document> {
    if (collection === 'test') {
      return {
        enableDeletion: true,
        fields: {
          _id: { type: 'id', index: true },
          primitiveOne: { type: 'id', unique: true },
          primitiveTwo: { type: 'binary', default: Buffer.from('testtest') },
          primitiveThree: { type: 'string', permissions: ['PRIMITIVE_THREE_VIEW'] },
          arrayOne: {
            type: 'array',
            fields: {
              type: 'object',
              fields: {
                dynamicObject: {
                  type: 'dynamicObject',
                  fields: {
                    '^testOne$': {
                      type: 'id',
                      index: true,
                      relation: 'externalRelation',
                    },
                    '^testTwo$': {
                      type: 'id',
                      relation: 'externalRelation',
                    },
                    '^special(.*)$': {
                      type: 'id',
                      relation: 'externalRelation',
                    },
                  },
                },
                object: {
                  type: 'object',
                  required: true,
                  fields: {
                    fieldOne: { type: 'string', permissions: ['ARRAY_ONE_OBJECT_FIELD_ONE_VIEW'] },
                  },
                  permissions: ['ARRAY_ONE_OBJECT_VIEW'],
                },
              },
              permissions: ['ARRAY_ONE_VIEW'],
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
          dynamicOne: {
            type: 'dynamicObject',
            fields: {
              '^testOne$': {
                type: 'id',
                relation: 'externalRelation',
              },
              '^testTwo$': {
                type: 'id',
                relation: 'otherExternalRelation',
              },
              '^testThree$': {
                type: 'object',
                fields: {
                  test: { type: 'string' },
                },
              },
              '^special(.*)$': {
                type: 'id',
                relation: 'externalRelation',
              },
            },
          },
          dynamicTwo: {
            type: 'dynamicObject',
            fields: {
              '^testOne$': {
                type: 'id',
                relation: 'externalRelation',
              },
              '^testTwo$': {
                type: 'object',
                fields: {
                  test: { type: 'string' },
                },
              },
            },
          },
        },
      };
    }
    if (collection === 'test2') {
      return {
        enableDeletion: true,
        fields: {
          float: {
            enum: [1],
            maximum: 10,
            minimum: 0,
            default: 4,
            type: 'float',
            multipleOf: 2,
            exclusiveMinimum: 0,
            exclusiveMaximum: 10,
          },
          floatTwo: { type: 'float' },
          integer: {
            enum: [1],
            maximum: 10,
            minimum: 0,
            default: 4,
            multipleOf: 2,
            type: 'integer',
            exclusiveMinimum: 0,
            exclusiveMaximum: 10,
            permissions: ['INTEGER_VIEW'],
          },
          integerTwo: { type: 'integer' },
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
          binary: { type: 'binary' },
          enum: { type: 'string', enum: ['test'] },
          boolean: { type: 'boolean', default: false },
          booleanTwo: { type: 'boolean' },
          relation: { type: 'id', relation: 'externalRelation' },
          date: {
            type: 'date',
            enum: [new Date('2023-01-01')],
            default: new Date('2023-01-01'),
          },
          dateTwo: { type: 'date' },
          id: {
            type: 'id',
            enum: [new Id('6478a6c5392350aaced68cf9')],
            default: new Id('6478a6c5392350aaced68cf9'),
          },
          array: {
            type: 'array',
            minItems: 3,
            maxItems: 10,
            uniqueItems: true,
            fields: { type: 'string', permissions: ['ARRAY_VIEW'] },
          },
          arrayTwo: {
            type: 'array',
            minItems: 1,
            maxItems: 1,
            uniqueItems: true,
            fields: { type: 'string', permissions: ['ARRAY_VIEW'] },
          },
          dynamicObject: {
            type: 'dynamicObject',
            minItems: 3,
            maxItems: 10,
            fields: {
              test: { type: 'string' },
            },
          },
          dynamicObjectTwo: {
            type: 'dynamicObject',
            minItems: 1,
            maxItems: 1,
            fields: {
              test: { type: 'string' },
            },
          },
        },
      };
    }
    if (collection === 'externalRelation') {
      return {
        enableDeletion: false,
        fields: {
          _id: { type: 'id', index: true },
          name: { type: 'string' },
          _isDeleted: { type: 'boolean' },
          relations: {
            type: 'array',
            fields: { type: 'id', relation: 'otherExternalRelation' },
          },
        },
      };
    }
    if (collection === 'otherExternalRelation') {
      return {
        enableDeletion: true,
        fields: {
          _id: { type: 'id' },
          type: { type: 'string' },
        },
      };
    }

    return this.defaultCollection;
  }
}
