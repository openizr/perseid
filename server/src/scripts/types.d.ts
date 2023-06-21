/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type Id,
  type User,
  type Logger as BaseLogger,
  type DataModel as DefaultTypes,
} from '@perseid/core';
import {
  type Db,
  type Document,
  type MongoClient,
  type ClientSession,
} from 'mongodb';
import {
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
  type FastifyInstance,
  type FastifySchema,
} from 'fastify';
import { type Stream } from 'stream';
import { type IncomingMessage } from 'http';
import { type KeywordDefinition } from 'ajv/dist/types';
import { type DestinationStream, type Logger as PinoLogger } from 'pino';

type BaseModel<Types> = Model<Types>;

type BaseDatabaseClient<Types> = DatabaseClient<Types>;

type RelationsPerCollection<Types> = Record<keyof Types, Map<string, string[]>>;

interface Details { [key: string]: unknown; }

type PinoDestination = DestinationStream & {
  flushSync: () => void;
  on: (event: string, callback: () => void) => void;
};

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

  /**
   * Maximum allowed level of resources depth. For instance, `1` means you can only fetch fields
   * from the requested resource, `2` means you can also fetch fields from direct sub-resources,
   * `3` means you can also fetch fields from their own direct sub-resources, and so on.
   * Defaults to `3`.
   */
  maximumDepth?: number;
}

/**
 * Command context, provides information about the author of changes.
 */
export interface CommandContext {
  /** User performing the command. */
  user: User;

  /** Id of the device from which user is performing the command. */
  deviceId?: string;

  /** User agent of the device from which user is performing the command. */
  userAgent?: string;
}

/**
 * Database results.
 */
export interface Results<T> {
  /** Total number of results that matched query. */
  total: number;

  /** Limited list of results that are actually returned. */
  results: T[];
}

/**
 * Resource creation payload (excluding all automatic fields).
 */
export type Payload<T> = {
  [K in keyof T as Exclude<K, `_${string}`>]: Payload<T[K]>;
};

/**
 * Resource update payload.
 */
export type UpdatePayload<T> = {
  [K in keyof T]?: UpdatePayload<T[K]>;
};

/**
 * Common properties for all data model fields.
 */
export interface GenericFieldDataModel {
  /**
   * Custom type name to assign to that field, in addition to its actual type.
   * Very useful to customize behaviours. For instance, you might want to display a specific
   * component for email addresses on front-end, even though their real type is `string`.
   */
  customType?: string;

  /** Whether field is required. */
  required?: boolean;

  /** Additional permissions required to access that field. */
  permissions?: string[];

  /** Custom error messages when user inputs do not match data model. */
  errorMessages?: {
    [errorType: string]: string;
  };
}

/**
 * String field data model.
 */
export interface StringDataModel extends GenericFieldDataModel {
  /** Data type. */
  type: 'string';

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /** Specific set of values allowed for that field. */
  enum?: string[];

  /** Default value for that field. */
  default?: string;

  /**
   * Whether field's value should be unique across the whole collection (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  unique?: boolean;

  /** RegExp user inputs must pass for that field. */
  pattern?: string;

  /** Field minimum length. */
  minLength?: number;

  /** Field maximum length. */
  maxLength?: number;
}

/**
 * Number field data model.
 */
export interface NumberDataModel extends GenericFieldDataModel {
  /** Data type. */
  type: 'integer' | 'float';

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /** Specific set of values allowed for that field. */
  enum?: number[];

  /** Default value for that field. */
  default?: number;

  /**
   * Whether field's value should be unique across the whole collection (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  unique?: boolean;

  /** Field minimum value. */
  minimum?: number;

  /** Field maximum value. */
  maximum?: number;

  /** Field exclusive minimum value. */
  exclusiveMinimum?: number;

  /** Field exclusive maximum value. */
  exclusiveMaximum?: number;

  /** Value to use as a multiple for user inputs. */
  multipleOf?: number;
}

/**
 * Boolean field data model.
 */
export interface BooleanDataModel extends GenericFieldDataModel {
  /** Data type. */
  type: 'boolean';

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /** Default value for that field. */
  default?: boolean;
}

/**
 * Id field data model.
 */
export interface IdDataModel<Types> extends GenericFieldDataModel {
  /** Data type. */
  type: 'id';

  /** Specific set of values allowed for that field. */
  enum?: Id[];

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /**
   * Whether field's value should be unique across the whole collection (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  unique?: boolean;

  /** Default value for that field. */
  default?: Id;

  /** Name of the collection the id refers to. See it as a foreign key. */
  relation?: keyof Types;
}

/**
 * Date field data model.
 */
export interface DateDataModel extends GenericFieldDataModel {
  /** Data type. */
  type: 'date';

  /** Specific set of values allowed for that field. */
  enum?: Date[];

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /**
   * Whether field's value should be unique across the whole collection (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  unique?: boolean;

  /** Default value for that field. */
  default?: Date;
}

/**
 * Binary field data model.
 */
export interface BinaryDataModel extends GenericFieldDataModel {
  /** Data type. */
  type: 'binary';

  /** Default value for that field. */
  default?: ArrayBuffer;
}

/**
 * Null field data model.
 */
export interface NullDataModel extends GenericFieldDataModel {
  /** Data type. */
  type: 'null';
}

