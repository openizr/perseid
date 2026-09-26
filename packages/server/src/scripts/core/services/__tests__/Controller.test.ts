/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';
import { writeStream } from '__mocks__/fs';
import { Readable, Writable } from 'stream';
import { createWriteStream, type WriteStream } from 'fs';
import { type IncomingMessage } from 'http';
import Model from 'scripts/core/services/Model';
import Telemetry from 'scripts/core/services/Telemetry';
import ControllerError from 'scripts/core/errors/Controller';
import type AuthEngine from 'scripts/core/services/AuthEngine';
import Controller from 'scripts/core/services/Controller';
import schema, { type DataModel } from 'scripts/core/services/__mocks__/schema';

vi.mock('fs');
vi.mock('scripts/core/services/Model');
vi.mock('scripts/core/services/Telemetry');

// Protected members are the API this blueprint class exposes to framework-specific controllers.
type TestController = Controller<DataModel> & {
  ajv: Controller['ajv'];
  version: Controller['version'];
  endpoints: Controller['endpoints'];
  handleCORS: Controller['handleCORS'];
  parseQuery: Controller['parseQuery'];
  KNOWN_ERRORS: Controller['KNOWN_ERRORS'];
  formatOutput: Controller['formatOutput'];
  parseFormData: Controller['parseFormData'];
  AJV_FORMATTERS: Controller['AJV_FORMATTERS'];
  instrumentEndpoints: Controller['instrumentEndpoints'];
};

