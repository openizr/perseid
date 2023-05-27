/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Document, MongoClient, Db } from 'mongodb';
import {
  type Id,
  type User,
  type Ids,
  type Authors,
  type Version,
  type Deletion,
  type DataModel,
  type Timestamps,
  type Logger as BaseLogger,
} from '@perseid/core';
import { Stream } from 'stream';
import { pino, type Logger as PinoLogger } from 'pino';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

interface Details { [key: string]: unknown; }
export type EndpointHandler = (request: FastifyRequest, response: FastifyReply) => Promise<void>;

/**
 * Generic HTTP error.
 */
export class HttpError extends Error {
  public code: string | number;

  constructor(code: string | number, message: string);
}

/**
 * Creates a new Ajv schema from `model`.
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
type CreateSchema = (
  collection: string,
  model: FieldsModel,
  isPartial?: boolean,
  isResponse?: boolean,
) => any;

/**
 * Catches and handles most common API errors thrown by `handler`.
 *
 * @param handler Fastify endpoint handler to wrap.
 *
 * @returns Wrapped handler.
 */
type CatchErrors = (handler: EndpointHandler) => EndpointHandler;

/**
 * Automatically registers hooks, handlers, oAuth and CRUD-related endpoints to `server`.
 *
 * @param server Fastify inIdstance to register endpoints to.
 *
 * @param captureError Errors logging function to use for monitoring.
 *
 * @param extraOAuthEndpoints Callback registering additional endpoints in the oAuth scope.
 *
 * @param extraRbacEndpoints Callback registering additional endpoints in the RBAC scope.
 */
type RegisterEndpoints = (
  server: FastifyInstance,
  logger: Logger,
  extraOAuthEndpoints?: ((app: FastifyInstance) => void) | null,
  extraRbacEndpoints?: ((app: FastifyInstance) => void) | null,
) => void;

/**
 * Perseid server library (helpers, services, and components).
 */
interface PerseidServer {
  catchErrors: CatchErrors;
  createSchema: CreateSchema;
  registerEndpoints: RegisterEndpoints;
}

/**
 * Initializes perseid.
 *
 * @param model perseid model.
 *
 * @param configuration Perseid server configuration.
 *
 * @param services Services to use in library.
 *
 * @returns Initialized server library.
 */
export function initialize(
  model: Model,
  configuration: ServerConfiguration,
  services: any,
): PerseidServer;

/**
 * Perseid server configuration.
 */
export interface ServerConfiguration {
  maxDepth?: number;
  version?: string;
  rootUser?: {
    email: string;
    password: string;
  };
  endpoints?: {
    signIn?: { path: string; };
    signUp?: { path: string; };
    signOut?: { path: string; };
    verifyEmail?: { path: string; };
    refreshToken?: { path: string; };
    resetPassword?: { path: string; };
    requestVerifyEmail?: { path: string; };
    requestPasswordReset?: { path: string; };
    view?: { [collection: string]: { path: string; }; };
    list?: { [collection: string]: { path: string; }; };
    create?: { [collection: string]: { path: string; }; };
    delete?: { [collection: string]: { path: string; }; };
    update?: { [collection: string]: { path: string; }; };
    search?: { [collection: string]: { path: string; }; };
  };
}

/**
 * Cache client.
 */
export interface Cache {
  /**
   * Deletes cached data stored at `key`.
   *
   * @param key Key containing cached data.
   */
  delete(key: string): Promise<void>;

  /**
   * Fetches cached data stored at `key`.
   *
   * @param key Key containing cached data.
   *
   * @returns Cached data if it exists, `null` otherwise.
   */
  get(key: string): Promise<(string | null)>;

  /**
   * Stores `data` in cache, at `key`.
   *
   * @param key Key to store data at.
   *
   * @param data Data to store in cache.
   *
   * @param duration Duration, in seconds, for which to keep data in cache.
   */
  set(key: string, data: unknown, duration: number): Promise<void>;
}

/**
 * Email options.
 */
export interface EmailOptions {
  /** List of recipients to send email to. */
  to: string[];

  /** Variables to inject in email template. */
  variables: Record<string, unknown>;
}

/**
 * Default email client.
 */
