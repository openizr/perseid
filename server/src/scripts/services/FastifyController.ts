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
import os from 'os';
import path from 'path';
import ajvErrors from 'ajv-errors';
import multiparty from 'multiparty';
import { createWriteStream } from 'fs';
import Gone from 'scripts/errors/Gone';
import Ajv, { ValidateFunction } from 'ajv';
import BaseModel from 'scripts/common/Model';
import isNested from 'scripts/common/isNested';
import NotFound from 'scripts/errors/NotFound';
import Conflict from 'scripts/errors/Conflict';
import Forbidden from 'scripts/errors/Forbidden';
import type Logger from 'scripts/services/Logger';
import { IncomingMessage as Payload } from 'http';
import BadRequest from 'scripts/errors/BadRequest';
import { DataValidationCxt } from 'ajv/dist/types';
import Controller, {
  BuiltInEndpoint, BuiltInEndpoints, CollectionBuiltInEndpoints, ControllerSettings, EndpointType,
} from 'scripts/services/Controller';
import Unauthorized from 'scripts/errors/Unauthorized';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import type OAuthEngine from 'scripts/services/OAuthEngine';
import TooManyRequests from 'scripts/errors/TooManyRequests';
import fastJsonStringify, { Schema } from 'fast-json-stringify';
import UnprocessableEntity from 'scripts/errors/UnprocessableEntity';
import RequestEntityTooLarge from 'scripts/errors/RequestEntityTooLarge';
import {
  Id, type DataModel as DefaultTypes, type User, Role,
} from '@perseid/core';

type Validate = { errors: { keyword: string; }[]; };

// type EndpointName = keyof ServerConfiguration['endpoints'];
// type EndpointConfiguration = { [collectionName: string]: { path: string; custom?: boolean; } };

// interface Params {
//   endpoint: string;
//   fields: string[];
//   loggedUser: User;
//   collection: string;
//   requiredPermissions: string[];
// }

// /**
//  * Types Ajv formatters.
//  */
// type Formatters = Record<string, (
//   field: FieldModel,
//   isPartial: boolean,
//   isResponse: boolean,
// ) => AjvFieldSchema>;

// /**
//  * Uploaded file.
//  */
// export interface File {
//   id: string;
//   size: number;
//   type: string;
//   path: string;
//   name: string;
// }

// /**
//  * Parsed multipart/form-data fields.
//  */
// export interface Fields {
//   [name: string]: string | File[];
// }

// /**
//  * Multipart/form-data parser options.
//  */
// export interface Options {
//   maxFields?: number;
//   maxFileSize?: number;
//   maxTotalSize?: number;
//   maxFieldsSize?: number;
//   allowedMimeTypes?: string[];
// }

/**
 * Ajv validation error.
 */
export interface ValidationError {
  keyword?: string;
  message?: string;
  instancePath?: string;
  params?: Record<string, string | string[]>;
}

/**
 * Ajv field validation schema.
 */
export interface AjvFieldSchema {
  $ref?: string;
  notEmpty?: boolean;
  items?: AjvFieldSchema;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  required?: string[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  additionalProperties?: boolean;
  default?: string | integer | number;
  enum?: (string | integer | number)[];
  errorMessage?: {
    [errorType: string]: string;
  };
  properties?: {
    [fieldName: string]: AjvFieldSchema;
  };
  patternProperties?: {
    [pattern: string]: AjvFieldSchema;
  };
  type: 'string' | 'null' | 'boolean' | 'integer' | 'number' | 'date' | 'binary' | 'object' | 'array';
}

/**
 * Ajv validation schema.
 */
export interface AjvSchema {

}

interface EndpointSettings<Types> {
  authenticate?: boolean;
  collection?: keyof Types;
  ignoreExpiration?: boolean;
  additionalPermissions?: string[];
  schema?: {
    body?: ObjectDataModel<Types>;
    query?: ObjectDataModel<Types>;
    params?: ObjectDataModel<Types>;
    headers?: ObjectDataModel<Types>;
    response?: {
      [status: string]: FieldDataModel<Types>;
    };
  };
  schemaTransformer?: (schema: AjvSchema) => AjvSchema;
  type?: 'SEARCH' | 'LIST' | 'CREATE' | 'UPDATE' | 'VIEW' | 'DELETE';
  handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
}

/**
 * API controller, designed for Fastify framework.
 */
export default class FastifyController<
  /** Data model types definitions. */
  Types extends DefaultTypes = DefaultTypes,

  /** Model class types definitions. */
  Model extends BaseModel<Types> = BaseModel<Types>,