describe('core/services/Controller', () => {
  vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

  const idA = '00000000-0000-7000-8000-000000000001';
  const idB = '00000000-0000-7000-8000-000000000002';
  const endpoints = { auth: { signIn: { path: '/auth/sign-in' } }, resources: {} };

  const test = it.extend<{
    telemetry: Telemetry;
    controller: TestController;
  }>({
    telemetry: async ({ onTestFinished }, use) => {
      onTestFinished(() => {
        Id.FORMAT = 'UUID';
        vi.clearAllMocks();
      });
      await use(new Telemetry());
    },
    controller: async ({ telemetry }, use) => {
      // The base controller never calls its engine, only framework-specific controllers do.
      const engine = {} as AuthEngine<DataModel>;
      await use(new Controller<DataModel>(new Model<DataModel>(schema), telemetry, engine, {
        endpoints,
        version: '1.0.0',
        handleCORS: true,
        instrumentEndpoints: false,
      }) as TestController);
    },
  });

  describe('[constructor]', () => {
    test('stores settings, without instrumenting endpoints', ({ controller, telemetry }) => {
      expect(controller.version).toBe('1.0.0');
      expect(controller.handleCORS).toBe(true);
      expect(controller.endpoints).toEqual(endpoints);
      expect(controller.instrumentEndpoints).toBe(false);
      expect(telemetry.createHistogram).not.toHaveBeenCalled();
      expect(telemetry.createUpDownCounter).not.toHaveBeenCalled();
    });

    test('registers HTTP metrics when instrumenting endpoints', ({ telemetry }) => {
      const engine = {} as AuthEngine<DataModel>;
      const model = new Model<DataModel>(schema);
      const controller = new Controller<DataModel>(model, telemetry, engine, {
        endpoints,
        version: '1.0.0',
        handleCORS: false,
        instrumentEndpoints: true,
      }) as TestController;
      expect(controller.instrumentEndpoints).toBe(true);
      expect(telemetry.createUpDownCounter).toHaveBeenCalledOnce();
      expect(telemetry.createUpDownCounter).toHaveBeenCalledWith('http.server.active_requests', {
        valueType: 1,
        unit: '{request}',
        description: 'Number of active HTTP server requests.',
      });
      expect(telemetry.createHistogram).toHaveBeenCalledOnce();
      expect(telemetry.createHistogram).toHaveBeenCalledWith('http.server.request.duration', {
        description: 'Duration of HTTP server requests.',
        unit: 's',
        advice: {
          explicitBucketBoundaries: [
            0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
          ],
        },
      });
    });
  });

  describe('[KNOWN_ERRORS]', () => {
    test('maps each known error to an HTTP status, a code and a message', ({ controller }) => {
      const details = {
        id: idA,
        path: 'title',
        value: 'test',
        filename: 'a.png',
        operation: 'CREATE',
        contentType: 'image/gif',
        permission: 'USERS.VIEW',
      };
      const responses = Object.fromEntries(Object.entries(controller.KNOWN_ERRORS).map(
        ([code, format]) => [code, format?.(new ControllerError(code, details))],
      ));
      expect(responses).toEqual({
        FORBIDDEN: [403, 'FORBIDDEN', 'You are missing "USERS.VIEW" permission to perform this operation.'],
        NO_USER: [401, 'NO_USER', 'User not found.'],
        INVALID_DEVICE_ID: [401, 'INVALID_DEVICE_ID', 'Invalid device id.'],
        INVALID_TOKEN: [401, 'INVALID_TOKEN', 'Invalid access token.'],
        PASSWORDS_MISMATCH: [400, 'PASSWORDS_MISMATCH', 'Passwords mismatch.'],
        INVALID_CREDENTIALS: [401, 'INVALID_CREDENTIALS', 'Invalid credentials.'],
        TOKEN_EXPIRED: [401, 'TOKEN_EXPIRED', 'Access token has expired.'],
        EMAIL_ALREADY_VERIFIED: [400, 'EMAIL_ALREADY_VERIFIED', 'Email already verified.'],
        INVALID_RESET_TOKEN: [401, 'INVALID_RESET_TOKEN', 'Invalid or expired reset token.'],
        INVALID_REFRESH_TOKEN: [401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.'],
        TOO_MANY_FIELDS: [422, 'TOO_MANY_FIELDS', 'Maximum number of fields exceeded.'],
        FILES_TOO_LARGE: [413, 'FILES_TOO_LARGE', 'Maximum total files size exceeded.'],
        INVALID_VERIFICATION_TOKEN: [401, 'INVALID_VERIFICATION_TOKEN', 'Invalid or expired verification token.'],
        MISSING_CONTENT_TYPE_HEADER: [422, 'MISSING_CONTENT_TYPE_HEADER', 'Missing "Content-Type" header.'],
        FIELD_TOO_LARGE: [413, 'FIELD_TOO_LARGE', 'Maximum non-file fields size exceeded.'],
        UNINDEXED_FIELD: [400, 'UNINDEXED_FIELD', 'Field "title" is not indexed.'],
        UNSORTABLE_FIELD: [400, 'UNSORTABLE_FIELD', 'Field "title" is not sortable.'],
        UNKNOWN_QUERY_FIELD: [400, 'UNKNOWN_QUERY_FIELD', 'Requested field "title" does not exist.'],
        USER_NOT_VERIFIED: [403, 'USER_NOT_VERIFIED', 'Please verify your email address before performing this operation.'],
        RESOURCE_REFERENCED: [400, 'RESOURCE_REFERENCED', 'Resource is still referenced in "title".'],
        RESOURCE_EXISTS: [409, 'RESOURCE_EXISTS', 'Resource with field value "test" already exists.'],
        INVALID_SORT_QUERY: [400, 'INVALID_SORT_QUERY', '"query.sortBy" and "query.sortOrder" must contain the same number of items.'],
        FILE_TOO_LARGE: [413, 'FILE_TOO_LARGE', 'Maximum size exceeded for file "a.png".'],
        MAXIMUM_DEPTH_EXCEEDED: [400, 'MAXIMUM_DEPTH_EXCEEDED', 'Maximum level of depth exceeded for field "title".'],
        OPERATION_NOT_ALLOWED: [403, 'OPERATION_NOT_ALLOWED', 'Operation "CREATE" is not allowed for this resource.'],
        INVALID_FILE_TYPE: [422, 'INVALID_FILE_TYPE', 'Invalid file type "image/gif" for file "a.png".'],
        NO_RESOURCE: [404, 'NO_RESOURCE', `Resource with id "${idA}" does not exist or does not match required criteria.`],
      });
    });

    test('maps a forbidden error with no specific permission', ({ controller }) => {
      const error = new ControllerError('FORBIDDEN', { permission: null });
      expect(controller.KNOWN_ERRORS.FORBIDDEN?.(error)).toEqual([
        403,
        'FORBIDDEN',
        'You are not allowed to perform this operation.',
      ]);
    });
  });

  describe('[formatOutput]', () => {
    test('formats ids, dates and binaries into strings, recursively', ({ controller }) => {
      expect(controller.formatOutput({
        _id: new Id(idA),
        count: 3,
        title: null,
        data: {
          _createdAt: new Date('2025-01-01T00:00:00.000Z'),
          binary: new TextEncoder().encode('data:text/plain;base64,dGVzdA==').buffer,
          relations: [new Id(idB), { _id: new Id(idA) }],
        },
      })).toEqual({
        _id: idA,
        count: 3,
        title: null,
        data: {
          _createdAt: '2025-01-01T00:00:00.000Z',
          binary: 'data:text/plain;base64,dGVzdA==',
          relations: [idB, { _id: idA }],
        },
      });
    });
  });

  describe('[parseQuery]', () => {
    test('parses built-in query params, and keeps custom ones as is', ({ controller }) => {
      expect(controller.parseQuery({
        fields: '_id,title',
        sortBy: 'title,_createdAt',
        sortOrder: '1,-1',
        offset: '10',
        custom: null,
      })).toEqual({
        fields: new Set(['_id', 'title']),
        sortBy: { title: 1, _createdAt: -1 },
        offset: '10',
        custom: null,
      });
    });

    test('keeps null built-in query params as is', ({ controller }) => {
      expect(controller.parseQuery({ fields: null, sortBy: null })).toEqual({
        fields: null,
        sortBy: null,
      });
    });

    test('throws when sorting params sizes mismatch', ({ controller }) => {
      expect(() => controller.parseQuery({ sortBy: 'title,_createdAt', sortOrder: '1' }))
        .toThrow(new ControllerError('INVALID_SORT_QUERY'));
      expect(() => controller.parseQuery({ sortBy: 'title' }))
        .toThrow(new ControllerError('INVALID_SORT_QUERY'));
    });
  });

  describe('[AJV_FORMATTERS]', () => {
    test('validates and formats a complete payload', ({ controller }) => {
      const validate = controller.ajv.compile(controller.AJV_FORMATTERS.object({
        description: '',
        type: 'object',
        isRequired: true,
        fields: {
          _id: { description: '', type: 'id', isRequired: true },
          id: {
            description: '', type: 'id', isRequired: true, enum: [new Id(idA)],
          },
          optionalId: { description: '', type: 'id', enum: [new Id(idA)] },
          binary: { description: '', type: 'binary', isRequired: true },
          boolean: { description: '', type: 'boolean', isRequired: true },
          date: {
            description: '', type: 'date', isRequired: true, enum: [new Date('2025-01-01T00:00:00.000Z')],
          },
          optionalDate: { description: '', type: 'date', enum: [new Date('2025-01-01T00:00:00.000Z')] },
          float: {
            description: '', type: 'float', isRequired: true, enum: [1.5, 2.5],
          },
          optionalFloat: { description: '', type: 'float', enum: [1.5] },
          integer: {
            description: '', type: 'integer', isRequired: true, enum: [1, 2],
          },
          optionalInteger: { description: '', type: 'integer', enum: [1] },
          string: {
            description: '', type: 'string', maxLength: 10, isRequired: true, enum: ['one', 'two'],
          },
          optionalString: {
            description: '', type: 'string', maxLength: 10, minLength: 2, enum: ['one'],
          },
          array: { type: 'array', isRequired: true, fields: { description: '', type: 'null' } },
          object: {
            description: '',
            type: 'object',
            isRequired: true,
            fields: {
              id: { description: '', type: 'id' },
              binary: { description: '', type: 'binary' },
              boolean: { description: '', type: 'boolean' },
              date: { description: '', type: 'date' },
              float: { description: '', type: 'float' },
              integer: { description: '', type: 'integer' },
              string: { description: '', type: 'string', maxLength: 10 },
              array: {
                type: 'array',
                fields: {
                  description: '', type: 'string', maxLength: 10, isRequired: true,
                },
              },
              object: { description: '', type: 'object', fields: { string: { description: '', type: 'string', maxLength: 10 } } },
            },
          },
        },
      }, true));
      const payload = {
        id: idA,
        binary: 'data:text/plain;base64,dGVzdA==',
        boolean: true,
        date: '2025-01-01T00:00:00.000Z',
        float: 1.5,
        integer: 2,
        string: 'one',
        array: [null],
        object: { object: null },
      };
      expect(validate(payload)).toBe(true);
      expect(payload).toEqual({
        id: new Id(idA),
        optionalId: null,
        binary: new TextEncoder().encode('data:text/plain;base64,dGVzdA==').buffer,
        boolean: true,
        date: new Date('2025-01-01T00:00:00.000Z'),
        optionalDate: null,
        float: 1.5,
        optionalFloat: null,
        integer: 2,
        optionalInteger: null,
        string: 'one',
        optionalString: null,
        array: [null],
        object: {
          id: null,
          binary: null,
          boolean: null,
          date: null,
          float: null,
          integer: null,
          string: null,
          array: null,
          object: null,
        },
      });
    });

    test('rejects an invalid payload with meaningful messages', ({ controller }) => {
      const validate = controller.ajv.compile(controller.AJV_FORMATTERS.object({
        description: '',
        type: 'object',
        isRequired: true,
        fields: {
          id: { description: '', type: 'id', isRequired: true },
          enumId: {
            description: '', type: 'id', isRequired: true, enum: [new Id(idA)],
          },
          optionalId: { description: '', type: 'id' },
          binary: { description: '', type: 'binary', isRequired: true },
          optionalBinary: { description: '', type: 'binary' },
          boolean: {
            description: '', type: 'boolean', isRequired: true, errorMessages: { description: '', type: 'must be yes or no' },
          },
          date: { description: '', type: 'date', isRequired: true },
          enumDate: {
            description: '', type: 'date', isRequired: true, enum: [new Date('2025-01-01T00:00:00.000Z')],
          },
          float: {
            description: '',
            type: 'float',
            isRequired: true,
            minimum: 1,
            maximum: 10,
            exclusiveMinimum: 0,
            exclusiveMaximum: 11,
            multipleOf: 0.5,
          },
          integer: {
            description: '',
            type: 'integer',
            isRequired: true,
            minimum: 1,
            maximum: 10,
            exclusiveMinimum: 0,
            exclusiveMaximum: 11,
            multipleOf: 2,
          },
          string: {
            description: '', type: 'string', isRequired: true, pattern: /^[a-z]+$/, maxLength: 5,
          },
          array: {
            type: 'array',
            isRequired: true,
            minItems: 2,
            maxItems: 3,
            uniqueItems: true,
            fields: {
              description: '', type: 'string', maxLength: 10, isRequired: true,
            },
          },
          singleArray: {
            type: 'array',
            isRequired: true,
            minItems: 1,
            maxItems: 1,
            fields: { description: '', type: 'integer', isRequired: true },
          },
          object: {
            description: '',
            type: 'object',
            fields: {
              string: {
                description: '', type: 'string', maxLength: 10, isRequired: true,
              },
            },
          },
        },
      }, false));
      expect(validate({
        id: 'invalid',
        enumId: idB,
        optionalId: 3,
        binary: 'invalid',
        optionalBinary: 3,
        boolean: 'invalid',
        date: 'invalid',
        enumDate: '2026-01-01T00:00:00.000Z',
        float: 0.7,
        integer: 13,
        string: 'ABCDEFG',
        array: ['a'],
        singleArray: [1, 2],
        object: {},
        unknown: true,
      })).toBe(false);
      expect(validate.errors?.map(({ instancePath, message }) => [instancePath, message])).toEqual([
        ['', 'must NOT have additional properties'],
        ['/id', 'must be a valid id'],
        ['/enumId', `must be one of: "${idA}"`],
        ['/optionalId', 'must be a valid id'],
        ['/binary', 'must NOT have fewer than 10 characters'],
        ['/binary', 'must be a base64-encoded binary'],
        ['/optionalBinary', 'must NOT have fewer than 10 characters'],
        ['/optionalBinary', 'must be a base64-encoded binary, or null'],
        ['/boolean', 'must be yes or no'],
        ['/date', 'must be a valid date'],
        ['/enumDate', 'must be one of: "2025-01-01T00:00:00.000Z"'],
        ['/float', 'must be greater than or equal to 1'],
        ['/float', 'must be a multiple of 0.5'],
        ['/integer', 'must be smaller than or equal to 10'],
        ['/integer', 'must be smaller than 11'],
        ['/integer', 'must be a multiple of 2'],
        ['/string', 'must be no longer than 5 characters'],
        ['/string', 'must match "^[a-z]+$" pattern'],
        ['/array', 'must contain at least 2 entries'],
        ['/singleArray', 'must not contain more than 1 entry'],
        ['/object', "must have required property 'string'"],
      ]);
    });

    test('validates ids in the snowflake format', ({ controller }) => {
      Id.FORMAT = 'SNOWFLAKE';
      const validate = controller.ajv.compile(controller.AJV_FORMATTERS.object({
        description: '',
        type: 'object',
        isRequired: true,
        fields: { id: { description: '', type: 'id', isRequired: true } },
      }, true));
      expect(validate({ id: 'invalid' })).toBe(false);
      const payload = { id: '0123456789abcdef01234567' };
      expect(validate(payload)).toBe(true);
      expect(payload).toEqual({ id: new Id('0123456789abcdef01234567') });
    });
  });

  describe('[parseFormData]', () => {
    test('parses fields and files, grouping files by field', async ({ controller }) => {
      const request = Object.assign(Readable.from([
        '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="title"\r\n\r\n'
        + 'Coffee machine\r\n'
        + '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="files"; filename="a.png"\r\n'
        + 'Content-Type: image/png\r\n\r\n'
        + 'PNG_A\r\n'
        + '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="photos"; filename="b.png"\r\n'
        + 'Content-Type: image/png\r\n\r\n'
        + 'PNG_BB\r\n'
        + '--BOUNDARY--\r\n',
      ]), { headers: { 'content-type': 'multipart/form-data; boundary=BOUNDARY' } });
      await expect(controller.parseFormData(request as unknown as IncomingMessage, {
        allowedMimeTypes: ['image/png'],
      })).resolves.toEqual({
        title: 'Coffee machine',
        files: [
          {
            size: 5,
            id: '1941f297c000',
            path: '/tmp/1941f297c000',
            name: 'a.png',
            type: 'image/png',
          },
        ],
        photos: [
          {
            size: 6,
            id: '1941f297c001',
            path: '/tmp/1941f297c001',
            name: 'b.png',
            type: 'image/png',
          },
        ],
      });
      expect(writeStream).toHaveBeenCalledTimes(2);
      expect(writeStream).toHaveBeenCalledWith('/tmp/1941f297c000', Buffer.from('PNG_A'));
      expect(writeStream).toHaveBeenCalledWith('/tmp/1941f297c001', Buffer.from('PNG_BB'));
    });

    test('parses a payload without files', async ({ controller }) => {
      const request = Object.assign(Readable.from([
        '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="title"\r\n\r\n'
        + 'Coffee machine\r\n'
        + '--BOUNDARY--\r\n',
      ]), { headers: { 'content-type': 'multipart/form-data; boundary=BOUNDARY' } });
      await expect(controller.parseFormData(request as unknown as IncomingMessage))
        .resolves.toEqual({ title: 'Coffee machine' });
      expect(writeStream).not.toHaveBeenCalled();
    });

    test('rejects too large fields', async ({ controller }) => {
      const request = Object.assign(Readable.from([
        '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="title"\r\n\r\n'
        + 'Coffee machine\r\n'
        + '--BOUNDARY--\r\n',
      ]), { headers: { 'content-type': 'multipart/form-data; boundary=BOUNDARY' } });
      await expect(controller.parseFormData(request as unknown as IncomingMessage, {
        maxTotalSize: 5,
      })).rejects.toMatchObject({ code: 'FIELD_TOO_LARGE' });
    });

    test('rejects too many fields', async ({ controller }) => {
      const request = Object.assign(Readable.from([
        '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="title"\r\n\r\n'
        + 'Coffee machine\r\n'
        + '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="description"\r\n\r\n'
        + 'Leaking\r\n'
        + '--BOUNDARY--\r\n',
      ]), { headers: { 'content-type': 'multipart/form-data; boundary=BOUNDARY' } });
      await expect(controller.parseFormData(request as unknown as IncomingMessage, {
        maxFields: 1,
      })).rejects.toMatchObject({ code: 'TOO_MANY_FIELDS' });
    });

    test('rejects a payload without content type', async ({ controller }) => {
      const request = Object.assign(Readable.from(['--BOUNDARY--\r\n']), { headers: {} });
      await expect(controller.parseFormData(request as unknown as IncomingMessage))
        .rejects.toMatchObject({ code: 'MISSING_CONTENT_TYPE_HEADER' });
    });

    test('rejects a payload that is not multipart', async ({ controller }) => {
      const request = Object.assign(Readable.from(['Coffee machine']), {
        headers: { 'content-type': 'text/plain' },
      });
      await expect(controller.parseFormData(request as unknown as IncomingMessage))
        .rejects.toThrow(new Error('unsupported content-type'));
    });

    test('rejects files with a forbidden type', async ({ controller }) => {
      const request = Object.assign(Readable.from([
        '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="files"; filename="a.gif"\r\n'
        + 'Content-Type: image/gif\r\n\r\n'
        + 'GIF_A\r\n'
        + '--BOUNDARY--\r\n',
      ]), { headers: { 'content-type': 'multipart/form-data; boundary=BOUNDARY' } });
      await expect(controller.parseFormData(request as unknown as IncomingMessage, {
        allowedMimeTypes: ['image/png'],
      })).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
      expect(writeStream).not.toHaveBeenCalled();
    });

    test('rejects a too large file', async ({ controller }) => {
      const request = Object.assign(Readable.from([
        '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="files"; filename="a.png"\r\n'
        + 'Content-Type: image/png\r\n\r\n'
        + 'PNG_A\r\n'
        + '--BOUNDARY--\r\n',
      ]), { headers: { 'content-type': 'multipart/form-data; boundary=BOUNDARY' } });
      await expect(controller.parseFormData(request as unknown as IncomingMessage, {
        maxFieldSize: 3,
        allowedMimeTypes: ['image/png'],
      })).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', details: { filename: 'a.png' } });
    });

    test('rejects too large files in total', async ({ controller }) => {
      const request = Object.assign(Readable.from([
        '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="files"; filename="a.png"\r\n'
        + 'Content-Type: image/png\r\n\r\n'
        + 'PNG_A\r\n'
        + '--BOUNDARY--\r\n',
      ]), { headers: { 'content-type': 'multipart/form-data; boundary=BOUNDARY' } });
      await expect(controller.parseFormData(request as unknown as IncomingMessage, {
        maxTotalSize: 3,
        allowedMimeTypes: ['image/png'],
      })).rejects.toMatchObject({ code: 'FILES_TOO_LARGE' });
    });

    test('rejects when a file cannot be written', async ({ controller }) => {
      vi.mocked(createWriteStream).mockImplementationOnce(() => new Writable({
        write(_chunk, _encoding, callback): void {
          callback(new Error('NO_SPACE_LEFT'));
        },
      }) as WriteStream);
      const request = Object.assign(Readable.from([
        '--BOUNDARY\r\n'
        + 'Content-Disposition: form-data; name="files"; filename="a.png"\r\n'
        + 'Content-Type: image/png\r\n\r\n'
        + 'PNG_A\r\n'
        + '--BOUNDARY--\r\n',
      ]), { headers: { 'content-type': 'multipart/form-data; boundary=BOUNDARY' } });
      await expect(controller.parseFormData(request as unknown as IncomingMessage, {
        allowedMimeTypes: ['image/png'],
      })).rejects.toThrow(new Error('NO_SPACE_LEFT'));
    });
  });
});
