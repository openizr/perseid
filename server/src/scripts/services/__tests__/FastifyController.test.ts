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
import { Id } from '@perseid/core';
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
import OAuthEngine from 'scripts/services/OAuthEngine';
import EmailClient from 'scripts/services/EmailClient';
import CacheClient from 'scripts/services/CacheClient';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import TooManyRequests from 'scripts/errors/TooManyRequests';
import DatabaseClient from 'scripts/services/DatabaseClient';
import { type DataModel } from 'scripts/services/__mocks__/schema';
import FastifyController from 'scripts/services/FastifyController';
import UnprocessableEntity from 'scripts/errors/UnprocessableEntity';
import RequestEntityTooLarge from 'scripts/errors/RequestEntityTooLarge';

type Validate = (arg: unknown, ...args: unknown[]) => boolean;

type TestFastifyController = FastifyController<DataModel> & {
  oAuth: FastifyController['oAuth'];
  KEYWORDS: FastifyController['KEYWORDS'];
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
  vi.mock('scripts/services/OAuthEngine');
  vi.mock('scripts/services/EmailClient');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/DatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const emailClient = new EmailClient(logger);
  const cacheClient = new CacheClient({ cachePath: '/var/www/html/node_modules/.cache' });
  const model = new Model<DataModel>({} as Record<keyof DataModel, CollectionDataModel<DataModel>>);
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
  const engine = new OAuthEngine<DataModel>(
    model,
    logger,
    databaseClient,
    emailClient,
    cacheClient,
    {
      baseUrl: '',
      oAuth: {
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
        oAuth: {},
        collections: {},
      },
    }) as TestFastifyController;
  });

  test('[KEYWORDS]', () => {
    const context = { parentData: {}, parentDataProperty: 'test' };
    let validate = (controller.KEYWORDS[0] as FuncKeywordDefinition).validate as Validate;
    expect(validate({}, null, { nullable: true }, context)).toBe(true);
    expect(validate({}, '', {}, context)).toBe(false);
    expect(validate({}, 'data:test', {}, context)).toBe(true);
    validate = (controller.KEYWORDS[1] as FuncKeywordDefinition).validate as Validate;
    expect(validate({}, null, { nullable: true }, context)).toBe(true);
    expect(validate({}, '', {}, context)).toBe(false);
    expect(validate({}, '2023-01-01T00:00:00.000Z', { enum: [] }, context)).toBe(false);
    expect(validate({}, '2023-01-01T00:00:00.000Z', {}, context)).toBe(true);
    validate = (controller.KEYWORDS[2] as FuncKeywordDefinition).validate as Validate;
    expect(validate({}, null, { nullable: true }, context)).toBe(true);
    expect(validate({}, '', {}, context)).toBe(false);
    expect(validate({}, '64723318e84f943f1ad6578b', { enum: [] }, context)).toBe(false);
    expect(validate({}, '64723318e84f943f1ad6578b', {}, context)).toBe(true);
  });

  test('[createSchema]', () => {
    expect(controller.createSchema({
      body: {
        type: 'object',
        fields: model.getCollection('test').fields,
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
        errorMessage: { type: 'must be a valid object' },
        default: null,
        properties: {
          primitiveOne: {
            isId: true,
            type: 'string',
            errorMessage: { type: 'must be a valid id', pattern: 'must be a valid id' },
            pattern: '^[0-9a-fA-F]{24}$',
            default: null,
            nullable: true,
          },
          primitiveTwo: {
            type: 'string',
            minLength: 10,
            isBinary: true,
            errorMessage: { type: 'must be a base64-encoded binary' },
            default: 'testtest',
            nullable: true,
          },
          primitiveThree: {
            type: 'string',
            errorMessage: { type: 'must be a string' },
            default: null,
            nullable: true,
          },
          arrayOne: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array' },
            items: {
              type: ['object', 'null'],
              additionalProperties: false,
              errorMessage: { type: 'must be a valid object' },
              required: ['object'],
              default: null,
              properties: {
                dynamicObject: {
                  type: ['object', 'null'],
                  additionalProperties: false,
                  errorMessage: { type: 'must be a valid object' },
                  default: null,
                  properties: {
                    '^testOne$': {
                      isId: true,
                      type: 'string',
                      errorMessage: {
                        type: 'must be a valid id',
                        pattern: 'must be a valid id',
                      },
                      pattern: '^[0-9a-fA-F]{24}$',
                      default: null,
                      nullable: true,
                    },
                    '^testTwo$': {
                      isId: true,
                      type: 'string',
                      errorMessage: {
                        type: 'must be a valid id',
                        pattern: 'must be a valid id',
                      },
                      pattern: '^[0-9a-fA-F]{24}$',
                      default: null,
                      nullable: true,
                    },
                    '^special(.*)$': {
                      isId: true,
                      type: 'string',
                      errorMessage: {
                        type: 'must be a valid id',
                        pattern: 'must be a valid id',
                      },
                      pattern: '^[0-9a-fA-F]{24}$',
                      default: null,
                      nullable: true,
                    },
                  },
                },
                object: {
                  type: 'object',
                  additionalProperties: false,
                  errorMessage: { type: 'must be a valid object' },
                  properties: {
                    fieldOne: {
                      type: 'string',
                      errorMessage: { type: 'must be a string' },
                      default: null,
                      nullable: true,
                    },
                  },
                },
              },
            },
            default: null,
          },
          arrayTwo: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array' },
            items: {
              isId: true,
              type: 'string',
              errorMessage: { type: 'must be a valid id', pattern: 'must be a valid id' },
              pattern: '^[0-9a-fA-F]{24}$',
              default: null,
              nullable: true,
            },
            default: null,
          },
          arrayThree: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array' },
            items: {
              isId: true,
              type: 'string',
              errorMessage: { type: 'must be a valid id', pattern: 'must be a valid id' },
              pattern: '^[0-9a-fA-F]{24}$',
              default: null,
              nullable: true,
            },
            default: null,
          },
          arrayFour: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array' },
            items: {
              type: 'string',
              errorMessage: { type: 'must be a string' },
              default: null,
              nullable: true,
            },
            default: null,
          },
          arrayFive: {
            type: ['array', 'null'],
            errorMessage: { type: 'must be a valid array' },
            items: {
              type: ['object', 'null'],
              additionalProperties: false,
              errorMessage: { type: 'must be a valid object' },
              default: null,
              properties: {
                fieldOne: {
                  type: 'string',
                  errorMessage: { type: 'must be a string' },
                  default: null,
                  nullable: true,
                },
              },
            },
            default: null,
          },
          dynamicOne: {
            type: ['object', 'null'],
            additionalProperties: false,
            errorMessage: { type: 'must be a valid object' },
            default: null,
            properties: {
              '^testOne$': {
                isId: true,
                type: 'string',
                errorMessage: {
                  type: 'must be a valid id',
                  pattern: 'must be a valid id',
                },
                pattern: '^[0-9a-fA-F]{24}$',
                default: null,
                nullable: true,
              },
              '^testTwo$': {
                isId: true,
                type: 'string',
                errorMessage: {
                  type: 'must be a valid id',
                  pattern: 'must be a valid id',
                },
                pattern: '^[0-9a-fA-F]{24}$',
                default: null,
                nullable: true,
              },
              '^testThree$': {
                type: ['object', 'null'],
                additionalProperties: false,
                errorMessage: { type: 'must be a valid object' },
                default: null,
                properties: {
                  test: {
                    type: 'string',
                    errorMessage: { type: 'must be a string' },
                    default: null,
                    nullable: true,
                  },
                },
              },
              '^special(.*)$': {
                isId: true,
                type: 'string',
                errorMessage: {
                  type: 'must be a valid id',
                  pattern: 'must be a valid id',
                },
                pattern: '^[0-9a-fA-F]{24}$',
                default: null,
                nullable: true,
              },
            },
          },
          dynamicTwo: {
            type: ['object', 'null'],
            additionalProperties: false,
            errorMessage: { type: 'must be a valid object' },
            default: null,
            properties: {
              '^testOne$': {
                isId: true,
                type: 'string',
                errorMessage: {
                  type: 'must be a valid id',
                  pattern: 'must be a valid id',
                },
                pattern: '^[0-9a-fA-F]{24}$',
                default: null,
                nullable: true,
              },
              '^testTwo$': {
                type: ['object', 'null'],
                additionalProperties: false,
                errorMessage: { type: 'must be a valid object' },
                default: null,
                properties: {
                  test: {
                    type: 'string',
                    errorMessage: { type: 'must be a string' },
                    default: null,
                    nullable: true,
                  },
                },
              },
            },
          },
        },
      },
      response: {
        '2xx': {
          type: 'object',
          additionalProperties: false,
          errorMessage: {},
          nullable: true,
          properties: {},
        },
      },
    });
    expect(controller.createSchema({
      body: {
        type: 'object',
        fields: model.getCollection('test2').fields,
      },
      response: {
        '2xx': {
          type: 'object',
          fields: {
            relation: { type: 'id', relation: 'test2' },
            array: { type: 'array', fields: { type: 'string' } },
            dynamicObject: { type: 'dynamicObject', fields: {} },
          },
        },
      },
    }, 'CREATE')).toEqual({
      body: {
        type: ['object', 'null'],
        additionalProperties: false,
        errorMessage: { type: 'must be a valid object' },
        default: null,
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
              enum: 'must be one of: "1"',
            },
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: 0,
            exclusiveMaximum: 10,
            multipleOf: 2,
            enum: [1],
            default: 4,
            nullable: true,
          },
          floatTwo: {
            type: 'number',
            errorMessage: { type: 'must be a float' },
            default: null,
            nullable: true,
          },
          integer: {
            type: 'integer',
            errorMessage: {
              type: 'must be a integer',
              minimum: 'must be greater than or equal to 0',
              maximum: 'must be smaller than or equal to 10',
              exclusiveMinimum: 'must be greater than 0',
              exclusiveMaximum: 'must be smaller than 10',
              multipleOf: 'must be a multiple of 2',
              enum: 'must be one of: "1"',
            },
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: 0,
            exclusiveMaximum: 10,
            multipleOf: 2,
            enum: [1],
            default: 4,
            nullable: true,
          },
          integerTwo: {
            type: 'integer',
            errorMessage: { type: 'must be a integer' },
            default: null,
            nullable: true,
          },
          string: {
            type: 'string',
            errorMessage: {
              type: 'must be a string',
              maxLength: 'must be no longer than 10 characters',
              minLength: 'must be no shorter than 1 characters',
              pattern: 'must match "test" pattern',
              enum: 'must be one of: "test"',
            },
            maxLength: 10,
            minLength: 1,
            pattern: 'test',
            enum: ['test'],
            default: '',
            nullable: true,
          },
          null: { type: 'null', errorMessage: {} },
          binary: {
            type: 'string',
            minLength: 10,
            isBinary: true,
            errorMessage: { type: 'must be a base64-encoded binary' },
            default: null,
            nullable: true,
          },
          enum: {
            type: 'string',
            errorMessage: { type: 'must be a string', enum: 'must be one of: "test"' },
            enum: ['test'],
            default: null,
            nullable: true,
          },
          boolean: {
            type: 'boolean',
            isBinary: true,
            errorMessage: { type: 'must be a boolean' },
            default: false,
            nullable: true,
          },
          booleanTwo: {
            type: 'boolean',
            isBinary: true,
            errorMessage: { type: 'must be a boolean' },
            default: null,
            nullable: true,
          },
          relation: {
            isId: true,
            type: 'string',
            errorMessage: { type: 'must be a valid id', pattern: 'must be a valid id' },
            pattern: '^[0-9a-fA-F]{24}$',
            default: null,
            nullable: true,
          },
          date: {
            type: 'string',
            isDate: true,
            errorMessage: {
              type: 'must be a valid date',
              pattern: 'must be a valid date',
              enum: 'must be one of: "Sun Jan 01 2023 00:00:00 GMT+0000 (Coordinated Universal Time)"',
            },
            pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z',
            enum: ['2023-01-01T00:00:00.000Z'],
            default: new Date('2023-01-01'),
            nullable: true,
          },
          dateTwo: {
            type: 'string',
            isDate: true,
            errorMessage: {
              type: 'must be a valid date',
              pattern: 'must be a valid date',
            },
            pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z',
            default: null,
            nullable: true,
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
            nullable: true,
          },
          array: {
            type: ['array', 'null'],
            errorMessage: {
              type: 'must be a valid array',
              minItems: 'must contain at least 3 entries',
              maxItems: 'must not contain more than 10 entries',
              uniqueItems: 'must contain only unique entries',
            },
            items: {
              type: 'string',
              errorMessage: { type: 'must be a string' },
              default: null,
              nullable: true,
            },
            minItems: 3,
            maxItems: 10,
            uniqueItems: true,
            default: null,
          },
          arrayTwo: {
            type: ['array', 'null'],
            errorMessage: {
              type: 'must be a valid array',
              minItems: 'must contain at least 1 entry',
              maxItems: 'must not contain more than 1 entry',
              uniqueItems: 'must contain only unique entries',
            },
            items: {
              type: 'string',
              errorMessage: { type: 'must be a string' },
              default: null,
              nullable: true,
            },
            minItems: 1,
            maxItems: 1,
            uniqueItems: true,
            default: null,
          },
          dynamicObject: {
            type: ['object', 'null'],
            additionalProperties: false,
            errorMessage: {
              type: 'must be a valid object',
              minProperties: 'must contain at least 3 entries',
              maxProperties: 'must not contain more than 10 entries',
            },
            minProperties: 3,
            maxProperties: 10,
            default: null,
            properties: {
              test: {
                type: 'string',
                errorMessage: { type: 'must be a string' },
                default: null,
                nullable: true,
              },
            },
          },
          dynamicObjectTwo: {
            type: ['object', 'null'],
            additionalProperties: false,
            errorMessage: {
              type: 'must be a valid object',
              minProperties: 'must contain at least 1 entry',
              maxProperties: 'must not contain more than 1 entry',
            },
            minProperties: 1,
            maxProperties: 1,
            default: null,
            properties: {
              test: {
                type: 'string',
                errorMessage: { type: 'must be a string' },
                default: null,
                nullable: true,
              },
            },
          },
        },
      },
      response: {
        '2xx': {
          type: 'object',
          additionalProperties: false,
          errorMessage: {},
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
              errorMessage: {},
              items: { type: 'string', errorMessage: {}, nullable: true },
              nullable: true,
            },
            dynamicObject: {
              type: 'object',
              additionalProperties: false,
              errorMessage: {},
              nullable: true,
              properties: {},
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

  test('[handleNotFound]', async () => {
    expect(async () => {
      await controller.handleNotFound();
    }).rejects.toEqual(new NotFound('NOT_FOUND', 'Not Found.'));
  });

  test('[handleError] BadRequest', async () => {
    const send = vi.fn();
    const header = vi.fn(() => ({ send }));
    const status = vi.fn(() => ({ header }));
    const error = new BadRequest('ERROR', 'Error');
    const response = { status } as unknown as FastifyReply;
    const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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
    controller.handleError(error as FastifyError, request, response);
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

  test('[oAuth] invalid device id', async () => {
    expect(async () => {
      await controller.oAuth('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', 'invalid');
    }).rejects.toEqual(new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.'));
  });

  test('[oAuth] unknown error', async () => {
    process.env.UNKNOWN_ERROR = 'true';
    expect(async () => {
      await controller.oAuth('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', 'valid');
    }).rejects.toEqual(new Error('UNKNOWN'));
  });

  test('[oAuth] valid device id', async () => {
    const user = await controller.oAuth('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', 'valid');
    expect(user).toEqual({
      _devices: [{ id: 'valid' }],
      roles: [{
        name: 'TEST',
        permissions: ['TEST'],
      }],
      _permissions: { TEST: true },
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
      handler: expect.any(Function),
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
      handler: expect.any(Function),
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
          _permissions: { TEST: true },
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
          _permissions: { TEST: true },
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
      handler(request, response);
      return { handler, schema: {} };
    });
    const server = {
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      setErrorHandler: vi.fn(),
      setNotFoundHandler: vi.fn(),
      setValidatorCompiler: vi.fn(),
      setSerializerCompiler: vi.fn((callback) => callback({})),
      addContentTypeParser: vi.fn((_, callback) => {
        callback('', { headers: { 'content-type': 'multipart/form-data' } }, vi.fn());
        callback('', { headers: { 'content-type': 'application/json' }, on: vi.fn() }, vi.fn());
      }),
      setSchemaErrorFormatter: vi.fn(),
      addHook: vi.fn(async (_event, callback) => {
        try {
          await callback();
        } catch (e) {
          // No-op.
        }
      }),
    } as unknown as FastifyInstance;
    controller.createEndpoints(server);
    expect(server.delete).toHaveBeenCalledTimes(2);
    expect(server.delete).toHaveBeenCalledWith('/users/:id', { handler: expect.any(Function), schema: {} });
    expect(server.delete).toHaveBeenCalledWith('/roles/:id', { handler: expect.any(Function), schema: {} });
    expect(server.get).toHaveBeenCalledTimes(5);
    expect(server.get).toHaveBeenCalledWith('/users', { handler: expect.any(Function), schema: {} });
    expect(server.get).toHaveBeenCalledWith('/roles', { handler: expect.any(Function), schema: {} });
    expect(server.get).toHaveBeenCalledWith('/_model', { handler: expect.any(Function), schema: {} });
    expect(server.get).toHaveBeenCalledWith('/users/:id', { handler: expect.any(Function), schema: {} });
    expect(server.get).toHaveBeenCalledWith('/roles/:id', { handler: expect.any(Function), schema: {} });
    expect(server.put).toHaveBeenCalledTimes(4);
    expect(server.put).toHaveBeenCalledWith('/users/:id', { handler: expect.any(Function), schema: {} });
    expect(server.put).toHaveBeenCalledWith('/roles/:id', { handler: expect.any(Function), schema: {} });
    expect(server.put).toHaveBeenCalledWith('/oauth/verify-email', { handler: expect.any(Function), schema: {} });
    expect(server.put).toHaveBeenCalledWith('/oauth/reset-password', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledTimes(10);
    expect(server.post).toHaveBeenCalledWith('/users', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledWith('/roles', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledWith('/users/:id', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledWith('/roles/:id', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledWith('/oauth/sign-in', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledWith('/oauth/sign-up', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledWith('/oauth/sign-out', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledWith('/oauth/verify-email', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledWith('/oauth/reset-password', { handler: expect.any(Function), schema: {} });
    expect(server.post).toHaveBeenCalledWith('/oauth/refresh-token', { handler: expect.any(Function), schema: {} });
    expect(server.addHook).toHaveBeenCalledTimes(3);
    expect(server.addHook).toHaveBeenCalledWith('onSend', expect.any(Function));
    expect(server.addHook).toHaveBeenCalledWith('onTimeout', expect.any(Function));
    expect(server.addHook).toHaveBeenCalledWith('preSerialization', expect.any(Function));
    expect(server.setSerializerCompiler).toHaveBeenCalledTimes(1);
    expect(server.setValidatorCompiler).toHaveBeenCalledTimes(1);
    expect(server.addContentTypeParser).toHaveBeenCalledTimes(1);
  });
});
