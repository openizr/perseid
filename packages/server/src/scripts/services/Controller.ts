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
  type IdSchema,
  type FieldSchema,
  type ObjectSchema,
  type DefaultDataModel,
  type DataModelMetadata,
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
import type UsersEngine from 'scripts/services/UsersEngine';

const decoder = new TextDecoder();
const parseValueToInt = (value: string): number => parseInt(value, 10);

type FieldsTree = Record<string, Set<string> | undefined>;

/** Built-in endpoint type. */
export type EndpointType = 'search' | 'view' | 'list' | 'create' | 'update' | 'delete';

/** Build-in endpoint configuration. */
export interface BuiltInEndpoint {
  /** API route for this endpoint. */
  path: string;

  /** Maximum allowed level of resources depth for this endpoint. */
  maximumDepth?: number;
}

/** Built-in endpoints to register for a specific collection. */
export type CollectionBuiltInEndpoints = Partial<Record<EndpointType, BuiltInEndpoint>>;

/** List of all available built-in endpoints. */
export interface BuiltInEndpoints<DataModel> {
  auth: {
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
  /** Release version. Will be sent back along with responses through the "X-Api-Version" header. */
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
  Engine extends UsersEngine<DataModel> = UsersEngine<DataModel>,
> {
  /** Expired token error code. */
  protected readonly TOKEN_EXPIRED_CODE = 'TOKEN_EXPIRED';

  /** User not verified error code. */
  protected readonly NOT_VERIFIED_CODE = 'NOT_VERIFIED';

  /** Default value for requested fields. */
  protected readonly DEFAULT_REQUESTED_FIELDS: string[] = [];

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

  /**
   * Checks if all `requestedFields` are allowed to be fetched.
   *
   * @param requestedFields List of requested fields to check.
   *
   * @param allowedFields List of allowed fields.
   *
   * @returns  `true` if every requested field is present in `allowedFields`, `false` otherwise.
   */
  protected isAllowedToFetch(
    requestedFields: Set<string> | undefined,
    allowedFields: Set<string>,
  ): boolean {
    const requestedFieldsArray = [...(requestedFields ?? this.DEFAULT_REQUESTED_FIELDS)];
    for (let index = 0, { length } = requestedFieldsArray; index < length; index += 1) {
      if (!allowedFields.has(requestedFieldsArray[index])) {
        return false;
      }
    }
    return true;
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
    if (isPlainObject(output)) {
      return Object.keys(output as Record<string, unknown>)
        .reduce((formattedResource, key) => ({
          ...formattedResource,
          [key]: this.formatOutput((output as Record<string, unknown>)[key]),
        }), {});
    }
    if (output instanceof Id) {
      return output.toString();
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
   * Generates the requested fields tree from `fields`.
   *
   * @param collection Requested collection.
   *
   * @param fields List of requested fields.
   *
   * @return Requested fields tree and collections.
   */
  protected generateFieldsTreeFrom(
    collection: keyof DataModel | undefined,
    fields: string[],
  ): { requestedFieldsTree: FieldsTree; requestedCollections: Set<string>; } {
    const fieldsTree: FieldsTree = {};
    const requestedCollections = new Set<string>();
    const fillTree = (path: string, canonicalPath: string[]): void => {
      let currentPath = '';
      const currentCollection = canonicalPath.shift();
      const rootPath = path.replace(new RegExp(`.?${canonicalPath.join('.')}$`), '');
      while (canonicalPath.length > 0) {
        currentPath += (currentPath === '' ? '' : '.') + canonicalPath.shift();
        const subCanonicalPath = `${currentCollection}.${currentPath}`;
        fieldsTree[subCanonicalPath] ??= new Set<string>();
        fieldsTree[subCanonicalPath]?.add(rootPath + (rootPath === '' ? '' : '.') + currentPath);
      }
    };
    for (let index = 0, { length } = fields; index < length; index += 1) {
      if (!fields[index].endsWith('*')) {
        const fieldMetadata = this.model.get(`${collection as string}.${fields[index]}`);
        if (fieldMetadata === null) {
          throw new BadRequest('INVALID_FIELD', `Requested field "${fields[index]}" does not exist.`);
        }
        const { canonicalPath } = fieldMetadata as DataModelMetadata<FieldSchema<DataModel>>;
        requestedCollections.add(canonicalPath[0]);
        fillTree(fields[index], canonicalPath);
      } else {
        const pathWithoutStar = fields[index].slice(0, -2);
        const fullPath = `${collection as string}${fields[index] === '*' ? '' : `.${pathWithoutStar}`}`;
        let fieldMetadata = this.model.get(fullPath) as DataModelMetadata<FieldSchema<DataModel>>;
        if ((fieldMetadata as unknown) === null) {
          throw new BadRequest('INVALID_FIELD', `Requested field "${fields[index]}" does not exist.`);
        } else {
          const { relation } = fieldMetadata.schema as IdSchema<DataModel>;
          if (relation !== undefined) {
            fieldMetadata = this.model.get(relation) as DataModelMetadata<FieldSchema<DataModel>>;
          }
          const { canonicalPath } = fieldMetadata;
          requestedCollections.add(canonicalPath[0]);
          Object.keys((fieldMetadata.schema as ObjectSchema<DataModel>).fields).forEach((field) => {
            fillTree(pathWithoutStar, canonicalPath.concat([field]));
          });
        }
      }
    }

    return { requestedCollections, requestedFieldsTree: fieldsTree };
  }

  /**
   * Parses `query`. Built-in query params (`fields`, `sortBy`, `sortOrder`, `limit`, `offset`) will
   * be correctly formatted to match engine / database client specifications. Other (custom) params
   * will be left as is.
   *
   * @param query Request query params.
   *
   * @returns Parsed query params.
   */
  protected parseQuery(query: Record<string, string | null>): {
    fields?: string[];
    sortBy?: string[];
    sortOrder?: number[];
    [key: string]: unknown;
  } {
    const parsedQuery: Record<string, unknown> = {};
    Object.keys(query).forEach((key) => {
      const queryValue = query[key];
      if (key === 'fields' && queryValue !== null) {
        parsedQuery[key] = queryValue.split(',');
      } else if (key === 'sortBy' && queryValue !== null) {
        parsedQuery[key] = queryValue.split(',');
        parsedQuery.sortOrder = query.sortOrder?.split(',').map(this.parseInt) ?? [];
      } else if (key !== 'sortOrder') {
        parsedQuery[key] = queryValue;
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
   * @returns Parsed search body.
   */
  protected parseSearchBody(
    collection: keyof DataModel,
    body: SearchBody,
  ): SearchBody {
    const { query, filters } = body;
    let formattedFilters: SearchFilters | undefined;

    if (filters !== undefined) {
      formattedFilters = {};
      const filterFields = Object.keys(filters);
      for (let index = 0, { length } = filterFields; index < length; index += 1) {
        const path = filterFields[index];
        const fullPath = `${collection as string}.${path}`;
        const fieldMetadata = this.model.get(fullPath) as DataModelMetadata<FieldSchema<DataModel>>;
        const filterValue = (Array.isArray(filters[path]) ? filters[path] : [filters[path]]);
        if ((fieldMetadata as unknown) === null) {
          throw new BadRequest('INVALID_FIELD', `Requested field "${fullPath}" does not exist.`);
        }
        if (fieldMetadata.schema.type === 'id') {
          formattedFilters[path] = (filterValue as string[]).map((id) => new Id(`${id}`));
        } else if (fieldMetadata.schema.type === 'date') {
          formattedFilters[path] = (filterValue as string[]).map((date) => new Date(date));
        } else if (fieldMetadata.schema.type === 'float') {
          formattedFilters[path] = (filterValue as string[]).map(parseFloat);
        } else if (fieldMetadata.schema.type === 'integer') {
          formattedFilters[path] = (filterValue as string[]).map((value) => parseInt(value, 10));
        } else {
          formattedFilters[path] = filterValue as string[];
        }

        formattedFilters[path] = ((formattedFilters[path] as string[]).length === 1)
          ? (formattedFilters[path] as string[])[0]
          : formattedFilters[path];
      }
    }

    return { query, filters: formattedFilters };
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
        const message = `Resource with id "${error.details.id as string}" does not exist or has been deleted.`;
        throw new NotFound('NO_RESOURCE', message);
      }
      if (error instanceof DatabaseError && error.code === 'NO_RESOURCE') {
        const message = `Resource with id "${error.details.id as string}" does not exist or does not match required criteria.`;
        throw new NotFound('NO_RESOURCE', message);
      }
      if (error instanceof DatabaseError && error.code === 'DUPLICATE_RESOURCE') {
        const message = `Resource with field "${error.details.field as string}" set to "${error.details.value as string}" already exists.`;
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
        throw new BadRequest('INVALID_FIELD', `Requested field "${error.details.path as string}" does not exist.`);
      }
      if (error instanceof DatabaseError && error.code === 'INVALID_INDEX') {
        throw new BadRequest('INVALID_INDEX', `Requested field "${error.details.path as string}" is not indexed.`);
      }
      if (error instanceof DatabaseError && error.code === 'RESOURCE_REFERENCED') {
        throw new NotAcceptable('RESOURCE_REFERENCED', `Resource is still referenced in collection "${error.details.collection as string}".`);
      }
      if (error instanceof DatabaseError && error.code === 'MAXIMUM_DEPTH_EXCEEDED') {
        const message = `Maximum level of depth exceeded for field "${error.details.path as string}".`;
        throw new BadRequest('MAXIMUM_DEPTH_EXCEEDED', message);
      }
      throw error;
    }
  }

  /**
   * Checks that user has all necessary permissions to perform the given operation.
   *
   * @param payload Request payload, if applicable.
   *
   * @param options Request options.
   *
   * @param context Request context.
   *
   * @throws If user email address is not yet verified.
   *
   * @throws If user is missing any of the required permissions.
   */
  protected rbac(payload: unknown, _options: CommandOptions, context: CommandContext & {
    id?: Id | 'me';
    permissions: Set<string>;
    collection?: keyof DataModel;
    requestedFieldsTree: FieldsTree;
    requestedCollections: Set<string>;
    type?: 'SEARCH' | 'LIST' | 'CREATE' | 'UPDATE' | 'VIEW' | 'DELETE';
  }): void {
    const { _verifiedAt } = context.user;
    const fields = context.requestedFieldsTree;
    const allPermissions = new Set([...context.permissions]);

    if (context.collection !== undefined) {
      allPermissions.add(`${toSnakeCase(context.collection as string)}_${context.type}`);
    }

    context.requestedCollections.forEach((collection) => {
      allPermissions.add(`${toSnakeCase(collection)}_VIEW`);
    });

    // Unverified users cannot access resources.
    if (context.id === 'me') {
      allPermissions.delete('USERS_VIEW');
      allPermissions.delete('ROLES_VIEW');
    }
    if (_verifiedAt === null && allPermissions.size > 0) {
      const message = 'Please verify your email address before performing this operation.';
      throw new Forbidden(this.NOT_VERIFIED_CODE, message);
    }

    // Checking user's permissions on the given resources...
    allPermissions.forEach((permission) => {
      if (!context.user._permissions.has(permission)) {
        const message = `You are missing "${permission}" permission to perform this operation.`;
        throw new Forbidden('FORBIDDEN', message);
      }
    });

    // "*/me" endpoints on users collection are special in the way that a users can view
    // and update all their own information (except roles), but not others' ones.
    const allowedFields = new Set((context.id !== 'me')
      ? []
      : ['_devices', 'roles', '_apiKeys', '_verifiedAt']);
    if (
      context.collection === 'users'
      && !context.user._permissions.has('USERS_ROLES_VIEW')
      && !this.isAllowedToFetch(fields['users.roles'], allowedFields)
    ) {
      const message = 'You are missing "USERS_ROLES_VIEW" permission to perform this operation.';
      throw new Forbidden('FORBIDDEN', message);
    }
    if (
      context.collection === 'users'
      && !context.user._permissions.has('USERS_ROLES_UPDATE')
      && (payload as User | null)?.roles as unknown !== undefined
    ) {
      const message = 'You are missing "USERS_ROLES_UPDATE" permission to perform this operation.';
      throw new Forbidden('FORBIDDEN', message);
    }
    if (
      context.collection === 'users'
      && !context.user._permissions.has('USERS_AUTH_DETAILS_VIEW')
      && (
        !this.isAllowedToFetch(fields['users._devices'], allowedFields)
        || !this.isAllowedToFetch(fields['users._apiKeys'], allowedFields)
        || !this.isAllowedToFetch(fields['users._verifiedAt'], allowedFields)
      )
    ) {
      const message = 'You are missing "USERS_AUTH_DETAILS_VIEW" permission to perform this operation.';
      throw new Forbidden('FORBIDDEN', message);
    }
    if (context.collection === 'users' && fields['users.password'] !== undefined) {
      throw new Forbidden('FORBIDDEN', 'You are not allowed to perform this operation.');
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
