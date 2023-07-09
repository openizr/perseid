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
  type FastifySchema,
} from 'fastify';
import {
  Id,
  type Role,
  type User,
  type FieldSchema,
  type DefaultDataModel,
  type CollectionSchema,
  type DataModelMetadata,
  IdSchema,
  BinarySchema,
  BooleanSchema,
  DateSchema,
  NumberSchema,
  StringSchema,
  ObjectSchema,
  DynamicObjectSchema,
  ArraySchema,
} from '@perseid/core';
import os from 'os';
import Ajv from 'ajv';
import { join } from 'path';
import Controller, {
  type EndpointType,
  type BuiltInEndpoint,
  type BuiltInEndpoints,
  type ControllerSettings,
  type CollectionBuiltInEndpoints,
} from 'scripts/services/Controller';
import ajvErrors from 'ajv-errors';
import multiparty from 'multiparty';
import { createWriteStream } from 'fs';
import Gone from 'scripts/errors/Gone';
import BaseModel from 'scripts/services/Model';
import NotFound from 'scripts/errors/NotFound';
import Conflict from 'scripts/errors/Conflict';
import EngineError from 'scripts/errors/Engine';
import Forbidden from 'scripts/errors/Forbidden';
import type Logger from 'scripts/services/Logger';
import BadRequest from 'scripts/errors/BadRequest';
import { type IncomingMessage as Payload } from 'http';
import Unauthorized from 'scripts/errors/Unauthorized';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import type OAuthEngine from 'scripts/services/OAuthEngine';
import TooManyRequests from 'scripts/errors/TooManyRequests';
import fastJsonStringify, { Schema } from 'fast-json-stringify';
import UnprocessableEntity from 'scripts/errors/UnprocessableEntity';
import RequestEntityTooLarge from 'scripts/errors/RequestEntityTooLarge';
import { type DataValidationCxt, type KeywordDefinition } from 'ajv/dist/types';

const decoder = new TextDecoder();
const defaultTransformer = (schema: FastifySchema): FastifySchema => schema;

type Validate = { errors: { keyword: string; }[]; };

/**
 * API validation schema.
 */
export interface ModelSchema<DataModel> {
  body?: FieldSchema<DataModel>;
  query?: FieldSchema<DataModel>;
  params?: FieldSchema<DataModel>;
  headers?: FieldSchema<DataModel>;
  response?: {
    [status: string]: FieldSchema<DataModel>;
  };
}

/**
 * Uploaded file.
 */
export interface UploadedFile {
  id: string;
  size: number;
  type: string;
  path: string;
  name: string;
}

/**
 * Parsed multipart/form-data fields.
 */
export interface FormDataFields {
  [name: string]: string | UploadedFile[];
}

/**
 * Multipart/form-data parser options.
 */
export interface FormDataOptions {
  maxFields?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  maxFieldsSize?: number;
  allowedMimeTypes?: string[];
}

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
 * Ajv validation schema.
 */
export interface AjvValidationSchema {
  type?: (
    'null' | 'object' | 'string' | 'array' | 'boolean' | 'number' | 'integer'
    | ('null' | 'object' | 'string' | 'array' | 'boolean' | 'number' | 'integer')[]
  );
  $ref?: string;
  isId?: boolean;
  isDate?: boolean;
  isBinary?: boolean;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  multipleOf?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  required?: string[];
  oneOf?: AjvValidationSchema[];
  errorMessage?: {
    [key: string]: string;
  };
  additionalProperties?: boolean;
  enum?: (string | null | number)[];
  items?: AjvValidationSchema;
  properties?: {
    [name: string]: AjvValidationSchema;
  };
  patternProperties?: {
    [pattern: string]: AjvValidationSchema;
  };
  default?: number | string | null | Date | Id | boolean;
}

/**
 * Perseid data model to Ajv validation schema formatters.
 */
export interface AjvFormatters<DataModel> {
  [type: string]: (
    model: FieldSchema<DataModel>,
    mode: 'RESPONSE' | 'CREATE' | 'UPDATE'
  ) => AjvValidationSchema;
}