/**
 * Object field data model.
 */
export interface ObjectDataModel<Types> extends GenericFieldDataModel {
  /** Data type. */
  type: 'object';

  /** Sub-fields data model. */
  fields: {
    [fieldName: string]: FieldDataModel<Types>;
  };
}

/**
 * Dynamic object field data model.
 * See https://json-schema.org/understanding-json-schema/reference/object.html#pattern-properties.
 */
export interface DynamicObjectDataModel<Types> extends GenericFieldDataModel {
  /** Data type. */
  type: 'dynamicObject';

  /** Minimum required number of sub-fields. */
  minItems?: number;

  /** Maximum allowed number of sub-fields. */
  maxItems?: number;

  /** Sub-fields data model, keyed by pattern. */
  fields: {
    [pattern: string]: FieldDataModel<Types>;
  };
}

/**
 * Array field data model.
 */
export interface ArrayDataModel<Types> extends Omit<GenericFieldDataModel, 'permissions'> {
  /** Data type. */
  type: 'array';

  /** Minimum required number of items in the array. */
  minItems?: number;

  /** Maximum allowed number of items in the array. */
  maxItems?: number;

  /** Items data model. */
  fields: FieldDataModel<Types>;

  /** Whether each array item should be unique. */
  uniqueItems?: boolean;
}

/**
 * Any field data model.
 */
export type FieldDataModel<Types> = (
  NullDataModel |
  DateDataModel |
  NumberDataModel |
  StringDataModel |
  BinaryDataModel |
  BooleanDataModel |
  IdDataModel<Types> |
  ArrayDataModel<Types> |
  ObjectDataModel<Types> |
  DynamicObjectDataModel<Types>
);

/**
 * Collection data model.
 */
export interface CollectionDataModel<Types> {
  /**
   * Data model version for this collection. Can be useful for applying different logics depending
   * on the data model version of a given resource in that collection.
   */
  version?: number;

  /** Whether to generate and manage`_createdBy` and `_updatedBy` fields for that collection. */
  enableAuthors?: boolean;

  /** Whether to generate and manage the `_isDeleted` field for that collection. */
  enableDeletion?: boolean;

  /** Whether to generate and manage`_createdAt` and `_updatedAt` fields for that collection. */
  enableTimestamps?: boolean;

  /** Collection fields data model. */
  fields: {
    [fieldName: string]: FieldDataModel<Types>;
  };
}

/**
 * Generic HTTP error.
 */
export class HttpError extends Error {
  public code: string | number;

  constructor(code: string | number, message: string);
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

/** Data model types definitions. */
export type DataModel<Types> = Record<keyof Types, CollectionDataModel<Types>>;

/**
 * Data model.
 */
export class Model<
  /** Data model types definitions. */
  Types = DefaultTypes,
> {
  /** Generated data model. */
  protected model: DataModel<Types>;

  /** Public data model schema, used for data model introspection on front-end. */
  protected publicSchema: DataModel<Types>;

  /** List of relations per collection, along with their respective path in the model. */
  protected relationsPerCollection: Record<keyof Types, Set<string>>;

  /** Default data model schema. */
  public static readonly DEFAULT_MODEL: DataModel<DefaultTypes>;

  /**
   * Generates public data schema from `model`.
   *
   * @param model Model from which to generate schema.
   *
   * @param relations Optional parameter, use it to also extract all relations declared in the
   * model. If this parameter is passed, a list of all collections referenced directly or indirectly
   * (i.e. by following subsequent relations) in the model will be generated and stored in that
   * variable. For instance, if `model` contains a field that references a collection A, that in
   * turn references collection B, that eventually references the initial collection, the following
   * list will be generated: `["A", "B"]`. Defaults to `new Set()`.
   */
  protected generatePublicSchemaFrom(
    model: FieldDataModel<Types>,
    relations?: Set<string>,
  ): FieldDataModel<Types>;

  /**
   * `email` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static email(overrides?: Partial<StringDataModel>): StringDataModel;

  /**
   * `tinyText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static tinyText(overrides?: Partial<StringDataModel>): StringDataModel;

  /**
   * `shortText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static shortText(overrides?: Partial<StringDataModel>): StringDataModel;

  /**
   * `mediumText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static mediumText(overrides?: Partial<StringDataModel>): StringDataModel;

  /**
   * `longText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static longText(overrides?: Partial<StringDataModel>): StringDataModel;

  /**
   * `hugeText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static hugeText(overrides?: Partial<StringDataModel>): StringDataModel;

  /**
   * `token` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static token(overrides?: Partial<StringDataModel>): StringDataModel;

  /**
   * `password` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static password(overrides?: Partial<StringDataModel>): StringDataModel;

  /**
   * `credentials` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static credentials(
    overrides?: Partial<ObjectDataModel<unknown>>,
  ): ObjectDataModel<unknown>;

  /**
   * Class constructor.
   *
   * @param schema Schema from which to generate data model.
   */
  constructor(schema: DataModel<Types>);

  /**
   * Returns the list of all data model collections names.
   *
   * @returns Data model collections names.
   */
  public getCollections(): (keyof Types)[];

  /**
   * Returns generated data model for collection `collection`.
   *
   * @param collection Name of the collection for which to get data model.
   *
   * @returns Collection generated data model.
   */
  public getCollection(collection: keyof Types): Readonly<CollectionDataModel<Types>>;

  /**
   * Returns public data model schema for `collection`, and all its direct or indirect relations.
   *
   * @param collection Name of the collection for which to get public data model schema.
   *
   * @returns Public data model schema for all related collections.
   */
  public getPublicSchema(collection: keyof Types): DataModel<Types>;
}

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
  public child(): PinoLogger;

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
 * Cache client settings.
 */
export interface CacheClientSettings {
  /** Path to the cache directory on file system. */
  cachePath: string;
}

/**
 * Handles data caching for faster access.
 */
export class CacheClient {
  /** Cache file path. */
  protected cachePath: string;

