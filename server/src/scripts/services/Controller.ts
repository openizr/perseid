/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import jwt from 'jsonwebtoken';
import { deepCopy, deepMerge, isPlainObject } from 'basx';
import {
  Id,
  type Role,
  type User,
  type UserPermissions,
} from '@perseid/core';
import type Model from 'scripts/common/Model';
import NotFound from 'scripts/errors/NotFound';
import Conflict from 'scripts/errors/Conflict';
import Gone from 'scripts/errors/Gone';
import TooManyRequests from 'scripts/errors/TooManyRequests';
import EngineError from 'scripts/errors/Engine';
import Forbidden from 'scripts/errors/Forbidden';
import BadRequest from 'scripts/errors/BadRequest';
import DatabaseError from 'scripts/errors/Database';
import Unauthorized from 'scripts/errors/Unauthorized';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import type OAuthEngine from 'scripts/services/OAuthEngine';
import ajvErrors from 'ajv-errors';
import oAuth from 'scripts/hooks/oAuth';
import Ajv, { ValidateFunction } from 'ajv';
import signIn from 'scripts/endpoints/signIn';
import signUp from 'scripts/endpoints/signUp';
import signOut from 'scripts/endpoints/signOut';
import viewResource from 'scripts/endpoints/view';
import listResources from 'scripts/endpoints/list';
import updateResource from 'scripts/endpoints/update';
import createResource from 'scripts/endpoints/create';
import deleteResource from 'scripts/endpoints/delete';
import searchResources from 'scripts/endpoints/search';
import verifyEmail from 'scripts/endpoints/verifyEmail';
import refreshToken from 'scripts/endpoints/refreshToken';
import fastJsonStringify, { Schema } from 'fast-json-stringify';
import resetPassword from 'scripts/endpoints/resetPassword';
import requestVerifyEmail from 'scripts/endpoints/requestVerifyEmail';
import requestPasswordReset from 'scripts/endpoints/requestPasswordReset';
import { DataValidationCxt } from 'ajv/dist/types';
import {
  FastifyError, FastifyInstance, FastifyReply, FastifyRequest,
} from 'fastify';
import os from 'os';
import path from 'path';
import multiparty from 'multiparty';
import { IncomingMessage as Payload } from 'http';
import UnprocessableEntity from 'scripts/errors/UnprocessableEntity';
import RequestEntityTooLarge from 'scripts/errors/RequestEntityTooLarge';
import { createWriteStream } from 'fs';
import Logger from './Logger';

interface ValidationError {
  keyword?: string;
  message?: string;
  instancePath?: string;
  params?: Record<string, string | string[]>;
}

type EndpointName = keyof ServerConfiguration['endpoints'];
type EndpointConfiguration = { [collectionName: string]: { path: string; custom?: boolean; } };

interface Params {
  endpoint: string;
  fields: string[];
  loggedUser: User;
  collection: string;
  requiredPermissions: string[];
}

/**
 * Types Ajv formatters.
 */
type Formatters = Record<string, (
  field: FieldModel,
  isPartial: boolean,
  isResponse: boolean,
) => AjvFieldSchema>;

/**
 * Uploaded file.
 */
export interface File {
  id: string;
  size: number;
  type: string;
  path: string;
  name: string;
}

/**
 * Parsed multipart/form-data fields.
 */
export interface Fields {
  [name: string]: string | File[];
}

/**
 * Multipart/form-data parser options.
 */
export interface Options {
  maxFields?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  maxFieldsSize?: number;
  allowedMimeTypes?: string[];
}
const toSnakeCase = (e: string): string => (e.match(/([A-Z])/g) ?? [] as string[]).reduce(
  (str: string, c: string) => str.replace(new RegExp(c), `_${c}`),
  e,
).toUpperCase();

export default class Controller<EngineType extends OAuthEngine = OAuthEngine> {
  protected model: Model;

  protected logger: Logger;

  protected engine: EngineType;

  protected endpoints: any;

  protected maxDepth: number;

  protected version: string;

  protected increment: number;

  public constructor(model: Model, logger: Logger, engine: EngineType, settings: any) {
    this.model = model;
    this.logger = logger;
    this.engine = engine;
    this.increment = 0;
    this.maxDepth = settings.maxDepth ?? 3;
    this.version = settings.version;
    this.endpoints = deepMerge({
      list: {},
      view: {},
      create: {},
      delete: {},
      update: {},
      search: {},
    }, settings.endpoints);
    this.pRbac = this.pRbac.bind(this);
  }

  /**
   * Catches and handles most common API errors thrown by `callback`.
   *
   * @param callback Callback to wrap.
   *
   * @returns Wrapped callback.
   */
  // eslint-disable-next-line
  public async catchErrors<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Unauthorized('TOKEN_EXPIRED', 'Access token has expired.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Unauthorized('INVALID_TOKEN', 'Invalid access token.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_DEVICE_ID') {
        throw new Unauthorized('INVALID_DEVICE_ID', 'Invalid device id.');
      }
      if (error instanceof EngineError && error.code === 'NO_RESOURCE') {
        throw new NotFound('NO_RESOURCE', `Resource with id "${error.details.id}" does not exist.`);
      }
      if (error instanceof DatabaseError && error.code === 'DUPLICATE_RESOURCE') {
        throw new Conflict('RESOURCE_EXISTS', `Resource with field "${error.details.field}" set to "${error.details.value}" already exists.`);
      }
      if (error instanceof EngineError && error.code === 'NO_O_AUTH_USER') {
        throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_CREDENTIALS') {
        throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_VERIFY_TOKEN') {
        throw new Unauthorized('INVALID_TOKEN', 'Invalid or expired verify token.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_RESET_TOKEN') {
        throw new Unauthorized('INVALID_TOKEN', 'Invalid or expired reset token.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_REFRESH_TOKEN') {
        throw new Unauthorized('INVALID_TOKEN', 'Invalid or expired refresh token.');
      }
      if (error instanceof EngineError && error.code === 'PASSWORDS_MISMATCH') {
        throw new BadRequest('PASSWORDS_MISMATCH', 'Passwords mismatch.');
      }
      if (error instanceof EngineError && error.code === 'PASSWORDS_MISMATCH') {
        throw new BadRequest('PASSWORDS_MISMATCH', 'Passwords mismatch.');
      }
      if (error instanceof EngineError && error.code === 'EMAIL_VERIFIED') {
        throw new NotAcceptable('EMAIL_VERIFIED', 'User email is already verified.');
      }
      throw error;
    }
  }