/**
 * Custom endpoint configuration.
 */
export interface EndpointSettings<DataModel> {
  /** Whether to authenticate user for that endpoint. */
  authenticate?: boolean;

  /** Name of the collection for which to generate the endpoint, if applicable. */
  collection?: keyof DataModel;

  /** Whether to ignore access token expiration. Useful for endpoints like refresh token. */
  ignoreExpiration?: boolean;

  /** Additional permissions to check for that endpoint. */
  additionalPermissions?: string[];

  /** API validation schema for that endpoint. */
  schema?: ModelSchema<DataModel>;

  /** Endpoint type, if applicable. Use in combination with `collection`. */
  type?: 'SEARCH' | 'LIST' | 'CREATE' | 'UPDATE' | 'VIEW' | 'DELETE';

  /** Optional transformation function to apply to generated Ajv schema. */
  schemaTransformer?: (schema: FastifySchema) => FastifySchema;

  /** Actual endpoint handler. */
  handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
}

/**
 * API controller, designed for Fastify framework.
 */
export default class FastifyController<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  Engine extends OAuthEngine<DataModel> = OAuthEngine<DataModel>,
> extends Controller<DataModel, Model, Engine> {
  /** HTTP 404 error code. */
  protected readonly NOT_FOUND_CODE = 'NOT_FOUND';

  /** Invalid payload error code. */
  protected readonly INVALID_PAYLOAD_CODE = 'INVALID_PAYLOAD';

  /** List of special Ajv keywords, used to format special types on the fly. */
  protected readonly KEYWORDS: KeywordDefinition[] = [
    {
      keyword: 'isBinary',
      modifying: true,
      validate: function validate(_, value, schema, context): boolean {
        (validate as unknown as Validate).errors = [];
        if ((schema as AjvValidationSchema).nullable && value === null) {
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
    } as KeywordDefinition,
    {
      keyword: 'isDate',
      modifying: true,
      errors: true,
      validate: function validate(_, value, schema, context) {
        (validate as unknown as Validate).errors = [];
        const { nullable, enum: enums } = schema as AjvValidationSchema;
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
    } as KeywordDefinition,
    {
      keyword: 'isId',
      modifying: true,
      errors: true,
      validate: function validate(_, value, schema, context) {
        (validate as unknown as Validate).errors = [];
        const { nullable, enum: enums } = schema as AjvValidationSchema;
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
    } as KeywordDefinition,
  ];

  /** List of formatters, used to format a perseid data model into its Ajv equivalent. */
  protected readonly FORMATTERS: AjvFormatters<DataModel> = {
    null() {
      return { type: 'null', errorMessage: {} };
    },
    id(schema, mode) {
      const {
        relation,
        errorMessages,
        enum: enumerations,
        default: defaultValue,
      } = schema as IdSchema<DataModel>;
      // Response mode...
      if (mode === 'RESPONSE') {
        return (relation === undefined)
          ? { type: 'string', nullable: !schema.required }
          : { oneOf: [{ type: 'string' }, { $ref: `${relation as string}.json` }] };
      }
      // Create / update mode...
      const fieldSchema: AjvValidationSchema = {
        isId: true,
        pattern: /^[0-9a-fA-F]{24}$/.source,
        type: schema.required ? 'string' : ['string', 'null'],
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be a valid id${schema.required ? '' : ', or null'}`;
      fieldSchema.errorMessage.pattern ??= 'must be a valid id';
      if (enumerations !== undefined) {
        fieldSchema.enum = enumerations.map((id) => `${id}`);
        fieldSchema.enum.push(...(schema.required ? [] : [null]));
        fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
          `"${value}"`
        )).join(', ')}`;
      }
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
        if (defaultValue !== undefined) {
          fieldSchema.default = defaultValue;
        }
      }
      return fieldSchema;
    },
    binary(schema, mode) {
      // Response mode...
      if (mode === 'RESPONSE') {
        return { type: 'string', nullable: !schema.required };
      }
      // Create / update mode...
      const { errorMessages, default: defaultValue } = schema as BinarySchema;
      const fieldSchema: AjvValidationSchema = {
        minLength: 10,
        isBinary: true,
        type: schema.required ? 'string' : ['string', 'null'],
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be a base64-encoded binary${schema.required ? '' : ', or null'}`;
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
        if (defaultValue !== undefined) {
          fieldSchema.default = decoder.decode(defaultValue);
        }
      }
      return fieldSchema;
    },
    boolean(schema, mode) {
      // Response mode...
      if (mode === 'RESPONSE') {
        return { type: 'boolean', nullable: !schema.required };
      }
      // Create / update mode...
      const { errorMessages, default: defaultValue } = schema as BooleanSchema;
      const fieldSchema: AjvValidationSchema = {
        type: schema.required ? 'boolean' : ['boolean', 'null'],
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be a boolean${schema.required ? '' : ', or null'}`;
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
        if (defaultValue !== undefined) {
          fieldSchema.default = defaultValue;
        }
      }
      return fieldSchema;
    },
    date(schema, mode) {
      // Response mode...
      if (mode === 'RESPONSE') {
        return { type: 'string', nullable: !schema.required };
      }
      // Create / update mode...
      const { enum: enumerations, errorMessages, default: defaultValue } = schema as DateSchema;
      const fieldSchema: AjvValidationSchema = {
        isDate: true,
        type: schema.required ? 'string' : ['string', 'null'],
        pattern: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/.source,
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be a valid date${schema.required ? '' : ', or null'}`;
      fieldSchema.errorMessage.pattern ??= 'must be a valid date';
      if (enumerations !== undefined) {
        fieldSchema.enum = enumerations.map((date) => date.toISOString());
        fieldSchema.enum.push(...(schema.required ? [] : [null]));
        fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
          `"${value.toISOString()}"`
        )).join(', ')}`;
      }
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
        if (defaultValue !== undefined) {
          fieldSchema.default = defaultValue;
        }
      }
      return fieldSchema;
    },
    float(schema, mode) {
      // Response mode...
      if (mode === 'RESPONSE') {
        return { type: 'number', nullable: !schema.required };
      }
      // Create / update mode...
      const {
        minimum,
        maximum,
        multipleOf,
        errorMessages,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
        default: defaultValue,
      } = schema as NumberSchema;
      const fieldSchema: AjvValidationSchema = {
        type: schema.required ? 'number' : ['number', 'null'],
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be a float${schema.required ? '' : ', or null'}`;
      if (minimum !== undefined) {
        fieldSchema.minimum = minimum;
        fieldSchema.errorMessage.minimum ??= `must be greater than or equal to ${minimum}`;
      }
      if (maximum !== undefined) {
        fieldSchema.maximum = maximum;
        fieldSchema.errorMessage.maximum ??= `must be smaller than or equal to ${maximum}`;
      }
      if (exclusiveMinimum !== undefined) {
        fieldSchema.exclusiveMinimum = exclusiveMinimum;
        fieldSchema.errorMessage.exclusiveMinimum ??= `must be greater than ${exclusiveMinimum}`;
      }
      if (exclusiveMaximum !== undefined) {
        fieldSchema.exclusiveMaximum = exclusiveMaximum;
        fieldSchema.errorMessage.exclusiveMaximum ??= `must be smaller than ${exclusiveMaximum}`;
      }
      if (multipleOf !== undefined) {
        fieldSchema.multipleOf = multipleOf;
        fieldSchema.errorMessage.multipleOf ??= `must be a multiple of ${multipleOf}`;
      }
      if (enumerations !== undefined) {
        fieldSchema.enum = [...enumerations];
        fieldSchema.enum.push(...(schema.required ? [] : [null]));
        fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
          `${value}`
        )).join(', ')}`;
      }
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
        if (defaultValue !== undefined) {
          fieldSchema.default = defaultValue;
        }
      }
      return fieldSchema;
    },
    integer(schema, mode) {
      // Response mode...
      if (mode === 'RESPONSE') {
        return { type: 'integer', nullable: !schema.required };
      }
      // Create / update mode...
      const {
        minimum,
        maximum,
        multipleOf,
        errorMessages,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
        default: defaultValue,
      } = schema as NumberSchema;
      const fieldSchema: AjvValidationSchema = {
        type: schema.required ? 'integer' : ['integer', 'null'],
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be an integer${schema.required ? '' : ', or null'}`;
      if (minimum !== undefined) {
        fieldSchema.minimum = minimum;
        fieldSchema.errorMessage.minimum ??= `must be greater than or equal to ${minimum}`;
      }
      if (maximum !== undefined) {
        fieldSchema.maximum = maximum;
        fieldSchema.errorMessage.maximum ??= `must be smaller than or equal to ${maximum}`;
      }
      if (exclusiveMinimum !== undefined) {
        fieldSchema.exclusiveMinimum = exclusiveMinimum;
        fieldSchema.errorMessage.exclusiveMinimum ??= `must be greater than ${exclusiveMinimum}`;
      }
      if (exclusiveMaximum !== undefined) {
        fieldSchema.exclusiveMaximum = exclusiveMaximum;
        fieldSchema.errorMessage.exclusiveMaximum ??= `must be smaller than ${exclusiveMaximum}`;
      }
      if (multipleOf !== undefined) {
        fieldSchema.multipleOf = multipleOf;
        fieldSchema.errorMessage.multipleOf ??= `must be a multiple of ${multipleOf}`;
      }
      if (enumerations !== undefined) {
        fieldSchema.enum = [...enumerations];
        fieldSchema.enum.push(...(schema.required ? [] : [null]));
        fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
          `${value}`
        )).join(', ')}`;
      }
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
        if (defaultValue !== undefined) {
          fieldSchema.default = defaultValue;
        }
      }
      return fieldSchema;
    },
    string(schema, mode) {
      // Response mode...
      if (mode === 'RESPONSE') {
        return { type: 'string', nullable: !schema.required };
      }
      // Create / update mode...
      const {
        pattern,
        maxLength,
        minLength,
        errorMessages,
        enum: enumerations,
        default: defaultValue,
      } = schema as StringSchema;
      const fieldSchema: AjvValidationSchema = {
        type: schema.required ? 'string' : ['string', 'null'],
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be a string${schema.required ? '' : ', or null'}`;
      if (maxLength !== undefined) {
        fieldSchema.maxLength = maxLength;
        fieldSchema.errorMessage.maxLength ??= `must be no longer than ${maxLength} characters`;
      }
      if (minLength !== undefined) {
        fieldSchema.minLength = minLength;
        fieldSchema.errorMessage.minLength ??= `must be no shorter than ${minLength} characters`;
      }
      if (pattern !== undefined) {
        fieldSchema.pattern = pattern;
        fieldSchema.errorMessage.pattern ??= `must match "${pattern}" pattern`;
      }
      if (enumerations !== undefined) {
        fieldSchema.enum = [...enumerations];
        fieldSchema.enum.push(...(schema.required ? [] : [null]));
        fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
          `"${value}"`
        )).join(', ')}`;
      }
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
        if (defaultValue !== undefined) {
          fieldSchema.default = defaultValue;
        }
      }
      return fieldSchema;
    },
    object: (schema, mode) => {
      const {
        fields,
        errorMessages,
      } = schema as ObjectSchema<DataModel>;
      // Response mode...
      if (mode === 'RESPONSE') {
        return {
          type: 'object',
          nullable: !schema.required,
          additionalProperties: false,
          properties: Object.keys(fields).reduce((properties, key) => ({
            ...properties,
            [key]: this.FORMATTERS[fields[key].type](fields[key], mode),
          }), {}),
        };
      }
      // Create / update mode...
      const exposedFields = Object.keys(fields).filter((field) => field[0] !== '_');
      const fieldSchema: AjvValidationSchema = {
        additionalProperties: false,
        type: schema.required ? 'object' : ['object', 'null'],
        properties: exposedFields.reduce((properties, key) => ({
          ...properties,
          [key]: this.FORMATTERS[fields[key].type](fields[key], mode),
        }), {}),
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be a valid object${schema.required ? '' : ', or null'}`;
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
        const requiredFields = exposedFields.filter((field) => fields[field].required);
        if (requiredFields.length > 0) {
          fieldSchema.required = requiredFields;
        }
      }
      return fieldSchema;
    },
    dynamicObject: (schema, mode) => {
      const {
        fields,
        maxItems,
        minItems,
        errorMessages,
      } = schema as DynamicObjectSchema<DataModel>;
      // Response mode...
      if (mode === 'RESPONSE') {
        return {
          type: 'object',
          nullable: !schema.required,
          additionalProperties: true,
          patternProperties: Object.keys(fields).reduce((patternProperties, key) => ({
            ...patternProperties,
            [key]: this.FORMATTERS[fields[key].type](fields[key], mode),
          }), {}),
        };
      }
      // Create / update mode...
      const fieldSchema: AjvValidationSchema = {
        minProperties: minItems,
        maxProperties: maxItems,
        additionalProperties: false,
        type: schema.required ? 'object' : ['object', 'null'],
        patternProperties: Object.keys(fields).reduce((patternProperties, key) => ({
          ...patternProperties,
          [key]: this.FORMATTERS[fields[key].type](fields[key], mode),
        }), {}),
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be a valid object${schema.required ? '' : ', or null'}`;
      if (minItems !== undefined) {
        fieldSchema.minProperties = minItems;
        fieldSchema.errorMessage.minProperties ??= `must contain at least ${minItems} ${(minItems === 1) ? 'entry' : 'entries'}`;
      }
      if (maxItems !== undefined) {
        fieldSchema.maxProperties = maxItems;
        fieldSchema.errorMessage.maxProperties ??= `must not contain more than ${maxItems} ${(maxItems === 1) ? 'entry' : 'entries'}`;
      }
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
      }
      return fieldSchema;
    },
    array: (schema, mode) => {
      const {
        fields,
        maxItems,
        minItems,
        uniqueItems,
        errorMessages,
      } = schema as ArraySchema<DataModel>;
      // Response mode...
      if (mode === 'RESPONSE') {
        return {
          type: 'array',
          nullable: !schema.required,
          items: this.FORMATTERS[fields.type](fields, mode),
        };
      }
      // Create / update mode...
      const fieldSchema: AjvValidationSchema = {
        minItems,
        maxItems,
        type: schema.required ? 'array' : ['array', 'null'],
        items: this.FORMATTERS[fields.type](fields, 'CREATE'),
      };
      fieldSchema.errorMessage = errorMessages ?? {};
      fieldSchema.errorMessage.type ??= `must be a valid array${schema.required ? '' : ', or null'}`;
      if (minItems !== undefined) {
        fieldSchema.minItems = minItems;
        fieldSchema.errorMessage.minItems ??= `must contain at least ${minItems} ${(minItems === 1) ? 'entry' : 'entries'}`;
      }
      if (maxItems !== undefined) {
        fieldSchema.maxItems = maxItems;
        fieldSchema.errorMessage.maxItems ??= `must not contain more than ${maxItems} ${(maxItems === 1) ? 'entry' : 'entries'}`;
      }
      if (uniqueItems !== undefined) {
        fieldSchema.uniqueItems = uniqueItems;
        fieldSchema.errorMessage.uniqueItems ??= 'must contain only unique entries';
      }
      if (mode === 'CREATE') {
        if (!schema.required) {
          fieldSchema.default = null;
        }
      }
      return fieldSchema;
    },
  };

  /** Increment used for `multipart/form-data` payloads parsing. */
  protected increment = 0;

  /** Built-in API handlers for OAuth related endpoints. */
  protected apiHandlers: Record<string, EndpointSettings<DataModel>> = {
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
            email: { type: 'string', required: true },
            password: { type: 'string', required: true },
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
      handler: async (request, response) => {
        const { resetToken, password, passwordConfirmation } = request.body as {
          resetToken: string;
          password: User['password'];
          passwordConfirmation: User['password'];
        };
        await this.engine.resetPassword(password, passwordConfirmation, resetToken);
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
   * Creates an Ajv validation schema from `schema`.
   *
   * @param schema Schema from which to create validation schema.
   *
   * @param mode Which mode (creation / update) is intended for schema generation.
   *
   * @param transfomer Optional transformation function to apply to generated Ajv schema.
   *
   * @returns Ajv validation schema.
   */
  protected createSchema(
    schema: ModelSchema<DataModel>,
    mode: 'CREATE' | 'UPDATE',
    transformer = defaultTransformer,
  ): FastifySchema {
    const formattedSchema: FastifySchema = {};
    Object.keys(schema).forEach((key) => {
      const partSchema = schema as Record<string, FieldSchema<DataModel>>;
      if (key === 'response') {
        const responseSchema = {} as { [status: string]: AjvValidationSchema };
        Object.keys(partSchema[key]).forEach((status) => {
          const subSchema = (schema[key] as Record<string, FieldSchema<DataModel>>)[status];
          responseSchema[status] = this.FORMATTERS[subSchema.type](subSchema, 'RESPONSE');
        });
        formattedSchema.response = responseSchema;
      } else {
        formattedSchema[key as 'body'] = this.FORMATTERS[partSchema[key].type](partSchema[key], mode);
      }
    });
    return transformer(formattedSchema);
  }

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
    let message = error[0].message ?? '';
    const { keyword, instancePath, params } = error[0];

    const httpPart = dataVar === 'querystring' ? 'query' : dataVar;
    const fullPath = `${httpPart}${(instancePath as string).replace(/\//g, '.')}`;
    message = `"${fullPath}" ${message}.`;
    if (keyword === 'required') {
      message = `"${fullPath}.${params?.missingProperty}" is required.`;
    } else if (keyword === 'additionalProperties') {
      message = `Unknown field "${fullPath}.${params?.additionalProperty}".`;
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
  protected parseFormData(
    payload: Payload,
    options: FormDataOptions = {},
  ): Promise<FormDataFields> {
    let totalSize = 0;
    let totalFiles = 0;
    const allowedMimeTypes = options.allowedMimeTypes ?? [];
    const maxTotalSize = options.maxTotalSize ?? 10000000;
    const maxFileSize = options.maxFileSize ?? 2000000;
    return new Promise((resolve, reject) => {
      const fields: FormDataFields = {};
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
        if (!allowedMimeTypes.includes(part.headers['content-type'])) {
          reject(new BadRequest('INVALID_FILE_TYPE', `Invalid file type "${part.headers['content-type']}" for file "${part.filename}".`));
        } else {
          const fileIndex = totalFiles;
          totalFiles += 1;
          const fileId = Date.now().toString(16) + this.increment;
          this.increment += 1;
          const filePath = join(os.tmpdir(), fileId);
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
          const uploadedFiles = (fields[part.name] ?? []) as UploadedFile[];
          uploadedFiles.push({
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
            uploadedFiles[fileIndex].size += size;
            if (totalSize > maxTotalSize) {
              reject(new RequestEntityTooLarge('FILES_TOO_LARGE', 'Maximum total files size exceeded.'));
            }
            if (uploadedFiles[fileIndex].size > maxFileSize) {
              reject(new RequestEntityTooLarge('FILE_TOO_LARGE', `Maximum size exceeded for file "${part.filename}".`));
            }
            fileStream.write(stream);
          });
          fields[part.name] = uploadedFiles;
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
   * @param request Fastify request.
   *
   * @param response Fastify response.
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
    let { user } = context;
    // As `engine.view` throws an error if user does not exist (for instance, a user that just has
    // been deleted, but tries to sign-in), we need to wrap the statement inside a try...catch.
    try {
      user = await this.engine.view('users', userId, {
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
      if (user._devices.find((device) => device.id === deviceId) === undefined) {
        throw new EngineError('NO_RESOURCE');
      }
    } catch (error) {
      if (error instanceof EngineError && error.code === 'NO_RESOURCE') {
        throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
      }
      throw error;
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
    settings: ControllerSettings<DataModel>,
  ) {
    super(model, logger, engine, settings);
    this.oAuth = this.oAuth.bind(this);
    this.handleError = this.handleError.bind(this);
    this.formatError = this.formatError.bind(this);
    this.formatOutput = this.formatOutput.bind(this);
    this.handleNotFound = this.handleNotFound.bind(this);
  }

  /**
   * Creates a new fastify endpoint from `settings`.
   *
   * @param settings Endpoint configuration.
   *
   * @returns Fastify endpoint to register.
   */
  public createEndpoint(settings: EndpointSettings<DataModel>): {
    handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
    schema: FastifySchema;
  } {
    const { collection, type } = settings;
    const validationType = (type === 'SEARCH') ? 'CREATE' : type as 'CREATE' | 'UPDATE';
    const headersTransformer = (schema: FastifySchema): FastifySchema => {
      const headersSchema = { ...schema.headers as AjvValidationSchema };
      return (settings.schemaTransformer ?? defaultTransformer)(!settings.authenticate
        ? schema
        : {
          ...schema,
          headers: {
            ...headersSchema,
            type: 'object',
            additionalProperties: true,
            required: [...(headersSchema?.required ?? []), 'x-device-id'],
            properties: {
              ...headersSchema.properties,
              'x-device-id': {
                type: 'string',
                errorMessage: {
                  type: 'must be a valid device id',
                  pattern: 'must be a valid device id',
                },
              },
            },
          },
        });
    };
    return {
      handler: async (request, response): Promise<void> => {
        await this.catchErrors(async () => {
          const deviceId = request.headers['x-device-id'] as string;
          const userAgent = request.headers['user-agent'] as string;
          const permissions = new Set(settings.additionalPermissions);
          const query = (collection === undefined)
            ? request.query
            : this.parseQuery(collection, request.query as Record<string, string>, permissions);
          const body = (type !== 'SEARCH' || collection === undefined)
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
              if (type === 'UPDATE' && (request.body as User).roles !== undefined) {
                this.rbac(user, ['USERS_ROLES_UPDATE']);
              }
            } else {
              this.rbac(user, [...permissions]);
            }
          }

          await settings.handler(request, response);
        });
      },
      schema: this.createSchema(settings.schema ?? {}, validationType, headersTransformer),
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
    this.KEYWORDS.forEach((keyword) => ajv.addKeyword(keyword));

    // We first register all schemas in order to let Ajv find them at compilation time.
    // We need to add schemas to the custom validator compiler instead of fastify.
    // See https://www.fastify.io/docs/latest/Reference/Validation-and-Serialization/.
    const schemas: Record<string, AjvValidationSchema> = {};
    this.model.getCollections().forEach((collection) => {
      const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
      const collectionSchema = { type: 'object' as const, fields: metaData.schema.fields };
      const collectionResponseSchema = this.FORMATTERS.object(collectionSchema, 'RESPONSE');
      schemas[`${collection as string}.json`] = collectionResponseSchema;
    });

    // Responses (for serializers)...
    const resultResponseSchema = (collection: keyof DataModel): Schema => ({
      $ref: `${collection as string}.json`,
    });
    const resultsResponseSchema = (collection: keyof DataModel): Schema => ({
      type: 'object',
      additionalProperties: false,
      properties: {
        total: { type: 'integer' },
        results: { type: 'array', items: resultResponseSchema(collection) },
      },
    });
    const fieldsSchema: StringSchema = {
      type: 'string',
      pattern: /^([^ ]+)(,([^ ]+))*$/.source,
      errorMessages: {
        type: 'must be a coma-separated list of fields paths',
        pattern: 'must be a coma-separated list of fields paths',
      },
    };
    const resultQuerySchema: ObjectSchema<DataModel> = {
      type: 'object',
      required: true,
      fields: {
        fields: fieldsSchema,
      },
    };
    const searchBodySchema: ObjectSchema<DataModel> = {
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
                required: true,
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
    const resultsQuerySchema: ObjectSchema<DataModel> = {
      type: 'object',
      required: true,
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

    // Model endpoint.
    server.get('/_model', this.createEndpoint({
      authenticate: true,
      handler: async (request, response) => {
        const { collection } = request.query as { collection: keyof DataModel; };
        response.status(200).send(this.model.getPublicSchema(collection));
      },
    }));

    // OAuth endpoints.
    const { oAuth, collections } = this.endpoints;
    Object.keys(oAuth).forEach((key) => {
      const method = (key === 'resetPassword' || key === 'verifyEmail') ? 'put' : 'post';
      const oAuthEndpoint = oAuth[key as keyof BuiltInEndpoints<DataModel>['oAuth']] as BuiltInEndpoint;
      server[method](oAuthEndpoint.path, this.createEndpoint(this.apiHandlers[key]));
    });

    // CRUD endpoints.
    (Object.keys(collections) as (keyof DataModel)[]).forEach((collection) => {
      const collectionEndpoints = collections[collection] as CollectionBuiltInEndpoints;
      const resultParamsSchema: ObjectSchema<DataModel> = {
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
      (Object.keys(collectionEndpoints) as EndpointType[]).forEach((endpoint) => {
        const { path, maximumDepth } = collectionEndpoints[endpoint] as BuiltInEndpoint;
        if (endpoint === 'create') {
          const data = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
          server.post(path, this.createEndpoint({
            collection,
            type: 'CREATE',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_CREATE`],
            schemaTransformer: (schema) => ({
              ...schema,
              response: { '2xx': resultResponseSchema(collection) },
            }),
            handler: async (request, response) => {
              const body = request.body as DataModel[keyof DataModel];
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
                fields: data.schema.fields,
              },
            },
          }));
        } else if (endpoint === 'update') {
          const data = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
          server.put(path, this.createEndpoint({
            collection,
            type: 'UPDATE',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_UPDATE`],
            schemaTransformer: (schema) => ({
              ...schema,
              response: { '2xx': resultResponseSchema(collection) },
            }),
            handler: async (request, response) => {
              const { id } = request.params as { id: Id; };
              const body = request.body as DataModel[keyof DataModel];
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
                fields: data.schema.fields,
              },
            },
          }));
        } else if (endpoint === 'list') {
          server.get(path, this.createEndpoint({
            collection,
            type: 'LIST',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_LIST`],
            schemaTransformer: (schema) => ({
              ...schema,
              response: { '2xx': resultsResponseSchema(collection) },
            }),
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
          server.get(path, this.createEndpoint({
            collection,
            type: 'VIEW',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_VIEW`],
            schemaTransformer: (schema) => ({
              ...schema,
              response: { '2xx': resultResponseSchema(collection) },
            }),
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
          server.post(path, this.createEndpoint({
            collection,
            type: 'SEARCH',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_SEARCH`],
            schemaTransformer: (schema) => {
              const bodySchema = schema.body as AjvValidationSchema;
              return {
                ...schema,
                body: {
                  ...bodySchema,
                  properties: {
                    ...bodySchema.properties,
                    filters: {
                      ...(bodySchema.properties as { filters: AjvValidationSchema; }).filters,
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
          server.delete(path, this.createEndpoint({
            collection,
            type: 'DELETE',
            authenticate: true,
            additionalPermissions: [`${this.toSnakeCase(collection as string)}_DELETE`],
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

    server.addHook('preSerialization', async (_request, _response, payload): Promise<unknown> => (
      this.formatOutput(payload)
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
      schema: schemas as unknown as Record<string, Schema>,
    }));

    // Logs requests timeouts.
    server.addHook('onTimeout', (request, _response, done) => {
      this.logger.error(new Error(`Request "${request.method} ${request.url}" timed out.`), {
        statusCode: 504,
        url: request.url,
        method: request.method,
        headers: Object.keys(request.headers),
      });
      done();
    });

    // Catch-all for unsupported content types. Prevents fastify from throwing HTTP 500 when dealing
    // with unknown payloads. See https://www.fastify.io/docs/latest/ContentTypeParser/.
    server.addContentTypeParser('*', (_request, payload, next) => {
      if (/^multipart\/form-data/.test(payload.headers['content-type'] as string)) {
        next(null, payload);
      } else {
        let data = '';
        payload.on('data', (chunk) => { data += chunk; });
        payload.on('end', () => { next(null, data); });
      }
    });
  }
}
