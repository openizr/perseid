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
  type UserDataModel,
  type BooleanSchema,
} from '@perseid/core';
import os from 'os';
import { join } from 'path';
import ajvErrors from 'ajv-errors';
import multiparty from 'multiparty';
import { createWriteStream } from 'fs';
import { type IncomingMessage } from 'http';
import Ajv, { type KeywordDefinition } from 'ajv';
import type Model from 'scripts/core/services/Model';
import Telemetry from 'scripts/core/services/Telemetry';
import type PerseidError from 'scripts/core/errors/Perseid';
import ControllerError from 'scripts/core/errors/Controller';
import type AuthEngine from 'scripts/core/services/AuthEngine';

interface Validate { errors: { keyword: string; }[]; }

const textEncoder = new TextEncoder();
const parseValueToInt = (value: string): number => parseInt(value, 10);

/**
 * Uploaded file.
 */
export interface UploadedFile {
  /**
   * File unique identifier.
   */
  id: string;

  /**
   * File size, in bytes.
   */
  size: number;

  /**
   * File MIME type.
   */
  type: string;

  /**
   * File path.
   */
  path: string;

  /**
   * File name.
   */
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
  /**
   * Maximum number of allowed fields. Defaults to 1000.
   */
  maxFields?: number;

  /**
   * Maximum allowed size per field, in bytes. Defaults to 2MB.
   */
  maxFieldSize?: number;

  /**
   * Maximum total size, in bytes. Defaults to 10MB.
   */
  maxTotalSize?: number;

  /**
   * List of allowed MIME types for files.
   */
  allowedMimeTypes?: string[];
}

/**
 * Built-in endpoint type.
 */
export type EndpointType = (
  'search'
  | 'view'
  | 'list'
  | 'create'
  | 'update'
  | 'delete'
);

/**
 * Build-in endpoint configuration.
 */
export interface BuiltInEndpoint {
  /**
   * API path on which to expose this endpoint.
   */
  path: string;

  /**
   * Maximum allowed level of resources depth for this endpoint.
   */
  maximumDepth?: number;
}

/**
 * Custom endpoint configuration.
 */
export interface CustomEndpoint {
  /**
   * Request body model schema, for data validation.
   */
  body?: {
    /**
     * Whether to allow partial payloads, or require all fields. Defaults to `true`.
     * - When partial payloads are allowed, non-required fields won't take any default value
     * - In the other case, non-required fields will take a default value of `null`
     *
     * For instance, on resource creation, if a non-required field is not provided in the request
     * body, it will be automatically set to `null`. On resource update however, that same field
     * will simply not exist in the payload.
     */
    requireAllFields?: boolean;

    /**
     * Body fields schemas.
     */
    fields: Record<string, FieldSchema<Record<string, unknown>>>;
  };

  /**
   * Request query model schema, for data validation.
   */
  query?: {
    /**
     * Whether to allow partial payloads, or require all fields. Defaults to `false`.
     * - When partial payloads are allowed, non-required fields won't take any default value
     * - In the other case, non-required fields will take a default value of `null`
     *
     * For instance, on resource creation, if a non-required field is not provided in the request
     * body, it will be automatically set to `null`. On resource update however, that same field
     * will simply not exist in the payload.
     */
    requireAllFields?: boolean;

    /**
     * Query fields schemas.
     */
    fields: Record<string, FieldSchema<Record<string, unknown>>>;
  };

  /**
   * Request headers model schema, for data validation.
   */
  headers?: {
    /**
     * Whether to allow partial payloads, or require all fields. Defaults to `true`.
     * - When partial payloads are allowed, non-required fields won't take any default value
     * - In the other case, non-required fields will take a default value of `null`
     *
     * For instance, on resource creation, if a non-required field is not provided in the request
     * body, it will be automatically set to `null`. On resource update however, that same field
     * will simply not exist in the payload.
     */
    requireAllFields?: boolean;

    /**
     * Headers fields schemas.
     */
    fields: Record<string, FieldSchema<Record<string, unknown>>>;
  };

