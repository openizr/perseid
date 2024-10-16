/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  isPlainObject,
  type IdSchema,
  type DateSchema,
  type ArraySchema,
  type FieldSchema,
  type NumberSchema,
  type ObjectSchema,
  type StringSchema,
  type BinarySchema,
  type BooleanSchema,
  type DefaultDataModel,
} from '@perseid/core';
import os from 'os';
import { join } from 'path';
import jwt from 'jsonwebtoken';
import ajvErrors from 'ajv-errors';
import multiparty from 'multiparty';
import { createWriteStream } from 'fs';
import { type IncomingMessage } from 'http';
import Logger from 'scripts/core/services/Logger';
import Ajv, { type KeywordDefinition } from 'ajv';
import NotFound from 'scripts/core/errors/NotFound';
import Conflict from 'scripts/core/errors/Conflict';
import EngineError from 'scripts/core/errors/Engine';
import Forbidden from 'scripts/core/errors/Forbidden';
import BadRequest from 'scripts/core/errors/BadRequest';
import type BaseModel from 'scripts/core/services/Model';
import DatabaseError from 'scripts/core/errors/Database';
import Unauthorized from 'scripts/core/errors/Unauthorized';
import NotAcceptable from 'scripts/core/errors/NotAcceptable';
import type UsersEngine from 'scripts/core/services/UsersEngine';
import UnprocessableEntity from 'scripts/core/errors/UnprocessableEntity';
import RequestEntityTooLarge from 'scripts/core/errors/RequestEntityTooLarge';

interface Validate { errors: { keyword: string; }[]; }

const textEncoder = new TextEncoder();
const parseValueToInt = (value: string): number => parseInt(value, 10);

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
export type FormDataFields = Record<string, string | UploadedFile[]>;

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

/** Built-in endpoint type. */
export type EndpointType = 'search' | 'view' | 'list' | 'create' | 'update' | 'delete';

/** Build-in endpoint configuration. */
export interface BuiltInEndpoint {
  /** API route for this endpoint. */
  path: string;

  /** Maximum allowed level of resources depth for this endpoint. */
  maximumDepth?: number;
}

/**
 * Custom endpoint configuration.
 */
export interface CustomEndpoint<DataModel extends DefaultDataModel> {
  /** Whether to authenticate user for that endpoint. */
  authenticate?: boolean;

  /**
   * Whether to ignore access token expiration. Useful for endpoints like refresh token.
   * Defaults to `false`.
   */
  ignoreExpiration?: boolean;

  /**
   * Request body model schema, for data validation.
   */
  body?: {
    /** Whether to allow partial payloads, or require all fields. */
    allowPartial?: boolean;

    /** Body fields schemas. */
    fields: Record<string, FieldSchema<DataModel>>;
  };

  /**
   * Request query model schema, for data validation.
   */
  query?: {
    /** Whether to allow partial payloads, or require all fields. */
    allowPartial?: boolean;

    /** Query fields schemas. */
    fields: Record<string, FieldSchema<DataModel>>;
  };

  /**
   * Request headers model schema, for data validation.
   */
  headers?: {
    /** Whether to allow partial payloads, or require all fields. */
    allowPartial?: boolean;

    /** Headers fields schemas. */
    fields: Record<string, FieldSchema<DataModel>>;
  };

  /**
   * Request params model schema, for data validation.
   */
  params?: {
    /** Whether to allow partial payloads, or require all fields. */
    allowPartial?: boolean;

    /** Params fields schemas. */
    fields: Record<string, FieldSchema<DataModel>>;
  };
}

/** Built-in endpoints to register for a specific resource type. */
export type ResourceBuiltInEndpoints = Partial<Record<EndpointType, BuiltInEndpoint>>;

/** List of all available built-in endpoints. */
export interface BuiltInEndpoints<DataModel> {
  auth: {
    signUp?: BuiltInEndpoint;
    signIn?: BuiltInEndpoint;
    viewMe?: BuiltInEndpoint;
    signOut?: BuiltInEndpoint;
    verifyEmail?: BuiltInEndpoint;
    refreshToken?: BuiltInEndpoint;
    resetPassword?: BuiltInEndpoint;
    requestPasswordReset?: BuiltInEndpoint;
    requestEmailVerification?: BuiltInEndpoint;
  };
  resources: Partial<Record<keyof DataModel, ResourceBuiltInEndpoints>>;
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
  additionalProperties?: boolean;
  enum?: (string | null | number)[];
  items?: AjvValidationSchema;
  properties?: Record<string, AjvValidationSchema>;
  errorMessage?: Record<string, string | undefined>;
  patternProperties?: Record<string, AjvValidationSchema>;
  default?: number | string | null | Date | Id | boolean;
}

