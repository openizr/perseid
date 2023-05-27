/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

const model: ModelSchema = {
  types: {
    invalid: { type: 'invalid' },
    email: {
      type: 'string',
      index: true,
      minLength: 20,
      maxLength: 50,
      required: true,
      default: 'test@test.com',
      pattern: '^[a-z]+@test.com$',
    },
    external: {
      type: 'id',
      index: true,
      relation: 'test2',
    },
    nested: {
      type: 'object',
      fields: {
        street1: {
          type: 'object',
          fields: {
            country: {
              type: 'string',
              index: true,
            },
          },
        },
        street2: {
          type: 'string',
        },
        street3: {
          type: 'id',
          relation: 'test2',
        },
        integer: {
          minimum: 3,
          maximum: 35,
          multipleOf: 10,
          type: 'integer',
          default: 5,
        },
        exclusiveInteger: {
          exclusiveMaximum: 10,
          exclusiveMinimum: 0,
          type: 'integer',
        },
        integerEnum: {
          type: 'integer',
          enum: [1, 2, 3],
        },
        float: {
          multipleOf: 0.5,
          maximum: 10,
          minimum: 1,
          type: 'float',
          default: 1.3,
        },
        exclusiveFloat: {
          exclusiveMaximum: 10,
          exclusiveMinimum: 0.5,
          type: 'float',
        },
        floatEnum: {
          type: 'float',
          enum: [1.0, 2.0, 3.1],
        },
      },
    },
  },
  collections: {
    test: {
      fields: {
        _id: { type: 'id', index: true },
        email: { type: 'email' },
        _updatedAt: { type: 'date', index: true },
        _nonSortableAt: { type: 'date' },
        amount: { type: 'float', index: true },
        amount2: { type: 'float', index: true },
        _count: { type: 'integer', index: true },
        _count2: { type: 'integer', index: true },
        isValid: { type: 'boolean', index: true },
        isOK: { type: 'boolean', index: true },
        file: { type: 'binary', default: 'aziodazoidjazoidj' },
        file2: { type: 'binary' },
        external: { type: 'external' },
        _external2: {
          type: 'id',
          relation: 'test3',
        },
        nested: { type: 'nested' },
        invalid: { type: 'invalid' },
        invalidObject: { type: 'object' },
        array: {
          type: 'array',
          minItems: 3,
          maxItems: 4,
          uniqueItems: true,
          fields: {
            type: 'date',
            enum: ['2022-06-08T11:58:43.721Z'],
          },
        },
        date: { type: 'date', default: '2022-06-08T11:58:43.721Z' },
        otherId: { type: 'id', default: '62889e6077733238b0ef76c2' },
        nested2: {
          type: 'object',
          required: true,
          minProperties: 2,
          maxProperties: 3,
          patternProperties: {
            '^[0-9a-fA-F]{24}$': {
              type: 'object',
              fields: {
                test: { type: 'date', required: true },
                id: { type: 'id', enum: ['62889e6077733238b0ef76c2'] },
                other: { type: 'external' },
              },
            },
          },
        },
        nested3: {
          type: 'object',
          fields: {
            external: { type: 'external' },
          },
        },
        array2: {
          type: 'array',
          fields: {
            type: 'object',
            fields: {
              external: { type: 'external' },
            },
          },
        },
        array3: {
          type: 'array',
          fields: { type: 'external' },
        },
        stringEnum: {
          type: 'string',
          enum: ['a', 'b', 'c'],
        },
      },
    },
    test2: {
      fields: {
        _id: { type: 'id', index: true },
        name: { type: 'string', index: true },
      },
    },
    test3: {
      fields: {
        _id: { type: 'id', index: true },
        email: { type: 'string', index: true },
        _external3: {
          type: 'id',
          relation: 'test',
        },
      },
    },
  },
};

export default model;