  public async oAuth(
    headers: Record<string, string | string[] | undefined>,
    ignoreExpiration = false,
  ): Promise<User> {
    return this.catchErrors(async () => {
      const deviceId = headers['x-device-id'];
      const accessToken = `${headers.authorization}`.replace('Bearer ', '') ?? '';

      const userId = await this.engine.verifyToken({
        deviceId,
        accessToken,
        ignoreExpiration,
      });
      // TODO this should be in rbac, not in oAuth.
      return this.buildPermissionsTree({ filters: { _id: new Id(userId) } });
    });
  }

  // eslint-disable-next-line
  public rbac(user: User, requiredPermissions: string[]): void {
    const { _verifiedAt } = user;

    // Unverified users cannot access resources (except their own information).
    if (_verifiedAt === null && !/^O_AUTH_USERS/.test(requiredPermissions[0])) {
      throw new Forbidden('UNVERIFIED', 'Please verify your email address before performing this operation.');
    }

    // Checking user's permissions on the given resources...
    for (let index = 0, { length } = requiredPermissions; index < length; index += 1) {
      if (!(<UserPermissions>user._permissions)[requiredPermissions[index]]) {
        throw new Forbidden('FORBIDDEN', `You are missing "${requiredPermissions[index]}" permission to perform this operation.`);
      }
    }
  }

  /**
   * Handles role-based access control.
   *
   * @param services Available internal services.
   *
   * @returns Actual fastify hook.
   */
  protected async pRbac(request: FastifyRequest): Promise<void> {
    const { collection, endpoint } = <Params>request.params;
    const { loggedUser } = <Params>request.params;
    const query = this.parseQuery(collection, <Record<string, unknown>>request.query);
    request.query = query;
    const allPermissions = [toSnakeCase(`${collection}_${endpoint}`)]
      .concat(<string[]>query._requiredPermissions);
    if (endpoint === 'search') {
      const body = this.parseSearchBody(collection, <Record<string, unknown>>request.body);
      allPermissions.push(...body._requiredPermissions);
      request.body = body;
    }

    await this.rbac(loggedUser, allPermissions);
  }

  protected createPaths(
    collections: string[],
    fields: any,
    subPaths: string[],
    prefix: string[],
    permissions: string[] = [],
  ): {
    paths: string[];
    collections: string[];
    permissions: string[];
  } {
    if (subPaths.length === 0) {
      return {
        collections,
        permissions,
        paths: [prefix.join('.')],
      };
    }
    // TODO in order to deal with nested fields correctly (e.g. supplies.test.private has a
    // specific permission, but requesting supplies.* gets rid of it), we need to consider all
    // nested fields the same way as relations (=> transform supplies.* to
    // supplies.unitPrice,supplies.test.* => and then supplies.unitPrice,supplies.test.private)
    if (subPaths[0] === '*') {
      const newPermissions = new Set<string>();
      const allFields = Object.keys(fields).map((subFieldName) => {
        fields[subFieldName].permissions?.forEach((permission: string) => {
          newPermissions.add(permission);
        });
        return prefix.concat([subFieldName]).join('.');
      });
      return {
        collections,
        paths: allFields,
        permissions: permissions.concat([...newPermissions]),
      };
    }
    const fieldName = subPaths[0];
    if (fields[fieldName] === undefined) {
      throw new BadRequest('INVALID_FIELDS', `Field "${fieldName}" does not exist in resource "${collections.slice(-1)[0]}".`);
    }
    const field = {
      ...((this.model.get() as any).types[fields[fieldName]?.type] ?? {}),
      ...fields[fieldName],
    };
    const newPermissions = permissions.concat(field.permissions ?? []);
    if (field.type === 'object') {
      const { fields: subFields, patternProperties } = <any>field;
      if (subFields !== undefined) {
        return this.createPaths(
          collections,
          subFields,
          subPaths.slice(1),
          prefix.concat([fieldName]),
          newPermissions,
        );
      }
      const patterns = Object.keys(<any>patternProperties);
      for (let index = 0, { length } = patterns; index < length; index += 1) {
        const pattern = patterns[index];
        if ((new RegExp(pattern)).test(subPaths[1])) {
          const patternFields = { [subPaths[1]]: (<any>patternProperties)[pattern] };
          return this.createPaths(
            collections,
            patternFields,
            subPaths.slice(1),
            prefix.concat([fieldName]),
            newPermissions,
          );
        }
      }
    }
    if (field.type === 'array') {
      const { fields: subFields } = <any>field;
      return this.createPaths(
        collections,
        { [fieldName]: subFields },
        subPaths,
        prefix,
        newPermissions,
      );
    }
    if (field.type === 'id') {
      const { relation } = <any>field;
      if (relation !== undefined && subPaths.length > 1) {
        const { fields: subFields } = (this.model.get() as any).collections[relation];
        return this.createPaths(
          collections.concat([relation]),
          subFields,
          subPaths.slice(1),
          prefix.concat([fieldName]),
          newPermissions,
        );
      }
    }
    return { collections, paths: [prefix.concat([fieldName]).join('.')], permissions: newPermissions };
  }