  /**
   * Request params model schema, for data validation.
   */
  params?: {
    /**
     * Whether to allow partial payloads, or require all fields. Defaults to `true`.
     * - When partial payloads are allowed, non-required fields won't take any default value
     * - In the other case, non-required fields will take a default value of `null`
     *
     * For instance, on resource creation, if a non-required field is not provided in the request
     * body, it will be automatically set to `null`. On resource update however, that same field
     * will simply not exist in the payload.
     */
    requireAllFields?: boolean;

    /**
     * Params fields schemas.
     */
    fields: Record<string, FieldSchema<Record<string, unknown>>>;
  };
}

/**
 * Built-in endpoints to register for a specific resource type.
 */
export type ResourceBuiltInEndpoints = Partial<Record<EndpointType, BuiltInEndpoint>>;

/**
 * List of all available built-in endpoints.
 */
export interface BuiltInEndpoints<DataModel> {
  /**
   * Auth-related endpoints.
   */
  auth: {
    /**
     * Sign-up endpoint.
     */
    signUp?: BuiltInEndpoint;

    /**
     * Sign-in endpoint.
     */
    signIn?: BuiltInEndpoint;

    /**
     * User info endpoint.
     */
    viewMe?: BuiltInEndpoint;

    /**
     * Sign-out endpoint.
     */
    signOut?: BuiltInEndpoint;

    /**
     * Email verification endpoint.
     */
    verifyEmail?: BuiltInEndpoint;

    /**
     * Access token refresh endpoint.
     */
    refreshToken?: BuiltInEndpoint;

    /**
     * Password reset endpoint.
     */
    resetPassword?: BuiltInEndpoint;

    /**
     * Password reset request endpoint.
     */
    requestPasswordReset?: BuiltInEndpoint;

    /**
     * Email verification request endpoint.
     */
    requestEmailVerification?: BuiltInEndpoint;
  };

  /**
   * Resources-related endpoints.
   */
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
  /**
   * Release version. Will be sent back along with responses through the "X-Api-Version" header.
   */
  version: string;

  /**
   * List of built-in endpoints to register.
   */
  endpoints: BuiltInEndpoints<DataModel>;

  /**
   * Whether to automatically handle CORS (usually in development mode).
   */
  handleCORS: boolean;

  /**
   * Whether to instrument all endpoints with OpenTelemetry. If set to `false`, only endpoints
   * created using `createEndpoint` will be wrapped within a span, and global requests won't be
   * instrumented. If you want to manually instrument global requests, you can link Perseid endpoint
   * root span to the global request span by adding a `telemetry` property to the request object,
   * containing the parent span to which you want to link the endpoint root span.
   *
   * @example
   * ```ts
   * const request = new FastifyRequest({
   *   method: 'GET',
   *   url: '/api/v1/users',
   * });
   * request.telemetry = { span: parentSpan };
   */
  instrumentEndpoints: boolean;
}

/**
 * List of available HTTP status codes for responses.
 */
export const HTTP_STATUS_CODES = {
  GONE: 410,
  CONFLICT: 409,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_ACCEPTABLE: 406,
  TOO_MANY_REQUESTS: 429,
  UNPROCESSABLE_ENTITY: 422,
  REQUEST_ENTITY_TOO_LARGE: 413,
};

/**
 * Abstract controller, to use as a blueprint for framework-specific implementations.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/Controller.ts
 */
export default class Controller<
  /**
   * Data model type definition.
   */
  DataModelType extends UserDataModel = UserDataModel,

  /**
   * Telemetry system type definition.
   */
  TelemetryType extends Telemetry = Telemetry,

  /**
   * Model class type definition.
   */
  ModelType extends Model<DataModelType> = Model<DataModelType>,

  /**
   * Database client types definition.
   */
  EngineType extends AuthEngine<DataModelType> = AuthEngine<DataModelType>,