export class EmailClient {
  /** Verification request email's content. */
  private verifyEmailMessage: string;

  /** User invite request email's content. */
  private inviteEmailMessage: string;

  /**
   * Sends a verification email with `options`.
   *
   * @param options Email options.
   */
  public sendVerifyEmail(options: EmailOptions): Promise<void>;

  /**
   * Sends a user invite email with `options`.
   *
   * @param options Email options.
   */
  public sendInviteEmail(options: EmailOptions): Promise<void>;
}

/**
 * Engine error.
 */
export class EngineError extends Error {
  /** Error code. */
  public code: string;

  /** Error details. */
  public details: Details;

  /**
   * Class constructor.
   *
   * @param code Error code.
   *
   * @param details Error details.
   */
  constructor(code: string, details?: Details);
}

/**
 * Database error.
 */
export class DatabaseError extends Error {
  /** Error code. */
  public code: string;

  /** Error details. */
  public details: Details;

  /**
   * Class constructor.
   *
   * @param code Error code.
   *
   * @param details Error details.
   */
  constructor(code: string, details?: Details);
}

/**
 * HTTP 400 error.
 */
export class BadRequest extends HttpError { }

/**
 * HTTP 409 error.
 */
export class Conflict extends HttpError { }

/**
 * HTTP 403 error.
 */
export class Forbidden extends HttpError { }

/**
 * HTTP 410 error.
 */
export class Gone extends HttpError { }

/**
 * HTTP 406 error.
 */
export class NotAcceptable extends HttpError { }

/**
 * HTTP 404 error.
 */
export class NotFound extends HttpError { }

/**
 * HTTP 413 error.
 */
export class RequestEntityTooLarge extends HttpError { }

/**
 * HTTP 429 error.
 */
export class TooManyRequests extends HttpError { }

/**
 * HTTP 401 error.
 */
export class Unauthorized extends HttpError { }

/**
 * HTTP 422 error.
 */
export class UnprocessableEntity extends HttpError { }

/**
 * Captures the given error.
 *
 * @param level Error level.
 *
 * @param error Error to capture.
 *
 * @param distinctId Unique id used to (anonymously) identify user.
 */
export type CaptureError = (level: ErrorLevel, error: unknown, distinctId?: string) => void;

/** Possible error levels to log. */
export type ErrorLevel = 'info' | 'error' | 'fatal';

/** Monitoring system settings. */
export interface MonitoringSettings {
  /** Current app environment. */
  environment: string;

  /** Default ID to use to identify log. */
  defaultId: string;

  /** Name of the source to flag log with (e.g. "backend", "web", "mobile-app", ...). */
  source: string;
}

/**
 * Cache client.
 */
export class CacheClient {
  /** Cache file path. */
  private cachePath: string;

  /**
   * Deletes cached data stored at `key`.
   *
   * @param key Key containing cached data.
   */
  public delete(key: string): Promise<void>;

  /**
   * Fetches cached data stored at `key`.
   *
   * @param key Key containing cached data.
   *
   * @returns Cached data if it exists, `null` otherwise.
   */
  public get(key: string): Promise<(string | null)>;

  /**
   * Stores `data` in cache, at `key`.
   *
   * @param key Key to store data at.
   *
   * @param data Data to store in cache.
   *
   * @param duration Duration, in seconds, for which to keep data in cache.
   */
  public set(key: string, data: unknown, duration: number): Promise<void>;
}

/**
 * Database results.
 */
export interface Results<T> {
  /** Total number of results that match given query. */
  total: number;

  /** Limited list of results that are actually returned. */
  results: T[];
}

/**
   * Database client settings.
   */
export interface DatabaseClientSettings {
  protocol: string;
  host: string;
  port: number | null;
  user: string | null
  password: string | null
  database: string
  maxPoolSize: number;
  connectTimeout: number;
  connectionLimit: number;
  queueLimit: number;
  cacheDuration: number;
}

/**
 * MongoDB database client.
 */
export class DatabaseClient<T = DataModel> {
  protected removeDeletedFilter: Document[];

  /** Default pagination offset value. */
  protected DEFAULT_OFFSET: number;

  /** Default pagination limit value. */
  protected DEFAULT_LIMIT: number;