  public parseSearchBody(collection: string, body: any): any {
    const { filters, query } = deepCopy(body);
    const parsedBody: any = { _requiredPermissions: [] };

    // Validating search filters...
    if (filters !== null) {
      Object.keys(filters).forEach((filterPath) => {
        let isIndexed = false;
        const fieldModelWithMetadata = this.model.get(`${collection}.${filterPath}`);
        if (fieldModelWithMetadata !== null) {
          let fieldModel = <any>fieldModelWithMetadata.model;
          // TODO invert spread? (first generic type, then field specific overrides)
          fieldModel = {
            ...fieldModel,
            ...((this.model?.get() as any)
              .types[fieldModel.type] ?? {}),
          };
          if (fieldModel.index || fieldModel.unique) {
            isIndexed = true;
            if (filters[filterPath] !== null) {
              if (fieldModel.type === 'id') {
                // TODO check ID is valid (hex)
                filters[filterPath] = Array.isArray(filters[filterPath])
                  ? filters[filterPath].map((value: string) => (
                    value === null ? null : new Id(value)))
                  : new Id(filters[filterPath]);
              } else if (fieldModel.type === 'date') {
                filters[filterPath] = Array.isArray(filters[filterPath])
                  ? filters[filterPath].map((value: string) => new Date(value))
                  : new Date(filters[filterPath]);
              } else if (fieldModel.type === 'float') {
                filters[filterPath] = Array.isArray(filters[filterPath])
                  ? filters[filterPath].map((value: string) => parseFloat(value))
                  : parseFloat(filters[filterPath]);
              } else if (fieldModel.type === 'integer') {
                filters[filterPath] = Array.isArray(filters[filterPath])
                  ? filters[filterPath].map((value: string) => parseInt(value, 10))
                  : parseInt(filters[filterPath], 10);
              }
            }
            parsedBody._requiredPermissions.push(...fieldModelWithMetadata.permissions);
            parsedBody._requiredPermissions.push(`${toSnakeCase(fieldModelWithMetadata.collection)}_SEARCH`);
          }
        }
        if (!isIndexed) {
          throw new BadRequest('INVALID_FILTERS', `Field "${filterPath}" is not indexed.`);
        }
        parsedBody.filters = filters;
      });
    }

    // Validating search query...
    if (query !== null) {
      for (let i = 0; i < query.on.length; i += 1) {
        const fieldModelWithMetadata = this.model.get(`${collection}.${query.on[i]}`) as any;
        let isIndexed = false;
        if (fieldModelWithMetadata !== null) {
          let fieldModel = <any>fieldModelWithMetadata.model;
          // TODO invert spread? (first generic type, then field specific overrides)
          fieldModel = {
            ...fieldModel,
            ...((this.model?.get() as any)
              .types[fieldModel.type] ?? {}),
          };
          if (fieldModel.type !== 'string') {
            throw new BadRequest('INVALID_QUERY', `Field "${query.on[i]}" is not searchable.`);
          }
          if (fieldModel.index || fieldModel.unique) {
            isIndexed = true;
            parsedBody._requiredPermissions.push(...fieldModelWithMetadata.permissions);
            parsedBody._requiredPermissions.push(`${toSnakeCase(fieldModelWithMetadata.collection)}_SEARCH`);
          }
        }
        if (!isIndexed) {
          throw new BadRequest('INVALID_QUERY', `Field "${query.on[i]}" is not indexed.`);
        }
      }
      parsedBody.query = query;
    }

    return parsedBody;
  }

  public createEndpoint(
    collection: string,
    callback: (request: FastifyRequest, response: FastifyReply) => Promise<void>,
    additionalPermissions: string[] = [],
    enableOAuth = true,
  ) {
    return async (request: FastifyRequest, response: FastifyReply): Promise<void> => {
      await this.catchErrors(async () => {
        const user = enableOAuth ? await this.oAuth(request.headers) : null;
        const query = this.parseQuery(collection, <Record<string, unknown>>request.query);
        const allPermissions = additionalPermissions.concat(<string[]>query._requiredPermissions);

        if (allPermissions.length > 0 && !enableOAuth) {
          throw new Error('OAuth must be enabled before checking user\'s permissions.');
        }
        await this.rbac(user as User, allPermissions);
        request.query = query;
        (request.params as any).loggedUser = user;
        await callback(request, response);
      });
    };
  }