  /**
   * Class constructor.
   *
   * @param settings Cache client settings.
   */
  constructor(settings: CacheClientSettings);

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

/** Mongo index. */
export interface Index {
  unique?: boolean;
  key: { [path: string]: 1; };
}

/** Mongo validation schema. */
export interface MongoValidationSchema {
  bsonType: ('null' | 'object' | 'string' | 'bool' | 'binData' | 'objectId' | 'date' | 'int' | 'double' | 'array')[];
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
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  required?: string[];
  additionalProperties?: boolean;
  enum?: (string | null | number)[];
  items?: MongoValidationSchema;
  properties?: {
    [name: string]: MongoValidationSchema;
  };
  patternProperties?: {
    [pattern: string]: MongoValidationSchema;
  };
}

/** Perseid data model to Mongo validation schema formatters. */
export interface MongoFormatters<Types> {
  [type: string]: (model: FieldDataModel<Types>) => MongoValidationSchema;
}

/** Migration callback. */
export type MigrationCallback = (session: ClientSession) => Promise<void>;

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
export class DatabaseClient<
  /** Data model types definitions. */
  Types = DefaultTypes,

  /** Model class types definitions. */
  Model extends BaseModel<Types> = BaseModel<Types>,
> {
  /** Default sorting pipeline. */
  protected readonly DEFAULT_SORTING_PIPELINE: Document[];

  /** Pattern used to split full-text search queries into separate tokens. */
  protected readonly SPLITTING_TOKENS: RegExp;

  /** Pipeline to use first when fetching results from collections that don't enable deletion. */
  protected readonly DELETION_FILTER_PIPELINE: Document[];

  /** Used to calculate total number of results for a given query. */
  protected readonly TOTAL_PIPELINE: Document[];

  /** Default pagination offset value. */
  protected readonly DEFAULT_OFFSET: number;

  /** Default pagination limit value. */
  protected readonly DEFAULT_LIMIT: number;

  /** Default maximum level of resources depth. */
  protected readonly DEFAULT_MAXIMUM_DEPTH: number;

  /** Default query options. */
  protected readonly DEFAULT_QUERY_OPTIONS: CommandOptions;

  /** List of formatters, used to format a perseid data model into its MongoDB equivalent. */
  protected readonly FORMATTERS: MongoFormatters<Types>;

  /** Logging system. */
  protected logger: Logger;

  /** Cache client, used for results caching. */
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

  /** List of fields in data model representing external relations, per collection. */
  protected relationsPerCollection: RelationsPerCollection<Types>;

  /** List of fields in data model referencing each collection, grouped by this collection. */
  protected invertedRelationsPerCollection: RelationsPerCollection<Types>;

  /**
   * Formats `input` to match MongoDB data types specifications.
   *
   * @param input Input to format.
   *
   * @param model Current input data model.
   *
   * @returns MongoDB-formatted input.
   */
  protected formatInput<Collection extends keyof Types>(
    input: Partial<Types[Collection]>,
    model: FieldDataModel<Types>,
  ): Document;

  /**
   * Formats `output` to match database-independent data types specifications.
   *
   * @param output Output to format.
   *
   * @param model Current output data model.
   *
   * @param projections List of current output fields to return.
   *
   * @returns Formatted output.
   */
  protected formatOutput<Collection extends keyof Types>(
    output: Partial<Types[Collection]>,
    model: FieldDataModel<Types>,
    projections: Document | 1,
  ): Partial<Types[Collection]> | Id | ArrayBuffer | null;

  /**
   * Makes sure that no collection references resource with id `id` from `collection`.
   *
   * @param collection Name of the collection the resource belongs to.
   *
   * @param id Id of the resource to check for references.
   *
   * @throws If any collection still references resource.
   */
  protected checkReferencesTo(collection: keyof Types, id: Id): Promise<void>;

  /**
   * Returns all indexed fields for `collection`.
   *
   * @param collection Name of the collection for which to get indexes.
   *
   * @returns Collection's indexed fields.
   */
  protected getCollectionIndexedFields(model: FieldDataModel<Types>, path?: string[]): Index[];

  /**
   * Scans `schema` to find foreign keys.
   *
   * @param schema Data model schema to scan.
   *
   * @param relations Map into which list of foreign keys and their related paths will be stored.
   *
   * @param path Current path in schema. Used for recursivity, do not use it directly!
   */
  protected scanRelationsFrom(
    schema: FieldDataModel<Types>,
    relations: Map<string, string[]>,
    path?: string[],
  ): void;

  /**
   * Creates a Mongo validation schema from `model`.
   *
   * @param model Model from which to create validation schema.
   *
   * @returns Mongo validation schema.
   */
  protected createSchema(model: ObjectDataModel<Types>): { $jsonSchema: MongoValidationSchema; };

  /**
   * Generates MongoDB-flavored projections object, from `path`.
   *
   * @param path Full path in the data model from which to generate projection.
   *
   * @param maximumDepth Maximum allowed level of resources depth.
   *
   * @param checkIndexing Whether to check that field is indexed.
   *
   * @param splittedPath Remaining path to analyze.
   *
   * @param model Current path data model.
   *
   * @param projections Current path projections object.
   *
   * @param currentDepth Current level of resources depth. Used internally. Defaults to `1`.
   *
   * @returns MongoDB projections object.
   *
   * @throws If given path is not a valid field in data model.
   *
   * @throws If maximum level of resourcess depth has been exceeded.
   *
   * @throws If `checkIndexing` is `true` and given path is not an indexed field in data model.
   */
  protected projectFromPath(
    path: string,
    maximumDepth: number,
    checkIndexing: boolean,
    splittedPath: string[],
    model?: FieldDataModel<Types>,
    projections?: Document,
    currentDepth?: number,
  ): Document;

  /**
   * Generates MongoDB-flavored list of fields to project in results, from `fields`.
   * The most specific path takes precedence, which means if you have the following classic fields:
   * `['object.field', 'object']`, the output will be `{ object: { field: 1 } }`.
   *
   * @param fields Fields from which to generate projections object.
   *
   * @param model Root collection data model.
   *
   * @param maximumDepth Maximum allowed level of resources depth.
   *
   * @returns MongoDB projections.
   */
  protected generateProjectionsFrom(
    fields: { classic: string[]; indexed?: string[] },
    model: FieldDataModel<Types>,
    maximumDepth: number,
  ): Document;

  /**
   * Generates MongoDB `$lookup`s pipeline from `projections`.
   *
   * @param projections Projections from which to generate pipeline.
   *
   * @param model Current path data model.
   *
   * @param path Current path in model. Used for recursivity, do not use it directly!
   *
   * @param isFlatArray Whether current path is part of a flat array.
   * Used for recursivity, do not use it directly!
   *
   * @returns Generated `$lookup`s pipeline.
   */
  protected generateLookupsPipelineFrom(
    projections: Document,
    model: FieldDataModel<Types>,
    path?: string[],
    isFlatArray?: boolean,
  ): Document[];

  /**
   * Generates MongoDB `$sort` pipeline from `sortBy` and `sortOrder`.
   *
   * @param sortBy List of fields' paths to sort results by.
   *
   * @param sortOrder Sorting orders (asc/desc) for each field path.
   *
   * @returns Generated `$sort` pipeline.
   *
   * @throws If `sortBy` and `sortOrder` are not the same size.
   */
  protected generateSortingPipelineFrom(
    sortBy: Exclude<CommandOptions['sortBy'], undefined>,
    sortOrder: Exclude<CommandOptions['sortOrder'], undefined>,
  ): Document[];

  /**
   * Generates MongoDB `$skip` and `$limit` pipeline from `offset` and `limit`.
   *
   * @param offset Pagination offset.
   *
   * @param limit Maximum number of results to fetch.
   *
   * @returns Generated pagination pipeline.
   */
  protected generatePaginationPipelineFrom(offset?: number, limit?: number): Document[];

  /**
   * Generates MongoDB search pipeline from `query` and `filters`.
   *
   * @param query Search query.
   *
   * @param filters Search filters.
   *
   * @returns Generated search pipeline.
   */
  protected generateSearchPipelineFrom(
    query: SearchQuery | null,
    filters: SearchFilters | null,
  ): Document[];

  /**
   * Connects database client to the MongoDB server before performing any query, and handles common
   * MongoDB server errors. You should always use this method to wrap your code.
   *
   * @param callback Callback to wrap in the error handler.
   *
   * @throws If connection to the server failed.
   *
   * @throws Transformed MongoDB error if applicable, original error otherwise.
   */
  protected handleError<T>(callback: () => Promise<T>): Promise<T>;

  /**
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param logger Logging system to use.
   *
   * @param cache Cache client instance to use for results caching.
   *
   * @param settings Database client settings.
   */
  public constructor(
    model: Model,
    logger: Logger,
    cache: CacheClient,
    settings: DatabaseClientSettings,
  );

  /**
   * Exposes `generateProjectionsFrom` method in order to make sure that all `fields` are valid.
   *
   * @param collection Root collection from which to check fields.
   *
   * @param fields Fields to check.
   *
   * @param maximumDepth Maximum allowed level of resources depth. Defaults to `3`.
   */
  public checkFields(
    collection: keyof Types,
    fields: string[],
    maximumDepth?: number,
  ): void;

  /**
   * Makes sure that `foreignIds` reference existing resources that match specific conditions.
   *
   * @param foreignIds Foreign ids to check in database.
   *
   * @throws If any foreign id does not exist.
   */
  public checkForeignIds(
    foreignIds: Map<string, SearchFilters[]>,
  ): Promise<void>;

  /**
   * Inserts `resource` into `collection`.
   *
   * @param collection Name of the collection to insert resource into.
   *
   * @param resource New resource to insert.
   */
  public create<Collection extends keyof Types>(
    collection: Collection,
    resource: Types[Collection],
  ): Promise<void>;

  /**
   * Updates resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to update resource from.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   */
  public update<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    payload: Partial<Types[Collection]>,
  ): Promise<void>;

