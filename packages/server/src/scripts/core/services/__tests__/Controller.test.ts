/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import jwt from 'jsonwebtoken';
import { createWriteStream } from 'fs';
import { type IncomingMessage } from 'http';
import Model from 'scripts/core/services/Model';
import { type FuncKeywordDefinition } from 'ajv';
import Logger from 'scripts/core/services/Logger';
import Conflict from 'scripts/core/errors/Conflict';
import NotFound from 'scripts/core/errors/NotFound';
import EngineError from 'scripts/core/errors/Engine';
import Forbidden from 'scripts/core/errors/Forbidden';
import { type ResourceSchema, Id } from '@perseid/core';
import BadRequest from 'scripts/core/errors/BadRequest';
import DatabaseError from 'scripts/core/errors/Database';
import Controller from 'scripts/core/services/Controller';
import Unauthorized from 'scripts/core/errors/Unauthorized';
import UsersEngine from 'scripts/core/services/UsersEngine';
import EmailClient from 'scripts/core/services/EmailClient';
import CacheClient from 'scripts/core/services/CacheClient';
import NotAcceptable from 'scripts/core/errors/NotAcceptable';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';
import UnprocessableEntity from 'scripts/core/errors/UnprocessableEntity';
import RequestEntityTooLarge from 'scripts/core/errors/RequestEntityTooLarge';
import MongoDatabaseClient from 'scripts/mongodb/services/MongoDatabaseClient';

type Validate = (arg: unknown, ...args: unknown[]) => boolean;

type TestController = Controller<DataModel> & {
  auth: Controller['auth'];
  parseInt: Controller['parseInt'];
  parseQuery: Controller['parseQuery'];
  catchErrors: Controller['catchErrors'];
  formatError: Controller['formatError'];
  AJV_KEYWORDS: Controller['AJV_KEYWORDS'];
  formatOutput: Controller['formatOutput'];
  parseFormData: Controller['parseFormData'];
  handleNotFound: Controller['handleNotFound'];
  AJV_FORMATTERS: Controller['AJV_FORMATTERS'];
};