  /** Default query options. */
  protected defaultOptions: CommandOptions;

  /** Logging system. */
  protected logger: Logger;

  /** Cache client, used to cache query results. */
  protected cache: CacheClient;

  /** Cache duration, in seconds. */
  protected cacheDuration: number;

  /** MongoDB client instance. */
  protected client: MongoClient;

  /** MongoDB database instance. */
  protected database: Db;

  /** Perseid data model to use. */
  protected model: Model;

  /** Whether MongoDB client is connected to the server. */
  protected isConnected: boolean;

  /** Used to compute total number of results for a given query. */
  protected totalPipeline: Document[];

  /**
   * Formats `input` to match MongoDB data types specifications.
   *
   * @returns MongoDB formatted document.
   */
  protected formatInput(input: Document): Document;

  /**
   * Formats `output` to match database-independent data types specifications.
   *
   * @returns Formatted document.
   */
  protected formatOutput<OutputType = Document>(output: Document): OutputType;

  /**
   * Generates MongoDB-flavored list of fields to project in results, from `fields`.
   *
   * @param collection Collection from which projections will be performed.
   *
   * @param {string[]} fields List of fields to project.
   *
   * @returns {Projections} MongoDB projections object.
   */
  protected generateProjectionsFrom<U extends keyof T>(_collection: U, fields: string[]): any;

  /**
   * Generates MongoDB `$lookup`s pipeline from `projections`.
   *
   * @param {FieldsModel} model Model to generate pipeline from.
   *
   * @param {Projections} projections Fields projections from which to generate pipeline.
   *
   * @param {string} [path?: string] Current path in model. Used internally to handle nested fields.
   *
   * @returns {Document[]} Generated `$lookup`s pipeline.
   */
  protected generateLookupsPipeline(model: any,
    projections: any,
    path?: string, arr?: boolean, nestedArr?: boolean): Document[];

  /**
   * Generates MongoDB `$sort` pipeline from `sortBy` and `sortOrder`.
   *
   * @param sortBy List of fields' paths to sort results by.
   *
   * @param sortOrder Sorting orders (asc/desc) for each field path.
   *
   * @returns {Document[]} Generated `$sort` pipeline.
   */
  protected generateSortingPipeline(sortBy?: CommandOptions['sortBy'], sortOrder?: CommandOptions['sortOrder']): Document[];

  /**
   * Generates MongoDB `$skip` and `$limit` pipeline from `offset` and `limit`.
   *
   * @param {number} offset Pagination offset.
   *
   * @param {number} limit Maximum number of results to fetch.
   *
   * @returns {Document[]} Generated pagination pipeline.
   */
  protected generatePaginationPipeline(offset?: number, limit?: number): Document[];

  /**
   * Generates MongoDB search pipeline from `fields`.
   *
   * @param {string} collection Collection for which to generate search pipeline.
   *
   * @param {Query | null} query Search query.
   *
   * @param {Filters | null} filters Search filters.
   *
   * @returns {(Document | null)[]} Generated search pipeline.
   */
  protected generateSearchPipeline<U extends keyof T>(
    collection: U,
    query: SearchQuery | null,
    filters: SearchFilters | null,
  ): (Document | null)[];

  /**
   * Connects database client to the MongoDB server before performing any query.
   *
   * @returns {Promise<void>}
   */
  protected handleConnection(): Promise<void>;

  /**
   * Checks that `collection` exists in model.
   *
   * @param name Name of the collection to check.
   *
   * @throws If collection does not exist in model.
   */
  protected checkModelCollection(name: string): void;

  /**
   * Makes sure that `collection` exists in model.
   *
   * @param collection Name of the collection to check.
   *
   * @throws {DatabaseError} If collection does not exist in model.
   */
  protected checkCollection<U extends keyof T>(collection: U): void;

  /**
   * Class constructor.
   *
   * @param {CacheClient} logger TODO Cache client instance to use for results caching.
   *
   * @param {CacheClient} cache Cache client instance to use for results caching.
   *
   * @param {DatabaseClientSettings} settings Database client settings.
   */
  public constructor(
    model: Model,
    logger: Logger,
    cache: CacheClient,
    settings: DatabaseClientSettings,
  );

  public getDatabase(): Db;

