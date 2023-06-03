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
  type UserPermissions,
  type DataModel as DefaultTypes,
} from '@perseid/core';
import jwt from 'jsonwebtoken';
import Logger from 'scripts/services/Logger';
import NotFound from 'scripts/errors/NotFound';
import Conflict from 'scripts/errors/Conflict';
import EngineError from 'scripts/errors/Engine';
import Forbidden from 'scripts/errors/Forbidden';
import type BaseModel from 'scripts/common/Model';
import BadRequest from 'scripts/errors/BadRequest';
import DatabaseError from 'scripts/errors/Database';
import Unauthorized from 'scripts/errors/Unauthorized';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import type OAuthEngine from 'scripts/services/OAuthEngine';

/** Built-in endpoint type. */
export type EndpointType = 'search' | 'view' | 'list' | 'create' | 'update' | 'delete';

/** Built-in endpoints to register for a specific collection. */
export type CollectionBuiltInEndpoints = Record<EndpointType, BuiltInEndpoint>;

/** Build-in endpoint configuration. */
export interface BuiltInEndpoint {
  /** API route for this endpoint. */
  path: string;

  /** Maximum allowed level of resources depth for this endpoint. */
  maximumDepth?: number;
}

/** List of all available built-in endpoints. */
export interface BuiltInEndpoints<Types> {
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
  collections: Partial<Record<keyof Types, CollectionBuiltInEndpoints>>;
}

/**
 * Controller settings.
 */
export interface ControllerSettings<Types> {
  /** Release version. Will be sent back along with responses through the "X-App-Release" header. */
  version: string;

  /** List of built-in endpoints to register. */
  endpoints: BuiltInEndpoints<Types>;
}

/**
 * Handles REST API calls.
 */
export default class Controller<
  /** Data model types definitions. */
  Types extends DefaultTypes = DefaultTypes,

  /** Model class types definitions. */
  Model extends BaseModel<Types> = BaseModel<Types>,

  /** Database client types definition. */
  Engine extends OAuthEngine<Types> = OAuthEngine<Types>,
> {
  /** Expired token error code. */
  protected readonly TOKEN_EXPIRED_CODE = 'TOKEN_EXPIRED';

  /** User not verified error code. */
  protected readonly NOT_VERIFIED_CODE = 'NOT_VERIFIED';

  /** Capital character token regexp. */
  protected readonly CAPITAL_TOKEN = /([A-Z])/g;

  /** Data model to use. */
  protected model: Model;

  /** Logging system to use. */
  protected logger: Logger;

  /** Engine to use. */
  protected engine: Engine;

  /** Release version. Will be sent back along with responses through the "X-App-Release" header. */
  protected version: string;

  /** List of built-in endpoints to register. */
  protected endpoints: BuiltInEndpoints<Types>;

  /**
   * Transforms `value` into SNAKE_CASE.
   *
   * @param value Value to transform.
   *
   * @returns Transformed value.
   */
  protected toSnakeCase(value: string): string {
    return (value.match(this.CAPITAL_TOKEN) ?? [] as string[]).reduce((match, char: string) => (
      match.replace(new RegExp(char), `_${char}`)
    ), value).toUpperCase();
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
    collection: keyof Types,
    fields: string,
    permissions = new Set(),
  ): string[] {
    const finalFields: Set<string> = new Set();
    const requestedFields = fields.split(',');
    const addPermission = permissions.add.bind(permissions);
    addPermission(`${(collection as string).toUpperCase()}_VIEW`);
    const { fields: collectionFields } = this.model.getCollection(collection);
    const model: FieldDataModel<Types> = { type: 'object', fields: collectionFields };

    for (let index = 0, { length } = requestedFields; index < length; index += 1) {
      let subPath = '';
      const path = requestedFields[index];
      const splittedPath = path.split('.');
      let currentModel: FieldDataModel<Types> = model;

      // Walking through the model...
      while (splittedPath.length > 0 && currentModel !== undefined) {
        subPath = splittedPath.shift() as string;
        if (splittedPath.length === 0 && subPath === '*') {
          break;
        } else {
          currentModel = (currentModel as ObjectDataModel<Types>).fields?.[subPath];
          (currentModel as DateDataModel)?.permissions?.forEach(addPermission);

          if (currentModel?.type === 'array') {
            currentModel = currentModel.fields;
            (currentModel as StringDataModel).permissions?.forEach(addPermission);
          }
          if (currentModel?.type === 'id' && currentModel.relation !== undefined) {
            addPermission(`${this.toSnakeCase(currentModel.relation as string)}_VIEW`);
            currentModel = { type: 'object', fields: this.model.getCollection(currentModel.relation).fields };
          } else if (currentModel?.type === 'dynamicObject' && splittedPath.length > 0 && splittedPath[0] !== '*') {
            const subFields: DynamicObjectDataModel<Types>['fields'] = currentModel.fields;
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
          (currentModel.fields[keys[i]] as StringDataModel).permissions?.forEach(addPermission);
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
    collection: keyof Types,
    filters: SearchFilters,
    permissions = new Set(),
  ): SearchFilters {
    const filterFields = Object.keys(filters);
    const formattedFilters: SearchFilters = {};
    const addPermission = permissions.add.bind(permissions);
    const { fields: collectionFields } = this.model.getCollection(collection);
    const model: FieldDataModel<Types> = { type: 'object', fields: collectionFields };

    for (let index = 0, { length } = filterFields; index < length; index += 1) {
      let subPath = '';
      const path = filterFields[index];
      const splittedPath = path.split('.');
      let currentModel: FieldDataModel<Types> = model;

      // Walking through the model...
      while (splittedPath.length > 0 && currentModel !== undefined) {
        subPath = splittedPath.shift() as string;
        currentModel = (currentModel as ObjectDataModel<Types>).fields?.[subPath];
        (currentModel as StringDataModel)?.permissions?.forEach(addPermission);

        if (currentModel?.type === 'array') {
          currentModel = currentModel.fields;
          (currentModel as StringDataModel).permissions?.forEach(addPermission);
        }
        if (currentModel?.type === 'id' && currentModel.relation !== undefined && splittedPath.length > 0) {
          permissions.add(`${this.toSnakeCase(currentModel.relation as string)}_VIEW`);
          currentModel = { type: 'object', fields: this.model.getCollection(currentModel.relation).fields };
        } else if (currentModel?.type === 'dynamicObject' && splittedPath.length > 0 && splittedPath[0] !== '*') {
          const subFields: DynamicObjectDataModel<Types>['fields'] = currentModel.fields;
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
    collection: keyof Types,
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
    collection: keyof Types,
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
        const message = `Resource with id "${error.details.id}" does not exist or has been deleted.`;
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
      if (error instanceof EngineError && error.code === 'EMAIL_ALREADY_VERIFIED') {
        throw new NotAcceptable('EMAIL_ALREADY_VERIFIED', 'User email is already verified.');
      }
      if (error instanceof DatabaseError && error.code === 'INVALID_FIELD') {
        throw new BadRequest('INVALID_FIELD', `Requested field "${error.details.path}" does not exist.`);
      }
      if (error instanceof DatabaseError && error.code === 'INVALID_INDEX') {
        throw new BadRequest('INVALID_INDEX', `Requested field "${error.details.path}" is not indexed.`);
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
    settings: ControllerSettings<Types>,
  ) {
    this.model = model;
    this.logger = logger;
    this.engine = engine;
    this.version = settings.version;
    this.endpoints = settings.endpoints;
  }
}