  /**
   * Updates resource matching `filters` from `collection`, using a write lock.
   *
   * @param collection Name of the collection to update resource from.
   *
   * @param filters Filters that resource must match.
   *
   * @param payload Updated resource payload.
   *
   * @returns `true` if resource was updated, `false` otherwise.
   */
  public exclusiveUpdate<Collection extends keyof Types>(
    collection: Collection,
    filters: SearchFilters,
    payload: Partial<Types[Collection]>,
  ): Promise<boolean>;

  /**
   * Fetches resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to fetch resource from.
   *
   * @param id Id of the resource to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Resource if it exists, `null` otherwise.
   */
  public view<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    options?: CommandOptions,
  ): Promise<Types[Collection] | null>;

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
  public search<Collection extends keyof Types>(
    collection: Collection,
    body: SearchBody,
    options?: CommandOptions,
  ): Promise<Results<Types[Collection]>>;

  /**
   * Fetches a paginated list of resources from `collection`.
   *
   * @param collection Name of the collection from which to fetch resources.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public list<Collection extends keyof Types>(
    collection: Collection,
    options?: CommandOptions,
  ): Promise<Results<Types[Collection]>>;

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
  public delete<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    payload?: Partial<Types[Collection]>,
  ): Promise<boolean>;

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
  public resetCollection<Collection extends keyof Types>(
    collection: Collection,
  ): Promise<void>;

  /**
   * Performs a validation schema update and a data migration on collection with name `name`.
   *
   * @param collection Name of the collection to update.
   *
   * @param migration Optional migration to perform. Defaults to an empty Promise.
   */
  public updateCollection<Collection extends keyof Types>(
    collection: Collection,
    migration?: MigrationCallback,
  ): Promise<void>;