  /** Database client types definition. */
  Engine extends OAuthEngine<Types> = OAuthEngine<Types>,
> extends Controller<Types, Model, Engine> {
  /** HTTP 404 error code. */
  protected readonly NOT_FOUND_CODE = 'NOT_FOUND';

  /** Invalid payload error code. */
  protected readonly INVALID_PAYLOAD_CODE = 'INVALID_PAYLOAD';

  /** Increment used for `multipart/form-data` payloads parsing. */
  protected increment = 0;

  protected commonHeadersTransformer = (schema: AjvSchema): AjvSchema => ({
    ...schema,
    headers: {
      ...schema.headers,
      type: 'object',
      required: [...(schema.headers?.required ?? []), 'x-device-id'],
      additionalProperties: true,
      properties: {
        ...schema.headers?.properties,
        'x-device-id': {
          type: 'string',
          pattern: /^[0-9a-fA-F]{24}$/.source,
          errorMessage: {
            type: 'must be a valid device id',
            pattern: 'must be a valid device id',
          },
        },
      },
    },
  });

  protected apiHandlers: Record<string, EndpointSettings<Types>> = {
    signUp: {
      handler: async (request, response) => {
        const context = request.params as CommandContext;
        const { email, password, passwordConfirmation: confirmation } = request.body as {
          email: User['email'];
          password: User['password'];
          passwordConfirmation: User['password'];
        };
        const credentials = await this.engine.signUp(email, password, confirmation, context);
        response.status(201).send(credentials);
      },
      schema: {
        body: {
          type: 'object',
          required: true,
          fields: {
            email: BaseModel.email(),
            password: BaseModel.password(),
            passwordConfirmation: BaseModel.password(),
          },
        },
        response: {
          '2xx': BaseModel.credentials(),
        },
      },
    },
    signIn: {
      schemaTransformer: this.commonHeadersTransformer,
      handler: async (request, response) => {
        const context = request.params as CommandContext;
        const { email, password } = request.body as User;
        const credentials = await this.engine.signIn(email, password, context);
        response.status(200).send(credentials);
      },
      schema: {
        body: {
          type: 'object',
          required: true,
          fields: {
            email: BaseModel.email(),
            password: BaseModel.password(),
          },
        },
        response: {
          '2xx': BaseModel.credentials(),
        },
      },
    },
    refreshToken: {
      authenticate: true,
      ignoreExpiration: true,
      schemaTransformer: this.commonHeadersTransformer,
      handler: async (request, response) => {
        const context = request.params as CommandContext;
        const { refreshToken } = request.body as { refreshToken: string; };
        const credentials = await this.engine.refreshToken(refreshToken, context);
        response.status(200).send(credentials);
      },
      schema: {
        body: {
          type: 'object',
          required: true,
          fields: {
            refreshToken: BaseModel.token(),
          },
        },
        response: {
          '2xx': BaseModel.credentials(),
        },
      },
    },
    requestPasswordReset: {
      schemaTransformer: this.commonHeadersTransformer,
      handler: async (request, response) => {
        await this.engine.requestPasswordReset((request.body as User).email);
        response.status(200).send();
      },
      schema: {
        body: {
          type: 'object',
          required: true,
          fields: { email: BaseModel.email() },
        },
        response: {
          '2xx': { type: 'null' },
        },
      },
    },
    resetPassword: {
      schemaTransformer: this.commonHeadersTransformer,
      handler: async (request, response) => {
        const { email, password } = request.body as User;
        const { resetToken, passwordConfirmation } = request.body as {
          resetToken: string;
          passwordConfirmation: User['password'];
        };
        await this.engine.resetPassword(email, password, passwordConfirmation, resetToken);
        response.status(200).send();
      },
      schema: {
        body: {
          type: 'object',
          required: true,
          fields: {
            email: BaseModel.email(),
            resetToken: BaseModel.token(),
            password: BaseModel.password(),
            passwordConfirmation: BaseModel.password(),
          },
        },
        response: {
          '2xx': BaseModel.credentials(),
        },
      },
    },
    requestEmailVerification: {
      authenticate: true,
      schemaTransformer: this.commonHeadersTransformer,
      handler: async (request, response) => {
        await this.engine.requestEmailVerification(request.params as CommandContext);
        response.status(200).send();
      },
      schema: {
        response: {
          '2xx': { type: 'null' },
        },
      },
    },
    verifyEmail: {
      authenticate: true,
      schemaTransformer: this.commonHeadersTransformer,
      handler: async (request, response) => {
        const { verificationToken } = request.body as { verificationToken: string; };
        await this.engine.verifyEmail(verificationToken, request.params as CommandContext);
        response.status(200).send();
      },
      schema: {
        body: {
          type: 'object',
          required: true,
          fields: {
            verificationToken: BaseModel.token(),
          },
        },
        response: {
          '2xx': { type: 'null' },
        },
      },
    },
    signOut: {
      authenticate: true,
      ignoreExpiration: true,
      schemaTransformer: this.commonHeadersTransformer,
      handler: async (request, response) => {
        await this.engine.signOut(request.params as CommandContext);
        response.status(200).send();
      },
      schema: {
        response: {
          '2xx': { type: 'null' },
        },
      },
    },
  };

  /**
   * Formats `error`.
   *
   * @param error Error to format.
   *
   * @param dataVar Additional info to format error with.
   *
   * @returns Formatted error.
   */
  protected formatError(error: ValidationError[], dataVar: string): Error {
    let message = error[0].message || '';
    const { keyword, instancePath, params } = error[0];

    const httpPart = dataVar === 'querystring' ? 'query' : dataVar;
    const fullPath = `${httpPart}${(instancePath as string).replace(/\//g, '.')}`;
    message = `"${fullPath}" ${message}.`;
    if (keyword === 'required') {
      message = `"${fullPath}.${params?.missingProperty}" is required.`;
    } else if (keyword === 'additionalProperties') {
      message = `Unknown property "${fullPath}.${params?.additionalProperty}".`;
    }

    return new BadRequest(this.INVALID_PAYLOAD_CODE, message);
  }

  /**
   * Parses `multipart/form-data` payload, and returns its data.
   *
   * @param payload Request payload.
   *
   * @param options Parser options. Defaults to `{
   *  allowedMimeTypes: [],
   *  maxTotalSize: 10000000,
   *  maxFileSize: 2000000,
   * }`.
   *
   * @returns Parsed payload.
   */
  public parseFormData(payload: Payload, options: Options = {}): Promise<Fields> {
    let totalSize = 0;
    let totalFiles = 0;
    const allowedMimeTypes = options.allowedMimeTypes || [];
    const maxTotalSize = options.maxTotalSize || 10000000;
    const maxFileSize = options.maxFileSize || 2000000;
    return new Promise((resolve, reject) => {
      const fields: Fields = {};
      let parserClosed = false;
      let numberOfParts = 0;
      let numberOfClosedParts = 0;

      const parser = new multiparty.Form({
        maxFields: options.maxFields,
        maxFieldsSize: options.maxFieldsSize,
      });

      parser.on('close', () => {
        parserClosed = true;
        if (numberOfParts === 0) {
          resolve(fields);
        }
      });

      // Non-file fields parsing logic.
      parser.on('field', (name, value) => {
        fields[name] = value;
      });

      // Global payload errors handling.
      parser.on('error', (error) => {
        if (/maxFieldsSize/i.test(error.message)) {
          reject(new RequestEntityTooLarge('FIELD_TOO_LARGE', 'Maximum non-file fields size exceeded.'));
        } else if (/maxFields/i.test(error.message)) {
          reject(new RequestEntityTooLarge('TOO_MANY_FIELDS', 'Maximum number of fields exceeded.'));
        } else if (/missing content-type header/i.test(error.message)) {
          reject(new UnprocessableEntity('MISSING_CONTENT_TYPE_HEADER', 'Missing "Content-Type" header.'));
        } else {
          reject(error);
        }
      });

      // Files parsing logic.
      parser.on('part', (part) => {
        numberOfParts += 1;
        if (allowedMimeTypes.includes(part.headers['content-type']) === false) {
          reject(new BadRequest('INVALID_FILE_TYPE', `Invalid file type "${part.headers['content-type']}" for file "${part.filename}".`));
        } else {
          const fileIndex = totalFiles;
          totalFiles += 1;
          const fileId = Date.now().toString(16) + this.increment;
          this.increment += 1;
          const filePath = path.join(os.tmpdir(), fileId);
          const fileStream = createWriteStream(filePath);
          const closeStream = (error: Error | null): void => {
            fileStream.end();
            if (error !== null && error !== undefined) {
              reject(error);
            }
          };
          fileStream.on('error', closeStream);
          fileStream.on('close', () => {
            numberOfClosedParts += 1;
            if (parserClosed === true && numberOfClosedParts >= numberOfParts) {
              resolve(fields);
            }
          });
          fields[part.name] = fields[part.name] || [];
          (<File[]>fields[part.name]).push({
            size: 0,
            id: fileId,
            path: filePath,
            name: part.filename,
            type: part.headers['content-type'],
          });
          part.on('error', closeStream);
          part.on('close', closeStream);
          part.on('data', (stream) => {
            const size = stream.length;
            totalSize += size;
            (<File[]>fields[part.name])[fileIndex].size += size;
            if (totalSize > maxTotalSize) {
              reject(new RequestEntityTooLarge('FILES_TOO_LARGE', 'Maximum total files size exceeded.'));
            }
            if ((<File[]>fields[part.name])[fileIndex].size > maxFileSize) {
              reject(new RequestEntityTooLarge('FILE_TOO_LARGE', `Maximum size exceeded for file "${part.filename}".`));
            }
            fileStream.write(stream);
          });
        }
      });

      parser.parse(payload);
    });
  }

  /**
   * Handles HTTP 404 errors.
   */
  protected handleNotFound(): void {
    throw new NotFound(this.NOT_FOUND_CODE, 'Not Found.');
  }

  /**
   * Handles thrown errors and formats a clean HTTP response.
   *
   * @param error Error thrown by fastify.
   *
   * @param request HTTP request.
   *
   * @param response HTTP response.
   */
  protected handleError(
    error: FastifyError,
    request: FastifyRequest,
    response: FastifyReply,
  ): void {
    let message = 'Internal Server Error.';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let statusCode = 500;

    if (error instanceof BadRequest) {
      statusCode = 400;
    } else if (error instanceof Unauthorized) {
      statusCode = 401;
    } else if (error instanceof Forbidden) {
      statusCode = 403;
    } else if (error instanceof NotFound) {
      statusCode = 404;
    } else if (error instanceof NotAcceptable) {
      statusCode = 406;
    } else if (error instanceof Conflict) {
      statusCode = 409;
    } else if (error instanceof Gone) {
      statusCode = 410;
    } else if (error instanceof UnprocessableEntity) {
      statusCode = 422;
    } else if (error instanceof RequestEntityTooLarge) {
      statusCode = 413;
    } else if (error instanceof TooManyRequests) {
      statusCode = 429;
    } else if (error.validation !== undefined) {
      statusCode = 400;
    }

    // HTTP 500 errors reason should not be displayed to end user.
    // Invalid JSON payloads throw a SyntaxError when fastify tries to parse them.
    if (statusCode === 500 && error.statusCode === 400) {
      statusCode = 400;
      errorCode = 'INVALID_PAYLOAD';
      message = 'Invalid JSON payload.';
    } else if (statusCode !== 500) {
      errorCode = error.code;
      message = error.message;
    }

    this.logger[(statusCode === 500) ? 'error' : 'info'](error, {
      statusCode,
      url: request.url,
      method: request.method,
      headers: Object.keys(request.headers),
    });

    response
      .status(statusCode)
      .header('Content-Type', 'application/json')
      .send({ error: { code: errorCode, message } });
  }

  /**
   * Verifies `accessToken` and `deviceId` to authenticate a user.
   *
   * @param accessToken Access token to verify.
   *
   * @param deviceId Device id to verify.
   *
   * @param ignoreExpiration Whether to ignore errors when token has expired. Defaults to `false`.
   *
   * @returns Authenticated user.
   *
   * @throws If user specified in the access token does not exist, or if device does exist for user.
   */
  protected async oAuth(
    accessToken: string,
    deviceId: string,
    ignoreExpiration = false,
  ): Promise<User> {
    const context = { deviceId } as CommandContext;
    const userId = await this.engine.verifyToken(accessToken, ignoreExpiration, context);
    const user = await this.engine.view('users', userId, {
      fields: [
        '_verifiedAt',
        '_devices',
        '_apiKeys',
        'email',
        'password',
        'roles',
        'roles.name',
        'roles.permissions',
      ],
    });

    if (user === null || user._devices.find((device) => device.id === deviceId) === undefined) {
      throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    return {
      ...user,
      _permissions: (user.roles as Role[])
        .reduce((permissions: string[], role) => permissions.concat(role.permissions), [])
        .reduce((permissions, permission) => ({
          ...permissions,
          [permission]: true,
        }), {}),
    };
  }

  /**
   * Creates a new Ajv schema from `model`. See https://ajv.js.org/json-schema.html.
   *
   * @param collection Name of the collection for which to create schema.
   *
   * @param model Model to generate schema from.
   *
   * @param isPartial Whether schema should allow partial values (e.g. updates). Defaults to `false`.
   *
   * @param isResponse Used internally to handle deep schemas. Defaults to `false`.
   *
   * @returns Generated Ajv schema.
   */

  protected formatters: Formatters = {
    null() {
      return { type: 'null' };
    },
    string(field, isPartial, isResponse) {
      const formattedField: AjvFieldSchema = { type: 'string' };
      const {
        pattern,
        maxLength,
        minLength,
        required,
        enum: enumerations,
        default: defaultValue,
      } = <StringFieldModel>field;
      if (!isResponse) {
        formattedField.errorMessage = {
          type: 'must be a string',
        };
        if (maxLength !== undefined) {
          formattedField.maxLength = maxLength;
          formattedField.errorMessage.maxLength = `must be shorter than ${maxLength + 1} characters`;
        }
        if (minLength !== undefined) {
          formattedField.minLength = minLength;
          formattedField.errorMessage.minLength = `must be longer than ${minLength - 1} characters`;
        }
        if (pattern !== undefined) {
          formattedField.pattern = pattern;
          formattedField.errorMessage.pattern = `must match "${pattern}" pattern`;
        }
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}`;
        }
        if (!isPartial) {
          if (defaultValue !== undefined) {
            formattedField.default = defaultValue;
          } else if (!required) {
            formattedField.default = null;
          }
        }
      }
      if (!field.required) {
        formattedField.nullable = true;
      }
      formattedField.errorMessage = { ...formattedField.errorMessage, ...field.errorMessages };
      // TODO handle specific erorr messages overrides from field (eg token "must be a valid token")
      return formattedField;
    },
    boolean(field, isPartial, isResponse) {
      const formattedField: AjvFieldSchema = { type: 'boolean' };
      const { default: defaultValue, required } = (<BooleanFieldModel>field);
      if (!isResponse) {
        formattedField.errorMessage = {
          type: 'must be a boolean',
        };
        if (!isPartial) {
          if (defaultValue !== undefined) {
            formattedField.default = defaultValue;
          } else if (!required) {
            formattedField.default = null;
          }
        }
      }
      if (!field.required) {
        formattedField.nullable = true;
      }
      return formattedField;
    },
    date(field, isPartial, isResponse) {
      const formattedField: any = { type: 'string', isDate: true };
      const {
        required,
        enum: enumerations,
        default: defaultValue,
      } = (<DateFieldModel>field);
      if (!isResponse) {
        formattedField.pattern = /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/.source;
        formattedField.errorMessage = {
          type: 'must be a valid date',
          pattern: 'must be a valid date',
        };
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}`;
        }
        if (!isPartial) {
          if (defaultValue !== undefined) {
            formattedField.default = defaultValue;
          } else if (!required) {
            formattedField.default = null;
          }
        }
      }
      if (!field.required) {
        formattedField.nullable = true;
      }
      return formattedField;
    },
    id(field, isPartial, isResponse) {
      const {
        relation,
        required,
        enum: enumerations,
        default: defaultValue,
      } = <IdFieldModel>field;
      // Relation - reusing declared Ajv schemas to allow deep schema validation...
      if (isResponse && relation !== undefined) {
        return { oneOf: [{ type: 'string' }, { type: 'null' }, { $ref: `${relation}.json` }] };
      }
      // Classic id...
      const formattedField: any = { type: 'string', isId: true };
      if (!isResponse) {
        formattedField.pattern = /^[0-9a-fA-F]{24}$/.source;
        formattedField.errorMessage = {
          type: 'must be a valid id',
          pattern: 'must be a valid id',
        };
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}`;
        }
        if (!isPartial) {
          if (defaultValue !== undefined) {
            formattedField.default = defaultValue;
          } else if (!required) {
            formattedField.default = null;
          }
        }
      }
      if (!field.required) {
        formattedField.nullable = true;
      }
      return formattedField;
    },
    binary(field, isPartial, isResponse) {
      const {
        required,
        default: defaultValue,
      } = <BinaryFieldModel>field;
      const formattedField: any = { type: 'string', isBinary: true }; // TODO min length / pattern
      if (!isResponse) {
        formattedField.errorMessage = {
          type: 'must be a base64-encoded binary',
        };
        if (!isPartial) {
          if (defaultValue !== undefined) {
            formattedField.default = defaultValue;
          } else if (!required) {
            formattedField.default = null;
          }
        }
      }
      if (!field.required) {
        formattedField.nullable = true;
      }
      return formattedField;
    },
    integer(field, isPartial, isResponse) {
      const formattedField: AjvFieldSchema = { type: 'integer' };
      const {
        minimum,
        maximum,
        required,
        multipleOf,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
        default: defaultValue,
      } = <NumberFieldModel>field;
      if (!isResponse) {
        formattedField.errorMessage = {
          type: 'must be an integer',
        };
        if (minimum !== undefined) {
          formattedField.minimum = minimum;
          formattedField.errorMessage.minimum = `must be greater than or equal to ${minimum}`;
        }
        if (maximum !== undefined) {
          formattedField.maximum = maximum;
          formattedField.errorMessage.maximum = `must be smaller than or equal to ${maximum}`;
        }
        if (exclusiveMinimum !== undefined) {
          formattedField.exclusiveMinimum = exclusiveMinimum;
          formattedField.errorMessage.exclusiveMinimum = `must be greater than ${exclusiveMinimum}`;
        }
        if (exclusiveMaximum !== undefined) {
          formattedField.exclusiveMaximum = exclusiveMaximum;
          formattedField.errorMessage.exclusiveMaximum = `must be smaller than ${exclusiveMaximum}`;
        }
        if (multipleOf !== undefined) {
          formattedField.multipleOf = multipleOf;
          formattedField.errorMessage.multipleOf = `must be a multiple of ${multipleOf}`;
        }
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}`;
        }
        if (!isPartial) {
          if (defaultValue !== undefined) {
            formattedField.default = defaultValue;
          } else if (!required) {
            formattedField.default = null;
          }
        }
      }
      if (!field.required) {
        formattedField.nullable = true;
      }
      return formattedField;
    },
    float(field, isPartial, isResponse) {
      const formattedField: AjvFieldSchema = { type: 'number' };
      const {
        minimum,
        maximum,
        required,
        multipleOf,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
        default: defaultValue,
      } = <NumberFieldModel>field;
      if (!isResponse) {
        formattedField.errorMessage = {
          type: 'must be a float',
        };
        if (minimum !== undefined) {
          formattedField.minimum = minimum;
          formattedField.errorMessage.minimum = `must be greater than or equal to ${minimum}`;
        }
        if (maximum !== undefined) {
          formattedField.maximum = maximum;
          formattedField.errorMessage.maximum = `must be smaller than or equal to ${maximum}`;
        }
        if (exclusiveMinimum !== undefined) {
          formattedField.exclusiveMinimum = exclusiveMinimum;
          formattedField.errorMessage.exclusiveMinimum = `must be greater than ${exclusiveMinimum}`;
        }
        if (exclusiveMaximum !== undefined) {
          formattedField.exclusiveMaximum = exclusiveMaximum;
          formattedField.errorMessage.exclusiveMaximum = `must be smaller than ${exclusiveMaximum}`;
        }
        if (multipleOf !== undefined) {
          formattedField.multipleOf = multipleOf;
          formattedField.errorMessage.multipleOf = `must be a multiple of ${multipleOf}`;
        }
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}`;
        }
        if (!isPartial) {
          if (defaultValue !== undefined) {
            formattedField.default = defaultValue;
          } else if (!required) {
            formattedField.default = null;
          }
        }
      }
      if (!field.required) {
        formattedField.nullable = true;
      }
      return formattedField;
    },
    object: (field, isPartial, isResponse, isRoot = false) => {
      const formattedField: any = {
        type: 'object',
        errorMessage: {},
        additionalProperties: false,
      };
      const {
        fields,
        required,
        minProperties,
        maxProperties,
        patternProperties,
      } = <ObjectFieldModel>field;
      if (!isResponse) {
        formattedField.errorMessage.type = 'must be a valid object';
        if (minProperties !== undefined) {
          formattedField.minProperties = minProperties;
          formattedField.errorMessage.minProperties = `must contain at least ${minProperties} ${(minProperties === 1) ? 'entry' : 'entries'}`;
        }
        if (maxProperties !== undefined) {
          formattedField.maxProperties = maxProperties;
          formattedField.errorMessage.maxProperties = `must not contain more than ${maxProperties} ${(maxProperties === 1) ? 'entry' : 'entries'}`;
        }
      }
      if (!required && !isRoot) {
        if (!isPartial && !isResponse) {
          formattedField.default = null;
          formattedField.type = ['object', 'null'];
        } else {
          formattedField.nullable = true;
        }
        formattedField.errorMessage.type = 'must be a valid object, or "null"';
      }
      if (fields !== undefined) {
        const requiredFields = Object.keys(fields).filter((fieldName) => (
          fieldName[0] !== '_' && fields[fieldName].required === true
        ));
        if (!isResponse && !isPartial && requiredFields.length > 0) {
          formattedField.required = requiredFields;
        }
        // eslint-disable-next-line
        formattedField.properties = Object.keys(fields).reduce((acc, field) => ({
          ...acc,
          [field]: this.createSchema(fields[field], isResponse ? 'RESPONSE' : isPartial ? 'UPDATE' : 'CREATE', (schema) => schema),
        }), {});
        return formattedField;
      }
      if (patternProperties !== undefined) {
        // formattedField.patternProperties = this.createSchema(
        //   patternProperties,
        //   // eslint-disable-next-line
        //   isResponse ? 'RESPONSE' : isPartial ? 'UPDATE' : 'CREATE',
        //   (schema) => schema,
        //   false,
        // );
        return formattedField;
      }
      return { type: 'null' };
    },
    array: (field, isPartial, isResponse) => {
      const {
        fields,
        maxItems,
        minItems,
        uniqueItems,
        required,
      } = <ArrayFieldModel>field;
      const formattedField: any = {
        type: 'array',
        // eslint-disable-next-line
        items: this.createSchema(fields, isResponse ? 'RESPONSE' : isPartial ? 'UPDATE' : 'CREATE', (schema) => schema, false).items,
        errorMessage: {},
      };
      if (!isResponse) {
        formattedField.errorMessage.type = 'must be a valid array';
        if (minItems !== undefined) {
          formattedField.minItems = minItems;
          formattedField.errorMessage.minItems = `must contain at least ${minItems} ${(minItems === 1) ? 'entry' : 'entries'}`;
        }
        if (maxItems !== undefined) {
          formattedField.maxItems = maxItems;
          formattedField.errorMessage.maxItems = `must not contain more than ${maxItems} ${(maxItems === 1) ? 'entry' : 'entries'}`;
        }
        if (uniqueItems !== undefined) {
          formattedField.uniqueItems = uniqueItems;
          formattedField.errorMessage.uniqueItems = 'must contain only unique entries';
        }
      }
      if (!required) {
        if (!isPartial && !isResponse) {
          formattedField.default = null;
          formattedField.type = ['array', 'null'];
        } else {
          formattedField.nullable = true;
        }
        formattedField.errorMessage.type = 'must be a valid array, or "null"';
      }
      return formattedField;
    },
  };

  public createSchema(
    model: FieldDataModel<Types>,
    endpointType = 'CREATE', // TODO UPDATE by defualt
    transformer = (schema: any) => schema,
    isRoot = true,
  ): any {
    return isRoot
      ? transformer(this.formatters[model.type](model, endpointType === 'UPDATE', endpointType === 'RESPONSE', isRoot))
      : this.formatters[model.type](model, endpointType === 'UPDATE', endpointType === 'RESPONSE');
  }

  protected createSchemas(schemas: any, type: any, transformer = (schema: any) => schema): any {
    const formattedSchemas: any = {};
    Object.keys(schemas).forEach((key) => {
      if (key === 'response') {
        formattedSchemas.response = {};
        Object.keys(schemas[key]).forEach((response) => {
          formattedSchemas.response[response] = this.createSchema(schemas[key][response], 'RESPONSE', (schema) => schema, true);
        });
      } else {
        formattedSchemas[key] = this.createSchema(schemas[key], type, (schema) => schema, true);
      }
    });
    return transformer(formattedSchemas);
  }

  /**
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param logger Logging system to use.
   *
   * @param engine Engine to use.
   *
   * @param settings Controller settings.
   */
  public constructor(
    model: Model,
    logger: Logger,
    engine: Engine,
    settings: ControllerSettings<Types>,
  ) {
    super(model, logger, engine, settings);
    this.oAuth = this.oAuth.bind(this);
    this.handleError = this.handleError.bind(this);
    this.formatError = this.formatError.bind(this);
    this.handleNotFound = this.handleNotFound.bind(this);
  }

  /**
   * Creates a new fastify endpoint from `settings`.
   *
   * @param settings Endpoint configuration.
   *
   * @returns Fastify endpoint to register.
   */
  public createEndpoint(settings: EndpointSettings<Types>): {
    handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
    schema: AjvSchema;
  } {
    return {
      handler: async (request, response): Promise<void> => {
        await this.catchErrors(async () => {
          const { collection } = settings;
          const deviceId = request.headers['x-device-id'] as string;
          const userAgent = request.headers['user-agent'] as string;
          const permissions = new Set(settings.additionalPermissions);
          const query = (collection === undefined)
            ? request.query
            : this.parseQuery(collection, request.query as Record<string, string>, permissions);
          const body = (settings.type !== 'SEARCH' || collection === undefined)
            ? request.body
            : this.parseSearchBody(collection, {
              query: (request.body as SearchBody).query ?? undefined,
              filters: (request.body as SearchBody).filters ?? undefined,
            }, permissions);
          request.body = body;
          request.query = query;
          (request.params as CommandContext).deviceId = deviceId;
          (request.params as CommandContext).userAgent = userAgent;

          if (settings.authenticate) {
            const accessToken = `${request.headers.authorization}`.replace('Bearer ', '');
            const user = await this.oAuth(`${accessToken}`, deviceId, settings.ignoreExpiration);
            (request.params as CommandContext).user = user;

            // "*/me" endpoints on users collection are special in the way that a users can view
            // and update all their own information, but not others' ones.
            if (collection === 'users' && (request.params as { id: string; }).id === 'me') {
              (request.params as { id: Id; }).id = user._id;
              if (settings.type === 'UPDATE' && (request.body as User).roles !== undefined) {
                this.rbac(user, ['USERS_ROLES_UPDATE']);
              }
            } else {
              this.rbac(user, [...permissions]);
            }
          }

          await settings.handler(request, response);
        });
      },
      schema: this.createSchemas(settings.schema, settings.type, settings.schemaTransformer),
    };
  }

  /**
   * Registers hooks, handlers, oAuth and CRUD-related endpoints to `server`.
   *
   * @param server Fastify instance to register endpoints and hooks to.
   */
  public createEndpoints(server: FastifyInstance): void {
    const ajv = new Ajv({
      allErrors: true,
      useDefaults: true,
      coerceTypes: true,
      removeAdditional: false,
    });
    ajvErrors(ajv);

    // Adding keywords to handle special types...
    ajv.addKeyword({
      keyword: 'isBinary',
      modifying: true,
      validate: function validate(_, value, schema, context) {
        (validate as unknown as Validate).errors = [];
        if ((schema as AjvFieldSchema).nullable && value === null) {
          return true;
        }
        if ((typeof value !== 'string' || value.slice(0, 5) !== 'data:')) {
          (validate as unknown as Validate).errors.push({ keyword: 'type' });
          return false;
        }
        const encoder = new TextEncoder();
        const { parentData, parentDataProperty } = context as DataValidationCxt;
        parentData[parentDataProperty] = encoder.encode(value).buffer;
        return true;
      },
    });
    ajv.addKeyword({
      keyword: 'isDate',
      modifying: true,
      errors: true,
      validate: function validate(_, value, schema, context) {
        (validate as unknown as Validate).errors = [];
        const { nullable, enum: enums } = schema as AjvFieldSchema;
        if (nullable && value === null) {
          return true;
        }
        if (!/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/.test(`${value}`)) {
          (validate as unknown as Validate).errors.push({ keyword: 'pattern' });
          return false;
        }
        if (enums !== undefined && !enums.includes(value)) {
          (validate as unknown as Validate).errors.push({ keyword: 'enum' });
          return false;
        }
        const { parentData, parentDataProperty } = context as DataValidationCxt;
        parentData[parentDataProperty] = new Date(value);
        return true;
      },
    });
    ajv.addKeyword({
      keyword: 'isId',
      modifying: true,
      errors: true,
      validate: function validate(_, value, schema, context) {
        (validate as unknown as Validate).errors = [];
        const { nullable, enum: enums } = schema as AjvFieldSchema;
        if (nullable && value === null) {
          return true;
        }
        if (!/^[0-9a-fA-F]{24}$/.test(`${value}`)) {
          (validate as unknown as Validate).errors.push({ keyword: 'pattern' });
          return false;
        }
        if (enums !== undefined && !enums.includes(value)) {
          (validate as unknown as Validate).errors.push({ keyword: 'enum' });
          return false;
        }
        const { parentData, parentDataProperty } = context as DataValidationCxt;
        parentData[parentDataProperty] = new Id(value);
        return true;
      },
    });

    // We first register all schemas in order to let Ajv find them at compilation time.
    // We need to add schemas to the custom validator compiler instead of fastify.
    // See https://www.fastify.io/docs/latest/Reference/Validation-and-Serialization/.
    const schemas: Record<string, Schema> = {};
    this.model.getCollections().forEach((collection) => {
      const { fields } = this.model.getCollection(collection);
      const collectionResponseSchema = this.createSchema({ type: 'object', fields }, 'RESPONSE');
      schemas[`${collection as string}.json`] = collectionResponseSchema;
    });

    // Responses (for serializers)...
    const resultResponseSchema = (collection: keyof Types): Schema => ({
      $ref: `${collection as string}.json`,
    });
    const resultsResponseSchema = (collection: keyof Types): Schema => ({
      type: 'object',
      additionalProperties: false,
      properties: {
        total: { type: 'integer' },
        results: { type: 'array', items: resultResponseSchema(collection) },
      },
    });

    const fieldsSchema: StringDataModel = {
      type: 'string',
      pattern: /^([^ ]+)(,([^ ]+))*$/.source,
      errorMessages: {
        type: 'must be a coma-separated list of fields paths',
        pattern: 'must be a coma-separated list of fields paths',
      },
    };
    const resultQuerySchema: ObjectDataModel<Types> = {
      type: 'object',
      fields: {
        fields: fieldsSchema,
      },
    };
    const searchBodySchema: ObjectDataModel<Types> = {
      type: 'object',
      required: true,
      fields: {
        filters: {
          type: 'object',
          fields: {},
        },
        query: {
          type: 'object',
          fields: {
            on: {
              type: 'array',
              required: true,
              minItems: 1,
              fields: {
                type: 'string',
                errorMessages: {
                  type: 'must be valid field path',
                },
              },
              errorMessages: {
                type: 'must be an array of fields paths',
                minItems: 'must contain at least one field path',
              },
            },
            text: {
              type: 'string',
              required: true,
              maxLength: 50,
              errorMessages: {
                type: 'must be a string',
                maxLength: 'must not be longer than 50 characters',
              },
            },
          },
        },
      },
    };

    const resultsQuerySchema: ObjectDataModel<Types> = {
      type: 'object',
      fields: {
        fields: fieldsSchema,
        limit: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          default: 20,
          errorMessages: {
            type: 'must be a valid length',
            minimum: 'must be valid length',
            maximum: 'cannot be greater than 100',
          },
        },
        offset: {
          type: 'integer',
          minimum: 0,
          default: 0,
          errorMessages: {
            type: 'must be a valid offset',
            minimum: 'must be valid offset',
          },
        },
        sortBy: {
          type: 'string',
          pattern: /^([^ ]+)(,([^ ]+))*$/.source,
          errorMessages: {
            type: 'must be a coma-separated list of fields paths',
            pattern: 'must be a coma-separated list of fields paths',
          },
        },
        sortOrder: {
          type: 'string',
          pattern: /^(-1|1)(,(-1|1))*$/.source,
          errorMessages: {
            type: 'must be a coma-separated list of sorting orders',
          },
        },
      },
    };

    // OAuth endpoints.
    const { oAuth, collections } = this.endpoints;
    Object.keys(oAuth).forEach((key) => {
      const method = (key === 'resetPassword' || key === 'verifyEmail') ? 'put' : 'post';
      const oAuthEndpoint = oAuth[key as keyof BuiltInEndpoints<Types>['oAuth']] as BuiltInEndpoint;
      server[method](oAuthEndpoint.path, this.createEndpoint(this.apiHandlers[key]));
    });

    // CRUD endpoints.
    (Object.keys(collections) as (keyof Types)[]).forEach((collection) => {
      const collectionEndpoints = collections[collection] as CollectionBuiltInEndpoints;
      const resultParamsSchema: ObjectDataModel<Types> = {
        type: 'object',
        required: true,
        fields: {
          // Allows usage of "me" as an identifier in users-related endpoints.
          id: (collection !== 'users')
            ? { type: 'id', required: true }
            : {
              type: 'string',
              required: true,
              pattern: /^(me|[0-9a-fA-F]{24})$/.source,
              errorMessages: {
                type: 'must be a valid id, or "me"',
                pattern: 'must be a valid id, or "me"',
              },
            },
        },
      };
      Object.keys(collectionEndpoints).forEach((endpoint) => {
        const { path: endpointPath, maximumDepth } = collectionEndpoints[endpoint as EndpointType];
        if (endpoint === 'create') {
          server.post(endpointPath, this.createEndpoint({
            collection,
            type: 'CREATE',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_CREATE`],
            schemaTransformer: (schema) => {
              const schemaWithHeaders = this.commonHeadersTransformer(schema);
              return {
                ...schemaWithHeaders,
                response: { '2xx': resultResponseSchema(collection) },
              };
            },
            handler: async (request, response) => {
              const body = request.body as Types[keyof Types];
              const context = request.params as CommandContext;
              const options = { ...request.query as CommandOptions, maximumDepth };
              const resource = await this.engine.create(collection, body, options, context);
              response.status(201).send(resource);
            },
            schema: {
              response: {},
              query: resultQuerySchema,
              body: {
                type: 'object',
                required: true,
                fields: this.model.getCollection(collection).fields,
              },
            },
          }));
        } else if (endpoint === 'update') {
          server.put(endpointPath, this.createEndpoint({
            collection,
            type: 'UPDATE',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_UPDATE`],
            schemaTransformer: (schema) => {
              const schemaWithHeaders = this.commonHeadersTransformer(schema);
              return {
                ...schemaWithHeaders,
                response: { '2xx': resultResponseSchema(collection) },
              };
            },
            handler: async (request, response) => {
              const { id } = request.params as { id: Id; };
              const body = request.body as Types[keyof Types];
              const context = request.params as CommandContext;
              const options = { ...request.query as CommandOptions, maximumDepth };
              const resource = await this.engine.update(collection, id, body, options, context);
              response.status(200).send(resource);
            },
            schema: {
              response: {},
              query: resultQuerySchema,
              params: resultParamsSchema,
              body: {
                type: 'object',
                required: true,
                fields: this.model.getCollection(collection).fields,
              },
            },
          }));
        } else if (endpoint === 'list') {
          server.get(endpointPath, this.createEndpoint({
            collection,
            type: 'LIST',
            authenticate: true,
            schemaTransformer: (schema) => {
              const schemaWithHeaders = this.commonHeadersTransformer(schema);
              return {
                ...schemaWithHeaders,
                response: { '2xx': resultsResponseSchema(collection) },
              };
            },
            handler: async (request, response) => {
              const options = { ...request.query as CommandOptions, maximumDepth };
              const results = await this.engine.list(collection, options);
              response.send(results);
            },
            schema: {
              query: resultsQuerySchema,
              response: {},
            },
          }));
        } else if (endpoint === 'view') {
          server.get(endpointPath, this.createEndpoint({
            collection,
            type: 'VIEW',
            authenticate: true,
            schemaTransformer: (schema) => {
              const schemaWithHeaders = this.commonHeadersTransformer(schema);
              return {
                ...schemaWithHeaders,
                response: { '2xx': resultResponseSchema(collection) },
              };
            },
            handler: async (request, response) => {
              const { id } = request.params as { id: Id; };
              const options = { ...request.query as CommandOptions, maximumDepth };
              const resource = await this.engine.view(collection, id, options);
              response.status(200).send(resource);
            },
            schema: {
              response: {},
              query: resultQuerySchema,
              params: resultParamsSchema,
            },
          }));
        } else if (endpoint === 'search') {
          server.post(endpointPath, this.createEndpoint({
            collection,
            type: 'SEARCH',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_SEARCH`],
            schemaTransformer: (schema) => {
              const schemaWithHeaders = this.commonHeadersTransformer(schema);
              return {
                ...schemaWithHeaders,
                body: {
                  ...schemaWithHeaders.body,
                  properties: {
                    ...schemaWithHeaders.body.properties,
                    filters: {
                      ...schemaWithHeaders.body.properties.filters,
                      additionalProperties: true,
                      patternProperties: {
                        '^[0-9A-Za-z.]$': {
                          oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } },
                          ],
                        },
                      },
                    },
                  },
                },
                response: {
                  '2xx': resultsResponseSchema(collection),
                },
              };
            },
            handler: async (request, response) => {
              const searchBody = request.body as SearchBody;
              const options = { ...request.query as CommandOptions, maximumDepth };
              const results = await this.engine.search(collection, searchBody, options);
              response.status(200).send(results);
            },
            schema: {
              response: {},
              body: searchBodySchema,
              query: resultsQuerySchema,
            },
          }));
        } else if (endpoint === 'delete') {
          server.delete(endpointPath, this.createEndpoint({
            collection,
            type: 'DELETE',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_DELETE`],
            schemaTransformer: this.commonHeadersTransformer,
            handler: async (request, response) => {
              const { id } = request.params as { id: Id; };
              await this.engine.delete(collection, id, request.params as CommandContext);
              response.status(200).send();
            },
            schema: {
              params: resultParamsSchema,
              response: { '2xx': { type: 'null' } },
            },
          }));
        }
      });
    });

    const formatOutput = (resource: unknown): unknown => {
      if (Array.isArray(resource)) {
        return resource.map((item) => formatOutput(item));
      }
      if (isNested(resource)) {
        return Object.keys(resource as Record<string, unknown>)
          .reduce((formattedResource, key) => ({
            ...formattedResource,
            [key]: formatOutput((resource as Record<string, unknown>)[key]),
          }), {});
      }
      if (resource instanceof Id) {
        return `${resource}`;
      }
      if (resource instanceof Date) {
        return resource.toISOString();
      }
      if (resource instanceof ArrayBuffer) {
        const decoder = new TextDecoder();
        return decoder.decode(resource);
      }
      return resource;
    };

    server.addHook('preSerialization', async (_request, _response, payload): Promise<unknown> => (
      formatOutput(payload)
    ));

    // API Versionning.
    server.addHook('onSend', async (_request, response, payload) => {
      response.header('X-App-Release', this.version);
      return payload;
    });

    // Default errors handlers.
    server.setSchemaErrorFormatter(this.formatError);
    server.setNotFoundHandler(this.handleNotFound);
    server.setErrorHandler(this.handleError.bind(this));
    server.setValidatorCompiler(({ schema }) => ajv.compile(schema));
    server.setSerializerCompiler(({ schema }) => fastJsonStringify(schema as Schema, {
      schema: schemas,
    }));
  }
}

// // Logs requests timeouts.
// app.addHook('onTimeout', (request, _response, done) => {
//   logger.error(new Error(`Request "${request.method} ${request.url}" timed out.`), {
//     statusCode: 504,
//     url: request.url,
//     method: request.method,
//     headers: Object.keys(request.headers),
//   });
//   done();
// });

// // Catch-all for unsupported content types. Prevents fastify from throwing HTTP 500 when dealing
// // with unknown payloads. See https://www.fastify.io/docs/latest/ContentTypeParser/.
// app.addContentTypeParser('*', (_request, payload, next) => {
//   if (/^multipart\/form-data/.test(payload.headers['content-type'] as string)) {
//     next(null, payload);
//   } else {
//     let data = '';
//     payload.on('data', (chunk) => { data += chunk; });
//     payload.on('end', () => { next(null, data); });
//   }
// });
