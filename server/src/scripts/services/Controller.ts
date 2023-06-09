/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  type User,
  toSnakeCase,
  type DateSchema,
  type FieldSchema,
  type ObjectSchema,
  type StringSchema,
  type UserPermissions,
  type DefaultDataModel,
  type CollectionSchema,
  type DataModelMetadata,
  type DynamicObjectSchema,
} from '@perseid/core';
import jwt from 'jsonwebtoken';
import { isPlainObject } from 'basx';
import Logger from 'scripts/services/Logger';
import NotFound from 'scripts/errors/NotFound';
import Conflict from 'scripts/errors/Conflict';
import EngineError from 'scripts/errors/Engine';
import Forbidden from 'scripts/errors/Forbidden';
import BadRequest from 'scripts/errors/BadRequest';
import type BaseModel from 'scripts/services/Model';
import DatabaseError from 'scripts/errors/Database';
import Unauthorized from 'scripts/errors/Unauthorized';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import type OAuthEngine from 'scripts/services/OAuthEngine';

const decoder = new TextDecoder();

/** Built-in endpoint type. */
export type EndpointType = 'search' | 'view' | 'list' | 'create' | 'update' | 'delete';

/** Built-in endpoints to register for a specific collection. */
export type CollectionBuiltInEndpoints = Partial<Record<EndpointType, BuiltInEndpoint>>;

/** Build-in endpoint configuration. */
export interface BuiltInEndpoint {
  /** API route for this endpoint. */
  path: string;

  /** Maximum allowed level of resources depth for this endpoint. */
  maximumDepth?: number;
}

/** List of all available built-in endpoints. */
export interface BuiltInEndpoints<DataModel> {
  oAuth: {
    signUp?: BuiltInEndpoint;
    signIn?: BuiltInEndpoint;
    signOut?: BuiltInEndpoint;
    verifyEmail?: BuiltInEndpoint;
    refreshToken?: BuiltInEndpoint;
    resetPassword?: BuiltInEndpoint;
    requestPasswordReset?: BuiltInEndpoint;
    requestEmailVerification?: BuiltInEndpoint;
  };
  collections: Partial<Record<keyof DataModel, CollectionBuiltInEndpoints>>;
}

/**
 * Controller settings.
 */
export interface ControllerSettings<DataModel> {
  /** Release version. Will be sent back along with responses through the "X-App-Release" header. */
  version: string;

  /** List of built-in endpoints to register. */
  endpoints: BuiltInEndpoints<DataModel>;
}

/**
 * Handles REST API calls.
 */
