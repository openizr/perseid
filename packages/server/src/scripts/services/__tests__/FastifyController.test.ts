/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
  type FastifyInstance,
} from 'fastify';
import { createWriteStream } from 'fs';
import Gone from 'scripts/errors/Gone';
import Model from 'scripts/services/Model';
import { type IncomingMessage } from 'http';
import Logger from 'scripts/services/Logger';
import NotFound from 'scripts/errors/NotFound';
import Conflict from 'scripts/errors/Conflict';
import { type FuncKeywordDefinition } from 'ajv';
import Forbidden from 'scripts/errors/Forbidden';
import BadRequest from 'scripts/errors/BadRequest';
import Unauthorized from 'scripts/errors/Unauthorized';
import UsersEngine from 'scripts/services/UsersEngine';
import EmailClient from 'scripts/services/EmailClient';
import CacheClient from 'scripts/services/CacheClient';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import TooManyRequests from 'scripts/errors/TooManyRequests';
import DatabaseClient from 'scripts/services/DatabaseClient';
import { type DataModel } from 'scripts/services/__mocks__/schema';
import FastifyController from 'scripts/services/FastifyController';
import UnprocessableEntity from 'scripts/errors/UnprocessableEntity';
import RequestEntityTooLarge from 'scripts/errors/RequestEntityTooLarge';
import { Id, type CollectionSchema, type DataModelMetadata } from '@perseid/core';

type Validate = (arg: unknown, ...args: unknown[]) => boolean;

type TestFastifyController = FastifyController<DataModel> & {
  auth: FastifyController['auth'];
  KEYWORDS: FastifyController['KEYWORDS'];
  apiHandlers: FastifyController['apiHandlers'];
  formatError: FastifyController['formatError'];
  handleError: FastifyController['handleError'];
  createSchema: FastifyController['createSchema'];
  parseFormData: FastifyController['parseFormData'];
  handleNotFound: FastifyController['handleNotFound'];
};