  public parseQuery(
    collection: string,
    query: Record<string, unknown>,
    parseSortBy = true,
    parseFields = true,
  ): {
    fields?: string[];
    sortBy?: string[];
    sortOrder?: number[];
    _requiredPermissions?: string[];
    [key: string]: unknown | number | string | string[];
  } {
    const a = Object.keys(query).reduce((finalQuery, key) => {
      // Parsing and validating sorting options...
      if (key === 'sortBy' && parseSortBy) {
        const sortBy = (query.sortBy as string)?.split(',') ?? [];
        const sortOrder = (query.sortOrder as string)?.split(',') ?? [];
        if (sortBy.length !== sortOrder.length) {
          throw new BadRequest('INVALID_SORTING', 'Number of sorting fields and orders must match.');
        }
        const realSortBy: string[] = [];
        const realSortOrder: number[] = [];
        const newPermissions: string[] = [];
        for (let i = 0; i < sortBy.length; i += 1) {
          let isIndexed = false;
          const fieldModelWithMetadata = this.model.get(`${collection}.${sortBy[i]}`) as any;
          if (fieldModelWithMetadata !== null) {
            const fieldModel = <any>(fieldModelWithMetadata.model);
            if (fieldModel.index || fieldModel.unique) {
              isIndexed = true;
              realSortOrder.push(parseInt(sortOrder[i], 10));
              realSortBy.push(sortBy[i]);
            }
          }
          newPermissions.push(...fieldModelWithMetadata.permissions);
          newPermissions.push(`${toSnakeCase(fieldModelWithMetadata.collection)}_VIEW`);
          if (!isIndexed) {
            throw new BadRequest('INVALID_SORTING', `Field "${sortBy[i]}" is not indexed.`);
          }
        }
        return {
          ...finalQuery,
          sortBy: realSortBy,
          sortOrder: realSortOrder,
          _requiredPermissions: finalQuery._requiredPermissions.concat(newPermissions),
        };
      }

      // Just skip this query param as we already processed it above.
      if (key === 'sortOrder' && parseSortBy) {
        return finalQuery;
      }

      // Parsing and validating fields options...
      if (key === 'fields' && parseFields) {
        const collections: any[] = [];
        const permissions: string[] = [];

        const fields = (query.fields as string)?.split(',') ?? [];
        let maxDepth = 0;
        const finalFieldPaths = [];
        for (let pathIndex = 0, { length } = fields; pathIndex < length; pathIndex += 1) {
          const splittedPath = fields[pathIndex].split('.');
          const paths = (this as any).createPaths(
            [collection],
            (this.model.get() as any).collections[collection].fields,
            splittedPath,
            [],
          );
          collections.push(...paths.collections);
          finalFieldPaths.push(...paths.paths);
          permissions.push(...paths.permissions);
          maxDepth = Math.max(maxDepth, paths.collections.length);

          if (maxDepth > this.maxDepth) {
            throw new BadRequest('INVALID_FIELDS', 'Maximum fields depth exceeded.');
          }
        }

        return {
          ...finalQuery,
          fields: finalFieldPaths,
          _requiredPermissions: finalQuery._requiredPermissions.concat(permissions).concat((collections?.map((relation) => `${toSnakeCase(relation)}_VIEW`) ?? [])),
        };
      }

      return { ...finalQuery, [key]: query[key] };
    }, { _requiredPermissions: [] } as any);
    a._requiredPermissions = [...new Set(a._requiredPermissions)];
    return a;
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
          type: 'must be a string.',
        };
        if (maxLength !== undefined) {
          formattedField.maxLength = maxLength;
          formattedField.errorMessage.maxLength = `must be shorter than ${maxLength + 1} characters.`;
        }
        if (minLength !== undefined) {
          formattedField.minLength = minLength;
          formattedField.errorMessage.minLength = `must be longer than ${minLength - 1} characters.`;
        }
        if (pattern !== undefined) {
          formattedField.pattern = pattern;
          formattedField.errorMessage.pattern = `must match "${pattern}" pattern.`;
        }
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}.`;
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
      // TODO handle specific erorr messages overrides from field (eg token "must be a valid token")
      return formattedField;
    },
    boolean(field, isPartial, isResponse) {
      const formattedField: AjvFieldSchema = { type: 'boolean' };
      const { default: defaultValue, required } = (<BooleanFieldModel>field);
      if (!isResponse) {
        formattedField.errorMessage = {
          type: 'must be a boolean.',
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
          type: 'must be a valid date.',
          pattern: 'must be a valid date.',
        };
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}.`;
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
        return { oneOf: [{ type: 'string' }, { $ref: `${relation}.json` }] };
      }
      // Classic id...
      const formattedField: any = { type: 'string', isId: true };
      if (!isResponse) {
        formattedField.pattern = /^[0-9a-fA-F]{24}$/.source;
        formattedField.errorMessage = {
          type: 'must be a valid id.',
          pattern: 'must be a valid id.',
        };
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}.`;
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
          type: 'must be a base64-encoded binary.',
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
          type: 'must be an integer.',
        };
        if (minimum !== undefined) {
          formattedField.minimum = minimum;
          formattedField.errorMessage.minimum = `must be greater than or equal to ${minimum}.`;
        }
        if (maximum !== undefined) {
          formattedField.maximum = maximum;
          formattedField.errorMessage.maximum = `must be smaller than or equal to ${maximum}.`;
        }
        if (exclusiveMinimum !== undefined) {
          formattedField.exclusiveMinimum = exclusiveMinimum;
          formattedField.errorMessage.exclusiveMinimum = `must be greater than ${exclusiveMinimum}.`;
        }
        if (exclusiveMaximum !== undefined) {
          formattedField.exclusiveMaximum = exclusiveMaximum;
          formattedField.errorMessage.exclusiveMaximum = `must be smaller than ${exclusiveMaximum}.`;
        }
        if (multipleOf !== undefined) {
          formattedField.multipleOf = multipleOf;
          formattedField.errorMessage.multipleOf = `must be a multiple of ${multipleOf}.`;
        }
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}.`;
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
          type: 'must be a float.',
        };
        if (minimum !== undefined) {
          formattedField.minimum = minimum;
          formattedField.errorMessage.minimum = `must be greater than or equal to ${minimum}.`;
        }
        if (maximum !== undefined) {
          formattedField.maximum = maximum;
          formattedField.errorMessage.maximum = `must be smaller than or equal to ${maximum}.`;
        }
        if (exclusiveMinimum !== undefined) {
          formattedField.exclusiveMinimum = exclusiveMinimum;
          formattedField.errorMessage.exclusiveMinimum = `must be greater than ${exclusiveMinimum}.`;
        }
        if (exclusiveMaximum !== undefined) {
          formattedField.exclusiveMaximum = exclusiveMaximum;
          formattedField.errorMessage.exclusiveMaximum = `must be smaller than ${exclusiveMaximum}.`;
        }
        if (multipleOf !== undefined) {
          formattedField.multipleOf = multipleOf;
          formattedField.errorMessage.multipleOf = `must be a multiple of ${multipleOf}.`;
        }
        if (enumerations !== undefined) {
          formattedField.enum = (enumerations as unknown[]).concat(!field.required ? [null] : []);
          formattedField.errorMessage.enum = `must be one of: ${enumerations.map((value) => `"${value}"`).join(', ')}.`;
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
    object: (field, isPartial, isResponse) => {
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
        formattedField.errorMessage.type = 'must be a valid object.';
        if (minProperties !== undefined) {
          formattedField.minProperties = minProperties;
          formattedField.errorMessage.minProperties = `must contain at least ${minProperties} ${(minProperties === 1) ? 'entry' : 'entries'}.`;
        }
        if (maxProperties !== undefined) {
          formattedField.maxProperties = maxProperties;
          formattedField.errorMessage.maxProperties = `must not contain more than ${maxProperties} ${(maxProperties === 1) ? 'entry' : 'entries'}.`;
        }
      }
      if (!required) {
        if (!isPartial && !isResponse) {
          formattedField.default = null;
          formattedField.type = ['object', 'null'];
        } else {
          formattedField.nullable = true;
        }
        formattedField.errorMessage.type = 'must be a valid object, or "null".';
      }
      if (fields !== undefined) {
        const requiredFields = Object.keys(fields).filter((fieldName) => (
          fieldName[0] !== '_' && fields[fieldName].required === true
        ));
        if (!isResponse && !isPartial && requiredFields.length > 0) {
          formattedField.required = requiredFields;
        }
        // eslint-disable-next-line
        formattedField.properties = this.createSchema(fields, isResponse ? 'RESPONSE' : isPartial ? 'UPDATE' : 'CREATE', (schema) => schema, false);
        return formattedField;
      }
      if (patternProperties !== undefined) {
        formattedField.patternProperties = this.createSchema(
          patternProperties,
          // eslint-disable-next-line
          isResponse ? 'RESPONSE' : isPartial ? 'UPDATE' : 'CREATE',
          (schema) => schema,
          false,
        );
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
        items: this.createSchema({ items: fields }, isResponse ? 'RESPONSE' : isPartial ? 'UPDATE' : 'CREATE', (schema) => schema, false).items,
        errorMessage: {},
      };
      if (!isResponse) {
        formattedField.errorMessage.type = 'must be a valid array.';
        if (minItems !== undefined) {
          formattedField.minItems = minItems;
          formattedField.errorMessage.minItems = `must contain at least ${minItems} ${(minItems === 1) ? 'entry' : 'entries'}.`;
        }
        if (maxItems !== undefined) {
          formattedField.maxItems = maxItems;
          formattedField.errorMessage.maxItems = `must not contain more than ${maxItems} ${(maxItems === 1) ? 'entry' : 'entries'}.`;
        }
        if (uniqueItems !== undefined) {
          formattedField.uniqueItems = uniqueItems;
          formattedField.errorMessage.uniqueItems = 'must contain only unique entries.';
        }
      }
      if (!required) {
        if (!isPartial && !isResponse) {
          formattedField.default = null;
          formattedField.type = ['array', 'null'];
        } else {
          formattedField.nullable = true;
        }
        formattedField.errorMessage.type = 'must be a valid array, or "null".';
      }
      return formattedField;
    },
  };

  public createSearchEndpoint(
    collection: string,
    callback: (request: FastifyRequest, response: FastifyReply) => Promise<void>,
    additionalPermissions: string[] = [],
    enableOAuth = true,
  ) {
    return async (request: FastifyRequest, response: FastifyReply): Promise<void> => {
      await this.catchErrors(async () => {
        const user = enableOAuth ? await this.oAuth(request.headers) : null;
        const query = this.parseQuery(collection, <Record<string, unknown>>request.query);
        const body = this.parseSearchBody(collection, <Record<string, unknown>>request.body);
        const allPermissions = additionalPermissions
          .concat(<string[]>query._requiredPermissions)
          .concat(<string[]>body._requiredPermissions);

        if (allPermissions.length > 0 && !enableOAuth) {
          throw new Error('OAuth must be enabled before checking user\'s permissions.');
        }
        await this.rbac(user as User, allPermissions);
        request.query = query;
        request.body = body;
        (request.params as any).loggedUser = user;
        await callback(request, response);
      });
    };
  }

  protected async buildPermissionsTree(searchBody: SearchBody): Promise<User> {
    const users = await this.engine.search('users', searchBody, {
      limit: 1,
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

    if (users.total === 0) {
      throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    const [user] = users.results;

    // Building user's permissions tree...
    const permissions: UserPermissions = {};
    (<Role[]>user.roles).forEach((role) => {
      Object.keys(role.permissions).forEach((permissionName) => {
        permissions[permissionName] = role.permissions[permissionName]
          || (permissions[permissionName] ?? false);
      });
    });
    user._permissions = permissions;

    return user;
  }

  public createSchema(
    currentModel: any,
    type = 'CREATE',
    transformer = (schema: any) => schema,
    isRoot = true,
  ): AjvRequestSchema {
    const schema = Object.keys(currentModel).reduce((currentSchema, fieldName) => {
      const field = ((this.model.get() as any).types[currentModel[fieldName].type] === undefined)
        ? currentModel[fieldName]
        : {
          ...currentModel[fieldName],
          ...(this.model.get() as any).types[currentModel[fieldName].type],
        };
      const format = this.formatters[field.type] ?? this.formatters.null;

      // Reducer / auto field...
      if (
        (fieldName[0] === '_' && type !== 'RESPONSE')
      ) {
        return currentSchema;
      }

      const formatted = (this.formatters[currentModel[fieldName].type] === undefined)
        ? format(field, type === 'UPDATE', type === 'RESPONSE')
        : this.formatters[currentModel[fieldName].type](currentModel[fieldName], type === 'UPDATE', type === 'RESPONSE');
      // Classic field...
      return {
        ...currentSchema,
        [fieldName]: formatted,
      };
    }, {});

    const requiredFields = isRoot && type === 'CREATE' ? Object.keys(currentModel).filter((fieldName) => (
      currentModel[fieldName].required === true
      && fieldName[0] !== '_'
    )) : [];

    if (isRoot && type === 'RESPONSE') {
      return transformer(schema);
    }
    return isRoot ? transformer({
      type: 'object',
      additionalProperties: false,
      required: requiredFields.length > 0 ? requiredFields : undefined,
      properties: schema,
    })
      : schema;
  }

  /**
   * Automatically registers hooks, handlers, oAuth and CRUD-related endpoints to `server`.
   *
   * @param server Fastify instance to register endpoints to.
   *
   * @param captureError Errors logging function to use for monitoring.
   *
   * @param extraOAuthEndpoints Callback registering additional endpoints in the oAuth scope.
   *
   * @param extraRbacEndpoints Callback registering additional endpoints in the RBAC scope.
   */
  public registerEndpoints(
    server: FastifyInstance,
    extraOAuthEndpoints?: ((app: FastifyInstance) => void) | null,
    extraRbacEndpoints?: ((app: FastifyInstance) => void) | null,
  ): void {
    const ajv = new Ajv({
      allErrors: true,
      useDefaults: true,
      coerceTypes: true,
    });
    ajvErrors(ajv);
    ajv.addKeyword({
      keyword: 'isBinary',
      modifying: true,
      validate: function validate(_, value, schema, context) {
        (validate as any).errors = [];
        if ((schema as any).nullable && value === null) {
          return true;
        }
        if ((typeof value !== 'string' || value.slice(0, 5) !== 'data:')) {
          (validate as any).errors.push({ keyword: 'type' });
          return false;
        }
        const encoder = new TextEncoder();
        const { parentData, parentDataProperty } = <DataValidationCxt>context;
        parentData[parentDataProperty] = encoder.encode(value).buffer;
        return true;
      },
    });
    ajv.addKeyword({
      keyword: 'isDate',
      modifying: true,
      errors: true,
      validate: function validate(_, value, schema, context) {
        (validate as any).errors = [];
        if ((schema as any).nullable && value === null) {
          return true;
        }
        if (!/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/.test(`${value}`)) {
          (validate as any).errors.push({ keyword: 'pattern' });
          return false;
        }
        if ((schema as any).enum !== undefined && !(schema as any).enum.includes(value)) {
          (validate as any).errors.push({ keyword: 'enum' });
          return false;
        }
        const { parentData, parentDataProperty } = context as any;
        parentData[parentDataProperty] = new Date(value);
        return true;
      },
    });
    ajv.addKeyword({
      keyword: 'isId',
      modifying: true,
      errors: true,
      validate: function validate(_, value, schema, context) {
        (validate as any).errors = [];
        if ((schema as any).nullable && value === null) {
          return true;
        }
        if (!/^[0-9a-fA-F]{24}$/.test(`${value}`)) {
          (validate as any).errors.push({ keyword: 'pattern' });
          return false;
        }
        if ((schema as any).enum !== undefined && !(schema as any).enum.includes(value)) {
          (validate as any).errors.push({ keyword: 'enum' });
          return false;
        }
        const { parentData, parentDataProperty } = context as any;
        parentData[parentDataProperty] = new Id(value);
        return true;
      },
    });

    // We first register all schemas in order to let Ajv find them at compilation time.
    // We need to add schemas to the custom validator compiler instead of fastify.
    // See https://www.fastify.io/docs/latest/Reference/Validation-and-Serialization/.
    const validators: Record<string, ValidateFunction> = {};
    const schemas: Record<string, Schema> = {};
    Object.keys((this.model.get() as unknown as ModelSchema).collections).forEach((collection) => {
      const collectionResponseSchema = this.createSchema((this.model.get() as unknown as ModelSchema).collections[collection].fields, 'RESPONSE', (schema) => ({
        type: 'object',
        nullable: true,
        additionalProperties: false,
        properties: schema,
      }));

      // Responses (for serializers)...
      schemas[`${collection}.json`] = collectionResponseSchema as any;
      schemas[`${collection}.view.response.json`] = { $ref: `${collection}.json` };
      schemas[`${collection}.update.response.json`] = { $ref: `${collection}.json` };
      schemas[`${collection}.create.response.json`] = { $ref: `${collection}.json` };
      schemas[`${collection}.list.response.json`] = {
        type: 'object',
        additionalProperties: false,
        properties: {
          total: { type: 'integer' },
          results: { type: 'array', items: { $ref: `${collection}.json` } },
        },
      };
      schemas[`${collection}.search.response.json`] = {
        type: 'object',
        additionalProperties: false,
        properties: {
          total: { type: 'integer' },
          results: { type: 'array', items: { $ref: `${collection}.json` } },
        },
      };

      // Inputs (for compilers)...
      const fieldsSchema = {
        type: 'string',
        pattern: '^([^ ]+)(,([^ ]+))*$',
        errorMessage: {
          type: 'must be a coma-separated list of fields paths.',
          pattern: 'must be a coma-separated list of fields paths.',
        },
      };
      const commonQuerySchema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          fields: fieldsSchema,
        },
      };
      const commonParamsSchema = {
        type: 'object',
        required: ['collection', 'id'],
        properties: {
          id: {
            type: 'string',
            pattern: /^[0-9a-fA-F]{24}$/.source,
            errorMessage: {
              type: 'must be a valid id.',
              pattern: 'must be a valid id.',
            },
          },
          collection: {
            type: 'string',
            pattern: /^[0-9a-zA-Z_]{2,}$/.source,
            errorMessage: {
              type: 'must be a valid collection name.',
              pattern: 'must be a valid collection name.',
            },
          },
        },
      };
      const listAndSearchQuerySchema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          fields: fieldsSchema,
          limit: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            default: 20,
            errorMessage: {
              type: 'must be a valid length.',
              minimum: 'must be valid length.',
              maximum: 'cannot be greater than 100.',
            },
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            errorMessage: {
              type: 'must be a valid offset.',
              minimum: 'must be valid offset.',
            },
          },
          sortBy: {
            type: 'string',
            pattern: '^([^ ]+)(,([^ ]+))*$',
            errorMessage: {
              type: 'must be a coma-separated list of fields paths.',
              pattern: 'must be a coma-separated list of fields paths.',
            },
          },
          sortOrder: {
            type: 'string',
            pattern: /^(-1|1)(,(-1|1))*$/.source,
            errorMessage: {
              type: 'must be a coma-separated list of sorting orders.',
            },
          },
        },
      };
      validators[`${collection}.list.query.json`] = ajv.compile({
        $id: `${collection}.list.query.json`,
        ...listAndSearchQuerySchema,
      });
      validators[`${collection}.search.query.json`] = ajv.compile({
        $id: `${collection}.search.query.json`,
        ...listAndSearchQuerySchema,
      });
      validators[`${collection}.view.query.json`] = ajv.compile({
        $id: `${collection}.view.query.json`,
        ...commonQuerySchema,
      });
      validators[`${collection}.update.query.json`] = ajv.compile({
        $id: `${collection}.update.query.json`,
        ...commonQuerySchema,
      });
      validators[`${collection}.create.query.json`] = ajv.compile({
        $id: `${collection}.create.query.json`,
        ...commonQuerySchema,
      });
      validators[`${collection}.create.body.json`] = ajv.compile({
        $id: `${collection}.create.body.json`,
        ...this.createSchema((this.model.get() as unknown as ModelSchema)
          .collections[collection].fields),
      });
      validators[`${collection}.update.body.json`] = ajv.compile({
        $id: `${collection}.update.body.json`,
        ...this.createSchema((this.model.get() as unknown as ModelSchema).collections[collection].fields, 'UPDATE'),
      });
      validators[`${collection}.search.body.json`] = ajv.compile({
        $id: `${collection}.search.body.json`,
        type: 'object',
        additionalProperties: false,
        errorMessage: {
          type: 'must be a valid object.',
        },
        properties: {
          query: {
            type: 'object',
            additionalProperties: false,
            default: null,
            nullable: true,
            errorMessage: {
              type: 'must be a valid object.',
            },
            required: ['on', 'text'],
            properties: {
              on: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'string',
                  errorMessage: {
                    type: 'must be valid fields path.',
                  },
                },
                errorMessage: {
                  type: 'must be an array of fields paths.',
                  minItems: 'must contain at least one field path.',
                },
              },
              text: {
                type: 'string',
                maxLength: 50,
                errorMessage: {
                  type: 'must be a string.',
                  maxLength: 'must not be longer than 50 characters.',
                },
              },
            },
          },
          filters: {
            type: 'object',
            default: null,
            nullable: true,
            // TODO
            // patternProperties: {
            //   '^[0-9A-Za-z.]$': {
            //     // type: ['array', 'string'],
            //     // allowUnionTypes: true,
            //     // items: {
            //     //   type: 'string',
            //     //   errorMessage: {
            //     //     type: 'must be a string.',
            //     //   },
            //     // },
            //     // errorMessage: {
            //     //   type: 'must be either a string or an array of strings.',
            //     // },
            //   },
            // },
            additionalProperties: true,
            errorMessage: {
              type: 'must be a valid object.',
            },
          },
        },
      });

      // Allows usage of "me" as an identifier in users-related endpoints.
      if (collection === 'users') {
        commonParamsSchema.properties.id.pattern = /^(me|[0-9a-fA-F]{24})$/.source;
        commonParamsSchema.properties.id.errorMessage.type = 'must be a valid id, or "me".';
        commonParamsSchema.properties.id.errorMessage.pattern = 'must be a valid id, or "me".';
      }
      validators[`${collection}.update.params.json`] = ajv.compile({
        $id: `${collection}.update.params.json`,
        ...commonParamsSchema,
      });
      validators[`${collection}.view.params.json`] = ajv.compile({
        $id: `${collection}.view.params.json`,
        ...commonParamsSchema,
      });
      validators[`${collection}.delete.params.json`] = ajv.compile({
        $id: `${collection}.delete.params.json`,
        ...commonParamsSchema,
      });
    });

    const serializers: Serializers = {};
    Object.keys((this.model.get() as unknown as ModelSchema).collections).forEach((collection) => {
      serializers[`${collection}.view.response.json`] = fastJsonStringify({
        $ref: `${collection}.json`,
      }, { schema: deepCopy(schemas) });
      serializers[`${collection}.create.response.json`] = fastJsonStringify({
        $ref: `${collection}.json`,
      }, { schema: deepCopy(schemas) });
      serializers[`${collection}.update.response.json`] = fastJsonStringify({
        $ref: `${collection}.json`,
      }, { schema: deepCopy(schemas) });
      serializers[`${collection}.list.response.json`] = fastJsonStringify({
        type: 'object',
        additionalProperties: false,
        properties: {
          total: { type: 'integer' },
          results: { type: 'array', items: { $ref: `${collection}.json` } },
        },
      }, { schema: deepCopy(schemas) });
      serializers[`${collection}.search.response.json`] = fastJsonStringify({
        type: 'object',
        additionalProperties: false,
        properties: {
          total: { type: 'integer' },
          results: { type: 'array', items: { $ref: `${collection}.json` } },
        },
      }, { schema: deepCopy(schemas) });
    });

    // TODO
    // Postman collection
    // server.get('/', {
    //   handler: async (_request: FastifyRequest, response: FastifyReply): Promise<void> => {
    //     response.send(toPostman(model));
    //   },
    //   schema: createSchema({
    //     response: {
    //       200: { type: 'object', additionalProperties: true },
    //     },
    //   }),
    // });

    const endpointHttpMethods: Record<string, string> = {
      create: 'POST',
      view: 'GET',
      list: 'GET',
      search: 'POST',
      update: 'PUT',
      delete: 'DELETE',
    };
    const endpointTypes = ['search', 'create', 'view', 'update', 'list', 'delete'];
    const endpoints = this.endpoints as { [endpoint: string]: EndpointConfiguration; };
    const getEndpoint = (collection: string, p: string, method: string): 'search' | 'create' | 'view' | 'update' | 'list' | 'delete' | null => {
      for (let index = 0, { length } = endpointTypes; index < length; index += 1) {
        const endpointType = endpointTypes[index];
        if (
          method === endpointHttpMethods[endpointType]
          && typeof endpoints[endpointType][collection]?.path === 'string'
          && p.indexOf(endpoints[endpointType][collection].path) >= 0
        ) {
          return <'search' | 'create' | 'view' | 'update' | 'list' | 'delete'>endpointType;
        }
      }
      return null;
    };

    // Public endpoints.
    if (typeof endpoints.signIn?.path === 'string') {
      server.post(endpoints.signIn.path, signIn(this.model, {
        engine: this.engine,
        controller: this,
      } as any));
    }
    if (typeof endpoints.signUp?.path === 'string') {
      server.post(endpoints.signUp.path, signUp(this.model, {
        engine: this.engine,
        controller: this,
      } as any));
    }
    if (typeof endpoints.resetPassword?.path === 'string') {
      server.put(endpoints.resetPassword.path, resetPassword(this.model, {
        engine: this.engine,
        controller: this,
      } as any));
    }
    if (typeof endpoints.requestPasswordReset?.path === 'string') {
      server.post(endpoints.requestPasswordReset.path, requestPasswordReset(this.model, {
        engine: this.engine,
        controller: this,
      } as any));
    }

    server.addHook('preHandler', async (request) => {
      const deviceId = request.headers['x-device-id'];
      // We need to store device ID in params as soon as possible to provide it to errors handler.
      (<any>request.params).deviceId = <string>deviceId;
    });

    // OAuth-protected endpoints.
    server.register((app, _options, done) => {
      app.addHook('preHandler', oAuth(this, { endpoints: this.endpoints } as any));

      if (typeof endpoints.signOut?.path === 'string') {
        app.post(endpoints.signOut.path, signOut(this.model, {
          engine: this.engine,
          controller: this,
        } as any));
      }
      if (typeof endpoints.refreshToken?.path === 'string') {
        app.post(endpoints.refreshToken.path, refreshToken(this.model, {
          engine: this.engine,
          controller: this,
        } as any));
      }
      if (typeof endpoints.verifyEmail?.path === 'string') {
        app.put(endpoints.verifyEmail.path, verifyEmail(this.model, {
          engine: this.engine,
          controller: this,
        } as any));
      }
      if (typeof endpoints.requestVerifyEmail?.path === 'string') {
        app.post(endpoints.requestVerifyEmail.path, requestVerifyEmail(this.model, {
          engine: this.engine,
          controller: this,
        } as any));
      }

      // CRUD-related endpoints.
      app.register((scopedApp, _scopedOptions, scopedDone) => {
        // Validates a different Ajv schema depending on the collection.
        scopedApp.addHook('preHandler', async (request: FastifyRequest) => {
          let { endpoint } = (request.params as { endpoint: string | null; });
          const { collection } = (request.params as { collection: string; });
          // endpoint !== null => custom registered endpoint
          if (endpoint === undefined) {
            endpoint = getEndpoint(collection, request.routerPath, request.routerMethod);

            // If collection does not exist or endpoint is not enabled for this collection,
            // we don't even need to go further.
            if (endpoint === null || (this.model.get() as unknown as ModelSchema)
              .collections[collection] === undefined) {
              throw new NotFound('NOT_FOUND', 'Not Found.');
            }

            (<{ endpoint: string; }>request.params).endpoint = endpoint;

            if ((<Any>endpoints)[endpoint][collection]?.custom !== true) {
              ['query', 'body', 'params'].forEach((httpPart) => {
                // This code is part of Fastify's internal logic. Directly picked from
                // the repository.
                const validator = validators[`${collection}.${endpoint}.${httpPart}.json`];
                if (validator !== undefined) {
                  const validationResult = validator((<Any>request)[httpPart] || null);
                  if (validationResult === false) {
                    throw this.formatError((<Any>validator).errors, httpPart);
                  }
                  const { error, value } = validationResult as Any;
                  if (error !== undefined) {
                    error.validationContext = error.validationContext || httpPart;
                    throw error;
                  }
                  if (value !== undefined) {
                    request.body = value;
                  }
                }
              });
            }
          }
        });
        scopedApp.addHook('preHandler', this.pRbac);
        endpointTypes.forEach((endpointType) => {
          const endpointConfigurations = this.endpoints[<EndpointName>endpointType] || {};
          const allEndpoints = Object.keys(endpointConfigurations)
            .filter((collection) => (
              <EndpointConfiguration>endpointConfigurations
            )[collection].custom !== true)
            .map((collection) => (<EndpointConfiguration>endpointConfigurations)[collection].path);
          // We sort endpoints from the most specific (longest path) to the less specific (shortest
          // path), to prevent less specific endpoints from catching all requests.
          const uniqueEndpoints = [...new Set(allEndpoints)].sort((a, b) => b.length - a.length);
          uniqueEndpoints.forEach((endpoint) => {
            switch (endpointType) {
              case 'create':
                scopedApp.post(endpoint, createResource({
                  engine: this.engine,
                  controller: this,
                } as any));
                break;
              case 'view':
                scopedApp.get(endpoint, viewResource({
                  engine: this.engine,
                  controller: this,
                } as any));
                break;
              case 'list':
                scopedApp.get(endpoint, listResources({
                  engine: this.engine,
                  controller: this,
                } as any));
                break;
              case 'search':
                scopedApp.post(endpoint, searchResources({
                  engine: this.engine,
                  controller: this,
                } as any));
                break;
              case 'update':
                scopedApp.put(endpoint, updateResource({
                  engine: this.engine,
                  controller: this,
                } as any));
                break;
              case 'delete':
                scopedApp.delete(endpoint, deleteResource({
                  engine: this.engine,
                  controller: this,
                } as any));
                break;
              default:
                break;
            }
          });
        });

        interface Params {
          endpoint: string;
          collection: string;
        }
        scopedApp.addHook('preSerialization', async (request, response, payload): Promise<unknown> => {
          const { collection, endpoint } = <Params>request.params;
          if (response.statusCode < 400 && endpoint !== undefined) {
            response
              .header('Content-Type', 'application/json')
              .serializer(serializers[`${collection}.${endpoint}.response.json`]);
          }
          return payload;
        });

        scopedDone();
      });
      done();
    });

    const formatOutput = (resource: unknown): unknown => {
      if (isPlainObject(resource)) {
        return Object.keys(resource as Record<string, unknown>)
          .reduce((formattedResource, key) => ({
            ...formattedResource,
            [key]: formatOutput((resource as Record<string, unknown>)[key]),
          }), {});
      }
      if (Array.isArray(resource)) {
        return resource.map((item) => formatOutput(item));
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

    // TODO rename (x-api-release?)
    // API Versionning.
    server.addHook('onSend', async (_request, response, payload) => {
      response.header('X-Api-Version', this.version);
      return payload;
    });

    // Default errors handlers.
    server.setSchemaErrorFormatter(this.formatError);
    server.setNotFoundHandler(this.handleNotFound);
    server.setErrorHandler(this.handleError.bind(this));
    server.setValidatorCompiler(({ schema }) => (ajv.compile(schema) as Any));
    server.setSerializerCompiler(({ schema }) => (
      fastJsonStringify(schema as Schema, { schema: deepCopy(schemas) })
    ));
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
  public formatError(error: ValidationError[], dataVar: string): Error {
    console.log(this);
    let message = error[0].message || '';
    const { keyword, instancePath, params } = error[0];

    const httpPart = dataVar === 'querystring' ? 'query' : dataVar;
    const fullPath = `${httpPart}${(instancePath as string).replace(/\//g, '.')}`;
    message = `"${fullPath}" ${message}`;
    if (keyword === 'required') {
      message = `"${fullPath}.${params?.missingProperty}" is required.`;
    } else if (keyword === 'additionalProperties') {
      message = `Unknown property "${fullPath}.${params?.additionalProperty}".`;
    }

    return new BadRequest('INVALID_PAYLOAD', message);
  }

  /**
 * Handles HTTP 404 errors.
 */
  public handleNotFound(): void {
    console.log(this);
    throw new NotFound('NOT_FOUND', 'Not Found.');
  }

  /**
 * Parses `multipart/form-data` payload, and returns its data.
 *
 * @param {IncomingMessage} payload Request payload.
 *
 * @param {Options} [options = {}] Parser options.
 * By default: `{
 *  allowedMimeTypes: [],
 *  maxTotalSize: 10000000,
 *  maxFileSize: 2000000,
 * }`
 *
 * @returns {Promise<Fields>} Parsed form fields.
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
 * Handles thrown errors and formats a clean HTTP response.
 *
 * @param error Error thrown by fastify.
 *
 * @param request HTTP request.
 *
 * @param response HTTP response.
 */
  public handleError(error: FastifyError, request: FastifyRequest, response: FastifyReply): void {
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
}