  /**
   * Drops `collection` from database.
   *
   * @param collection Name of the collection to drop from database.
   */
  public dropCollection(collection: keyof Types): Promise<void>;

  /**
   * Resets the whole underlying database, re-creating collections, indexes, and such.
   */
  public reset(): Promise<void>;

  /**
   * Performs integrity checks on `collection` if specified, or on the whole database.
   *
   * @param collection Name of the collection on which to perform the integrity checks.
   *
   * @returns List of found integrity errors, per collection.
   *
   * @throws If integrity checks failed.
   */
  public checkIntegrity(
    collection?: keyof Types,
  ): Promise<Record<string, Record<string, Id[]>>>;
}

/**
 * Handles emails sending.
 */
export class EmailClient {
  /** Logging system. */
  protected logger: Logger;

  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   */
  constructor(logger: Logger);

  /**
   * Sends a verification email to `to`.
   *
   * @param verificationUrl Verification URL to indicate in the email.
   */
  public sendVerificationEmail(to: string, verificationUrl: string): Promise<void>;

  /**
   * Sends a password reset email to `to`.
   *
   * @param passwordResetUrl Password reset URL to indicate in the email.
   */
  public sendPasswordResetEmail(to: string, passwordResetUrl: string): Promise<void>;

  /**
   * Sends a user invite email to `to`.
   *
   * @param to Recipient email address.
   *
   * @param signInUrl Sign-in URL to indicate in the email.
   *
   * @param temporaryPassword Temporary password to indicate in the email.
   */
  public sendInviteEmail(
    to: string,
    signInUrl: string,
    temporaryPassword: string,
  ): Promise<void>;
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
   * @param metrics Profiler metrics.
   *
   * @returns Formatted metrics.
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

/**
 * Perseid engine, contains all the basic CRUD methods.
 */
export class Engine<
  /** Data model types definitions. */
  Types,

  /** Model class types definitions. */
  Model extends BaseModel<Types> = BaseModel<Types>,