describe('services/FastifyController', () => {
  vi.mock('fs');
  vi.mock('os');
  vi.mock('path');
  vi.mock('ajv');
  vi.mock('fastify');
  vi.mock('multiparty');
  vi.mock('ajv-errors');
  vi.mock('@perseid/core');
  vi.mock('fast-json-stringify');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/Controller');
  vi.mock('scripts/services/UsersEngine');
  vi.mock('scripts/services/EmailClient');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/DatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const emailClient = new EmailClient(logger);
  const cacheClient = new CacheClient({ cachePath: '/var/www/html/node_modules/.cache' });
  const model = new Model<DataModel>({} as Record<keyof DataModel, CollectionSchema<DataModel>>);
  const databaseClient = new DatabaseClient<DataModel>(model, logger, cacheClient, {
    cacheDuration: 0,
    connectionLimit: 0,
    connectTimeout: 0,
    database: '',
    host: '',
    maxPoolSize: 0,
    password: '',
    port: 0,
    protocol: '',
    queueLimit: 0,
    user: '',
  });
  const engine = new UsersEngine<DataModel>(
    model,
    logger,
    databaseClient,
    emailClient,
    cacheClient,
    {
      baseUrl: '',
      auth: {
        algorithm: 'RS256',
        clientId: '',
        issuer: '',
        privateKey: '',
        publicKey: '',
      },
    },
  );
  let controller: TestFastifyController;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UNKNOWN_ERROR;
    delete process.env.MUTIPARTY_ERROR_OTHER;
    delete process.env.MUTIPARTY_ERROR_MISSING_HEADER;
    delete process.env.MUTIPARTY_ERROR_FIELD_TOO_LARGE;
    delete process.env.MUTIPARTY_ERROR_TOO_MANY_FIELDS;
    controller = new FastifyController<DataModel>(model, logger, engine, {
      version: '0.0.1',
      endpoints: {
        auth: {},
        collections: {},
      },
    }) as TestFastifyController;
  });

  test('[KEYWORDS]', () => {
    const context = { parentData: {}, parentDataProperty: 'test' };
    let validate = (controller.KEYWORDS[0] as FuncKeywordDefinition).validate as Validate;
    expect(validate({}, null, { type: ['string', 'null'] }, context)).toBe(true);
    expect(validate({}, '', {}, context)).toBe(false);
    expect(validate({}, 'data:test', {}, context)).toBe(true);
    validate = (controller.KEYWORDS[1] as FuncKeywordDefinition).validate as Validate;
    expect(validate({}, null, { type: ['string', 'null'] }, context)).toBe(true);
    expect(validate({}, '', {}, context)).toBe(false);
    expect(validate({}, '2023-01-01T00:00:00.000Z', { enum: [] }, context)).toBe(false);
    expect(validate({}, '2023-01-01T00:00:00.000Z', {}, context)).toBe(true);
    validate = (controller.KEYWORDS[2] as FuncKeywordDefinition).validate as Validate;
    expect(validate({}, null, { type: ['string', 'null'] }, context)).toBe(true);
    expect(validate({}, '', {}, context)).toBe(false);
    expect(validate({}, '64723318e84f943f1ad6578b', { enum: [] }, context)).toBe(false);
    expect(validate({}, '64723318e84f943f1ad6578b', {}, context)).toBe(true);
  });

  test('[createSchema] create mode', () => {
    const testMetadata = model.get('test') as DataModelMetadata<CollectionSchema<DataModel>>;
    expect(controller.createSchema({
      body: {
        type: 'object',
        fields: testMetadata.schema.fields,
      },
      response: {
        '2xx': {
          type: 'object',
          fields: {},
        },
      },
    }, 'CREATE')).toEqual({
      body: {
        type: ['object', 'null'],
        additionalProperties: false,
        errorMessage: { type: 'must be a valid object, or null' },
        default: null,
        properties: {
          primitiveOne: {
            isId: true,
            type: ['string', 'null'],
            errorMessage: {
              type: 'must be a valid id, or null',
              pattern: 'must be a valid id',
            },
            pattern: '^[0-9a-fA-F]{24}$',
            default: null,
          },
          primitiveTwo: {
            type: ['string', 'null'],
            minLength: 10,
            isBinary: true,
            errorMessage: { type: 'must be a base64-encoded binary, or null' },
            default: 'testtest',
          },
          primitiveThree: {
            type: ['string', 'null'],
            errorMessage: { type: 'must be a string, or null' },
            default: null,
          },
          arrayOne: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            items: {
              type: ['object', 'null'],
              additionalProperties: false,
              errorMessage: { type: 'must be a valid object, or null' },
              required: ['object'],
              default: null,
              properties: {
                object: {
                  type: 'object',
                  additionalProperties: false,
                  errorMessage: { type: 'must be a valid object' },
                  properties: {
                    fieldOne: {
                      type: ['string', 'null'],
                      errorMessage: { type: 'must be a string, or null' },
                      default: null,
                    },
                    fieldTwo: {
                      isId: true,
                      type: ['string', 'null'],
                      pattern: '^[0-9a-fA-F]{24}$',
                      errorMessage: {
                        type: 'must be a valid id, or null',
                        pattern: 'must be a valid id',
                      },
                      default: null,
                    },
                  },
                },
              },
            },
            default: null,
          },
          arrayTwo: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            default: null,
            items: {
              isId: true,
              type: ['string', 'null'],
              errorMessage: {
                type: 'must be a valid id, or null',
                pattern: 'must be a valid id',
              },
              pattern: '^[0-9a-fA-F]{24}$',
              default: null,
            },
          },
          arrayThree: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            items: {
              isId: true,
              type: ['string', 'null'],
              errorMessage: {
                type: 'must be a valid id, or null',
                pattern: 'must be a valid id',
              },
              pattern: '^[0-9a-fA-F]{24}$',
              default: null,
            },
            default: null,
          },
          arrayFour: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            items: {
              type: ['string', 'null'],
              errorMessage: { type: 'must be a string, or null' },
              default: null,
            },
            default: null,
          },
          arrayFive: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            items: {
              type: ['object', 'null'],
              additionalProperties: false,
              errorMessage: { type: 'must be a valid object, or null' },
              default: null,
              properties: {
                fieldOne: {
                  type: ['string', 'null'],
                  errorMessage: { type: 'must be a string, or null' },
                  default: null,
                },
              },
            },
            default: null,
          },
          objectOne: {
            additionalProperties: false,
            default: null,
            type: ['object', 'null'],
            errorMessage: { type: 'must be a valid object, or null' },
            properties: {
              testOne: {
                default: null,
                errorMessage: {
                  pattern: 'must be a valid id',
                  type: 'must be a valid id, or null',
                },
                isId: true,
                pattern: '^[0-9a-fA-F]{24}$',
                type: ['string', 'null'],
              },
            },
          },
        },
      },
      response: {
        '2xx': {
          type: 'object',
          additionalProperties: false,
          nullable: true,
          properties: {},
        },
      },
    });
    // Just to make sure schemas enumerations are not directly mutated by formatters.
    const test2Metadata = model.get('test2') as DataModelMetadata<CollectionSchema<DataModel>>;
    controller.createSchema({
      body: {
        type: 'object',
        fields: test2Metadata.schema.fields,
      },
    }, 'CREATE');
    expect(controller.createSchema({
      body: {
        type: 'object',
        fields: test2Metadata.schema.fields,
      },
      response: {
        '2xx': {
          type: 'object',
          fields: {
            relation: { type: 'id', relation: 'test2' },
            array: { type: 'array', fields: { type: 'string' } },
          },
        },
      },
    }, 'CREATE')).toEqual({
      body: {
        type: ['object', 'null'],
        additionalProperties: false,
        errorMessage: { type: 'must be a valid object, or null' },
        default: null,
        required: [
          'float',
          'integer',
          'binary',
          'enum',
          'boolean',
          'date',
          'id',
          'arrayTwo',
        ],
        properties: {
          float: {
            type: 'number',
            errorMessage: {
              type: 'must be a float',
              minimum: 'must be greater than or equal to 0',
              maximum: 'must be smaller than or equal to 10',
              exclusiveMinimum: 'must be greater than 0',
              exclusiveMaximum: 'must be smaller than 10',
              multipleOf: 'must be a multiple of 2',
              enum: 'must be one of: 1',
            },
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: 0,
            exclusiveMaximum: 10,
            multipleOf: 2,
            enum: [1],
            default: 4,
          },
          floatTwo: {
            type: ['number', 'null'],
            enum: [2, null],
            errorMessage: {
              enum: 'must be one of: 2',
              type: 'must be a float, or null',
            },
            default: null,
          },
          integer: {
            type: 'integer',
            errorMessage: {
              type: 'must be an integer',
              minimum: 'must be greater than or equal to 0',
              maximum: 'must be smaller than or equal to 10',
              exclusiveMinimum: 'must be greater than 0',
              exclusiveMaximum: 'must be smaller than 10',
              multipleOf: 'must be a multiple of 2',
              enum: 'must be one of: 1',
            },
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: 0,
            exclusiveMaximum: 10,
            multipleOf: 2,
            enum: [1],
            default: 4,
          },
          integerTwo: {
            default: null,
            enum: [2, null],
            type: ['integer', 'null'],
            errorMessage: { enum: 'must be one of: 2', type: 'must be an integer, or null' },
          },
          string: {
            type: ['string', 'null'],
            errorMessage: {
              type: 'must be a string, or null',
              maxLength: 'must be no longer than 10 characters',
              minLength: 'must be no shorter than 1 characters',
              pattern: 'must match "test" pattern',
              enum: 'must be one of: "test"',
            },
            maxLength: 10,
            minLength: 1,
            pattern: 'test',
            enum: ['test', null],
            default: '',
          },
          null: { type: 'null', errorMessage: {} },
          binary: {
            type: 'string',
            minLength: 10,
            isBinary: true,
            errorMessage: { type: 'must be a base64-encoded binary' },
          },
          enum: {
            type: 'string',
            errorMessage: { type: 'must be a string', enum: 'must be one of: "test"' },
            enum: ['test'],
          },
          boolean: {
            type: 'boolean',
            errorMessage: { type: 'must be a boolean' },
            default: false,
          },
          booleanTwo: {
            type: ['boolean', 'null'],
            errorMessage: { type: 'must be a boolean, or null' },
            default: null,
          },
          relation: {
            isId: true,
            type: ['string', 'null'],
            errorMessage: { type: 'must be a valid id, or null', pattern: 'must be a valid id' },
            pattern: '^[0-9a-fA-F]{24}$',
            default: null,
          },
          date: {
            type: 'string',
            isDate: true,
            errorMessage: {
              type: 'must be a valid date',
              pattern: 'must be a valid date',
              enum: 'must be one of: "2023-01-01T00:00:00.000Z"',
            },
            pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z',
            enum: ['2023-01-01T00:00:00.000Z'],
            default: new Date('2023-01-01'),
          },
          dateTwo: {
            type: ['string', 'null'],
            isDate: true,
            errorMessage: {
              type: 'must be a valid date, or null',
              pattern: 'must be a valid date',
              enum: 'must be one of: "2023-01-01T00:00:00.000Z"',
            },
            enum: ['2023-01-01T00:00:00.000Z', null],
            pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z',
            default: null,
          },
          id: {
            isId: true,
            type: 'string',
            errorMessage: {
              type: 'must be a valid id',
              pattern: 'must be a valid id',
              enum: 'must be one of: "6478a6c5392350aaced68cf9"',
            },
            pattern: '^[0-9a-fA-F]{24}$',
            enum: ['6478a6c5392350aaced68cf9'],
            default: new Id('6478a6c5392350aaced68cf9'),
          },
          idTwo: {
            isId: true,
            type: ['string', 'null'],
            errorMessage: {
              pattern: 'must be a valid id',
              type: 'must be a valid id, or null',
              enum: 'must be one of: "6478a6c5392350aaced68cf9"',
            },
            pattern: '^[0-9a-fA-F]{24}$',
            enum: ['6478a6c5392350aaced68cf9', null],
            default: new Id('6478a6c5392350aaced68cf9'),
          },
          array: {
            type: ['array', 'null'],
            errorMessage: {
              type: 'must be a valid array, or null',
              minItems: 'must contain at least 3 entries',
              maxItems: 'must not contain more than 10 entries',
              uniqueItems: 'must contain only unique entries',
            },
            items: {
              type: ['string', 'null'],
              errorMessage: { type: 'must be a string, or null' },
              default: null,
            },
            minItems: 3,
            maxItems: 10,
            uniqueItems: true,
            default: null,
          },
          arrayTwo: {
            type: 'array',
            errorMessage: {
              type: 'must be a valid array',
              minItems: 'must contain at least 1 entry',
              maxItems: 'must not contain more than 1 entry',
              uniqueItems: 'must contain only unique entries',
            },
            items: {
              type: ['string', 'null'],
              errorMessage: { type: 'must be a string, or null' },
              default: null,
            },
            minItems: 1,
            maxItems: 1,
            uniqueItems: true,
          },
        },
      },
      response: {
        '2xx': {
          type: 'object',
          additionalProperties: false,
          nullable: true,
          properties: {
            relation: {
              oneOf: [
                { type: 'string' },
                { $ref: 'test2.json' },
              ],
            },
            array: {
              type: 'array',
              items: { type: 'string', nullable: true },
              nullable: true,
            },
          },
        },
      },
    });
  });

  test('[createSchema] update mode', () => {
    const testMetadata = model.get('test') as DataModelMetadata<CollectionSchema<DataModel>>;
    expect(controller.createSchema({
      body: {
        type: 'object',
        fields: testMetadata.schema.fields,
      },
      response: {
        '2xx': {
          type: 'object',
          fields: {},
        },
      },
    }, 'UPDATE')).toEqual({
      body: {
        type: ['object', 'null'],
        additionalProperties: false,
        errorMessage: { type: 'must be a valid object, or null' },
        properties: {
          primitiveOne: {
            isId: true,
            type: ['string', 'null'],
            errorMessage: {
              type: 'must be a valid id, or null',
              pattern: 'must be a valid id',
            },
            pattern: '^[0-9a-fA-F]{24}$',
          },
          primitiveTwo: {
            type: ['string', 'null'],
            minLength: 10,
            isBinary: true,
            errorMessage: { type: 'must be a base64-encoded binary, or null' },
          },
          primitiveThree: {
            type: ['string', 'null'],
            errorMessage: { type: 'must be a string, or null' },
          },
          arrayOne: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            items: {
              type: ['object', 'null'],
              additionalProperties: false,
              errorMessage: { type: 'must be a valid object, or null' },
              required: ['object'],
              default: null,
              properties: {
                object: {
                  type: 'object',
                  additionalProperties: false,
                  errorMessage: { type: 'must be a valid object' },
                  properties: {
                    fieldOne: {
                      type: ['string', 'null'],
                      errorMessage: { type: 'must be a string, or null' },
                      default: null,
                    },
                    fieldTwo: {
                      isId: true,
                      type: ['string', 'null'],
                      pattern: '^[0-9a-fA-F]{24}$',
                      errorMessage: {
                        type: 'must be a valid id, or null',
                        pattern: 'must be a valid id',
                      },
                      default: null,
                    },
                  },
                },
              },
            },
          },
          arrayTwo: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            items: {
              isId: true,
              type: ['string', 'null'],
              errorMessage: {
                type: 'must be a valid id, or null',
                pattern: 'must be a valid id',
              },
              pattern: '^[0-9a-fA-F]{24}$',
              default: null,
            },
          },
          arrayThree: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            items: {
              isId: true,
              type: ['string', 'null'],
              errorMessage: {
                type: 'must be a valid id, or null',
                pattern: 'must be a valid id',
              },
              pattern: '^[0-9a-fA-F]{24}$',
              default: null,
            },
          },
          arrayFour: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            items: {
              type: ['string', 'null'],
              errorMessage: { type: 'must be a string, or null' },
              default: null,
            },
          },
          arrayFive: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array, or null' },
            items: {
              type: ['object', 'null'],
              additionalProperties: false,
              errorMessage: { type: 'must be a valid object, or null' },
              default: null,
              properties: {
                fieldOne: {
                  type: ['string', 'null'],
                  errorMessage: { type: 'must be a string, or null' },
                  default: null,
                },
              },
            },
          },
          objectOne: {
            additionalProperties: false,
            type: ['object', 'null'],
            errorMessage: { type: 'must be a valid object, or null' },
            properties: {
              testOne: {
                errorMessage: {
                  pattern: 'must be a valid id',
                  type: 'must be a valid id, or null',
                },
                isId: true,
                pattern: '^[0-9a-fA-F]{24}$',
                type: ['string', 'null'],
              },
            },
          },
        },
      },
      response: {
        '2xx': {
          type: 'object',
          additionalProperties: false,
          nullable: true,
          properties: {},
        },
      },
    });
    // Just to make sure schemas enumerations are not directly mutated by formatters.
    const test2Metadata = model.get('test2') as DataModelMetadata<CollectionSchema<DataModel>>;
    expect(controller.createSchema({
      body: {
        type: 'object',
        fields: test2Metadata.schema.fields,
      },
      response: {
        '2xx': {
          type: 'object',
          fields: {
            _id: { type: 'id' },
            date: { type: 'date' },
            float: { type: 'float' },
            binary: { type: 'binary' },
            boolean: { type: 'boolean' },
            integer: { type: 'integer' },
            relation: { type: 'id', relation: 'test2' },
            array: { type: 'array', fields: { type: 'string' } },
          },
        },
      },
    }, 'UPDATE')).toEqual({
      body: {
        type: ['object', 'null'],
        additionalProperties: false,
        errorMessage: { type: 'must be a valid object, or null' },
        properties: {
          float: {
            type: 'number',
            errorMessage: {
              type: 'must be a float',
              minimum: 'must be greater than or equal to 0',
              maximum: 'must be smaller than or equal to 10',
              exclusiveMinimum: 'must be greater than 0',
              exclusiveMaximum: 'must be smaller than 10',
              multipleOf: 'must be a multiple of 2',
              enum: 'must be one of: 1',
            },
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: 0,
            exclusiveMaximum: 10,
            multipleOf: 2,
            enum: [1],
          },
          floatTwo: {
            type: ['number', 'null'],
            enum: [2, null],
            errorMessage: {
              enum: 'must be one of: 2',
              type: 'must be a float, or null',
            },
          },
          integer: {
            type: 'integer',
            errorMessage: {
              type: 'must be an integer',
              minimum: 'must be greater than or equal to 0',
              maximum: 'must be smaller than or equal to 10',
              exclusiveMinimum: 'must be greater than 0',
              exclusiveMaximum: 'must be smaller than 10',
              multipleOf: 'must be a multiple of 2',
              enum: 'must be one of: 1',
            },
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: 0,
            exclusiveMaximum: 10,
            multipleOf: 2,
            enum: [1],
          },
          integerTwo: {
            enum: [2, null],
            type: ['integer', 'null'],
            errorMessage: { enum: 'must be one of: 2', type: 'must be an integer, or null' },
          },
          string: {
            type: ['string', 'null'],
            errorMessage: {
              type: 'must be a string, or null',
              maxLength: 'must be no longer than 10 characters',
              minLength: 'must be no shorter than 1 characters',
              pattern: 'must match "test" pattern',
              enum: 'must be one of: "test"',
            },
            maxLength: 10,
            minLength: 1,
            pattern: 'test',
            enum: ['test', null],
          },
          null: { type: 'null', errorMessage: {} },
          binary: {
            type: 'string',
            minLength: 10,
            isBinary: true,
            errorMessage: { type: 'must be a base64-encoded binary' },
          },
          enum: {
            type: 'string',
            errorMessage: {
              type: 'must be a string',
              enum: 'must be one of: "test"',
            },
            enum: ['test'],
          },
          booleanTwo: {
            type: ['boolean', 'null'],
            errorMessage: { type: 'must be a boolean, or null' },
          },
          relation: {
            isId: true,
            type: ['string', 'null'],
            errorMessage: {
              type: 'must be a valid id, or null',
              pattern: 'must be a valid id',
            },
            pattern: '^[0-9a-fA-F]{24}$',
          },
          boolean: { type: 'boolean', errorMessage: { type: 'must be a boolean' } },
          date: {
            type: 'string',
            isDate: true,
            errorMessage: {
              type: 'must be a valid date',
              pattern: 'must be a valid date',
              enum: 'must be one of: "2023-01-01T00:00:00.000Z"',
            },
            pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z',
            enum: ['2023-01-01T00:00:00.000Z'],
          },
          dateTwo: {
            type: ['string', 'null'],
            isDate: true,
            errorMessage: {
              type: 'must be a valid date, or null',
              pattern: 'must be a valid date',
              enum: 'must be one of: "2023-01-01T00:00:00.000Z"',
            },
            enum: ['2023-01-01T00:00:00.000Z', null],
            pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z',
          },
          id: {
            isId: true,
            type: 'string',
            errorMessage: {
              type: 'must be a valid id',
              pattern: 'must be a valid id',
              enum: 'must be one of: "6478a6c5392350aaced68cf9"',
            },
            pattern: '^[0-9a-fA-F]{24}$',
            enum: ['6478a6c5392350aaced68cf9'],
          },
          idTwo: {
            isId: true,
            type: ['string', 'null'],
            errorMessage: {
              pattern: 'must be a valid id',
              type: 'must be a valid id, or null',
              enum: 'must be one of: "6478a6c5392350aaced68cf9"',
            },
            pattern: '^[0-9a-fA-F]{24}$',
            enum: ['6478a6c5392350aaced68cf9', null],
          },
          array: {
            type: ['array', 'null'],
            errorMessage: {
              type: 'must be a valid array, or null',
              minItems: 'must contain at least 3 entries',
              maxItems: 'must not contain more than 10 entries',
              uniqueItems: 'must contain only unique entries',
            },
            items: {
              type: ['string', 'null'],
              errorMessage: { type: 'must be a string, or null' },
              default: null,
            },
            minItems: 3,
            maxItems: 10,
            uniqueItems: true,
          },
          arrayTwo: {
            type: 'array',
            errorMessage: {
              type: 'must be a valid array',
              minItems: 'must contain at least 1 entry',
              maxItems: 'must not contain more than 1 entry',
              uniqueItems: 'must contain only unique entries',
            },
            items: {
              type: ['string', 'null'],
              errorMessage: { type: 'must be a string, or null' },
              default: null,
            },
            minItems: 1,
            maxItems: 1,
            uniqueItems: true,
          },
        },
      },
      response: {
        '2xx': {
          type: 'object',
          additionalProperties: false,
          nullable: true,
          properties: {
            relation: { oneOf: [{ type: 'string' }, { $ref: 'test2.json' }] },
            _id: { type: 'string', nullable: true },
            date: { type: 'string', nullable: true },
            float: { type: 'number', nullable: true },
            binary: { type: 'string', nullable: true },
            boolean: { type: 'boolean', nullable: true },
            integer: { type: 'integer', nullable: true },
            array: {
              type: 'array',
              items: { type: 'string', nullable: true },
              nullable: true,
            },
          },
        },
      },
    });
  });

  test('[formatError] query', () => {
    expect(controller.formatError([{
      instancePath: 'path/to/field',
    }], 'querystring')).toEqual(new BadRequest('INVALID_PAYLOAD', '"querypath.to.field" .'));
  });

  test('[formatError] required property', () => {
    expect(controller.formatError([{
      keyword: 'required',
      instancePath: '/path/to',
      params: { missingProperty: 'field' },
    }], 'body')).toEqual(new BadRequest('INVALID_PAYLOAD', '"body.path.to.field" is required.'));
  });

  test('[formatError] unknown property', () => {
    expect(controller.formatError([{
      keyword: 'additionalProperties',
      instancePath: '/path/to',
      params: { additionalProperty: 'field' },
    }], 'body')).toEqual(new BadRequest('INVALID_PAYLOAD', 'Unknown field "body.path.to.field".'));
  });

  test('[parseFormData] field too large', async () => {
    const payload = {} as IncomingMessage;
    process.env.MUTIPARTY_ERROR_FIELD_TOO_LARGE = 'true';
    const error = new RequestEntityTooLarge('field_too_large', 'Maximum non-file fields size exceeded.');
    await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
    delete process.env.MUTIPARTY_ERROR_FIELD_TOO_LARGE;
  });

  test('[parseFormData] too many fields', async () => {
    const payload = {} as IncomingMessage;
    process.env.MUTIPARTY_ERROR_TOO_MANY_FIELDS = 'true';
    const error = new RequestEntityTooLarge('too_many_fields', 'Maximum number of fields exceeded.');
    await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
    delete process.env.MUTIPARTY_ERROR_TOO_MANY_FIELDS;
  });

  test('[parseFormData] missing content-type header', async () => {
    const payload = {} as IncomingMessage;
    process.env.MUTIPARTY_ERROR_MISSING_HEADER = 'true';
    const error = new UnprocessableEntity('missing_content_type_header', 'Missing "Content-Type" header.');
    await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
    delete process.env.MUTIPARTY_ERROR_MISSING_HEADER;
  });

  test('[parseFormData] other error', async () => {
    const payload = {} as IncomingMessage;
    process.env.MUTIPARTY_ERROR_OTHER = 'true';
    const error = new Error('other error');
    await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
    delete process.env.MUTIPARTY_ERROR_OTHER;
  });

  test('[parseFormData] invalid file type', async () => {
    const payload = {} as IncomingMessage;
    const error = new BadRequest('invalid_file_type', 'Invalid file type "image/png" for file "undefined".');
    await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
  });

  test('[parseFormData] file too large', async () => {
    const payload = {} as IncomingMessage;
    const options = { allowedMimeTypes: ['image/png'], maxFileSize: 10 };
    const error = new BadRequest('file_too_large', 'Maximum size exceeded for file "undefined".');
    await expect(() => controller.parseFormData(payload, options)).rejects.toEqual(error);
  });

  test('[parseFormData] files too large', async () => {
    const payload = {} as IncomingMessage;
    const options = { allowedMimeTypes: ['image/png'], maxFileSize: 100, maxTotalSize: 10 };
    const error = new BadRequest('files_too_large', 'Maximum total files size exceeded.');
    await expect(() => controller.parseFormData(payload, options)).rejects.toEqual(error);
  });

  test('[parseFormData] stream error', async () => {
    const payload = {} as IncomingMessage;
    process.env.FS_ERROR_STREAM = 'true';
    const options = { allowedMimeTypes: ['image/png'] };
    const error = new Error('error');
    await expect(() => controller.parseFormData(payload, options)).rejects.toEqual(error);
    delete process.env.FS_ERROR_STREAM;
  });

  test('[parseFormData] 0 field', async () => {
    const payload = {} as IncomingMessage;
    process.env.MUTIPARTY_NO_FIELD = 'true';
    const options = { allowedMimeTypes: ['image/png'] };
    await controller.parseFormData(payload, options);
    expect(createWriteStream).toHaveBeenCalledTimes(0);
    delete process.env.MUTIPARTY_NO_FIELD;
  });

  test('[parseFormData] 1 file', async () => {
    const payload = {} as IncomingMessage;
    const options = { allowedMimeTypes: ['image/png'] };
    await controller.parseFormData(payload, options);
    expect(createWriteStream).toHaveBeenCalledTimes(1);
  });

  test('[handleNotFound]', () => {
    expect(() => {
      controller.handleNotFound();
    }).toThrow(new NotFound('NOT_FOUND', 'Not Found.'));
  });

  test('[handleError] BadRequest', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new BadRequest('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(400);
    expect(header).toHaveBeenCalledTimes(1);
    expect(header).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ error: { code: 'ERROR', message: 'Error' } });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(error, {
      headers: [],
      method: 'GET',
      statusCode: 400,
      url: 'https://test.test',
    });
  });

  test('[handleError] Unauthorized', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new Unauthorized('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(401);
  });

  test('[handleError] Forbidden', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new Forbidden('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(403);
  });

  test('[handleError] NotFound', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new NotFound('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(404);
  });

  test('[handleError] NotAcceptable', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new NotAcceptable('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(406);
  });

  test('[handleError] Conflict', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new Conflict('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(409);
  });

  test('[handleError] Gone', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new Gone('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(410);
  });

  test('[handleError] UnprocessableEntity', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new UnprocessableEntity('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(422);
  });

  test('[handleError] RequestEntityTooLarge', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new RequestEntityTooLarge('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(413);
  });

  test('[handleError] TooManyRequests', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new TooManyRequests('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(429);
  });

  test('[handleError] validation error', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = { validation: {} };
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(400);
  });

  test('[handleError] payload error', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = { statusCode: 400 };
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid JSON payload.' } });
  });

  test('[handleError] other error', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = {};
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    await controller.handleError(error as FastifyError, request, response);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error.' } });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(error, {
      headers: [],
      method: 'GET',
      statusCode: 500,
      url: 'https://test.test',
    });
  });

  test('[auth] invalid device id', async () => {
    await expect(async () => {
      await controller.auth('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', 'invalid');
    }).rejects.toEqual(new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.'));
  });

  test('[auth] unknown error', async () => {
    process.env.UNKNOWN_ERROR = 'true';
    await expect(async () => {
      await controller.auth('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', 'valid');
    }).rejects.toEqual(new Error('UNKNOWN'));
  });

  test('[auth] valid device id', async () => {
    const user = await controller.auth('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', 'valid');
    expect(user).toEqual({
      _devices: [{ id: 'valid' }],
      roles: [{
        name: 'TEST',
        permissions: ['TEST'],
      }],
      _permissions: new Set(['TEST']),
    });
  });

  test('[createEndpoint] no collection', async () => {
    const handler = vi.fn();
    const request = {
      headers: {
        'x-device-id': 'valid',
        'user-agent': 'Chrome',
      },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      url: 'https://test.test',
    } as unknown as FastifyRequest;
    const endpoint = controller.createEndpoint({ handler });
    expect(endpoint).toEqual({
      handler: expect.any(Function) as unknown,
      schema: {},
    });
    await endpoint.handler(request, {} as FastifyReply);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(request, {});
  });

  test('[createEndpoint] SEARCH on users collection', async () => {
    const handler = vi.fn();
    const request = {
      headers: {
        'x-device-id': 'valid',
        'user-agent': 'Chrome',
      },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      url: 'https://test.test',
    } as unknown as FastifyRequest;
    const endpoint = controller.createEndpoint({
      handler,
      type: 'SEARCH',
      collection: 'users',
      authenticate: true,
    });
    expect(endpoint).toEqual({
      handler: expect.any(Function) as unknown,
      schema: {
        headers: {
          type: 'object',
          additionalProperties: true,
          required: ['x-device-id'],
          properties: {
            'x-device-id': {
              type: 'string',
              errorMessage: {
                type: 'must be a valid device id',
                pattern: 'must be a valid device id',
              },
            },
          },
        },
      },
    });
    await endpoint.handler(request, {} as FastifyReply);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      ...request,
      body: { filters: {} },
      query: { parsed: true },
      params: {
        deviceId: 'valid',
        userAgent: 'Chrome',
        user: {
          _devices: [{ id: 'valid' }],
          roles: [{ name: 'TEST', permissions: ['TEST'] }],
          _permissions: new Set(['TEST']),
        },
      },
    }, {});
  });

  test('[createEndpoint] UPDATE on users collection', async () => {
    const handler = vi.fn();
    const request = {
      headers: {
        'x-device-id': 'valid',
        'user-agent': 'Chrome',
      },
      params: {
        id: 'me',
      },
      body: {
        roles: [],
      },
      query: {},
      method: 'GET',
      url: 'https://test.test',
    } as unknown as FastifyRequest;
    const endpoint = controller.createEndpoint({
      handler,
      type: 'UPDATE',
      collection: 'users',
      authenticate: true,
    });
    await endpoint.handler(request, {} as FastifyReply);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      ...request,
      query: { parsed: true },
      params: {
        id: undefined,
        deviceId: 'valid',
        userAgent: 'Chrome',
        user: {
          _devices: [{ id: 'valid' }],
          roles: [{ name: 'TEST', permissions: ['TEST'] }],
          _permissions: new Set(['TEST']),
        },
      },
    }, {});
  });

  test('[createEndpoints]', async () => {
    const send = vi.fn();
    const request = { params: {}, body: {}, query: {} } as FastifyRequest;
    const response = { send, status: vi.fn(() => ({ send })) } as unknown as FastifyReply;
    vi.spyOn(controller, 'createEndpoint').mockImplementation(({ handler, schemaTransformer }) => {
      schemaTransformer?.({ body: { properties: {} } });
      handler(request, response).catch(vi.fn);
      return { handler, schema: {} };
    });
    await expect(async () => {
      await controller.apiHandlers._model.handler({
        query: { collection: 'unknown', id: 'me' },
      } as FastifyRequest, response);
    }).rejects.toEqual(new NotFound('NO_COLLECTION', 'Collection "unknown" does not exist.'));
    const server = {
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };
    const instance = {
      addHook: vi.fn(async (_event, callback: (...args: unknown[]) => Promise<void>) => {
        try {
          await callback({}, { header: vi.fn() });
        } catch (e) {
          // No - op.
        }
      }),
      setErrorHandler: vi.fn(),
      setNotFoundHandler: vi.fn(),
      setValidatorCompiler: vi.fn(),
      setSerializerCompiler: vi.fn((callback: (...args: unknown[]) => unknown) => callback({})),
      addContentTypeParser: vi.fn((_, callback: (...args: unknown[]) => unknown) => {
        callback('', { headers: { 'content-type': 'multipart/form-data' } }, vi.fn());
        callback('', { headers: { 'content-type': 'application/json' }, on: vi.fn() }, vi.fn());
      }),
      setSchemaErrorFormatter: vi.fn(),
      register: vi.fn((callback: (...args: unknown[]) => unknown) => (
        callback(server, null, vi.fn())
      )),
    } as unknown as FastifyInstance;
    const handler = expect.any(Function) as unknown;
    await controller.createEndpoints(instance);
    expect(send).toHaveBeenCalledTimes(21);
    expect(send).toHaveBeenCalledWith({});
    expect(server.delete).toHaveBeenCalledTimes(2);
    expect(server.delete).toHaveBeenCalledWith('/users/:id', { handler, schema: {} });
    expect(server.delete).toHaveBeenCalledWith('/roles/:id', { handler, schema: {} });
    expect(server.get).toHaveBeenCalledTimes(5);
    expect(server.get).toHaveBeenCalledWith('/users', { handler, schema: {} });
    expect(server.get).toHaveBeenCalledWith('/roles', { handler, schema: {} });
    expect(server.get).toHaveBeenCalledWith('/_model', { handler, schema: {} });
    expect(server.get).toHaveBeenCalledWith('/users/:id', { handler, schema: {} });
    expect(server.get).toHaveBeenCalledWith('/roles/:id', { handler, schema: {} });
    expect(server.put).toHaveBeenCalledTimes(4);
    expect(server.put).toHaveBeenCalledWith('/users/:id', { handler, schema: {} });
    expect(server.put).toHaveBeenCalledWith('/roles/:id', { handler, schema: {} });
    expect(server.put).toHaveBeenCalledWith('/auth/verify-email', { handler, schema: {} });
    expect(server.put).toHaveBeenCalledWith('/auth/reset-password', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledTimes(10);
    expect(server.post).toHaveBeenCalledWith('/users', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledWith('/roles', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledWith('/users/:id', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledWith('/roles/:id', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledWith('/auth/sign-in', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledWith('/auth/sign-up', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledWith('/auth/sign-out', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledWith('/auth/verify-email', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledWith('/auth/reset-password', { handler, schema: {} });
    expect(server.post).toHaveBeenCalledWith('/auth/refresh-token', { handler, schema: {} });
    expect(instance.addHook).toHaveBeenCalledTimes(3);
    expect(instance.addHook).toHaveBeenCalledWith('onSend', expect.any(Function));
    expect(instance.addHook).toHaveBeenCalledWith('onTimeout', expect.any(Function));
    expect(instance.addHook).toHaveBeenCalledWith('preSerialization', expect.any(Function));
    expect(instance.setSerializerCompiler).toHaveBeenCalledTimes(1);
    expect(instance.setValidatorCompiler).toHaveBeenCalledTimes(1);
    expect(instance.addContentTypeParser).toHaveBeenCalledTimes(1);
  });
});