  /**
   * Fetches a paginated list of resources from `collection`, that match specific filters/query.
   *
   * @param collection Collection to fetch resources from.
   *
   * @param body Search/filters body.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public search<U extends keyof T>(
    collection: U,
    body: SearchBody,
    options?: CommandOptions,
  ): Promise<Results<T[U]>>;

  // eslint-disable-next-line
  protected fillMissingFields(fields: string[], resource: Document): Document;

  /**
   * Fetches a paginated list of resources from `collection`.
   *
   * @param collection Name of the collection for which to fetch resources.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public list<U extends keyof T>(
    collection: U,
    options?: CommandOptions,
  ): Promise<Results<T[U]>>;

  /**
   * Inserts `resource` into `collection`.
   *
   * @param collection Name of the collection to insert resource into.
   *
   * @param resource New resource to insert.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @throws If new resource violates a unique index rule.
   */
  public create<U extends keyof T>(
    collection: U,
    newValues: T[U],
  ): Promise<void>;

  /**
   * Fetches resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to fetch resources from.
   *
   * @param id Id of the resource to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   */
  public view<U extends keyof T>(
    collection: U,
    id: Id,
    options?: CommandOptions,
  ): Promise<T[U] | null>;

  /**
   * Updates resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to update resource from.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   *
   * @returns Updated resource.
   *
   * @throws If updated resource violates a unique index rule.
   */
  public update<U extends keyof T>(
    collection: U,
    id: Id,
    payload: Partial<T[U]>,
  ): Promise<void>;

  /**
   * Updates resource matching `filters` from `collection`, using a write lock.
   *
   * @param collection Name of the collection to update resource from.
   *
   * @param filters Filters resource must match.
   *
   * @param payload Updated resource payload.
   *
   * @returns `true` if resource was updated, `false` otherwise.
   *
   * @throws If updated resource violates a unique index rule.
   */
  public exclusiveUpdate<U extends keyof T>(
    collection: U,
    filters: SearchFilters,
    payload: Partial<T[U]>,
  ): Promise<boolean>;

  /**
   * Deletes resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to delete resource from.
   *
   * @param id Resource id.
   *
   * @param payload Additional payload to update resource with in case of soft-deletion.
   * Defaults to `{}`.
   *
   * @returns `true` if resource has been successfully deleted, `false` otherwise.
   */
  public delete<U extends keyof T>(
    collection: U,
    id: Id,
    payload?: any,
  ): Promise<boolean>;

  protected formatters: Record<string, (
    field: any,
  ) => any>;

  public createSchema(
    fields: any,
    transformer?: (schema: any) => any,
    isRoot?: boolean,
  ): any;

  /**
   * Drops entire database`.
   */
  public dropDatabase(): Promise<void>;

  /**
   * Creates database.
   */
  public createDatabase(): Promise<void>;

  /**
   * Creates collection with name `name`.
   *
   * @param collection Name of the collection to create.
   */
  public resetCollection<U extends keyof T>(collection: U): Promise<void>;

  /**
   * Performs a validation schema update and a data migration on collection with name `name`.
   *
   * @param collection Name of the collection to update.
   */
  public updateCollection<U extends keyof T>(
    collection: U,
    migration?: any,
  ): Promise<void>;

  /**
   * Returns all indexed fields for `collection`.
   *
   * @param collection Name of the collection for which to get indexes.
   *
   * @returns Collection's indexed fields.
   */
  protected getCollectionIndexedFields(collection: string, path?: string, field?: any): any;

  /**
   * Drops `collection` from database.
   *
   * @param collection Name of the collection to drop from database.
   */
  public dropCollection(collection: string): Promise<void>;

  /**
   * Resets the whole underlying database, re-creating collections, indexes, and such.
   */
  public async reset(): Promise<void>;
}

interface GenericFieldModel {
  required?: boolean;
  permissions?: string[];
  dependencies?: string[];

  // // TODO remove
  // errorMessage?: {
  //   [errorType: string]: string;
  // };
}

interface StringFieldModel extends GenericFieldModel {
  type: 'string';
  index?: boolean;
  enum?: string[];
  default?: string;
  unique?: boolean;
  pattern?: string;
  maxLength?: number;
  minLength?: number;
}