  /** Database client types definition. */
  DatabaseClient extends BaseDatabaseClient<Types> = BaseDatabaseClient<Types>,
> {
  /** Data model. */
  protected model: Model;

  /** Logging system. */
  protected logger: Logger;

  /** Database client. */
  protected databaseClient: DatabaseClient;

  /** Default update payload, used as a fallback when there is no change to perform on resource. */
  protected defaultPayload: Partial<Payload<unknown>>;

  /**
   * Performs a deep (recursive) merge of `resource` and `payload`. Rules are the following:
   *  - `null` is a special value that signifies "remove the item" in an array or a dynamic object.
   *    For instance, merging `[1, 2, 3]` and `[null, 2, null]` will give `[2]`.
   *  - If payload has less items than the original resource, remaining items will be added. For
   *    instance, merging `[1, 2, 3, 4]` and `[9, 10]` will give `[9, 10, 3, 4]`.
   *  - If `payload` and `resource` are deeply equal, `undefined` is returned.
   *
   * @param resource Original resource on which to apply the deep merge.
   *
   * @param payload New values to partially update resource with.
   *
   * @param dataModel Current field data model (used to determine wether field is an array or a
   * dynamic object).
   *
   * @param foreignIds Optional parameter, use it to also extract foreign ids from payload. If this
   * parameter is passed, a list of foreign ids per collection will be generated and stored in that
   * variable. Defaults to `new Map()`.
   *
   * @param path Current path in schema. Used for recursivity, do not use it directly!
   *
   * @returns A deep merge of `resource` and `payload`.
   */
  protected deepMerge<Collection extends keyof Types>(
    resource: Partial<Types[Collection]>,
    payload: UpdatePayload<Types[Collection]>,
    dataModel: FieldDataModel<Types>,
    foreignIds?: Map<string, Record<string, Set<string>>>,
    path?: string[],
  ): UpdatePayload<Types[Collection]>;

  /**
   * Makes sure that `foreignIds` reference existing resources that match specific conditions.
   *
   * @param collection Collection for which to check foreign ids.
   *
   * @param resource Current resource being updated, if applicable.
   *
   * @param payload Payload for updating or creating resource.
   *
   * @param foreignIds Foreign ids map, generated from `deepMerge`.
   *
   * @param context Command context.
   */
  protected checkForeignIds<Collection extends keyof Types>(
    collection: Collection,
    resource: Types[Collection] | null,
    payload: UpdatePayload<Types[Collection]>,
    foreignIds: Map<string, Record<string, Set<string>>>,
    context: CommandContext,
  ): Promise<void>;

  /**
   * Returns filters to apply when checking foreign ids referencing other relations.
   *
   * @param collection Collection for which to return filters.
   *
   * @param path Path to the relation reference in data model.
   *
   * @param ids List of foreign ids to check.
   *
   * @param resource Current resource being updated, if applicable.
   *
   * @param payload Payload for updating or creating resource.
   *
   * @param context Command context.
   *
   * @returns Filters to apply to check foreign ids.
   */
  protected createRelationFilters<Collection extends keyof Types>(
    collection: Collection,
    path: string,
    ids: Id[],
    resource: Types[Collection] | null,
    payload: UpdatePayload<Types[Collection]>,
    context: CommandContext,
  ): SearchFilters;

  /**
   * Returns updated `payload` with automatic fields.
   *
   * @param collection Collection for which to generate automatic fields.
   *
   * @param resource Current resource being updated, if applicable.
   *
   * @param payload Payload to update.
   *
   * @param context Command context.
   *
   * @returns Payload with automatic fields.
   */
  protected withAutomaticFields<Collection extends keyof Types>(
    collection: Collection,
    resource: Types[Collection] | null,
    payload: Payload<Types[Collection]> | UpdatePayload<Types[Collection]>,
    context: CommandContext,
  ): Types[Collection];

  /**
   * Performs specific checks `payload` to make sure it is valid, and updates it if necessary.
   *
   * @param collection Payload collection.
   *
   * @param resource Current resource being updated, if applicable.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   */
  protected checkAndUpdatePayload<Collection extends keyof Types>(
    collection: Collection,
    resource: Types[Collection] | null,
    payload: UpdatePayload<Types[Collection]>,
    context: CommandContext,
  ): Promise<Partial<Types[Collection]>>;

  /**
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param logger Logging system to use.
   *
   * @param databaseClient Database client to use.
   */
  constructor(
    model: Model,
    logger: Logger,
    databaseClient: DatabaseClient,
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
  public create<Collection extends keyof Types>(
    collection: Collection,
    payload: Payload<Types[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<Types[Collection]>;

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
  public update<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    payload: UpdatePayload<Types[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<Types[Collection]>;

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
  public view<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    options: CommandOptions,
  ): Promise<Types[Collection]>;

  /**
   * Fetches a paginated list of resources from `collection`.
   *
   * @param collection Name of the collection to fetch resources from.
   *
   * @param options Command options.
   *
   * @returns Paginated list of resources.
   */
  public list<Collection extends keyof Types>(
    collection: Collection,
    options: CommandOptions,
  ): Promise<Results<Types[Collection]>>;

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
  public search<Collection extends keyof Types>(
    collection: Collection,
    search: SearchBody,
    options: CommandOptions,
  ): Promise<Results<Types[Collection]>>;

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
  public delete<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    context: CommandContext,
  ): Promise<void>;

  /**
   * Resets the whole system, including database.
   */
  public reset(...args: unknown[]): Promise<void>;

  /**
   * Performs integrity checks on `collection` if specified, or on the whole database.
   *
   * @param collection Name of the collection on which to perform the integrity checks.
   *
   * @returns List of found integrity errors, per collection.
   *
   * @throws If integrity checks failed.
   */
  public checkIntegrity(
    collection?: keyof Types,
  ): Promise<Record<string, Record<string, Id[]>>>;
}

/**
 * Generated OAuth credentials.
 */
export interface Credentials {
  /** Id of the device for which these credentials are valid. */
  deviceId: string;

  /** Access token expiration period, in seconds. */
  expiresIn: number;

  /** Access token. */
  accessToken: string;

  /** Refresh token, used to generate a new access token. */
  refreshToken: string;

  /** Refresh token expiration date. */
  refreshTokenExpiration: Date;
}

/**
 * OAuth engine settings.
 */
export interface OAuthEngineSettings {
  /** Application base URL. */
  baseUrl: string;

  /** OAuth configuration. */
  oAuth: {
    /** Access tokens issuer name (usually the companie's name). */
    issuer: string;

    /** Algorithm to use for access tokens generation. */
    algorithm: 'RS256';

    /** Client id to store in access tokens (usually the application's name). */
    clientId: string;

    /** Private key to use for access tokens generation. */
    privateKey: string;

    /** Public key to use for access tokens generation. */
    publicKey: string;
  };
}

/**
 * Perseid engine extended with OAuth-related methods.
 */
export class OAuthEngine<
  /** Data model types definitions. */
  Types extends DefaultTypes = DefaultTypes,

  /** Model class types definitions. */
  Model extends BaseModel<Types> = BaseModel<Types>,

  /** Database client types definition. */
  DatabaseClient extends BaseDatabaseClient<Types> = BaseDatabaseClient<Types>,
> extends Engine<Types, Model, DatabaseClient> {
  /** Default duration before a refresh token expires. */
  protected readonly REFRESH_TOKEN_DURATION: number; // 30 days.

  /** Email client to use. */
  protected emailClient: EmailClient;

  /** Cache client to use. */
  protected cacheClient: CacheClient;

  /** OAuth engine settings. */
  protected settings: OAuthEngineSettings;

  /**
   * Generates new OAuth credentials (refresh/access tokens) for `userId` and `deviceId`.
   *
   * @param userId Id of the user to generate credentials for.
   *
   * @param deviceId Id of the device to generate credentials for.
   * If not set, a new id will be created.
   *
   * @returns Generated credentials.
   */
  protected generateCredentials(
    userId: Id,
    deviceId?: string,
  ): Credentials;

  /**
   * Performs specific checks `payload` to make sure it is valid, and updates it if necessary.
   *
   * @param collection Payload collection.
   *
   * @param resource Current resource being updated, if applicable.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   */
  protected checkAndUpdatePayload<Collection extends keyof Types>(
    collection: Collection,
    resource: Types[Collection] | null,
    payload: UpdatePayload<Types[Collection]>,
    context: CommandContext,
  ): Promise<Partial<Types[Collection]>>;

  /**
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param logger Logging system to use.
   *
   * @param databaseClient Database client to use.
   *
   * @param emailClient Email client to use.
   *
   * @param cacheClient Cache client to use.
   *
   * @param settings Engine settings.
   */
  constructor(
    model: Model,
    logger: Logger,
    databaseClient: DatabaseClient,
    emailClient: EmailClient,
    cacheClient: CacheClient,
    settings: OAuthEngineSettings,
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
  public create<Collection extends keyof Types>(
    collection: Collection,
    payload: Payload<Types[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<Types[Collection]>;

  /**
   * Verifies `accessToken` validity.
   *
   * @param accessToken Access token to verify.
   *
   * @param ignoreExpiration Whether to ignore access token expiration.
   *
   * @param context Command context.
   *
   * @returns Id of the user related to the access token.
   *
   * @throws If device id is not valid.
   */
  public verifyToken(
    accessToken: string,
    ignoreExpiration: boolean,
    context: CommandContext,
  ): Promise<Id>;

  /**
   * Signs a new user up in the system.
   *
   * @param email User email.
   *
   * @param password User password.
   *
   * @param passwordConfirmation User password confirmation.
   *
   * @param context Command context.
   *
   * @returns New credentials.
   *
   * @throws If password and confirmation mismatch.
   */
  public signUp(
    email: Types['users']['email'],
    password: Types['users']['password'],
    passwordConfirmation: Types['users']['password'],
    context: CommandContext,
  ): Promise<Credentials>;

  /**
   * Signs an existing user in.
   *
   * @param email User email.
   *
   * @param password User password.
   *
   * @param context Command context.
   *
   * @returns New credentials.
   *
   * @throws If user with email `email` does not exist.
   *
   * @throws If `password` does not match user password.
   */
  public signIn(
    email: string,
    password: string,
    context: CommandContext,
  ): Promise<Credentials>;

  /**
   * Sends a new verification email to connected user.
   *
   * @param context Command context.
   *
   * @throws If user email is already verified.
   */
  public requestEmailVerification(context: CommandContext): Promise<void>;

  /**
   * Verifies email of the connected user.
   *
   * @param token Verification token that was sent in the verification email.
   *
   * @param context Command context.
   *
   * @throws If verification token is not valid.
   */
  public verifyEmail(verificationToken: string, context: CommandContext): Promise<void>;

  /**
   * Sends a new password reset email to user with email `email`.
   *
   * @param email Email of the user to whom to send password reset email.
   *
   * @param context
   */
  public requestPasswordReset(email: string): Promise<void>;

  /**
   * Resets password for user with email `email`.
   *
   * @param password New password.
   *
   * @param passwordConfirmation New password confirmation.
   *
   * @param resetToken Reset token sent in the password reset email.
   *
   * @throws If password and confirmation mismatch.
   *
   * @throws If reset token is not valid.
   */
  public resetPassword(
    password: Types['users']['password'],
    passwordConfirmation: Types['users']['password'],
    resetToken: string,
  ): Promise<void>;

  /**
   * Refreshes access token for connected user.
   *
   * @param refreshToken Refresh token to use to refresh access token.
   *
   * @param context Command context.
   *
   * @returns New credentials.
   *
   * @throws If refresh token is invalid.
   */
  public refreshToken(refreshToken: string, context: CommandContext): Promise<Credentials>;

  /**
   * Signs connected user out.
   *
   * @param context Command context.
   */
  public signOut(context: CommandContext): Promise<void>;

  /**
   * Resets the whole system, including database, and re-creates root role and user.
   *
   * @param rootEmail Email to use for root user.
   *
   * @param rootPassword Password to use for root user.
   */
  public reset(rootEmail: string, rootPassword: string): Promise<void>;
}

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
export class Controller<
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
  protected readonly CAPITAL_TOKEN: RegExp;

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
  protected toSnakeCase(value: string): string;

  /**
   * Formats `output` to match fastify data types specifications.
   *
   * @param output Output to format.
   *
   * @returns Formatted output.
   */
  protected formatOutput(output: unknown): unknown;

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
    permissions?: Set<string>,
  ): string[];

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
    permissions?: Set<string>,
  ): SearchFilters;

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
    permissions?: Set<string>,
  ): {
    fields?: string[];
    sortBy?: string[];
    sortOrder?: number[];
    [key: string]: unknown | number | string | string[];
  };

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
    permissions?: Set<string>,
  ): SearchBody;

  /**
   * Catches and handles most common API errors thrown by `callback`.
   *
   * @param callback Callback to wrap.
   *
   * @returns Wrapped callback.
   */
  protected catchErrors<T>(callback: () => Promise<T>): Promise<T>;

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
  protected rbac(user: User, permissions: string[]): void;

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
  );
}