/**
 * Controller settings.
 */
export interface ControllerSettings<DataModel> {
  /** Release version. Will be sent back along with responses through the "X-Api-Version" header. */
  version: string;

  /** List of built-in endpoints to register. */
  endpoints: BuiltInEndpoints<DataModel>;

  /** Whether to automatically handle CORS (usually in development mode). */
  handleCORS: boolean;
}

/**
 * Abstract controller, to use as a blueprint for framework-specific implementations.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/Controller.ts
 */
export default class Controller<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  Engine extends UsersEngine<DataModel> = UsersEngine<DataModel>,
> {
  /** HTTP 404 error code. */
  protected readonly NOT_FOUND_CODE = 'NOT_FOUND';

  /** `fields` built-in query param schema. */
  protected readonly FIELDS_QUERY_PARAM_SCHEMA: StringSchema = {
    type: 'string',
    pattern: /^([^ ]+)(,([^ ]+))*$/,
    errorMessages: {
      type: 'must be a coma-separated list of fields paths',
      pattern: 'must be a coma-separated list of fields paths',
    },
  };

  /** `limit` built-in query param schema. */
  protected readonly LIMIT_QUERY_PARAM_SCHEMA: NumberSchema = {
    type: 'integer',
    minimum: 0,
    maximum: 100,
    errorMessages: {
      type: 'must be a valid length',
      minimum: 'must be valid length',
      maximum: 'cannot be greater than 100',
    },
  };

  /** `offset` built-in query param schema. */
  protected readonly OFFSET_QUERY_PARAM_SCHEMA: NumberSchema = {
    type: 'integer',
    minimum: 0,
    errorMessages: {
      type: 'must be a valid offset',
      minimum: 'must be valid offset',
    },
  };

  /** `sortBy` built-in query param schema. */
  protected readonly SORT_BY_QUERY_PARAM_SCHEMA: StringSchema = {
    type: 'string',
    pattern: /^([^ ]+)(,([^ ]+))*$/,
    errorMessages: {
      type: 'must be a coma-separated list of fields paths',
      pattern: 'must be a coma-separated list of fields paths',
    },
  };

  /** `sortOrder` built-in query param schema. */
  protected readonly SORT_ORDER_QUERY_PARAM_SCHEMA: StringSchema = {
    type: 'string',
    pattern: /^(-1|1)(,(-1|1))*$/,
    errorMessages: {
      type: 'must be a coma-separated list of sorting orders',
    },
  };

  /** List of special Ajv keywords, used to format special types on the fly. */
  protected readonly AJV_KEYWORDS: KeywordDefinition[] = [
    {
      keyword: 'isBinary',
      modifying: true,
      validate: function validate(_, value, schema, context): boolean {
        (validate as unknown as Validate).errors = [];
        if ((schema as { type?: string[]; }).type?.[1] === 'null' && value === null) {
          return true;
        }
        if (typeof value !== 'string' || !value.startsWith('data:')) {
          (validate as unknown as Validate).errors.push({ keyword: 'type' });
          return false;
        }
        if (context !== undefined) {
          const { parentData, parentDataProperty } = context;
          parentData[parentDataProperty] = textEncoder.encode(value).buffer;
        }
        return true;
      },
    } as KeywordDefinition,
    {
      keyword: 'isDate',
      modifying: true,
      errors: true,
      validate: function validate(_, value: string | null, schema, context) {
        (validate as unknown as Validate).errors = [];
        const { enum: enums } = schema as { enum?: (string | null)[]; };
        if ((schema as { type?: string[]; }).type?.[1] === 'null' && value === null) {
          return true;
        }
        if (!/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/.test(String(value))) {
          (validate as unknown as Validate).errors.push({ keyword: 'pattern' });
          return false;
        }
        if (enums !== undefined && !enums.includes(value)) {
          (validate as unknown as Validate).errors.push({ keyword: 'enum' });
          return false;
        }
        if (context !== undefined) {
          const { parentData, parentDataProperty } = context;
          parentData[parentDataProperty] = new Date(value as unknown as string);
        }
        return true;
      },
    } as KeywordDefinition,
    {
      keyword: 'isId',
      modifying: true,
      errors: true,
      validate: function validate(_, value: string | null, schema, context) {
        (validate as unknown as Validate).errors = [];
        const { enum: enums } = schema as { enum?: (string | null)[]; };
        if ((schema as { type?: string[]; }).type?.[1] === 'null' && value === null) {
          return true;
        }
        if (!/^[0-9a-fA-F]{24}$/.test(String(value))) {
          (validate as unknown as Validate).errors.push({ keyword: 'pattern' });
          return false;
        }
        if (enums !== undefined && !enums.includes(value)) {
          (validate as unknown as Validate).errors.push({ keyword: 'enum' });
          return false;
        }
        if (context !== undefined) {
          const { parentData, parentDataProperty } = context;
          parentData[parentDataProperty] = new Id(value as unknown as string);
        }
        return true;
      },
    } as KeywordDefinition,
  ];

  /** List of Ajv formatters, used to format a perseid data model into its Ajv equivalent. */
  protected readonly AJV_FORMATTERS: Record<string, (
    model: FieldSchema<DataModel>,
    requireAllFields: boolean,
  ) => AjvValidationSchema> = {
      null() {
        return { type: 'null', errorMessage: {} };
      },
      id(schema) {
        const {
          isRequired,
          errorMessages,
          enum: enumerations,
        } = schema as IdSchema<DataModel>;
        const fieldSchema: AjvValidationSchema = {
          isId: true,
          pattern: /^[0-9a-fA-F]{24}$/.source,
          type: isRequired ? 'string' : ['string', 'null'],
        };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a valid id${isRequired ? '' : ', or null'}`;
        fieldSchema.errorMessage.pattern ??= 'must be a valid id';
        if (enumerations !== undefined) {
          fieldSchema.enum = enumerations.map((id) => id.toString());
          fieldSchema.enum.push(...(isRequired ? [] : [null]));
          fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
            `"${value.toString()}"`
          )).join(', ')}`;
        }
        return fieldSchema;
      },
      binary(schema) {
        const { errorMessages, isRequired } = schema as BinarySchema;
        const fieldSchema: AjvValidationSchema = {
          minLength: 10,
          isBinary: true,
          type: isRequired ? 'string' : ['string', 'null'],
        };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a base64-encoded binary${isRequired ? '' : ', or null'}`;
        return fieldSchema;
      },
      boolean(schema) {
        const { errorMessages, isRequired } = schema as BooleanSchema;
        const fieldSchema: AjvValidationSchema = { type: isRequired ? 'boolean' : ['boolean', 'null'] };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a boolean${schema.isRequired ? '' : ', or null'}`;
        return fieldSchema;
      },
      date(schema) {
        const { enum: enumerations, errorMessages, isRequired } = schema as DateSchema;
        const fieldSchema: AjvValidationSchema = {
          isDate: true,
          type: isRequired ? 'string' : ['string', 'null'],
          pattern: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/.source,
        };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a valid date${isRequired ? '' : ', or null'}`;
        fieldSchema.errorMessage.pattern ??= 'must be a valid date';
        if (enumerations !== undefined) {
          fieldSchema.enum = enumerations.map((date) => date.toISOString());
          fieldSchema.enum.push(...(isRequired ? [] : [null]));
          fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
            `"${value.toISOString()}"`
          )).join(', ')}`;
        }
        return fieldSchema;
      },
      float(schema) {
        const {
          minimum,
          maximum,
          multipleOf,
          isRequired,
          errorMessages,
          exclusiveMinimum,
          exclusiveMaximum,
          enum: enumerations,
        } = schema as NumberSchema;
        const fieldSchema: AjvValidationSchema = { type: isRequired ? 'number' : ['number', 'null'] };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a float${isRequired ? '' : ', or null'}`;
        if (minimum !== undefined) {
          fieldSchema.minimum = minimum;
          fieldSchema.errorMessage.minimum ??= `must be greater than or equal to ${String(minimum)}`;
        }
        if (maximum !== undefined) {
          fieldSchema.maximum = maximum;
          fieldSchema.errorMessage.maximum ??= `must be smaller than or equal to ${String(maximum)}`;
        }
        if (exclusiveMinimum !== undefined) {
          fieldSchema.exclusiveMinimum = exclusiveMinimum;
          fieldSchema.errorMessage.exclusiveMinimum ??= `must be greater than ${String(exclusiveMinimum)}`;
        }
        if (exclusiveMaximum !== undefined) {
          fieldSchema.exclusiveMaximum = exclusiveMaximum;
          fieldSchema.errorMessage.exclusiveMaximum ??= `must be smaller than ${String(exclusiveMaximum)}`;
        }
        if (multipleOf !== undefined) {
          fieldSchema.multipleOf = multipleOf;
          fieldSchema.errorMessage.multipleOf ??= `must be a multiple of ${String(multipleOf)}`;
        }
        if (enumerations !== undefined) {
          fieldSchema.enum = [...enumerations];
          fieldSchema.enum.push(...(isRequired ? [] : [null]));
          fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
            String(value)
          )).join(', ')}`;
        }
        return fieldSchema;
      },
      integer(schema) {
        const {
          minimum,
          maximum,
          isRequired,
          multipleOf,
          errorMessages,
          exclusiveMinimum,
          exclusiveMaximum,
          enum: enumerations,
        } = schema as NumberSchema;
        const fieldSchema: AjvValidationSchema = { type: isRequired ? 'integer' : ['integer', 'null'] };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be an integer${isRequired ? '' : ', or null'}`;
        if (minimum !== undefined) {
          fieldSchema.minimum = minimum;
          fieldSchema.errorMessage.minimum ??= `must be greater than or equal to ${String(minimum)}`;
        }
        if (maximum !== undefined) {
          fieldSchema.maximum = maximum;
          fieldSchema.errorMessage.maximum ??= `must be smaller than or equal to ${String(maximum)}`;
        }
        if (exclusiveMinimum !== undefined) {
          fieldSchema.exclusiveMinimum = exclusiveMinimum;
          fieldSchema.errorMessage.exclusiveMinimum ??= `must be greater than ${String(exclusiveMinimum)}`;
        }
        if (exclusiveMaximum !== undefined) {
          fieldSchema.exclusiveMaximum = exclusiveMaximum;
          fieldSchema.errorMessage.exclusiveMaximum ??= `must be smaller than ${String(exclusiveMaximum)}`;
        }
        if (multipleOf !== undefined) {
          fieldSchema.multipleOf = multipleOf;
          fieldSchema.errorMessage.multipleOf ??= `must be a multiple of ${String(multipleOf)}`;
        }
        if (enumerations !== undefined) {
          fieldSchema.enum = [...enumerations];
          fieldSchema.enum.push(...(isRequired ? [] : [null]));
          fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
            String(value)
          )).join(', ')}`;
        }
        return fieldSchema;
      },
      string(schema) {
        const {
          pattern,
          maxLength,
          minLength,
          isRequired,
          errorMessages,
          enum: enumerations,
        } = schema as StringSchema;
        const realMinLength = isRequired ? Math.max(minLength ?? 1, 1) : minLength;
        const fieldSchema: AjvValidationSchema = { type: isRequired ? 'string' : ['string', 'null'] };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a string${isRequired ? '' : ', or null'}`;
        if (maxLength !== undefined) {
          fieldSchema.maxLength = maxLength;
          fieldSchema.errorMessage.maxLength ??= `must be no longer than ${String(maxLength)} characters`;
        }
        if (realMinLength !== undefined) {
          fieldSchema.minLength = realMinLength;
          fieldSchema.errorMessage.minLength ??= `must be no shorter than ${String(realMinLength)} characters`;
        }
        if (pattern !== undefined) {
          fieldSchema.pattern = pattern.source;
          fieldSchema.errorMessage.pattern ??= `must match "${pattern.source}" pattern`;
        }
        if (enumerations !== undefined) {
          fieldSchema.enum = [...enumerations];
          fieldSchema.enum.push(...(isRequired ? [] : [null]));
          fieldSchema.errorMessage.enum ??= `must be one of: ${enumerations.map((value) => (
            `"${value}"`
          )).join(', ')}`;
        }
        return fieldSchema;
      },
      object: (schema, requireAllFields) => {
        const {
          fields,
          isRequired,
          errorMessages,
        } = schema as ObjectSchema<DataModel>;
        const requiredFields: string[] = [];
        const requireAllSubfields = requireAllFields || !isRequired;
        const exposedFields = Object.keys(fields).filter((fieldName) => {
          const keepField = !fieldName.startsWith('_');
          if (keepField && requireAllSubfields) {
            requiredFields.push(fieldName);
          }
          return keepField;
        });
        const fieldSchema: AjvValidationSchema = {
          additionalProperties: false,
          type: isRequired ? 'object' : ['object', 'null'],
          properties: exposedFields.reduce((properties, key) => ({
            ...properties,
            [key]: this.AJV_FORMATTERS[fields[key].type](fields[key], requireAllSubfields),
          }), {}),
        };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a valid object${isRequired ? '' : ', or null'}`;
        if (requiredFields.length > 0) {
          fieldSchema.required = requiredFields;
        }
        return fieldSchema;
      },
      array: (schema) => {
        const {
          fields,
          maxItems,
          minItems,
          isRequired,
          uniqueItems,
          errorMessages,
        } = schema as ArraySchema<DataModel>;
        const fieldSchema: AjvValidationSchema = {
          minItems,
          maxItems,
          type: isRequired ? 'array' : ['array', 'null'],
          items: this.AJV_FORMATTERS[fields.type](fields, true),
        };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a valid array${isRequired ? '' : ', or null'}`;
        if (minItems !== undefined) {
          fieldSchema.minItems = minItems;
          const entries = (minItems === 1) ? 'entry' : 'entries';
          fieldSchema.errorMessage.minItems ??= `must contain at least ${String(minItems)} ${entries}`;
        }
        if (maxItems !== undefined) {
          fieldSchema.maxItems = maxItems;
          const entries = (maxItems === 1) ? 'entry' : 'entries';
          fieldSchema.errorMessage.maxItems ??= `must not contain more than ${String(maxItems)} ${entries}`;
        }
        if (uniqueItems !== undefined) {
          fieldSchema.uniqueItems = uniqueItems;
          fieldSchema.errorMessage.uniqueItems ??= 'must contain only unique entries';
        }
        return fieldSchema;
      },
    };

  /** Data model to use. */
  protected model: Model;

  /** Logging system to use. */
  protected logger: Logger;

  /** Engine to use. */
  protected engine: Engine;

  /** Release version. Will be sent back along with responses through the "X-Api-Version" header. */
  protected version: string;

  /** List of built-in endpoints to register. */
  protected endpoints: BuiltInEndpoints<DataModel>;

  /** Parses `value` into an integer. */
  protected parseInt = parseValueToInt;

  /** Used to format ArrayBuffers into strings. */
  protected textDecoder = new TextDecoder('utf-8');

  /** Increment used for `multipart/form-data` payloads parsing. */
  protected increment = 0;

  /** Ajv instance for payloads validation. */
  protected ajv: Ajv;

  /** Whether to automatically handle CORS (usually in development mode). */
  protected handleCORS: boolean;

  /**
   * Handles HTTP 404 errors.
   */
  protected handleNotFound(): void {
    throw new NotFound(this.NOT_FOUND_CODE, 'Not Found.');
  }

  /**
   * Formats `error`.
   *
   * @param error Error to format.
   *
   * @param payloadType Type of payload that failed validation.
   *
   * @returns Formatted error.
   */
  protected formatError(error: unknown, payloadType: string): BadRequest {
    this.logger.silent('');

    let { message } = error as { message?: string; };
    const { keyword, instancePath, params } = error as {
      keyword?: string;
      instancePath?: string;
      params?: Record<string, unknown>;
    };

    const fullPath = `${payloadType}${(String(instancePath)).replace(/\//g, '.')}`;
    message = `"${fullPath}" ${message as unknown as string}.`;
    if (keyword === 'required') {
      message = `"${fullPath}.${params?.missingProperty as string}" is required.`;
    } else if (keyword === 'additionalProperties') {
      message = `Unknown field "${fullPath}.${params?.additionalProperty as string}".`;
    }

    return new BadRequest('INVALID_PAYLOAD', message);
  }

  /**
   * Formats `output` to match fastify data types specifications.
   *
   * @param output Output to format.
   *
   * @returns Formatted output.
   */
  protected formatOutput(output: unknown): unknown {
    if (Array.isArray(output)) {
      return output.map(this.formatOutput.bind(this));
    }
    if (output instanceof Id) {
      return output.toString();
    }
    if (output instanceof Date) {
      return output.toISOString();
    }
    if (output instanceof ArrayBuffer) {
      return this.textDecoder.decode(output);
    }
    if (isPlainObject(output)) {
      return Object.keys(output as Record<string, unknown>)
        .reduce((formattedResource, key) => ({
          ...formattedResource,
          [key]: this.formatOutput((output as Record<string, unknown>)[key]),
        }), {});
    }
    return output;
  }

  /**
   * Parses `query`. Built-in query params (`fields`, `sortBy`, `sortOrder`, `limit`, `offset`) will
   * be correctly formatted to match engine / database client specifications. Other (custom) params
   * will be left as is.
   *
   * @param query Request query params.
   *
   * @returns Parsed query params.
   *
   * @throws If `query.sortBy` and `query.sortOrders` sizes do not match.
   */
  protected parseQuery(query: Record<string, string | null>): {
    fields?: string[];
    sortBy?: Record<string, 1 | -1>
    [key: string]: unknown;
  } {
    const parsedQuery: Record<string, unknown> = {};
    Object.keys(query).forEach((key) => {
      const queryValue = query[key];
      if (key === 'fields' && queryValue !== null) {
        parsedQuery[key] = new Set(queryValue.split(','));
      } else if (key === 'sortBy' && queryValue !== null) {
        const sortBy = queryValue.split(',');
        const sortOrder = query.sortOrder?.split(',').map(this.parseInt) ?? [];

        if (sortBy.length !== sortOrder.length) {
          const message = '"query.sortBy" and "query.sortOrder" must contain the same number of items.';
          throw new BadRequest('INVALID_PAYLOAD', message);
        }

        parsedQuery[key] = sortBy.reduce((finalSortBy, path, index) => ({
          ...finalSortBy,
          [path]: sortOrder[index],
        }), {});
      } else if (key !== 'sortOrder') {
        parsedQuery[key] = queryValue;
      }
    });
    return parsedQuery;
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
    payload: IncomingMessage,
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
        const headers = part.headers as Record<string, string>;
        if (!allowedMimeTypes.includes(headers['content-type'])) {
          reject(new BadRequest('INVALID_FILE_TYPE', `Invalid file type "${headers['content-type']}" for file "${part.filename}".`));
        } else {
          const fileIndex = totalFiles;
          totalFiles += 1;
          const fileId = `${Date.now().toString(16)}${String(this.increment)}`;
          this.increment += 1;
          const filePath = join(os.tmpdir(), fileId);
          const fileStream = createWriteStream(filePath);
          const closeStream = (error?: Error | null): void => {
            fileStream.end();
            if (error !== null && error !== undefined) {
              reject(error);
            }
          };
          fileStream.on('error', closeStream);
          fileStream.on('close', () => {
            numberOfClosedParts += 1;
            if (parserClosed && numberOfClosedParts >= numberOfParts) {
              resolve(fields);
            }
          });
          const uploadedFiles = (fields[part.name] as unknown ?? []) as UploadedFile[];
          uploadedFiles.push({
            size: 0,
            id: fileId,
            path: filePath,
            name: part.filename,
            type: headers['content-type'],
          });
          part.on('error', closeStream);
          part.on('close', closeStream);
          part.on('data', (stream: Buffer) => {
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
   * @throws If user specified in the access token does not exist, or if device does not exist
   * for this user.
   */
  protected async auth(
    accessToken: string,
    deviceId: string,
    ignoreExpiration = false,
  ): Promise<DataModel['users']> {
    let user: DataModel['users'];
    const context = { deviceId } as CommandContext<DataModel>;
    const userId = await this.engine.verifyToken(accessToken, ignoreExpiration, context);
    // As `engine.generateContext` throws an error if user does not exist (e.g, a user that has just
    //  been deleted, but tries to sign-in), we need to wrap the statement inside a try...catch.
    try {
      user = (await this.engine.generateContext(userId)).user;
      if (!user._devices.some((device) => device._id === deviceId)) {
        throw new EngineError('NO_RESOURCE');
      }
    } catch (error) {
      if (error instanceof EngineError && error.code === 'NO_RESOURCE') {
        throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
      }
      throw error;
    }

    return user;
  }

  /**
   * Catches and handles most common API errors thrown by `callback`.
   *
   * @param callback Callback to wrap.
   *
   * @returns Wrapped callback.
   */
  protected async catchErrors<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      this.logger.silent('');
      if (error instanceof jwt.TokenExpiredError) {
        throw new Unauthorized('TOKEN_EXPIRED', 'Access token has expired.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Unauthorized('INVALID_TOKEN', 'Invalid access token.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_DEVICE_ID') {
        throw new Unauthorized('INVALID_DEVICE_ID', 'Invalid device id.');
      }
      if (error instanceof EngineError && error.code === 'PASSWORDS_MISMATCH') {
        throw new BadRequest('PASSWORDS_MISMATCH', 'Passwords mismatch.');
      }
      if (error instanceof EngineError && error.code === 'NO_USER') {
        throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_CREDENTIALS') {
        throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
      }
      if (error instanceof EngineError && error.code === 'EMAIL_ALREADY_VERIFIED') {
        throw new NotAcceptable('EMAIL_ALREADY_VERIFIED', 'User email is already verified.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_VERIFICATION_TOKEN') {
        throw new Unauthorized('INVALID_VERIFICATION_TOKEN', 'Invalid or expired verification token.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_RESET_TOKEN') {
        throw new Unauthorized('INVALID_RESET_TOKEN', 'Invalid or expired reset token.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_REFRESH_TOKEN') {
        throw new Unauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
      }
      if (error instanceof EngineError && error.code === 'NO_RESOURCE') {
        const message = `Resource with id "${error.details.id as string}" does not exist or does not match required criteria.`;
        throw new NotFound('NO_RESOURCE', message);
      }
      if (error instanceof EngineError && error.code === 'USER_NOT_VERIFIED') {
        const message = 'Please verify your email address before performing this operation.';
        throw new Forbidden('USER_NOT_VERIFIED', message);
      }
      if (error instanceof EngineError && error.code === 'FORBIDDEN') {
        const message = (error.details.permission === null)
          ? 'You are not allowed to perform this operation.'
          : `You are missing "${error.details.permission as string}" permission to perform this operation.`;
        throw new Forbidden('FORBIDDEN', message);
      }
      if (error instanceof EngineError && error.code === 'UNKNOWN_FIELD') {
        throw new BadRequest('UNKNOWN_FIELD', `Requested field "${error.details.path as string}" does not exist.`);
      }
      if (error instanceof EngineError && error.code === 'MAXIMUM_DEPTH_EXCEEDED') {
        const message = `Maximum level of depth exceeded for field "${error.details.path as string}".`;
        throw new BadRequest('MAXIMUM_DEPTH_EXCEEDED', message);
      }
      if (error instanceof DatabaseError && error.code === 'DUPLICATE_RESOURCE') {
        const message = `Resource with field value "${error.details.value as string}" already exists.`;
        throw new Conflict('DUPLICATE_RESOURCE', message);
      }
      if (error instanceof DatabaseError && error.code === 'RESOURCE_REFERENCED') {
        const message = `Resource is still referenced in "${error.details.path as string}".`;
        throw new BadRequest('RESOURCE_REFERENCED', message);
      }
      if (error instanceof DatabaseError && error.code === 'NO_RESOURCE') {
        const message = `Resource with id "${error.details.id as string}" does not exist or does not match required criteria.`;
        throw new BadRequest('NO_RESOURCE', message);
      }
      if (error instanceof DatabaseError && error.code === 'UNSORTABLE_FIELD') {
        const message = `Field "${error.details.path as string}" is not sortable.`;
        throw new BadRequest('UNSORTABLE_FIELD', message);
      }
      if (error instanceof DatabaseError && error.code === 'UNINDEXED_FIELD') {
        const message = `Field "${error.details.path as string}" is not indexed.`;
        throw new BadRequest('UNINDEXED_FIELD', message);
      }

      throw error;
    }
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
    this.model = model;
    this.logger = logger;
    this.engine = engine;
    this.version = settings.version;
    this.endpoints = settings.endpoints;
    this.handleCORS = settings.handleCORS;
    this.ajv = new Ajv({
      allErrors: true,
      useDefaults: true,
      coerceTypes: true,
      removeAdditional: false,
    });
    ajvErrors(this.ajv);

    // Adding Ajv keywords to handle special types...
    this.AJV_KEYWORDS.forEach((keyword) => this.ajv.addKeyword(keyword));
  }
}