interface NumberFieldModel extends GenericFieldModel {
  type: 'integer' | 'float';
  index?: boolean;
  enum?: number[];
  default?: number;
  unique?: boolean;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
}

interface BooleanFieldModel extends GenericFieldModel {
  type: 'boolean';
  index?: boolean;
  default?: boolean;
}

interface IdFieldModel extends GenericFieldModel {
  type: 'id';
  enum?: string[];
  index?: boolean;
  unique?: boolean;
  default?: string;
  relation?: string;
}

interface DateFieldModel extends GenericFieldModel {
  type: 'date';
  enum?: string[];
  index?: boolean;
  unique?: boolean;
  default?: string;
}

interface BinaryFieldModel extends GenericFieldModel {
  type: 'binary';
  default?: string;
}

interface ObjectFieldModel extends GenericFieldModel {
  type: 'object';
  fields?: FieldsModel;
  minProperties?: number;
  maxProperties?: number;
  patternProperties?: FieldsModel;
}

interface ArrayFieldModel extends GenericFieldModel {
  type: 'array';
  maxItems?: number;
  minItems?: number;
  fields: FieldModel;
  uniqueItems?: boolean;
}

interface CustomFieldModel extends GenericFieldModel {
  index?: boolean;
  unique?: boolean;
  required?: boolean;
  type: Exclude<string, 'array' | 'id' | 'string' | 'date' | 'binary' | 'object' | 'number' | 'boolean'>;
}

export type FieldModel = (
  CustomFieldModel |
  StringFieldModel |
  DateFieldModel |
  IdFieldModel |
  BinaryFieldModel |
  ObjectFieldModel |
  NumberFieldModel |
  BooleanFieldModel |
  ArrayFieldModel
);

export interface ModelWithMetadata {
  realPath: string;
  collection: string;
  expandPaths: string[];
  permissions: string[];
  canonicalPath: string;
  realExpandPaths: string[];
  model: CollectionModel | FieldModel | Model;
}

export interface FieldsModel {
  [fieldName: string]: FieldModel;
}

export interface CollectionModel {
  fields: FieldsModel;
  version?: number;
  enableAuthors?: boolean;
  enableDeletion?: boolean;
  enableTimestamps?: boolean;
}

export interface CollectionsModel {
  [collection: string]: CollectionModel;
}

export interface ModelSchema {
  realPath?: string;
  canonicalPath?: string;
  types: {
    [type: string]: FieldModel;
  };
  collections: CollectionsModel;
}

export class Controller<EngineType extends OAuthEngine = OAuthEngine> {
  protected model: Model;

  protected engine: EngineType;

  protected maxDepth: number;

  public constructor(model: Model, engine: EngineType, settings: any);

  /**
   * Catches and handles most common API errors thrown by `callback`.
   *
   * @param callback Callback to wrap.
   *
   * @returns Wrapped callback.
   */
  // eslint-disable-next-line
  public catchErrors<T>(callback: () => Promise<T>): Promise<T>;

  protected buildPermissionsTree(searchBody: SearchBody): Promise<User>;

  public oAuth(
    headers: Record<string, string | string[] | undefined>,
    ignoreExpiration?: boolean,
  ): Promise<User>;

  // eslint-disable-next-line
  public rbac(user: User, requiredPermissions: string[]): void;

  protected createPaths(
    collections: string[],
    fields: any,
    subPaths: string[],
    prefix: string[],
  ): {
    paths: string[];
    collections: string[];
  };

  public parseSearchBody(collection: string, body: any): any;

  public parseQuery(
    collection: string,
    query: Record<string, unknown>,
    parseSortBy?: boolean,
    parseFields?: boolean,
  ): {
    fields?: string[];
    sortBy?: string[];
    sortOrder?: number[];
    _requiredPermissions?: string[];
    [key: string]: unknown | number | string | string[];
  };

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

  protected formatters: any;

  public createSchema(
    currentModel: any,
    type?: string,
    transformer?: (schema: any) => any,
    isRoot?: boolean,
  ): any;
}
interface OAuthConfiguration {
  issuer: string;
  algorithm: 'RS256';
  clientId: string;
  privateKey: string;
  publicKey: string;
}