/**
 * API validation schema.
 */
export interface ModelSchema<Types> {
  body?: FieldDataModel<Types>;
  query?: FieldDataModel<Types>;
  params?: FieldDataModel<Types>;
  headers?: FieldDataModel<Types>;
  response?: {
    [status: string]: FieldDataModel<Types>;
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
  type: (
    'null' | 'object' | 'string' | 'array' | 'boolean' | 'number' | 'integer'
    | ('null' | 'object' | 'string' | 'array' | 'boolean' | 'number' | 'integer')[]
  );
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
  errorMessage: {
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
export interface AjvFormatters<Types> {
  [type: string]: (
    model: FieldDataModel<Types>,
    mode: 'RESPONSE' | 'CREATE' | 'UPDATE'
  ) => AjvValidationSchema;
}

/**
 * Custom endpoint configuration.
 */
export interface EndpointSettings<Types> {
  /** Whether to authenticate user for that endpoint. */
  authenticate?: boolean;

  /** Name of the collection for which to generate the endpoint, if applicable. */
  collection?: keyof Types;

  /** Whether to ignore access token expiration. Useful for endpoints like refresh token. */
  ignoreExpiration?: boolean;

  /** Additional permissions to check for that endpoint. */
  additionalPermissions?: string[];

  /** API validation schema for that endpoint. */
  schema?: ModelSchema<Types>;

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
export class FastifyController<
  /** Data model types definitions. */
  Types extends DefaultTypes = DefaultTypes,

  /** Model class types definitions. */
  Model extends BaseModel<Types> = BaseModel<Types>,

  /** Database client types definition. */
  Engine extends OAuthEngine<Types> = OAuthEngine<Types>,
> extends Controller<Types, Model, Engine> {
  /** HTTP 404 error code. */
  protected readonly NOT_FOUND_CODE: string;

  /** Invalid payload error code. */
  protected readonly INVALID_PAYLOAD_CODE: string;

  /** List of special Ajv keywords, used to format special types on the fly. */
  protected readonly KEYWORDS: KeywordDefinition[];

  /** List of formatters, used to format a perseid data model into its Ajv equivalent. */
  protected readonly FORMATTERS: AjvFormatters<Types>;

  /** Increment used for `multipart/form-data` payloads parsing. */
  protected increment: number;

  /** Built-in API handlers for OAuth related endpoints. */
  protected apiHandlers: Record<string, EndpointSettings<Types>>;

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
    schema: ModelSchema<Types>,
    mode: 'CREATE' | 'UPDATE',
    transformer?: (schema: FastifySchema) => FastifySchema,
  ): FastifySchema;

  /**
   * Formats `error`.
   *
   * @param error Error to format.
   *
   * @param dataVar Additional info to format error with.
   *
   * @returns Formatted error.
   */
  protected formatError(error: ValidationError[], dataVar: string): Error;

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
    options?: FormDataOptions,
  ): Promise<FormDataFields>;

  /**
   * Handles HTTP 404 errors.
   */
  protected handleNotFound(): void;

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
  ): void;

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
  protected oAuth(
    accessToken: string,
    deviceId: string,
    ignoreExpiration?: boolean,
  ): Promise<User>;

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
  );

  /**
   * Creates a new fastify endpoint from `settings`.
   *
   * @param settings Endpoint configuration.
   *
   * @returns Fastify endpoint to register.
   */
  public createEndpoint(settings: EndpointSettings<Types>): {
    handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
    schema: FastifySchema;
  };

  /**
   * Registers hooks, handlers, oAuth and CRUD-related endpoints to `server`.
   *
   * @param server Fastify instance to register endpoints and hooks to.
   */
  public createEndpoints(server: FastifyInstance): void;
}