export default class Controller<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  Engine extends OAuthEngine<DataModel> = OAuthEngine<DataModel>,
> {
  /** Expired token error code. */
  protected readonly TOKEN_EXPIRED_CODE = 'TOKEN_EXPIRED';

  /** User not verified error code. */
  protected readonly NOT_VERIFIED_CODE = 'NOT_VERIFIED';

  /** Data model to use. */
  protected model: Model;

  /** Logging system to use. */
  protected logger: Logger;

  /** Engine to use. */
  protected engine: Engine;

  /** Release version. Will be sent back along with responses through the "X-App-Release" header. */
  protected version: string;

  /** List of built-in endpoints to register. */
  protected endpoints: BuiltInEndpoints<DataModel>;

  /**
   * Formats `output` to match fastify data types specifications.
   *
   * @param output Output to format.
   *
   * @returns Formatted output.
   */
  protected formatOutput(output: unknown): unknown {
    if (Array.isArray(output)) {
      return output.map(this.formatOutput);
    }
    if (isPlainObject(output)) {
      return Object.keys(output as Record<string, unknown>)
        .reduce((formattedResource, key) => ({
          ...formattedResource,
          [key]: this.formatOutput((output as Record<string, unknown>)[key]),
        }), {});
    }
    if (output instanceof Id) {
      return `${output}`;
    }
    if (output instanceof Date) {
      return output.toISOString();
    }
    if (output instanceof ArrayBuffer) {
      return decoder.decode(output);
    }
    return output;
  }

  /**
   * Generates the list of fields to fetch from `fields` query parameter.
   *
   * @param collection Requested collection.
   *
   * @param fields `fields` query parameter.
   *
   * @param permissions Optional parameter, use it to also extract permissions from requested
   * fields. If this parameter is passed, a list of required permissions will be generated and
   * stored in that variable. Defaults to `new Set()`.
   *
   * @return List of requested fields.
   */
  protected generateFieldsFrom(
    collection: keyof DataModel,
    fields: string,
    permissions = new Set(),
  ): string[] {
    const finalFields: Set<string> = new Set();
    const requestedFields = fields.split(',');
    const addPermission = permissions.add.bind(permissions);
    addPermission(`${toSnakeCase(collection as string)}_VIEW`);
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;

    for (let index = 0, { length } = requestedFields; index < length; index += 1) {
      let subPath = '';
      const path = requestedFields[index];
      const splittedPath = path.split('.');
      let currentModel: FieldSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };

      // Walking through the model...
      while (splittedPath.length > 0 && currentModel !== undefined) {
        subPath = splittedPath.shift() as string;
        if (splittedPath.length === 0 && subPath === '*') {
          break;
        } else {
          currentModel = (currentModel as ObjectSchema<DataModel>).fields?.[subPath];
          (currentModel as DateSchema)?.permissions?.forEach(addPermission);

          if (currentModel?.type === 'array') {
            currentModel = currentModel.fields;
            (currentModel as StringSchema).permissions?.forEach(addPermission);
          }
          if (currentModel?.type === 'id' && currentModel.relation !== undefined) {
            const { relation } = currentModel;
            addPermission(`${toSnakeCase(currentModel.relation as string)}_VIEW`);
            const data = this.model.get(relation) as DataModelMetadata<CollectionSchema<DataModel>>;
            currentModel = { type: 'object', fields: data.schema.fields };
          } else if (currentModel?.type === 'dynamicObject' && splittedPath.length > 0 && splittedPath[0] !== '*') {
            const subFields: DynamicObjectSchema<DataModel>['fields'] = currentModel.fields;
            const patterns = Object.keys(subFields).map((pattern) => new RegExp(pattern));
            const pattern = (patterns.find((p) => p.test(splittedPath[0])) as RegExp).source;
            currentModel = { type: 'object', fields: { [splittedPath[0]]: subFields[pattern] } };
          }
        }
      }

      // This part handles "*" notation in fields paths.
      if (currentModel !== undefined && subPath !== '*') {
        finalFields.add(path);
      } else if (currentModel?.type === 'dynamicObject') {
        finalFields.add(path.replace('.*', ''));
      } else if (currentModel?.type === 'object') {
        const keys = Object.keys(currentModel.fields);
        for (let i = 0, { length: keysLength } = keys; i < keysLength; i += 1) {
          (currentModel.fields[keys[i]] as StringSchema).permissions?.forEach(addPermission);
          finalFields.add(path.replace('*', keys[i]));
        }
      } else {
        finalFields.add(path);
      }
    }

    return [...finalFields];
  }

  /**
   * Formats search `filters`.
   *
   * @param collection Requested collection.
   *
   * @param filters Search filters.
   *
   * @param permissions Optional parameter, use it to also extract permissions from filters.
   * If this parameter is passed, a list of required permissions will be generated and
   * stored in that variable. Defaults to `new Set()`.
   *
   * @return Formatted search filters.
   */
  protected formatSearchFilters(
    collection: keyof DataModel,
    filters: SearchFilters,
    permissions = new Set(),
  ): SearchFilters {
    const filterFields = Object.keys(filters);
    const formattedFilters: SearchFilters = {};
    const addPermission = permissions.add.bind(permissions);
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    for (let index = 0, { length } = filterFields; index < length; index += 1) {
      let subPath = '';
      const path = filterFields[index];
      const splittedPath = path.split('.');
      let currentModel: FieldSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };

      // Walking through the model...
      while (splittedPath.length > 0 && currentModel !== undefined) {
        subPath = splittedPath.shift() as string;
        currentModel = (currentModel as ObjectSchema<DataModel>).fields?.[subPath];
        (currentModel as StringSchema)?.permissions?.forEach(addPermission);

        if (currentModel?.type === 'array') {
          currentModel = currentModel.fields;
          (currentModel as StringSchema).permissions?.forEach(addPermission);
        }
        if (currentModel?.type === 'id' && currentModel.relation !== undefined && splittedPath.length > 0) {
          const { relation } = currentModel;
          permissions.add(`${toSnakeCase(currentModel.relation as string)}_VIEW`);
          const data = this.model.get(relation) as DataModelMetadata<CollectionSchema<DataModel>>;
          currentModel = { type: 'object', fields: data.schema.fields };
        } else if (currentModel?.type === 'dynamicObject' && splittedPath.length > 0 && splittedPath[0] !== '*') {
          const subFields: DynamicObjectSchema<DataModel>['fields'] = currentModel.fields;
          const patterns = Object.keys(subFields).map((pattern) => new RegExp(pattern));
          const pattern = (patterns.find((p) => p.test(splittedPath[0])) as RegExp).source;
          currentModel = { type: 'object', fields: { [splittedPath[0]]: subFields[pattern] } };
        }
      }

      const filterValue = Array.isArray(filters[path]) ? filters[path] : [filters[path]];
      if (currentModel?.type === 'id') {
        formattedFilters[path] = (filterValue as string[]).map((id) => new Id(`${id}`));
      } else if (currentModel?.type === 'date') {
        formattedFilters[path] = (filterValue as string[]).map((date) => new Date(date as string));
      } else if (currentModel?.type === 'float') {
        formattedFilters[path] = (filterValue as string[]).map(parseFloat);
      } else if (currentModel?.type === 'integer') {
        formattedFilters[path] = (filterValue as string[]).map((value) => parseInt(value, 10));
      } else {
        formattedFilters[path] = filterValue as string[];
      }

      formattedFilters[path] = ((formattedFilters[path] as string[]).length === 1)
        ? (formattedFilters[path] as string[])[0]
        : formattedFilters[path];
    }

    return formattedFilters;
  }

  /**
   * Parses `query`. Built-in query params (`fields`, `sortBy`, `sortOrder`, `limit`, `offset`) will
   * be correctly formatted to match engine / database client specifications. Other (custom) params
   * will be left as is.
   *
   * @param collection Name of the collection for which to parse query params.
   *
   * @param query Request query params.
   *
   * @param permissions Optional parameter, use it to also extract permissions from requested
   * fields. If this parameter is passed, a list of required permissions will be generated and
   * stored in that variable. Defaults to `new Set()`.
   *
   * @returns Parsed query params.
   */
  protected parseQuery(
    collection: keyof DataModel,
    query: Record<string, string>,
    permissions = new Set(),
  ): {
    fields?: string[];
    sortBy?: string[];
    sortOrder?: number[];
    [key: string]: unknown | number | string | string[];
  } {
    const parsedQuery: Record<string, unknown> = {};
    Object.keys(query).forEach((key) => {
      if (key === 'fields' && query[key] !== null) {
        parsedQuery[key] = this.generateFieldsFrom(collection, query[key], permissions);
      } else if (key === 'sortBy' && query[key] !== null) {
        parsedQuery[key] = this.generateFieldsFrom(collection, query[key], permissions);
        parsedQuery.sortOrder = query.sortOrder?.split(',').map((o) => parseInt(o, 10)) ?? [];
      } else if (key !== 'sortOrder') {
        parsedQuery[key] = query[key];
      }
    });
    return parsedQuery;
  }

  /**
   * Parses search `body`.
   *
   * @param collection Requested collection.
   *
   * @param body Search body to parse.
   *
   * @param permissions Optional parameter, use it to also extract permissions from search body.
   * If this parameter is passed, a list of required permissions will be generated and
   * stored in that variable. Defaults to `new Set()`.
   *
   * @returns Parsed search body.
   */
  public parseSearchBody(
    collection: keyof DataModel,
    body: SearchBody,
    permissions = new Set(),
  ): SearchBody {
    const { query, filters } = body;

    return {
      query: (query === undefined)
        ? undefined
        : {
          text: query.text,
          on: this.generateFieldsFrom(collection, query.on.join(','), permissions),
        },
      filters: (filters === undefined)
        ? undefined
        : this.formatSearchFilters(collection, filters, permissions),
    };
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
      if (error instanceof jwt.TokenExpiredError) {
        throw new Unauthorized(this.TOKEN_EXPIRED_CODE, 'Access token has expired.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Unauthorized('INVALID_TOKEN', 'Invalid access token.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_DEVICE_ID') {
        throw new Unauthorized('INVALID_DEVICE_ID', 'Invalid device id.');
      }
      if (error instanceof EngineError && error.code === 'NO_RESOURCE') {
        const message = `Resource with id "${error.details.id}" does not exist or has been deleted.`;
        throw new NotFound('NO_RESOURCE', message);
      }
      if (error instanceof DatabaseError && error.code === 'NO_RESOURCE') {
        const message = `Resource with id "${error.details.id}" does not exist or does not match required criteria.`;
        throw new NotFound('NO_RESOURCE', message);
      }
      if (error instanceof DatabaseError && error.code === 'DUPLICATE_RESOURCE') {
        const message = `Resource with field "${error.details.field}" set to "${error.details.value}" already exists.`;
        throw new Conflict('RESOURCE_EXISTS', message);
      }
      if (error instanceof EngineError && error.code === 'NO_USER') {
        throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
      }
      if (error instanceof EngineError && error.code === 'INVALID_CREDENTIALS') {
        throw new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.');
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
      if (error instanceof EngineError && error.code === 'PASSWORDS_MISMATCH') {
        throw new BadRequest('PASSWORDS_MISMATCH', 'Passwords mismatch.');
      }
      if (error instanceof EngineError && error.code === 'EMAIL_ALREADY_VERIFIED') {
        throw new NotAcceptable('EMAIL_ALREADY_VERIFIED', 'User email is already verified.');
      }
      if (error instanceof DatabaseError && error.code === 'INVALID_FIELD') {
        throw new BadRequest('INVALID_FIELD', `Requested field "${error.details.path}" does not exist.`);
      }
      if (error instanceof DatabaseError && error.code === 'INVALID_INDEX') {
        throw new BadRequest('INVALID_INDEX', `Requested field "${error.details.path}" is not indexed.`);
      }
      if (error instanceof DatabaseError && error.code === 'RESOURCE_REFERENCED') {
        throw new NotAcceptable('RESOURCE_REFERENCED', `Resource is still referenced in collection "${error.details.collection}".`);
      }
      if (error instanceof DatabaseError && error.code === 'MAXIMUM_DEPTH_EXCEEDED') {
        const message = `Maximum level of depth exceeded for field "${error.details.path}".`;
        throw new BadRequest('MAXIMUM_DEPTH_EXCEEDED', message);
      }
      throw error;
    }
  }

  /**
   * Checks that `user` has all `permissions`.
   *
   * @param user User to check permissions for.
   *
   * @param permissions List of permissions that user must have.
   *
   * @throws If user email address is not yet verified.
   *
   * @throws If user is missing any of the required permissions.
   */
  protected rbac(user: User, permissions: string[]): void {
    const { _verifiedAt } = user;

    // Unverified users cannot access resources.
    if (_verifiedAt === null && permissions.length > 0) {
      const message = 'Please verify your email address before performing this operation.';
      throw new Forbidden(this.NOT_VERIFIED_CODE, message);
    }

    // Checking user's permissions on the given resources...
    for (let index = 0, { length } = permissions; index < length; index += 1) {
      if (!(<UserPermissions>user._permissions)[permissions[index]]) {
        const message = `You are missing "${permissions[index]}" permission to perform this operation.`;
        throw new Forbidden('FORBIDDEN', message);
      }
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
  }
}