//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
/**
 * Data model.
 */
export class Model {
  /** Generated data model. */
  protected model: ModelSchema;

  /**
   * Class constructor.
   *
   * @param schema Schema from which to generate model.
   */
  constructor(schema: ModelSchema);

  /**
   * Returns the data model for `path`.
   *
   * @param path Data model path to introspect.
   *
   * @param inferTypes Whether to infer types using model's `types` definitions. Defaults to `true`.
   *
   * @returns Path's data model if it exists, `null` otherwise.
   */
  public get(path?: string, inferTypes?: boolean): ModelWithMetadata | null;
}

export class Engine<
  T = DataModel,
  M extends Model = Model,
  D extends DatabaseClient<T> = DatabaseClient<T>,
> {
  protected model: M;

  protected logger: Logger;

  protected databaseClient: D;

  protected generateAutomaticFields<U extends keyof T>(
    collection: U,
    context: CommandContext & { _id?: Id; },
    partial?: boolean,
  ): Ids & Authors & Timestamps & Deletion & Version;

  /**
   *
   * @param databaseClient
   * @param settings
   */
  constructor(
    model: M,
    logger: Logger,
    databaseClient: D,
  );

  /**
   * Creates a new resource into `collection`.
   *
   * @param collection Name of the collection to create resource into.
   *
   * @param payload New resource payload.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Newly created resource.
   */
  public create<U extends keyof T>(
    collection: U,
    payload: WithoutAutomaticFields<T[U]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<T[U]>;

  /**
   * Fetches resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to fetch resource from.
   *
   * @param id Resource id.
   *
   * @param options Command options.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public view<U extends keyof T>(
    collection: U,
    id: Id,
    options: CommandOptions,
  ): Promise<T[U]>;

  /**
   * Fetches a paginated list of resources from `collection`.
   *
   * @param collection Name of the collection to fetch resources from.
   *
   * @param options Command options.
   *
   * @returns Paginated list of resources.
   */
  public list<U extends keyof T>(
    collection: U,
    options: CommandOptions,
  ): Promise<Results<T[U]>>;

  /**
 * Fetches a paginated list of resources from `collection` according to given search options.
 *
 * @param collection Name of the collection to fetch resources from.
 *
 * @param search Search options (filters, text query) to filter resources with.
 *
 * @param options Command options.
 *
 * @returns Paginated list of resources.
 */
  public search<U extends keyof T>(
    collection: U,
    search: SearchBody,
    options: CommandOptions,
  ): Promise<Results<T[U]>>;

  /**
   * Updates resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to update resource from.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Updated resource.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public update<U extends keyof T>(
    collection: U,
    id: Id,
    payload: Partial<WithoutAutomaticFields<T[U]>>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<T[U]>;

  /**
   * Deletes resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to delete resource from.
   *
   * @param id Resource id.
   *
   * @param context Command context.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public delete<U extends keyof T>(
    collection: U,
    id: Id,
    context: CommandContext,
  ): Promise<void>;
}

export interface Credentials {
  deviceId: string;
  expiresIn: number;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiration: Date;
}

export interface EngineSettings {
  baseUrl: string;
  oAuth: OAuthConfiguration;
}
export class OAuthEngine<
  T = DataModel,
  M extends Model = Model,
  D extends DatabaseClient<T> = DatabaseClient<T>,
> extends Engine<T, M, D> {
  protected settings: EngineSettings;

  protected emailClient: EmailClient;

  protected cacheClient: CacheClient;

  /**
   *
   * @param emailClient
   * @param databaseClient
   * @param settings
   */
  constructor(
    model: M,
    logger: Logger,
    emailClient: EmailClient,
    cacheClient: CacheClient,
    databaseClient: D,
    settings: EngineSettings,
  );

  /**
   *
   * @param resource
   * @param context
   * @returns
   */
  public createUser(payload: User, context: any): Promise<User>;

  /**
   * Generates new OAuth credentials (refresh/access tokens) for `userId` and `deviceId`.
   *
   * @param userId Id of the user to generate credentials for.
   *
   * @param oAuthConfiguration OAuth configuration.
   *
   * @param deviceId Id of the device to generate credentials for. If not set, it will
   * generate a new device id.
   *
   * @returns New credentials.
   */
  public static generateCredentials(
    userId: Id,
    oAuthConfiguration: OAuthConfiguration,
    deviceId?: string,
  ): Credentials;

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public verifyToken(context: any): Promise<string>;

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public refreshToken(
    refreshToken: string,
    context: any,
  ): Promise<any>;

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public signIn(
    email: string,
    password: string,
    options: any,
    context: any,
  ): Promise<any>;

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public signOut({ userId, deviceId }: any): Promise<void>;

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public signUp(resource: any, context: any): Promise<any>;

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public requestPasswordReset(email: string): Promise<void>;

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public resetPassword({
    email,
    password,
    resetToken,
    passwordConfirmation,
  }: any): Promise<void>;

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public requestVerifyEmail(id: Id): Promise<void>;

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public verifyEmail({ userId, verifyToken }: any): Promise<void>;

  /**
   * Resets the whole system, including database, and re-creates root role and user.
   *
   * @param rootEmail Email to use for root user.
   *
   * @param rootPassword Password to use for root user.
   */
  public async reset(rootEmail: string, rootPassword: string): Promise<void>;
}

export interface OAuthParams {
  deviceId: string;
  loggedUser: User;
  loggedUserId: Id;
}
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
/**
 * Database search filters.
 * Each key is a field name, and its related value is the filter value.
 * For instance, to fetch only resources for which `firstField` is either `'a'`, `'b'` or `'c'`
 * and `secondField` is `42`, you should write the following:
 * `{
 *    firstField: ['a', 'b', 'c'],
 *    secondField: 42,
 * }`
 */
export interface SearchFilters {
  [fieldPath: string]: (
    string | Date | number | boolean | Id | null |
    (string | Date | Id | number | boolean | null)[]
  );
}

/**
 * Database search query, used for full-text search.
 */
export interface SearchQuery {
  /** A full-text search will be performed on that text. */
  text: string;

  /** List of fields over which to perform the full-text search. */
  on: string[];
}

/**
 * Search request body.
 */
export interface SearchBody {
  /** Search query. */
  query?: SearchQuery;

  /** Search filters. */
  filters?: SearchFilters;
}

/**
 * Command options, controls the way results are shaped.
 */
export interface CommandOptions {
  /** Limits the number of returned results when calling `search` or `list`. Defaults to `20`. */
  limit?: number;

  /** Results pagination offset to apply when calling `search` or `list`. Defaults to `0`. */
  offset?: number;

  /** Names of the fields to sort results by. */
  sortBy?: string[];

  /** Order (asc/desc) of the fields to sort results by. */
  sortOrder?: (1 | -1)[];

  /** List of fields to return for each resource. Defaults to `[]`. */
  fields?: string[];
}

/**
 * Command context, provides information about the author of changes.
 */
export interface CommandContext {
  user: User;
}

/**
 * Any resource, excluding its automatic fields.
 */
export type WithoutAutomaticFields<T> = {
  [K in keyof T as Exclude<K, `_${string}`>]: T[K]
};

type PinoDestination = pino.DestinationStream & {
  flushSync: () => void;
  on: (event: string, callback: () => void) => void;
};

/**
 * Logger settings
 */
export interface LoggerSettings {
  /** Minimum logging level (all logs below that level won't be logs). */
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal';

  /** Whether to pretty-print logs. */
  prettyPrint: boolean;

  /** Custom pino destination for logs (e.g. specific file, distant stream, ...). */
  destination?: PinoDestination;
}

/**
 * pino-based logging system.
 */
export class Logger extends BaseLogger {
  /** pino logger instance. */
  protected logger: PinoLogger;

  /** Custom pino destination for logs (e.g. specific file, distant stream, ...). */
  protected destination?: PinoDestination;

  /** Minimum logging level (all logs below that level won't be logs). */
  public readonly level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';

  /** Only for pino compatibility. */
  public readonly silent: null;

  /**
   * Class constructor.
   *
   * @param settings Logger settings.
   */
  public constructor(settings: LoggerSettings);

  /**
   * Only for pino compatibility.
   */
  public child(): Logger;

  /**
   * @deprecated Use `debug` instead.
   */
  public trace(message: unknown, ...args: unknown[]): void;

  /**
   * Information that is diagnostically helpful to people more than just developers
   * (IT, sysadmins, etc.).
   * This should be the minimum logging level in development.
   */
  public debug(message: unknown, ...args: unknown[]): void;

  /**
   * Generally useful information to log (service start/stop, configuration assumptions, etc).
   * Info we want to always have available but usually don't care about under normal circumstances.
   * This should be the minimum logging level in (pre)production.
   */
  public info(message: unknown, ...args: unknown[]): void;

  /**
   * Anything that can potentially cause application oddities, but which is not a serious concern
   * (Such as switching from a primary to backup server, retrying an operation, missing secondary
   * data, etc.). Not much to worry about, but it is still important to analyze warnings on a
   * regular basis to identify potential issues.
   */
  public warn(message: unknown, ...args: unknown[]): void;

  /**
   * Any error which is fatal to the operation, but not the service or application (can't open a
   * required file, missing data, etc.). These errors will force user (administrator, or direct
   * user) intervention. These are usually reserved for incorrect connection strings, missing
   * services, uncaught exceptions, etc. Constitutes a degradation of service, which means
   * engineering team must be immediately notified.
   */
  public error(message: unknown, ...args: unknown[]): void;

  /**
   * Any error that is forcing a shutdown of the service or application to prevent data loss
   * (or further data loss). Reserved only for the most heinous errors and situations where there is
   * guaranteed to have been data corruption or loss. Constitutes an interruption of service, which
   * means engineering and SysAdmin / DevOps teams must be immediatly notified.
   */
  public fatal(message: unknown, ...args: unknown[]): void;

  /**
   * Resolves as soon as the logging system is ready to accept logs.
   */
  public waitForReady(): Promise<void>;

  /**
   * Gracefully closes pino logger, flushing remaining buffered logs.
   */
  public close(): Promise<void>;
}

/**
 * Handles log files storage on a remote bucket.
 */
export class BucketClient {
  /** Logging system. */
  protected logger: Logger;

  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   */
  constructor(logger: Logger);

  /**
   * Uploads `body` on the bucket at `path`.
   *
   * @param type Content's MIME type.
   *
   * @param path Destination path on the bucket.
   *
   * @param body Content to upload.
   */
  public upload(_type: string, path: string, body: Stream): Promise<void>;
}

/**
 * CPU average load.
 */
export interface CpuLoad {
  idle: number;
  total: number;
}

/**
 * Snapshot metrics.
 */
export interface Measurement {
  name: string;
  memory: number;
  elapsedTime: number;
  cpuAverage: {
    idle: number;
    total: number;
  };
}

/**
 * CPU average load.
 */
export interface CpuLoad {
  idle: number;
  total: number;
}

/**
 * Snapshot metrics.
 */
export interface Measurement {
  name: string;
  memory: number;
  elapsedTime: number;
  cpuAverage: {
    idle: number;
    total: number;
  };
}

/**
 * Provides performance measurement tools (execution time, memory, ...).
 */
export class Profiler {
  /** Profiling start timestamp. */
  private startTimestamp: number;

  /** Profiling start average CPU load. */
  private startCpuAverageLoad: CpuLoad;

  /** List of measurements for current profiling. */
  private measurements: Measurement[];

  /**
   * Class constructor.
   */
  public constructor();

  /**
   * Formats the given profiler metrics into a human-readable string.
   *
   * @param {Measurement[]} Profiler metrics.
   *
   * @returns {string} Formatted metrics.
   */
  public static formatMetrics(metrics: Measurement[]): string;

  /**
   * Computes current CPU average load.
   * See https://gist.github.com/GaetanoPiazzolla/c40e1ebb9f709d091208e89baf9f4e00.
   *
   * @returns Current CPU average load.
   */
  public static getCpuAverageLoad(): CpuLoad;

  /**
   * Resets profiling.
   */
  public reset(): void;

  /**
   * Creates a snapshot of current performance metrics under the given name.
   *
   * @param name Snapshot name.
   */
  public snapshot(name: string): void;

  /**
   * Returns collected performance metrics for the current profiling session.
   *
   * @returns Collected metrics.
   */
  public getMetrics(): Measurement[];
}