describe('core/services/Controller', () => {
  vi.mock('fs');
  vi.mock('os');
  vi.mock('path');
  vi.mock('ajv');
  vi.mock('multiparty');
  vi.mock('ajv-errors');
  vi.mock('jsonwebtoken');
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');
  vi.mock('scripts/core/services/UsersEngine');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/core/services/EmailClient');
  vi.mock('scripts/mongodb/services/MongoDatabaseClient');

  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const emailClient = new EmailClient(logger, { connectTimeout: 0 });
  const cacheClient = new CacheClient({ cachePath: '/.cache', connectTimeout: 0 });
  const model = new Model<DataModel>({} as Record<keyof DataModel, ResourceSchema<DataModel>>);
  const databaseClient = new MongoDatabaseClient<DataModel>(model, logger, cacheClient, {
    connectionLimit: 0,
    connectTimeout: 0,
    database: '',
    host: '',
    password: '',
    port: 0,
    protocol: '',
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
  let controller: TestController;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UNKNOWN_ERROR;
    controller = new Controller<DataModel>(model, logger, engine, {
      version: '0.0.1',
      handleCORS: false,
      endpoints: { auth: {}, resources: {} },
    }) as TestController;
  });

  test('[AJV_KEYWORDS]', () => {
    const context = { parentData: {}, parentDataProperty: 'test' };
    let validate = (controller.AJV_KEYWORDS[0] as FuncKeywordDefinition).validate as Validate;
    expect(validate({}, null, { type: ['string', 'null'] }, context)).toBe(true);
    expect(validate({}, '', {}, context)).toBe(false);
    expect(validate({}, 'data:test', {}, context)).toBe(true);
    validate = (controller.AJV_KEYWORDS[1] as FuncKeywordDefinition).validate as Validate;
    expect(validate({}, null, { type: ['string', 'null'] }, context)).toBe(true);
    expect(validate({}, '', {}, context)).toBe(false);
    expect(validate({}, '2023-01-01T00:00:00.000Z', { enum: [] }, context)).toBe(false);
    expect(validate({}, '2023-01-01T00:00:00.000Z', {}, context)).toBe(true);
    validate = (controller.AJV_KEYWORDS[2] as FuncKeywordDefinition).validate as Validate;
    expect(validate({}, null, { type: ['string', 'null'] }, context)).toBe(true);
    expect(validate({}, '', {}, context)).toBe(false);
    expect(validate({}, '64723318e84f943f1ad6578b', { enum: [] }, context)).toBe(false);
    expect(validate({}, '64723318e84f943f1ad6578b', {}, context)).toBe(true);
  });

  describe('[AJV_FORMATTERS]', () => {
    test('null', () => {
      expect(controller.AJV_FORMATTERS.null({ type: 'null' }, false)).toEqual({
        type: 'null',
        errorMessage: {},
      });
    });

    test('id', () => {
      expect(controller.AJV_FORMATTERS.id({
        type: 'id',
        enum: [new Id('000000000000000000000001')],
      }, false)).toEqual({
        enum: [
          '000000000000000000000001',
          null,
        ],
        errorMessage: {
          enum: 'must be one of: "000000000000000000000001"',
          pattern: 'must be a valid id',
          type: 'must be a valid id, or null',
        },
        isId: true,
        pattern: '^[0-9a-fA-F]{24}$',
        type: [
          'string',
          'null',
        ],
      });
      expect(controller.AJV_FORMATTERS.id({
        type: 'id',
        isRequired: true,
        enum: [new Id('000000000000000000000001')],
      }, false)).toEqual({
        enum: [
          '000000000000000000000001',
        ],
        errorMessage: {
          enum: 'must be one of: "000000000000000000000001"',
          pattern: 'must be a valid id',
          type: 'must be a valid id',
        },
        isId: true,
        pattern: '^[0-9a-fA-F]{24}$',
        type: 'string',
      });
    });

    test('binary', () => {
      expect(controller.AJV_FORMATTERS.binary({
        type: 'binary',
      }, false)).toEqual({
        errorMessage: {
          type: 'must be a base64-encoded binary, or null',
        },
        isBinary: true,
        minLength: 10,
        type: [
          'string',
          'null',
        ],
      });
      expect(controller.AJV_FORMATTERS.binary({
        type: 'binary',
        isRequired: true,
      }, false)).toEqual({
        errorMessage: {
          type: 'must be a base64-encoded binary',
        },
        isBinary: true,
        minLength: 10,
        type: 'string',
      });
    });

    test('date', () => {
      expect(controller.AJV_FORMATTERS.date({
        type: 'date',
        enum: [new Date('2023-01-01')],
      }, false)).toEqual({
        enum: [
          '2023-01-01T00:00:00.000Z',
          null,
        ],
        errorMessage: {
          enum: 'must be one of: "2023-01-01T00:00:00.000Z"',
          pattern: 'must be a valid date',
          type: 'must be a valid date, or null',
        },
        isDate: true,
        pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z',
        type: [
          'string',
          'null',
        ],
      });
      expect(controller.AJV_FORMATTERS.date({
        type: 'date',
        isRequired: true,
        enum: [new Date('2023-01-01')],
      }, false)).toEqual({
        enum: [
          '2023-01-01T00:00:00.000Z',
        ],
        errorMessage: {
          enum: 'must be one of: "2023-01-01T00:00:00.000Z"',
          pattern: 'must be a valid date',
          type: 'must be a valid date',
        },
        isDate: true,
        pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z',
        type: 'string',
      });
    });

    test('boolean', () => {
      expect(controller.AJV_FORMATTERS.boolean({
        type: 'boolean',
      }, false)).toEqual({
        errorMessage: {
          type: 'must be a boolean, or null',
        },
        type: [
          'boolean',
          'null',
        ],
      });
      expect(controller.AJV_FORMATTERS.boolean({
        type: 'boolean',
        isRequired: true,
      }, false)).toEqual({
        errorMessage: {
          type: 'must be a boolean',
        },
        type: 'boolean',
      });
    });

    test('float', () => {
      expect(controller.AJV_FORMATTERS.float({
        type: 'float',
        maximum: 3,
        minimum: 2,
        multipleOf: 1,
        enum: [2],
      }, false)).toEqual({
        errorMessage: {
          enum: 'must be one of: 2',
          maximum: 'must be smaller than or equal to 3',
          minimum: 'must be greater than or equal to 2',
          multipleOf: 'must be a multiple of 1',
          type: 'must be a float, or null',
        },
        maximum: 3,
        minimum: 2,
        multipleOf: 1,
        enum: [2, null],
        type: [
          'number',
          'null',
        ],
      });
      expect(controller.AJV_FORMATTERS.float({
        type: 'float',
        isRequired: true,
        exclusiveMaximum: 3,
        exclusiveMinimum: 0,
        enum: [2],
      }, false)).toEqual({
        errorMessage: {
          enum: 'must be one of: 2',
          exclusiveMaximum: 'must be smaller than 3',
          exclusiveMinimum: 'must be greater than 0',
          type: 'must be a float',
        },
        enum: [2],
        exclusiveMaximum: 3,
        exclusiveMinimum: 0,
        type: 'number',
      });
    });

    test('integer', () => {
      expect(controller.AJV_FORMATTERS.integer({
        type: 'integer',
        maximum: 3,
        minimum: 2,
        multipleOf: 1,
        enum: [2],
      }, false)).toEqual({
        errorMessage: {
          enum: 'must be one of: 2',
          maximum: 'must be smaller than or equal to 3',
          minimum: 'must be greater than or equal to 2',
          multipleOf: 'must be a multiple of 1',
          type: 'must be an integer, or null',
        },
        enum: [2, null],
        maximum: 3,
        minimum: 2,
        multipleOf: 1,
        type: [
          'integer',
          'null',
        ],
      });
      expect(controller.AJV_FORMATTERS.integer({
        type: 'integer',
        isRequired: true,
        exclusiveMaximum: 3,
        exclusiveMinimum: 0,
        enum: [2],
      }, false)).toEqual({
        errorMessage: {
          enum: 'must be one of: 2',
          exclusiveMaximum: 'must be smaller than 3',
          exclusiveMinimum: 'must be greater than 0',
          type: 'must be an integer',
        },
        enum: [2],
        exclusiveMaximum: 3,
        exclusiveMinimum: 0,
        type: 'integer',
      });
    });

    test('string', () => {
      expect(controller.AJV_FORMATTERS.string({
        type: 'string',
        enum: ['test'],
        maxLength: 10,
        minLength: 2,
        pattern: /test/i,
      }, false)).toEqual({
        enum: [
          'test',
          null,
        ],
        errorMessage: {
          enum: 'must be one of: "test"',
          maxLength: 'must be no longer than 10 characters',
          minLength: 'must be no shorter than 2 characters',
          pattern: 'must match "test" pattern',
          type: 'must be a string, or null',
        },
        maxLength: 10,
        minLength: 2,
        pattern: 'test',
        type: [
          'string',
          'null',
        ],
      });
      expect(controller.AJV_FORMATTERS.string({
        type: 'string',
        enum: ['test'],
        maxLength: 10,
        pattern: /test/i,
        isRequired: true,
      }, false)).toEqual({
        enum: ['test'],
        errorMessage: {
          enum: 'must be one of: "test"',
          maxLength: 'must be no longer than 10 characters',
          minLength: 'must be no shorter than 1 characters',
          pattern: 'must match "test" pattern',
          type: 'must be a string',
        },
        maxLength: 10,
        minLength: 1,
        pattern: 'test',
        type: 'string',
      });
    });
    test('object', () => {
      expect(controller.AJV_FORMATTERS.object({
        type: 'object',
        fields: {
          test: { type: 'string' },
        },
      }, false)).toEqual({
        additionalProperties: false,
        required: ['test'],
        type: ['object', 'null'],
        errorMessage: {
          type: 'must be a valid object, or null',
        },
        properties: {
          test: {
            type: ['string', 'null'],
            errorMessage: {
              type: 'must be a string, or null',
            },
          },
        },
      });
      expect(controller.AJV_FORMATTERS.object({
        type: 'object',
        isRequired: true,
        fields: {
          test: { type: 'string' },
        },
      }, false)).toEqual({
        additionalProperties: false,
        type: 'object',
        errorMessage: {
          type: 'must be a valid object',
        },
        properties: {
          test: {
            type: ['string', 'null'],
            errorMessage: {
              type: 'must be a string, or null',
            },
          },
        },
      });
    });
    test('array', () => {
      expect(controller.AJV_FORMATTERS.array({
        type: 'array',
        maxItems: 10,
        minItems: 1,
        uniqueItems: true,
        fields: { type: 'string' },
      }, false)).toEqual({
        errorMessage: {
          maxItems: 'must not contain more than 10 entries',
          minItems: 'must contain at least 1 entry',
          type: 'must be a valid array, or null',
          uniqueItems: 'must contain only unique entries',
        },
        items: {
          errorMessage: {
            type: 'must be a string, or null',
          },
          type: ['string', 'null'],
        },
        maxItems: 10,
        minItems: 1,
        type: ['array', 'null'],
        uniqueItems: true,
      });
      expect(controller.AJV_FORMATTERS.array({
        type: 'array',
        maxItems: 1,
        minItems: 2,
        isRequired: true,
        uniqueItems: true,
        fields: { type: 'string' },
      }, false)).toEqual({
        errorMessage: {
          maxItems: 'must not contain more than 1 entry',
          minItems: 'must contain at least 2 entries',
          type: 'must be a valid array',
          uniqueItems: 'must contain only unique entries',
        },
        items: {
          errorMessage: {
            type: 'must be a string, or null',
          },
          type: ['string', 'null'],
        },
        maxItems: 1,
        minItems: 2,
        type: 'array',
        uniqueItems: true,
      });
    });
  });

  test('[handleNotFound]', () => {
    expect(() => {
      controller.handleNotFound();
    }).toThrow(new NotFound('NOT_FOUND', 'Not Found.'));
  });

  describe('[formatError]', () => {
    test('required property', () => {
      expect(controller.formatError({
        keyword: 'required',
        instancePath: '/path/to',
        params: { missingProperty: 'field' },
      }, 'body')).toEqual(new BadRequest('INVALID_PAYLOAD', '"body.path.to.field" is required.'));
    });

    test('unknown property', () => {
      expect(controller.formatError({
        keyword: 'additionalProperties',
        instancePath: '/path/to',
        params: { additionalProperty: 'field' },
      }, 'body')).toEqual(new BadRequest('INVALID_PAYLOAD', 'Unknown field "body.path.to.field".'));
    });
  });

  test('[formatOutput]', () => {
    expect(controller.formatOutput({
      array: [],
      object: {},
      id: new Id('64723318e84f943f1ad6578b'),
      date: new Date('2023-01-01T00:00:00.000Z'),
      other: 'test',
      binary: new ArrayBuffer(0),
    })).toEqual({
      array: [],
      object: {},
      id: '64723318e84f943f1ad6578b',
      date: '2023-01-01T00:00:00.000Z',
      other: 'test',
      binary: '',
    });
  });

  describe('[parseQuery]', () => {
    const message = '"query.sortBy" and "query.sortOrder" must contain the same number of items.';
    test('INVALID_PAYLOAD error', () => {
      expect(() => (
        controller.parseQuery({ sortBy: '_id' })
      )).toThrow(new BadRequest('INVALID_PAYLOAD', message));
    });
    test('no error', () => {
      expect(controller.parseQuery({
        fields: 'array,test',
        sortBy: '_id,test',
        sortOrder: '-1,1',
        other: 'test',
      })).toEqual({
        fields: new Set(['array', 'test']),
        sortBy: {
          _id: -1,
          test: 1,
        },
        other: 'test',
      });
    });
  });

  describe('[parseFormData]', () => {
    test('field too large', async () => {
      const payload = {} as IncomingMessage;
      process.env.MUTIPARTY_ERROR_FIELD_TOO_LARGE = 'true';
      const error = new RequestEntityTooLarge('field_too_large', 'Maximum non-file fields size exceeded.');
      await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
      delete process.env.MUTIPARTY_ERROR_FIELD_TOO_LARGE;
    });

    test('too many fields', async () => {
      const payload = {} as IncomingMessage;
      process.env.MUTIPARTY_ERROR_TOO_MANY_FIELDS = 'true';
      const error = new RequestEntityTooLarge('too_many_fields', 'Maximum number of fields exceeded.');
      await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
      delete process.env.MUTIPARTY_ERROR_TOO_MANY_FIELDS;
    });

    test('missing content-type header', async () => {
      const payload = {} as IncomingMessage;
      process.env.MUTIPARTY_ERROR_MISSING_HEADER = 'true';
      const error = new UnprocessableEntity('missing_content_type_header', 'Missing "Content-Type" header.');
      await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
      delete process.env.MUTIPARTY_ERROR_MISSING_HEADER;
    });

    test('other error', async () => {
      const payload = {} as IncomingMessage;
      process.env.MUTIPARTY_ERROR_OTHER = 'true';
      const error = new Error('other error');
      await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
      delete process.env.MUTIPARTY_ERROR_OTHER;
    });

    test('invalid file type', async () => {
      const payload = {} as IncomingMessage;
      const error = new BadRequest('invalid_file_type', 'Invalid file type "image/png" for file "undefined".');
      await expect(() => controller.parseFormData(payload)).rejects.toEqual(error);
    });

    test('file too large', async () => {
      const payload = {} as IncomingMessage;
      const options = { allowedMimeTypes: ['image/png'], maxFileSize: 10 };
      const error = new BadRequest('file_too_large', 'Maximum size exceeded for file "undefined".');
      await expect(() => controller.parseFormData(payload, options)).rejects.toEqual(error);
    });

    test('files too large', async () => {
      const payload = {} as IncomingMessage;
      const options = { allowedMimeTypes: ['image/png'], maxFileSize: 100, maxTotalSize: 10 };
      const error = new BadRequest('files_too_large', 'Maximum total files size exceeded.');
      await expect(() => controller.parseFormData(payload, options)).rejects.toEqual(error);
    });

    test('stream error', async () => {
      const payload = {} as IncomingMessage;
      process.env.FS_ERROR_STREAM = 'true';
      const options = { allowedMimeTypes: ['image/png'] };
      const error = new Error('error');
      await expect(() => controller.parseFormData(payload, options)).rejects.toEqual(error);
      delete process.env.FS_ERROR_STREAM;
    });

    test('0 field', async () => {
      const payload = {} as IncomingMessage;
      process.env.MUTIPARTY_NO_FIELD = 'true';
      const options = { allowedMimeTypes: ['image/png'] };
      await controller.parseFormData(payload, options);
      expect(createWriteStream).toHaveBeenCalledTimes(0);
      delete process.env.MUTIPARTY_NO_FIELD;
    });

    test('1 file', async () => {
      const payload = {} as IncomingMessage;
      const options = { allowedMimeTypes: ['image/png'] };
      await controller.parseFormData(payload, options);
      expect(createWriteStream).toHaveBeenCalledOnce();
    });
  });

  describe('[auth]', () => {
    test('INVALID_CREDENTIALS error', async () => {
      await expect(async () => {
        await controller.auth('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', 'invalid');
      }).rejects.toEqual(new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.'));
    });

    test('unknown error', async () => {
      process.env.UNKNOWN_ERROR = 'true';
      await expect(async () => {
        await controller.auth('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', 'valid');
      }).rejects.toEqual(new Error('UNKNOWN'));
    });

    test('no error', async () => {
      const user = await controller.auth('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', 'valid');
      expect(user).toEqual({
        _devices: [{ _id: 'valid' }],
        roles: [{
          name: 'TEST',
          permissions: ['TEST'],
        }],
      });
    });
  });

  describe('[catchErrors]', () => {
    test('TOKEN_EXPIRED error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new jwt.TokenExpiredError('', new Date());
        });
      }).rejects.toThrow(new Unauthorized('TOKEN_EXPIRED', 'Access token has expired.'));
    });

    test('INVALID_TOKEN error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new jwt.JsonWebTokenError('');
        });
      }).rejects.toThrow(new Unauthorized('INVALID_TOKEN', 'Invalid access token.'));
    });

    test('INVALID_DEVICE_ID error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('INVALID_DEVICE_ID');
        });
      }).rejects.toThrow(new Unauthorized('INVALID_DEVICE_ID', 'Invalid device id.'));
    });

    test('NO_RESOURCE error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('NO_RESOURCE', { id: 'test' });
        });
      }).rejects.toThrow(new NotFound('NO_RESOURCE', 'Resource with id "test" does not exist or does not match required criteria.'));
    });

    test('USER_NOT_VERIFIED error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('USER_NOT_VERIFIED');
        });
      }).rejects.toThrow(new Forbidden('USER_NOT_VERIFIED', 'Please verify your email address before performing this operation.'));
    });

    test('FORBIDDEN error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('FORBIDDEN', { permission: null });
        });
      }).rejects.toThrow(new Forbidden('FORBIDDEN', 'You are not allowed to perform this operation.'));
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('FORBIDDEN', { permission: 'test' });
        });
      }).rejects.toThrow(new Forbidden('FORBIDDEN', 'You are missing "test" permission to perform this operation.'));
    });

    test('DUPLICATE_RESOURCE error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new DatabaseError('DUPLICATE_RESOURCE', { path: 'test', value: 'value' });
        });
      }).rejects.toThrow(new Conflict('RESOURCE_EXISTS', 'Resource with field "test" set to "value" already exists.'));
    });

    test('NO_USER error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('NO_USER');
        });
      }).rejects.toThrow(new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.'));
    });

    test('INVALID_CREDENTIALS error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('INVALID_CREDENTIALS');
        });
      }).rejects.toThrow(new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.'));
    });

    test('INVALID_VERIFICATION_TOKEN error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('INVALID_VERIFICATION_TOKEN');
        });
      }).rejects.toThrow(new Unauthorized('INVALID_VERIFICATION_TOKEN', 'Invalid or expired verification token.'));
    });

    test('INVALID_RESET_TOKEN error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('INVALID_RESET_TOKEN');
        });
      }).rejects.toThrow(new Unauthorized('INVALID_RESET_TOKEN', 'Invalid or expired reset token.'));
    });

    test('INVALID_REFRESH_TOKEN error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('INVALID_REFRESH_TOKEN');
        });
      }).rejects.toThrow(new Unauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.'));
    });

    test('PASSWORDS_MISMATCH error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('PASSWORDS_MISMATCH');
        });
      }).rejects.toThrow(new BadRequest('PASSWORDS_MISMATCH', 'Passwords mismatch.'));
    });

    test('EMAIL_ALREADY_VERIFIED error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('EMAIL_ALREADY_VERIFIED');
        });
      }).rejects.toThrow(new NotAcceptable('EMAIL_ALREADY_VERIFIED', 'User email is already verified.'));
    });

    test('UNKNOWN_FIELD error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('UNKNOWN_FIELD', { path: 'path' });
        });
      }).rejects.toThrow(new BadRequest('UNKNOWN_FIELD', 'Requested field "path" does not exist.'));
    });

    test('NO_RESOURCE error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new DatabaseError('NO_RESOURCE', { id: 'test' });
        });
      }).rejects.toThrow(new NotFound('NO_RESOURCE', 'Resource with id "test" does not exist or does not match required criteria.'));
    });

    test('UNSORTABLE_FIELD error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new DatabaseError('UNSORTABLE_FIELD', { path: 'path' });
        });
      }).rejects.toThrow(new BadRequest('UNSORTABLE_FIELD', 'Field "path" is not sortable.'));
    });

    test('UNINDEXED_FIELD error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new DatabaseError('UNINDEXED_FIELD', { path: 'path' });
        });
      }).rejects.toThrow(new BadRequest('UNINDEXED_FIELD', 'Field "path" is not indexed.'));
    });

    test('RESOURCE_REFERENCED error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new DatabaseError('RESOURCE_REFERENCED', { path: 'resource.path.to.field' });
        });
      }).rejects.toThrow(new BadRequest('RESOURCE_REFERENCED', 'Resource is still referenced in "resource.path.to.field".'));
    });

    test('MAXIMUM_DEPTH_EXCEEDED error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new EngineError('MAXIMUM_DEPTH_EXCEEDED', { path: 'path' });
        });
      }).rejects.toThrow(new BadRequest('MAXIMUM_DEPTH_EXCEEDED', 'Maximum level of depth exceeded for field "path".'));
    });

    test('other error', async () => {
      await expect(async () => {
        await controller.catchErrors(() => {
          throw new Error('test');
        });
      }).rejects.toThrow(new Error('test'));
    });
  });
});