> {
  /**
   * Common headers to require for all requests. Defaults to 'User-Agent' and 'X-Device-Id' headers.
   */
  protected readonly COMMON_HEADERS: Record<string, FieldSchema<unknown>> = {
    'user-agent': {
      type: 'string',
      isRequired: true,
      description: 'User Agent',
      maxLength: 500,
      errorMessages: {
        type: 'must be a valid user agent',
      },
    },
    'x-device-id': {
      type: 'string',
      isRequired: true,
      maxLength: 255,
      description: 'Device ID',
      errorMessages: {
        type: 'must be a valid device id',
        pattern: 'must be a valid device id',
      },
    },
  };

  /**
   * List of known engine/database errors and their corresponding error message/code to send back.
   * For instance, if the engine throws a `NO_RESOURCE` error, the controller will generate a
   * clean 404 HTTP response containing additional details.
   */
  protected readonly KNOWN_ERRORS: Partial<Record<string, (error: PerseidError) => (
    [number, string, string]
  )>> = {
      FORBIDDEN: (error) => [
        HTTP_STATUS_CODES.FORBIDDEN,
        error.code,
        (error.details.permission === null)
          ? 'You are not allowed to perform this operation.'
          : `You are missing "${error.details.permission as string}" permission to perform this operation.`,
      ],
      NO_USER: (error) => [HTTP_STATUS_CODES.UNAUTHORIZED, error.code, 'User not found.'],
      INVALID_DEVICE_ID: (error) => [HTTP_STATUS_CODES.UNAUTHORIZED, error.code, 'Invalid device id.'],
      INVALID_TOKEN: (error) => [HTTP_STATUS_CODES.UNAUTHORIZED, error.code, 'Invalid access token.'],
      PASSWORDS_MISMATCH: (error) => [HTTP_STATUS_CODES.BAD_REQUEST, error.code, 'Passwords mismatch.'],
      INVALID_CREDENTIALS: (error) => [HTTP_STATUS_CODES.UNAUTHORIZED, error.code, 'Invalid credentials.'],
      TOKEN_EXPIRED: (error) => [HTTP_STATUS_CODES.UNAUTHORIZED, error.code, 'Access token has expired.'],
      EMAIL_ALREADY_VERIFIED: (error) => [HTTP_STATUS_CODES.BAD_REQUEST, error.code, 'Email already verified.'],
      INVALID_RESET_TOKEN: (error) => [HTTP_STATUS_CODES.UNAUTHORIZED, error.code, 'Invalid or expired reset token.'],
      INVALID_REFRESH_TOKEN: (error) => [HTTP_STATUS_CODES.UNAUTHORIZED, error.code, 'Invalid or expired refresh token.'],
      TOO_MANY_FIELDS: (error) => [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY, error.code, 'Maximum number of fields exceeded.'],
      FILES_TOO_LARGE: (error) => [HTTP_STATUS_CODES.REQUEST_ENTITY_TOO_LARGE, error.code, 'Maximum total files size exceeded.'],
      INVALID_VERIFICATION_TOKEN: (error) => [HTTP_STATUS_CODES.UNAUTHORIZED, error.code, 'Invalid or expired verification token.'],
      MISSING_CONTENT_TYPE_HEADER: (error) => [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY, error.code, 'Missing "Content-Type" header.'],
      FIELD_TOO_LARGE: (error) => [HTTP_STATUS_CODES.REQUEST_ENTITY_TOO_LARGE, error.code, 'Maximum non-file fields size exceeded.'],
      UNINDEXED_FIELD: (error) => [HTTP_STATUS_CODES.BAD_REQUEST, error.code, `Field "${String(error.details.path)}" is not indexed.`],
      UNSORTABLE_FIELD: (error) => [HTTP_STATUS_CODES.BAD_REQUEST, error.code, `Field "${String(error.details.path)}" is not sortable.`],
      UNKNOWN_QUERY_FIELD: (error) => [HTTP_STATUS_CODES.BAD_REQUEST, error.code, `Requested field "${String(error.details.path)}" does not exist.`],
      USER_NOT_VERIFIED: (error) => [HTTP_STATUS_CODES.FORBIDDEN, error.code, 'Please verify your email address before performing this operation.'],
      RESOURCE_REFERENCED: (error) => [HTTP_STATUS_CODES.BAD_REQUEST, error.code, `Resource is still referenced in "${String(error.details.path)}".`],
      DUPLICATE_RESOURCE: (error) => [HTTP_STATUS_CODES.CONFLICT, error.code, `Resource with field value "${String(error.details.value)}" already exists.`],
      INVALID_SORT_QUERY: (error) => [HTTP_STATUS_CODES.BAD_REQUEST, error.code, '"query.sortBy" and "query.sortOrder" must contain the same number of items.'],
      FILE_TOO_LARGE: (error) => [HTTP_STATUS_CODES.REQUEST_ENTITY_TOO_LARGE, error.code, `Maximum size exceeded for file "${String(error.details.filename)}".`],
      MAXIMUM_DEPTH_EXCEEDED: (error) => [HTTP_STATUS_CODES.BAD_REQUEST, error.code, `Maximum level of depth exceeded for field "${String(error.details.path)}".`],
      INVALID_FILE_TYPE: (error) => [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY, error.code, `Invalid file type "${String(error.details.contentType)}" for file "${String(error.details.filename)}".`],
      NO_RESOURCE: (error) => [HTTP_STATUS_CODES.NOT_FOUND, error.code, `Resource with id "${String(error.details.id)}" does not exist or does not match required criteria.`],
    };

  /**
   * List of special Ajv keywords, used to format special types on the fly.
   */
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
        if (
          (Id.FORMAT === 'SNOWFLAKE' && !/^[0-9a-fA-F]{24}$/.test(String(value)))
          || (Id.FORMAT === 'UUID' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(value)))
        ) {
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

  /**
   * List of Ajv formatters, used to format a perseid data model into its Ajv equivalent.
   */
  protected readonly AJV_FORMATTERS: Record<string, (
    model: FieldSchema<Record<string, unknown>>,
    requireAllFields: boolean,
    isRoot?: boolean,
  ) => AjvValidationSchema> = {
      null() {
        return { type: 'null', errorMessage: {} };
      },
      id(schema, requireAllFields) {
        const {
          isRequired,
          errorMessages,
          enum: enumerations,
        } = schema as IdSchema<DataModelType>;
        const fieldSchema: AjvValidationSchema = {
          isId: true,
          pattern: (Id.FORMAT === 'SNOWFLAKE')
            ? /^[0-9a-fA-F]{24}$/.source
            : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.source,
          type: isRequired ? 'string' : ['string', 'null'],
          default: !isRequired && requireAllFields ? null : undefined,
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
      binary(schema, requireAllFields) {
        const { errorMessages, isRequired } = schema as BinarySchema;
        const fieldSchema: AjvValidationSchema = {
          minLength: 10,
          isBinary: true,
          type: isRequired ? 'string' : ['string', 'null'],
          default: !isRequired && requireAllFields ? null : undefined,
        };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a base64-encoded binary${isRequired ? '' : ', or null'}`;
        return fieldSchema;
      },
      boolean(schema, requireAllFields) {
        const { errorMessages, isRequired } = schema as BooleanSchema;
        const fieldSchema: AjvValidationSchema = {
          type: isRequired ? 'boolean' : ['boolean', 'null'],
          default: !isRequired && requireAllFields ? null : undefined,
        };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a boolean${isRequired ? '' : ', or null'}`;
        return fieldSchema;
      },
      date(schema, requireAllFields) {
        const { enum: enumerations, errorMessages, isRequired } = schema as DateSchema;
        const fieldSchema: AjvValidationSchema = {
          isDate: true,
          type: isRequired ? 'string' : ['string', 'null'],
          pattern: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/.source,
          default: !isRequired && requireAllFields ? null : undefined,
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
      float(schema, requireAllFields) {
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
        const fieldSchema: AjvValidationSchema = {
          type: isRequired ? 'number' : ['number', 'null'],
          default: !isRequired && requireAllFields ? null : undefined,
        };
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
      integer(schema, requireAllFields) {
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
        const fieldSchema: AjvValidationSchema = {
          type: isRequired ? 'integer' : ['integer', 'null'],
          default: !isRequired && requireAllFields ? null : undefined,
        };
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
      string(schema, requireAllFields) {
        const {
          pattern,
          maxLength,
          minLength,
          isRequired,
          errorMessages,
          enum: enumerations,
        } = schema as StringSchema;
        const realMinLength = isRequired ? Math.max(minLength ?? 1, 1) : minLength;
        const fieldSchema: AjvValidationSchema = {
          type: isRequired ? 'string' : ['string', 'null'],
          default: !isRequired && requireAllFields ? null : undefined,
        };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a string${isRequired ? '' : ', or null'}`;
        fieldSchema.maxLength = maxLength;
        fieldSchema.errorMessage.maxLength ??= `must be no longer than ${String(maxLength)} characters`;
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
      object: (schema, requireAllFields, isRoot = true) => {
        const {
          fields,
          isRequired,
          errorMessages,
        } = schema as ObjectSchema<DataModelType>;
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
          default: !isRoot && !isRequired && requireAllFields ? null : undefined,
          properties: exposedFields.reduce((properties, key) => ({
            ...properties,
            [key]: this.AJV_FORMATTERS[fields[key].type](fields[key], requireAllSubfields, false),
          }), {}),
        };
        fieldSchema.errorMessage = errorMessages ?? {};
        fieldSchema.errorMessage.type ??= `must be a valid object${isRequired ? '' : ', or null'}`;
        if (requiredFields.length > 0) {
          fieldSchema.required = requiredFields;
        }
        return fieldSchema;
      },
      array: (schema, requireAllFields) => {
        const {
          fields,
          maxItems,
          minItems,
          isRequired,
          uniqueItems,
          errorMessages,
        } = schema as ArraySchema<DataModelType>;
        const fieldSchema: AjvValidationSchema = {
          minItems,
          maxItems,
          type: isRequired ? 'array' : ['array', 'null'],
          default: !isRequired && requireAllFields ? null : undefined,
          items: this.AJV_FORMATTERS[fields.type](fields, true, false),
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

  /**
   * Model instance to use.
   */
  protected model: ModelType;

  /**
   * Telemetry instance to use.
   */
  protected telemetry: TelemetryType;

  /**
   * Engine instance to use.
   */
  protected engine: EngineType;

  /**
   * Release version. Will be sent back along with responses through the "X-Api-Version" header.
   */
  protected version: string;

  /**
   * List of built-in endpoints to register.
   */
  protected endpoints: BuiltInEndpoints<DataModelType>;

  /**
   * Parses `value` into an integer.
   */
  protected parseInt = parseValueToInt;

  /**
   * Used to format ArrayBuffers into strings.
   */
  protected textDecoder = new TextDecoder('utf-8');

  /**
   * Increment used for `multipart/form-data` payloads parsing.
   */
  protected increment = 0;

  /**
   * Ajv instance for payloads validation.
   */
  protected ajv: Ajv;

  /**
   * Whether to automatically handle CORS (usually in development mode).
   */
  protected handleCORS: boolean;

  /**
   * Whether to instrument all endpoints with OpenTelemetry. If set to `false`, only endpoints
   * created using `createEndpoint` will be wrapped within a span, and global requests won't be
   * instrumented. If you want to manually instrument global requests, you can link Perseid endpoint
   * root span to the global request span by adding a `telemetry` property to the request object,
   * containing the parent span to which you want to link the endpoint root span.
   *
   * @example
   * ```ts
   * const request = new FastifyRequest({
   *   method: 'GET',
   *   url: '/api/v1/users',
   * });
   * request.telemetry = { span: parentSpan };
   */
  protected instrumentEndpoints: boolean;

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
      return Object.keys(output)
        .reduce((formattedResource, key) => ({
          ...formattedResource,
          [key]: this.formatOutput((output)[key]),
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
          throw new ControllerError('INVALID_SORT_QUERY');
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
   * @param options Parser options.
   *
   * @returns Parsed payload.
   *
   * @throws If any of the field is too large.
   *
   * @throws If the payload contains too many fields.
   *
   * @throws If the payload is missing the "Content-Type" header.
   *
   * @throws If the payload contains an invalid field type.
   *
   * @throws If total size of the payload is too large.
   */
  protected parseFormData(
    payload: IncomingMessage,
    options: FormDataOptions = {},
  ): Promise<FormDataFields> {
    let totalSize = 0;
    let totalFiles = 0;
    const allowedMimeTypes = options.allowedMimeTypes ?? [];
    const maxTotalSize = options.maxTotalSize ?? 10 * 1024 * 1024;
    const maxFieldSize = options.maxFieldSize ?? 2 * 1024 * 1024;
    return new Promise((resolve, reject) => {
      const fields: FormDataFields = {};
      let parserClosed = false;
      let numberOfParts = 0;
      let numberOfClosedParts = 0;

      const parser = new multiparty.Form({
        maxFields: options.maxFields,
        maxFieldsSize: options.maxTotalSize,
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
          reject(new ControllerError('FIELD_TOO_LARGE'));
        } else if (/maxFields/i.test(error.message)) {
          reject(new ControllerError('TOO_MANY_FIELDS'));
        } else if (/missing content-type header/i.test(error.message)) {
          reject(new ControllerError('MISSING_CONTENT_TYPE_HEADER'));
        } else {
          reject(error);
        }
      });

      // Files parsing logic.
      parser.on('part', (part) => {
        numberOfParts += 1;
        const headers = part.headers as Record<string, string>;
        if (!allowedMimeTypes.includes(headers['content-type'])) {
          reject(new ControllerError('INVALID_FILE_TYPE'));
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
              reject(new ControllerError('FILES_TOO_LARGE'));
            }
            if (uploadedFiles[fileIndex].size > maxFieldSize) {
              reject(new ControllerError('FILE_TOO_LARGE', { filename: part.filename }));
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
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param telemetry Logging system to use.
   *
   * @param engine Engine to use.
   *
   * @param settings Controller settings.
   */
  public constructor(
    model: ModelType,
    telemetry: TelemetryType,
    engine: EngineType,
    settings: ControllerSettings<DataModelType>,
  ) {
    this.model = model;
    this.engine = engine;
    this.telemetry = telemetry;
    this.version = settings.version;
    this.endpoints = settings.endpoints;
    this.handleCORS = settings.handleCORS;
    this.instrumentEndpoints = settings.instrumentEndpoints;
    this.ajv = new Ajv({
      allErrors: true,
      useDefaults: true,
      coerceTypes: true,
      removeAdditional: false,
    });
    ajvErrors(this.ajv);

    // Adding Ajv keywords to handle special types...
    this.AJV_KEYWORDS.forEach((keyword) => this.ajv.addKeyword(keyword));

    if (this.instrumentEndpoints) {
      this.telemetry.createUpDownCounter('http.server.active_requests', {
        valueType: 1, // DOUBLE
        unit: '{request}',
        description: 'Number of active HTTP server requests.',
      });
      this.telemetry.createHistogram('http.server.request.duration', {
        description: 'Duration of HTTP server requests.',
        unit: 's',
        advice: {
          explicitBucketBoundaries: [
            0.005,
            0.01,
            0.025,
            0.05,
            0.075,
            0.1,
            0.25,
            0.5,
            0.75,
            1,
            2.5,
            5,
            7.5,
            10,
          ],
        },
      });
    }
  }
}
