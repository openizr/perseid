/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type Id,
  type Results,
  type HttpClient,
  type FieldSchema,
  type ObjectSchema,
  type StringSchema,
  type DataModelSchema,
  type DefaultDataModel,
  type Model as BaseModel,
  type Logger as BaseLogger,
  type NumberSchema,
} from '@perseid/core';
import type {
  FastifyError,
  FastifyReply,
  FastifyRequest,
  FastifyInstance,
} from 'fastify';
import pg from 'pg';
import mysql from 'mysql2/promise';
import { type Stream } from 'stream';
import { type IncomingMessage } from 'http';
import type { Db, MongoClient } from 'mongodb';
import type { Ajv, KeywordDefinition } from 'ajv';
import type { Application, NextFunction, RequestHandler } from 'express';
import { type DestinationStream, type Logger as PinoLogger } from 'pino';

type Details = Record<string, unknown>;

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
export type SearchFilters = Record<string, (
  string | Date | number | boolean | Id | null |
  (string | Date | Id | number | boolean | null)[]
)>;

/**
 * Database search query, used for full-text search.
 */
export interface SearchQuery {
  /** A full-text search will be performed on that text. */
  text: string;

  /** List of fields over which to perform the full-text search. */
  on: Set<string>;
}

/**
 * Search request body.
 */
export interface SearchBody {
  /** Search query. */
  query: SearchQuery | null;

  /** Search filters. */
  filters: SearchFilters | null;
}

/**
 * Command options for view method, controls the way results are shaped.
 */
export interface ViewCommandOptions {
  /** List of fields to fetch. Defaults to `new Set<string>()`. */
  fields?: Set<string>;

  /**
   * Maximum allowed level of resources depth. For instance, `1` means you can only fetch fields
   * from the requested resource, `2` means you can also fetch fields from direct sub-resources,
   * `3` means you can also fetch fields from their own direct sub-resources, and so on.
   * Defaults to `3`.
   */
  maximumDepth?: number;
}

/**
 * Command options for list method, controls the way results are shaped.
 */
export interface ListCommandOptions extends ViewCommandOptions {
  /** Limits the number of returned results. Defaults to `20`. */
  limit?: number;

  /** Results pagination offset to apply. Defaults to `0`. */
  offset?: number;

  /** List of fields to sort results by, along with their sorting order (asc/desc). */
  sortBy?: Record<string, 1 | -1>;
}

/**
 * Command options for search method, controls the way results are shaped.
 */
export interface SearchCommandOptions extends ViewCommandOptions {
  /** Limits the number of returned results. Defaults to `20`. */
  limit?: number;

  /** Results pagination offset to apply. Defaults to `0`. */
  offset?: number;

  /** List of fields to sort results by, along with their sorting order (asc/desc). */
  sortBy?: Record<string, 1 | -1>;
}

/**
 * Command context, provides information about the author of changes.
 */
export interface CommandContext<DataModel extends DefaultDataModel> {
  /** User performing the command. */
  user: DataModel['users'];

  /** Id of the device from which user is performing the command. */
  deviceId?: string;

  /** User agent of the device from which user is performing the command. */
  userAgent?: string;
}

/**
 * Resource creation payload (excluding all its automatic fields).
 */
export type CreatePayload<Resource> = {
  [K in keyof Resource as Exclude<K, `_${string}`>]: CreatePayload<Resource[K]>;
};

/**
 * Resource update payload (excluding all its automatic fields).
 */
export type UpdatePayload<Resource> = Partial<{
  [K in keyof Resource as Exclude<K, `_${string}`>]: UpdatePayload<Resource[K]>;
}>;

/**
 * Resource creation / update payload.
 */
export type Payload<Resource> = Partial<{
  [K in keyof Resource]: Payload<Resource[K]>;
}>;

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
export class Database extends Error {
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
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/Profiler.ts
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
 * Bucket client settings.
 */
export interface BucketClientSettings {
  /** Maximum request duration (in ms) before generating a timeout. */
  connectTimeout: number;
}

/**
 * Handles log files storage on a remote bucket.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/BucketClient.ts
 */
export class BucketClient extends HttpClient {
  /** Logging system. */
  protected logger: Logger;

  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   *
   * @param settings Email client settings.
   */
  constructor(logger: Logger, settings: BucketClientSettings);

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
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/Logger.ts
 */
export class Logger extends BaseLogger {
  /** pino logger instance. */
  protected logger: PinoLogger;

  /** Custom pino destination for logs (e.g. specific file, distant stream, ...). */
  protected destination?: PinoDestination;

  /** Minimum logging level (all logs below that level won't be logs). */
  public readonly level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';

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
   * Only for pino compatibility.
   */
  public silent(message: unknown, ...args: unknown[]): void;

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
 * Cache client settings.
 */
export interface CacheClientSettings {
  /** Path to the cache directory on file system. */
  cachePath: string;

  /** Maximum request duration (in ms) before generating a timeout. */
  connectTimeout: number;
}

/**
 * Handles data caching for faster access.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/CacheClient.ts
 */
export class CacheClient extends HttpClient {
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
  public get(key: string): Promise<string | null>;

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
 * Email client settings.
 */
export interface EmailClientSettings {
  /** Maximum request duration (in ms) before generating a timeout. */
  connectTimeout: number;
}

/**
 * Handles emails sending.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/EmailClient.ts
 */
export class EmailClient extends HttpClient {
  /** Logging system. */
  protected logger: Logger;

  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   *
   * @param settings Email client settings.
   */
  constructor(logger: Logger, settings: EmailClientSettings);

  /**
   * Sends a verification email to `to`.
   *
   * @param verificationUrl Verification URL to indicate in the email.
   */
  public sendVerificationEmail(to: string, verificationUrl: string): Promise<void>;

  /**
   * Sends a password reset email to `to`.
   *
   * @param to Recipient email address.
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
 * Data model.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/Model.ts
 */
export class Model<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,
> extends BaseModel<DataModel> {
  /** Public data model schema, used for data model introspection on front-end. */
  protected publicSchema: DataModelSchema<DataModel>;

  /** List of relations per resource, along with their respective path in the model. */
  protected relationsPerResource: { [Resource in keyof DataModel]: Set<string> };

  /** Default data model schema. */
  public static readonly DEFAULT_MODEL: DataModelSchema<DefaultDataModel>;

  /**
   * Generates public data schema from `schema`.
   *
   * @param schema Data model schema from which to generate public schema.
   *
   * @param relations Optional parameter, use it to also extract all relations declared in the
   * model. If this parameter is passed, a list of all resources referenced directly or indirectly
   * (i.e. by following subsequent relations) in the model will be generated and stored in that
   * variable. For instance, if `schema` contains a field that references a resource A, that in
   * turn references resource B, that eventually references the initial resource, the following
   * list will be generated: `["A", "B"]`. Defaults to `new Set()`.
   */
  protected generatePublicSchemaFrom(
    schema: FieldSchema<DataModel>,
    relations: Set<string>,
  ): FieldSchema<DataModel>;

  /**
   * `email` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static email(overrides?: Partial<StringSchema>): StringSchema;

  /**
   * `tinyText` custom data model schema type generator. TODO describe what is a tiny/short/... text
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static tinyText(overrides?: Partial<StringSchema>): StringSchema;

  /**
   * `shortText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static shortText(overrides?: Partial<StringSchema>): StringSchema;

  /**
   * `mediumText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static mediumText(overrides?: Partial<StringSchema>): StringSchema;

  /**
   * `longText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static longText(overrides?: Partial<StringSchema>): StringSchema;

  /**
   * `hugeText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static hugeText(overrides?: Partial<StringSchema>): StringSchema;

  /**
   * `token` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static token(overrides?: Partial<StringSchema>): StringSchema;

  /**
   * `password` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static password(overrides?: Partial<StringSchema>): StringSchema;

  /**
   * `credentials` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static credentials(
    overrides?: Partial<ObjectSchema<unknown>>,
  ): ObjectSchema<unknown>;

  /**
   * Class constructor.
   *
   * @param schema Schema from which to generate data model.
   */
  constructor(schema: DataModelSchema<DataModel>);

  /**
   * Returns public data model schema for `resource`, and all its direct or indirect relations.
   *
   * @param resource Name of the resource for which to get public data model schema.
   *
   * @returns Public data model schema for all related resources if they exist, `null` otherwise.
   */
  public getPublicSchema(resource: keyof DataModel): DataModelSchema<DataModel> | null;
}

/**
 * Structured payload for database storage.
 */
export type StructuredPayload = Record<string, Record<string, unknown>[]>;

/** DBMS-specific formatted query. */
export interface FormattedQuery {
  /** Name of the structure on which to perform the query. */
  structure: string;

  /** When performing a join with another structure, name of the local field to use. */
  localField: string | null;

  /** When performing a join with another structure, name of the foreign field to use. */
  foreignField: string | null;

  /** List of fields to retrieve from database. */
  fields: Record<string, string>;

  /** When performing a sort, list of fields to use, along with the sorting order. */
  sort: Record<string, 1 | -1> | null;

  /** List of sub-joins to perform with this structure. */
  lookups: Record<string, FormattedQuery>;

  /** When filtering results, list of constraints to use. */
  match: { query: Record<string, unknown>[]; filters: Record<string, unknown>[]; } | null;
}

/**
 * Represents metadata for a specific data model resource. This metadata is used to define and
 * create database structures.
 */
export interface ResourceMetadata {
  /** Name of the primary structure. */
  structure: string;

  /** Names of sub-structures associated with the primary structure (e.g. in relational DBMS). */
  subStructures: string[];

  /**
   * Each key represents a path within the data model, and corresponding set contains the names of
   * sub-structures associated with that path. Several sub-structures can be associated to one path,
   * in the case of nested arrays in a relational DBMS. Used to know which entities need to be
   * deleted when updating or deleting a resource.
   */
  subStructuresPerPath: Record<string, Set<string>>;

  /**
   * List of fields in the whole data model referencing that resource. Necessary to simulate a
   * foreign keys system in DBMS that do not support that feature.
   */
  invertedRelations: Map<string, string[]>;

  /** List of indexes definitions for the structure. */
  indexes: { path: string; unique: boolean; }[];

  /**
   * List of additional constraints definitions for the structure (e.g. foreign keys in relational
   * DBMS).
   */
  constraints: { path: string; relation: string; }[];

  /** List of structure fields definitions. */
  fields: unknown;
}

/**
 * Database client settings.
 */
export interface DatabaseClientSettings {
  /** Protocol to use for database connection. */
  protocol: string;

  /** Database hostname. */
  host: string;

  /** Database port. */
  port: number | null;

  /** Username to use to connect to the database. */
  user: string | null;

  /** Password to use to connect to the database. */
  password: string | null;

  /** Database name. */
  database: string;

  /** Maximum number of ms after which to generate a timeout when connecting to the database. */
  connectTimeout: number;

  /** Maximum number of connections to create at once in the connections pool. */
  connectionLimit: number;
}

/**
 * Abstract database client, to use as a blueprint for DBMS-specific implementations.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/AbstractDatabaseClient.ts
 */
export abstract class AbstractDatabaseClient<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
> {
  /** Pattern used to split full-text search queries into separate tokens. */
  protected readonly SPLITTING_TOKENS: RegExp;

  /** Default pagination offset value. */
  protected readonly DEFAULT_OFFSET: number;

  /** Default pagination limit value. */
  protected readonly DEFAULT_LIMIT: number;

  /** Default maximum level of resources depth. */
  protected readonly DEFAULT_MAXIMUM_DEPTH: number;

  /** Default search command options. */
  protected readonly DEFAULT_SEARCH_COMMAND_OPTIONS: SearchCommandOptions;

  /** Default list command options. */
  protected readonly DEFAULT_LIST_COMMAND_OPTIONS: ListCommandOptions;

  /** Default view command options. */
  protected readonly DEFAULT_VIEW_COMMAND_OPTIONS: ViewCommandOptions;

  /** List of payload validators, used to check payloads integrity. */
  protected readonly VALIDATORS: Record<string, (
    path: string,
    payload: unknown,
    schema: FieldSchema<DataModel>,
  ) => void>;

  /** Logging system. */
  protected logger: Logger;

  /** Cache client, used for results caching. */
  protected cache: CacheClient;

  /** Database to use. */
  protected database: string;

  /** Perseid data model to use. */
  protected model: Model;

  /** Whether database client is connected to the server. */
  protected isConnected: boolean;

  /** Resources metadata, used to generate database structure and handle resources deletion. */
  protected resourcesMetadata: Record<string, ResourceMetadata>;

  /**
   * Generates metadata for `resource`, including fields, indexes, and constraints, necessary to
   * generate the database structure and handle resources deletion.
   *
   * @param resource Type of resource for which to generate metadata.
   *
   * @returns Resource metadata.
   */
  protected abstract generateResourceMetadata<Resource extends keyof DataModel & string>(
    resource: Resource,
  ): void;

  /**
   * Returns DBMS-specific formatted query metadata and projections from `fields`.
   *
   * @param resource Type of resource to query.
   *
   * @param fields List of fields to fetch from database.
   *
   * @param maximumDepth Maximum allowed level of resources depth.
   *
   * @param searchBody Optional search body to apply to the request. Defaults to `null`.
   *
   * @param sortBy Optional sorting to apply to the request. Defaults to `{}`.
   *
   * @returns Formatted query, along with projections.
   *
   * @throws If field path does not exist in data model.
   *
   * @throws If field path is not a leaf in data model.
   *
   * @throws If any field path in search body is not indexed.
   *
   * @throws If any field path in sorting is not sortable.
   *
   * @throws If maximum level of resources depth is exceeded.
   */
  protected abstract parseFields<Resource extends keyof DataModel & string>(
    resource: Resource,
    fields: Set<string>,
    maximumDepth: number,
    searchBody?: SearchBody | null,
    sortBy?: Partial<Record<string, 1 | -1>>,
  ): { projections: unknown; formattedQuery: FormattedQuery; };

  /**
   * Generates the final DBMS-specific query from `formattedQuery`.
   *
   * @param resource Type of resource for which to generate database query.
   *
   * @param formattedQuery Formatted query to generate database query from.
   *
   * @returns Final DBMS-specific query.
   */
  protected abstract generateQuery<Resource extends keyof DataModel & string>(
    resource: Resource,
    formattedQuery: FormattedQuery,
  ): unknown;

  /**
   * Recursively formats `payload` into a structured format for database storage.
   *
   * @param resource Type of resource to format.
   *
   * @param resourceId Id of the related resource.
   *
   * @param payload Payload to format.
   *
   * @param mode Whether to structure payload for creation, or just a partial update.
   *
   * @returns Structured format for database storage.
   */
  protected abstract structurePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    resourceId: Id,
    payload: Payload<DataModel[Resource]>,
    mode: 'CREATE' | 'UPDATE',
  ): StructuredPayload;

  /**
   * Formats `results` into a database-agnostic structure, containing only requested fields.
   *
   * @param resource Type of resource to format.
   *
   * @param results List of database raw results to format.
   *
   * @param fields Fields tree used to format results.
   *
   * @param mapping Mapping between DBMS-specific field name and real field path.
   *
   * @returns Formatted results.
   */
  protected abstract formatResources<Resource extends keyof DataModel & string>(
    resource: Resource,
    results: unknown[],
    fields: unknown,
    mapping: Map<string, string>
  ): DataModel[Resource][];

  /**
   * Connects database client to the database server before performing any query, and handles common
   * database server errors. You should always use this method to wrap your code.
   *
   * @param callback Callback to wrap in the error handler.
   *
   * @throws If connection to the server failed.
   *
   * @throws Transformed database error if applicable, original error otherwise.
   */
  protected abstract handleError<T>(callback: () => Promise<T>): Promise<T>;

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
   * Drops the entire database.
   */
  public abstract dropDatabase(): Promise<void>;

  /**
   * Creates the database.
   */
  public abstract createDatabase(): Promise<void>;

  /**
   * Creates missing database structures for current data model.
   */
  public abstract createMissingStructures(): Promise<void>;

  /**
   * Resets the whole underlying database, re-creating structures, indexes, and such.
   */
  public abstract reset(): Promise<void>;

  /**
   * Makes sure that `foreignIds` reference existing resources that match specific conditions.
   *
   * @param foreignIds Foreign ids to check in database.
   *
   * @throws If any foreign id does not exist.
   */
  public abstract checkForeignIds<Resource extends keyof DataModel & string>(
    resource: Resource,
    foreignIds: Map<string, { resource: keyof DataModel & string; filters: SearchFilters; }>,
  ): Promise<void>;

  /**
   * Creates a new resource in database.
   *
   * @param resource Type of resource to create.
   *
   * @param payload New resource payload.
   */
  public abstract create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: DataModel[Resource],
  ): Promise<void>;

  /**
   * Updates resource with id `id` in database.
   *
   * @param resource Type of resource to update.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   *
   * @returns `true` if resource has been successfully updated, `false` otherwise.
   */
  public abstract update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: Payload<DataModel[Resource]>,
  ): Promise<boolean>;

  /**
   * Fetches resource with id `id` from database.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Id of the resource to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Resource if it exists, `null` otherwise.
   */
  public abstract view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options?: ViewCommandOptions,
  ): Promise<DataModel[Resource] | null>;

  /**
   * Fetches a paginated list of resources from database, that match specific filters/query.
   *
   * @param resource Type of resources to fetch.
   *
   * @param body Search/filters body.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public abstract search<Resource extends keyof DataModel & string>(
    resource: Resource,
    body: SearchBody,
    options?: SearchCommandOptions,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Fetches a paginated list of resources from database.
   *
   * @param resource Type of resources to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public abstract list<Resource extends keyof DataModel & string>(
    resource: Resource,
    options?: ListCommandOptions,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Deletes resource with id `id` from database.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource id.
   *
   * @returns `true` if resource has been successfully deleted, `false` otherwise.
   */
  public abstract delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<boolean>;
}

/** MongoDB validation schema. */
interface ValidationSchema {
  bsonType: string[];
  required?: string[];
  items?: ValidationSchema;
  additionalProperties?: boolean;
  properties?: Record<string, ValidationSchema>;
}

/**
 * MongoDB database client.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/MongoDatabaseClient.ts
 */
export class MongoDatabaseClient<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
> extends AbstractDatabaseClient<DataModel, Model> {
  /** MongoDB client instance. */
  protected client: MongoClient;

  /** MongoDB database instance. */
  protected databaseConnection: Db;

  /**
   * Generates metadata for `resource`, including fields, indexes, and constraints, necessary to
   * generate the database structure and handle resources deletion.
   *
   * @param resource Type of resource for which to generate metadata.
   */
  protected generateResourceMetadata<Resource extends keyof DataModel & string>(
    resource: Resource,
  ): void;

  /**
   * Returns DBMS-specific formatted query metadata and projections from `fields`.
   *
   * @param resource Type of resource to query.
   *
   * @param fields List of fields to fetch from database.
   *
   * @param maximumDepth Maximum allowed level of resources depth.
   *
   * @param searchBody Optional search body to apply to the request. Defaults to `null`.
   *
   * @param sortBy Optional sorting to apply to the request. Defaults to `{}`.
   *
   * @returns Formatted query, along with projections.
   *
   * @throws If field path does not exist in data model.
   *
   * @throws If field path is not a leaf in data model.
   *
   * @throws If any field path in search body is not indexed.
   *
   * @throws If any field path in sorting is not sortable.
   *
   * @throws If maximum level of resources depth is exceeded.
   */
  protected parseFields<Resource extends keyof DataModel & string>(
    resource: Resource,
    fields: Set<string>,
    maximumDepth: number,
    searchBody?: SearchBody | null,
    sortBy?: Partial<Record<string, 1 | -1>>,
  ): { projections: unknown; formattedQuery: FormattedQuery; };

  /**
   * Generates the final DBMS-specific query from `formattedQuery`.
   *
   * @param resource Type of resource for which to generate database query.
   *
   * @param formattedQuery Formatted query to generate database query from.
   *
   * @returns Final DBMS-specific query.
   */
  protected generateQuery<Resource extends keyof DataModel & string>(
    resource: Resource,
    formattedQuery: FormattedQuery,
  ): unknown;

  /**
   * Recursively formats `payload` into a structured format for database storage.
   *
   * @param resource Type of resource to format.
   *
   * @param resourceId Id of the related resource.
   *
   * @param payload Payload to format.
   *
   * @param mode Whether to structure payload for creation, or just a partial update.
   *
   * @returns Structured format for database storage.
   */
  protected structurePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    _resourceId: Id,
    payload: Payload<DataModel[Resource]>,
    mode: 'CREATE' | 'UPDATE',
  ): StructuredPayload;

  /**
   * Formats `results` into a database-agnostic structure, containing only requested fields.
   *
   * @param resource Type of resource to format.
   *
   * @param results List of database raw results to format.
   *
   * @param fields Fields tree used to format results.
   *
   * @param mapping Mapping between DBMS-specific field name and real field path.
   *
   * @returns Formatted results.
   */
  protected formatResources<Resource extends keyof DataModel & string>(
    resource: Resource,
    results: unknown[],
    fields: unknown,
  ): DataModel[Resource][];

  /**
   * Makes sure that no resource references resource with id `id`.
   *
   * @param resource Type of resource to check.
   *
   * @param id Id of the resource to check for references.
   *
   * @throws If any other resource still references resource.
   */
  protected checkReferencesTo<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<void>;

  /**
   * Connects database client to the database server before performing any query, and handles common
   * database server errors. You should always use this method to wrap your code.
   *
   * @param callback Callback to wrap in the error handler.
   *
   * @throws If connection to the server failed.
   *
   * @throws Transformed database error if applicable, original error otherwise.
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
   * Drops the entire database.
   */
  public dropDatabase(): Promise<void>;

  /**
   * Creates the database.
   */
  public createDatabase(): Promise<void>;

  /**
   * Creates missing database structures for current data model.
   */
  public createMissingStructures(): Promise<void>;

  /**
   * Resets the whole underlying database, re-creating structures, indexes, and such.
   */
  public reset(): Promise<void>;

  /**
   * Makes sure that `foreignIds` reference existing resources that match specific conditions.
   *
   * @param foreignIds Foreign ids to check in database.
   *
   * @throws If any foreign id does not exist.
   */
  public checkForeignIds<Resource extends keyof DataModel & string>(
    _resource: Resource,
    foreignIds: Map<string, { resource: keyof DataModel & string; filters: SearchFilters; }>,
  ): Promise<void>;

  /**
   * Creates a new resource in database.
   *
   * @param resource Type of resource to create.
   *
   * @param payload New resource payload.
   */
  public create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: DataModel[Resource],
  ): Promise<void>;

  /**
   * Updates resource with id `id` in database.
   *
   * @param resource Type of resource to update.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   *
   * @returns `true` if resource has been successfully updated, `false` otherwise.
   */
  public update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: Payload<DataModel[Resource]>,
  ): Promise<boolean>;

  /**
   * Fetches resource with id `id` from database.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Id of the resource to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Resource if it exists, `null` otherwise.
   */
  public view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options?: ViewCommandOptions,
  ): Promise<DataModel[Resource] | null>;

  /**
   * Fetches a paginated list of resources from database, that match specific filters/query.
   *
   * @param resource Type of resources to fetch.
   *
   * @param body Search/filters body.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public search<Resource extends keyof DataModel & string>(
    resource: Resource,
    body: SearchBody,
    options?: SearchCommandOptions,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Fetches a paginated list of resources from database.
   *
   * @param resource Type of resources to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public list<Resource extends keyof DataModel & string>(
    resource: Resource,
    options?: ListCommandOptions,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Deletes resource with id `id` from database.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource id.
   *
   * @returns `true` if resource has been successfully deleted, `false` otherwise.
   */
  public delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<boolean>;
}

/**
 * MySQL database client.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/MySQLDatabaseClient.ts
 */
export class MySQLDatabaseClient<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
> extends AbstractDatabaseClient<DataModel, Model> {
  /** Data model types <> SQL types mapping, for tables creation. */
  protected readonly SQL_TYPES_MAPPING: Record<string, string>;

  /** SQL sorting keywords. */
  protected readonly SQL_SORT_MAPPING: Record<1 | -1, string>;

  /** MySQL client instance. */
  protected client: mysql.Pool;

  /** Used to format ArrayBuffers into strings. */
  protected textDecoder: TextDecoder;

  /** Used to format strings into ArrayBuffers. */
  protected textEncoder: TextEncoder;

  /**
   * Generates metadata for `resource`, including fields, indexes, and constraints, necessary to
   * generate the database structure and handle resources deletion.
   *
   * @param resource Type of resource for which to generate metadata.
   *
   * @returns Resource metadata.
   */
  protected generateResourceMetadata<Resource extends keyof DataModel & string>(
    resource: Resource,
  ): void;

  /**
   * Returns DBMS-specific formatted query metadata and projections from `fields`.
   *
   * @param resource Type of resource to query.
   *
   * @param fields List of fields to fetch from database.
   *
   * @param maximumDepth Maximum allowed level of resources depth.
   *
   * @param searchBody Optional search body to apply to the request. Defaults to `null`.
   *
   * @param sortBy Optional sorting to apply to the request. Defaults to `{}`.
   *
   * @returns Formatted query, along with projections.
   *
   * @throws If field path does not exist in data model.
   *
   * @throws If field path is not a leaf in data model.
   *
   * @throws If any field path in search body is not indexed.
   *
   * @throws If any field path in sorting is not sortable.
   *
   * @throws If maximum level of resources depth is exceeded.
   */
  protected parseFields<Resource extends keyof DataModel & string>(
    resource: Resource,
    fields: Set<string>,
    maximumDepth: number,
    searchBody?: SearchBody | null,
    sortBy?: Partial<Record<string, 1 | -1>>,
  ): { projections: unknown; formattedQuery: FormattedQuery; };

  /**
   * Generates the final DBMS-specific query from `formattedQuery`.
   *
   * @param resource Type of resource for which to generate database query.
   *
   * @param formattedQuery Formatted query to generate database query from.
   *
   * @param isSearchQuery Whether query is a search query or a simple `SELECT`. Defaults to `false`.
   *
   * @param textIndent Current indent. Used to improve SQL statement legibility. Defaults to `""`.
   *
   * @returns Final DBMS-specific query.
   */
  protected generateQuery<Resource extends keyof DataModel>(
    resource: Resource,
    formattedQuery: FormattedQuery,
    textIndent?: string,
  ): string;

  /**
   * Recursively formats `payload` into a structured format for database storage.
   *
   * @param resource Type of resource to format.
   *
   * @param resourceId Id of the related resource.
   *
   * @param payload Payload to format.
   *
   * @param mode Whether to structure payload for creation, or just a partial update.
   *
   * @returns Structured format for database storage.
   */
  protected structurePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    resourceId: Id,
    payload: Payload<DataModel[Resource]>,
    mode: 'CREATE' | 'UPDATE',
  ): StructuredPayload;

  /**
   * Formats `results` into a database-agnostic structure, containing only requested fields.
   *
   * @param resource Type of resource to format.
   *
   * @param results List of database raw results to format.
   *
   * @param fields Fields tree used to format results.
   *
   * @param mapping Mapping between DBMS-specific field name and real field path.
   *
   * @returns Formatted results.
   */
  protected formatResources<Resource extends keyof DataModel & string>(
    resource: Resource,
    results: unknown[],
    fields: unknown,
    mapping: Map<string, string>,
  ): DataModel[Resource][];

  /**
   * Connects database client to the database server before performing any query, and handles common
   * database server errors. You should always use this method to wrap your code.
   *
   * @param callback Callback to wrap in the error handler.
   *
   * @throws If connection to the server failed.
   *
   * @throws Transformed database error if applicable, original error otherwise.
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
   * Drops the entire database.
   */
  public dropDatabase(): Promise<void>;

  /**
   * Creates the database.
   */
  public createDatabase(): Promise<void>;

  /**
   * Creates missing database structures for current data model.
   */
  public createMissingStructures(): Promise<void>;

  /**
   * Resets the whole underlying database, re-creating structures, indexes, and such.
   */
  public reset(): Promise<void>;

  /**
   * Makes sure that `foreignIds` reference existing resources that match specific conditions.
   *
   * @param foreignIds Foreign ids to check in database.
   *
   * @throws If any foreign id does not exist.
   */
  public checkForeignIds<Resource extends keyof DataModel & string>(
    _resource: Resource,
    foreignIds: Map<string, { resource: keyof DataModel & string; filters: SearchFilters; }>,
  ): Promise<void>;

  /**
   * Creates a new resource in database.
   *
   * @param resource Type of resource to create.
   *
   * @param payload New resource payload.
   */
  public create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: DataModel[Resource],
  ): Promise<void>;

  /**
   * Updates resource with id `id` in database.
   *
   * @param resource Type of resource to update.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   *
   * @returns `true` if resource has been successfully updated, `false` otherwise.
   */
  public update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: Payload<DataModel[Resource]>,
  ): Promise<boolean>;

  /**
   * Fetches resource with id `id` from database.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Id of the resource to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Resource if it exists, `null` otherwise.
   */
  public view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options?: ViewCommandOptions,
  ): Promise<DataModel[Resource] | null>;

  /**
   * Fetches a paginated list of resources from database, that match specific filters/query.
   *
   * @param resource Type of resources to fetch.
   *
   * @param body Search/filters body.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public search<Resource extends keyof DataModel & string>(
    resource: Resource,
    body: SearchBody,
    options?: SearchCommandOptions,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Fetches a paginated list of resources from database.
   *
   * @param resource Type of resources to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public list<Resource extends keyof DataModel & string>(
    resource: Resource,
    options?: ListCommandOptions,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Deletes resource with id `id` from database.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource id.
   *
   * @returns `true` if resource has been successfully deleted, `false` otherwise.
   */
  public delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<boolean>;
}

/**
 * PostgreSQL database client.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/PostgreSQLDatabaseClient.ts
 */
export class PostgreSQLDatabaseClient<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
> extends AbstractDatabaseClient<DataModel, Model> {
  /** Data model types <> SQL types mapping, for tables creation. */
  protected readonly SQL_TYPES_MAPPING: Record<string, string>;

  /** SQL sorting keywords. */
  protected readonly SQL_SORT_MAPPING: Record<1 | -1, string>;

  /** PostgreSQL client instance. */
  protected client: pg.Pool;

  /** PostgreSQL database connection settings. Necessary to reset pool after dropping database. */
  protected databaseSettings: DatabaseClientSettings;

  /** Used to format ArrayBuffers into strings. */
  protected textDecoder: TextDecoder;

  /** Used to format strings into ArrayBuffers. */
  protected textEncoder: TextEncoder;

  /**
   * Generates metadata for `resource`, including fields, indexes, and constraints, necessary to
   * generate the database structure and handle resources deletion.
   *
   * @param resource Type of resource for which to generate metadata.
   *
   * @returns Resource metadata.
   */
  protected generateResourceMetadata<Resource extends keyof DataModel & string>(
    resource: Resource,
  ): void;

  /**
   * Returns DBMS-specific formatted query metadata and projections from `fields`.
   *
   * @param resource Type of resource to query.
   *
   * @param fields List of fields to fetch from database.
   *
   * @param maximumDepth Maximum allowed level of resources depth.
   *
   * @param searchBody Optional search body to apply to the request. Defaults to `null`.
   *
   * @param sortBy Optional sorting to apply to the request. Defaults to `{}`.
   *
   * @returns Formatted query, along with projections.
   *
   * @throws If field path does not exist in data model.
   *
   * @throws If field path is not a leaf in data model.
   *
   * @throws If any field path in search body is not indexed.
   *
   * @throws If any field path in sorting is not sortable.
   *
   * @throws If maximum level of resources depth is exceeded.
   */
  protected parseFields<Resource extends keyof DataModel & string>(
    resource: Resource,
    fields: Set<string>,
    maximumDepth: number,
    searchBody?: SearchBody | null,
    sortBy?: Partial<Record<string, 1 | -1>>,
  ): { projections: unknown; formattedQuery: FormattedQuery; };

  /**
   * Generates the final DBMS-specific query from `formattedQuery`.
   *
   * @param resource Type of resource for which to generate database query.
   *
   * @param formattedQuery Formatted query to generate database query from.
   *
   * @param isSearchQuery Whether query is a search query or a simple `SELECT`. Defaults to `false`.
   *
   * @param textIndent Current indent. Used to improve SQL statement legibility. Defaults to `""`.
   *
   * @param startPlaceholderIndex Current placeholder index. Defaults to `1`.
   *
   * @returns Final DBMS-specific query.
   */
  protected generateQuery<Resource extends keyof DataModel>(
    resource: Resource,
    formattedQuery: FormattedQuery,
    textIndent?: string,
    startPlaceholderIndex?: number,
  ): string;

  /**
   * Recursively formats `payload` into a structured format for database storage.
   *
   * @param resource Type of resource to format.
   *
   * @param resourceId Id of the related resource.
   *
   * @param payload Payload to format.
   *
   * @param mode Whether to structure payload for creation, or just a partial update.
   *
   * @returns Structured format for database storage.
   */
  protected structurePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    resourceId: Id,
    payload: Payload<DataModel[Resource]>,
    mode: 'CREATE' | 'UPDATE',
  ): StructuredPayload;

  /**
   * Formats `results` into a database-agnostic structure, containing only requested fields.
   *
   * @param resource Type of resource to format.
   *
   * @param results List of database raw results to format.
   *
   * @param fields Fields tree used to format results.
   *
   * @param mapping Mapping between DBMS-specific field name and real field path.
   *
   * @returns Formatted results.
   */
  protected formatResources<Resource extends keyof DataModel & string>(
    resource: Resource,
    results: unknown[],
    fields: unknown,
    mapping: Map<string, string>,
  ): DataModel[Resource][];

  /**
   * Connects database client to the database server before performing any query, and handles common
   * database server errors. You should always use this method to wrap your code.
   *
   * @param callback Callback to wrap in the error handler.
   *
   * @throws If connection to the server failed.
   *
   * @throws Transformed database error if applicable, original error otherwise.
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
   * Drops the entire database.
   */
  public dropDatabase(): Promise<void>;

  /**
   * Creates the database.
   */
  public createDatabase(): Promise<void>;

  /**
   * Creates missing database structures for current data model.
   */
  public createMissingStructures(): Promise<void>;

  /**
   * Resets the whole underlying database, re-creating structures, indexes, and such.
   */
  public reset(): Promise<void>;

  /**
   * Makes sure that `foreignIds` reference existing resources that match specific conditions.
   *
   * @param foreignIds Foreign ids to check in database.
   *
   * @throws If any foreign id does not exist.
   */
  public checkForeignIds<Resource extends keyof DataModel & string>(
    _resource: Resource,
    foreignIds: Map<string, { resource: keyof DataModel & string; filters: SearchFilters; }>,
  ): Promise<void>;

  /**
   * Creates a new resource in database.
   *
   * @param resource Type of resource to create.
   *
   * @param payload New resource payload.
   */
  public create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: DataModel[Resource],
  ): Promise<void>;

  /**
   * Updates resource with id `id` in database.
   *
   * @param resource Type of resource to update.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   *
   * @returns `true` if resource has been successfully updated, `false` otherwise.
   */
  public update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: Payload<DataModel[Resource]>,
  ): Promise<boolean>;

  /**
   * Fetches resource with id `id` from database.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Id of the resource to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Resource if it exists, `null` otherwise.
   */
  public view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options?: ViewCommandOptions,
  ): Promise<DataModel[Resource] | null>;

  /**
   * Fetches a paginated list of resources from database, that match specific filters/query.
   *
   * @param resource Type of resources to fetch.
   *
   * @param body Search/filters body.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public search<Resource extends keyof DataModel & string>(
    resource: Resource,
    body: SearchBody,
    options?: SearchCommandOptions,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Fetches a paginated list of resources from database.
   *
   * @param resource Type of resources to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public list<Resource extends keyof DataModel & string>(
    resource: Resource,
    options?: ListCommandOptions,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Deletes resource with id `id` from database.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource id.
   *
   * @returns `true` if resource has been successfully deleted, `false` otherwise.
   */
  public delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<boolean>;
}

/**
 * Perseid engine, contains all the basic CRUD methods.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/Engine.ts
 */
export class Engine<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  DatabaseClient extends AbstractDatabaseClient<DataModel> = AbstractDatabaseClient<DataModel>,
> {
  /** Data model. */
  protected model: Model;

  /** Logging system. */
  protected logger: Logger;

  /** Database client. */
  protected databaseClient: DatabaseClient;

  /**
   * Makes sure that user has all necessary permissions to perform `operation`.
   *
   * @param operation Name of the operation to perform.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param payload Operation payload, if applicable, `null` otherwise.
   *
   * @param context Request context.
   *
   * @throws If user email address is not yet verified.
   *
   * @throws If user is missing any of the required permissions.
   *
   * @throws If user account is not verified yet.
   */
  protected rbac<Resource extends keyof DataModel & string>(
    requiredPermissions: Set<string>,
    existingResource: DataModel[Resource] | null,
    payload: unknown,
    context: CommandContext<DataModel>,
  ): Promise<void>;

  /**
   * Parses `fields`, making sure they are all valid paths in `resource` data model, transforming
   * `*` specific statements into the proper list of sub-fields, and checking user permissions for
   * specific fields.
   *
   * @param resource Type of resource for which to parse fields.
   *
   * @param fields List of fields to fetch from database.
   *
   * @param context Command context.
   *
   * @param maximumDepth Maximum allowed level of resources depth. Defaults to `3`.
   *
   * @returns List of parsed fields.
   *
   * @throws If field path does not exist in data model.
   *
   * @throws If maximum level of resources depth is exceeded.
   *
   * @throws If user does not have sufficient permissions to access to any of the fields.
   */
  protected parseFields<Resource extends keyof DataModel & string>(
    resource: Resource,
    fields: Set<string>,
    maximumDepth?: number,
  ): {
    fields: Set<string>;
    permissions: Set<string>;
  };

  /**
   * Returns the list of fields to fetch when retrieving an existing resource for update.
   *
   * @param resource Type of resource for which to get existing fields.
   *
   * @returns Fields list.
   */
  protected getResourceFields<Resource extends keyof DataModel & string>(
    resource: Resource,
  ): Set<string>;

  /**
   * Returns filters to apply when checking foreign ids referencing other relations.
   *
   * @param resource Type of resource for which to return filters.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param path Path to the relation reference in data model.
   *
   * @param ids List of foreign ids to check.
   *
   * @param payload Payload for updating or creating resource.
   *
   * @param context Command context.
   *
   * @returns Filters to apply to check foreign ids.
   */
  protected getRelationFilters<Resource extends keyof DataModel & string>(
    resource: Resource,
    existingResource: DataModel[Resource] | null,
    path: string,
    ids: Id[],
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): SearchFilters;

  /**
   * Returns updated `payload` with automatic fields.
   *
   * @param resource Type of resource for which to generate automatic fields.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param payload Payload to update.
   *
   * @param context Command context.
   *
   * @returns Payload with automatic fields.
   */
  protected withAutomaticFields<Resource extends keyof DataModel & string>(
    resource: Resource,
    existingResource: DataModel[Resource] | null,
    payload: Payload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>>;

  /**
   * Performs specific checks `payload` to make sure it is valid, and updates it if necessary.
   *
   * @param resource Type of resource for which to check and update payload.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   */
  protected checkAndUpdatePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    existingResource: DataModel[Resource] | null,
    payload: Payload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>>;

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
   * Resets the whole system, including database.
   */
  public reset(...args: unknown[]): Promise<void>;

  /**
   * Generates full command context.
   *
   * @param userId Id of the user to populate context with.
   *
   * @param deviceId Device id to add to the context.
   *
   * @param userAgent User agent to add to the context.
   *
   * @returns Generated command context.
   *
   * @throws If user does not exist.
   */
  public generateContext(
    userId: Id,
    deviceId?: string,
    userAgent?: string,
  ): Promise<CommandContext<DataModel>>;

  /**
   * Creates a new resource.
   *
   * @param resource Type of resource to create.
   *
   * @param payload New resource payload.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Newly created resource.
   */
  public create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]>;

  /**
   * Updates resource with id `id`.
   *
   * @param resource Type of resource to update.
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
  public update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    options: ViewCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]>;

  /**
   * Fetches resource with id `id`.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Resource id.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]>;

  /**
   * Fetches a paginated list of resources.
   *
   * @param resource Type of resources to fetch.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Paginated list of resources.
   */
  public list<Resource extends keyof DataModel & string>(
    resource: Resource,
    options: ListCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Fetches a paginated list of resources matching `searchBody` constraints.
   *
   * @param resource Type of resources to fetch.
   *
   * @param searchBody Search body (filters, text query) to filter resources with.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Paginated list of resources.
   */
  public search<Resource extends keyof DataModel & string>(
    resource: Resource,
    searchBody: SearchBody,
    options: SearchCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<Results<DataModel[Resource]>>;

  /**
   * Deletes resource with id `id`.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource id.
   *
   * @param context Command context.
   *
   * @param context Command context.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<void>;
}

/**
 * Generated credentials.
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
 * Users engine settings.
 */
export interface UsersEngineSettings {
  /** Application base URL. */
  baseUrl: string;

  /** Auth configuration. */
  auth: {
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
 * Perseid engine extended with auth-related methods.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/UsersEngine.ts
 */
export class UsersEngine<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  DatabaseClient extends AbstractDatabaseClient<DataModel> = AbstractDatabaseClient<DataModel>,
> extends Engine<DataModel, Model, DatabaseClient> {
  /** Default duration before a refresh token expires. */
  protected readonly REFRESH_TOKEN_DURATION: number; // 30 days.

  /** Email client to use. */
  protected emailClient: EmailClient;

  /** Cache client to use. */
  protected cacheClient: CacheClient;

  /** Auth engine settings. */
  protected settings: UsersEngineSettings;

  /**
   * Generates new credentials (refresh/access tokens) for `userId` and `deviceId`.
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
   * Returns updated `payload` with automatic fields.
   *
   * @param resource Type of resource for which to generate automatic fields.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param payload Payload to update.
   *
   * @param context Command context.
   *
   * @returns Payload with automatic fields.
   */
  protected withAutomaticFields<Resource extends keyof DataModel & string>(
    resource: Resource,
    existingResource: DataModel[Resource] | null,
    payload: Payload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>>;

  /**
   * Performs specific checks `payload` to make sure it is valid, and updates it if necessary.
   *
   * @param resource Type of resource for which to check and update payload.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   */
  protected checkAndUpdatePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    existingResource: DataModel[Resource] | null,
    payload: Payload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>>;

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
    settings: UsersEngineSettings,
  );

  /**
   * Resets the whole system, including database, and re-creates root role and user.
   *
   * @param rootEmail Email to use for root user.
   *
   * @param rootPassword Password to use for root user.
   */
  public reset(rootEmail: string, rootPassword: string): Promise<void>;

  /**
   * Creates a new resource.
   *
   * @param resource Type of resource to create.
   *
   * @param payload New resource payload.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Newly created resource.
   */
  public create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]>;

  /**
   * Fetches information about current user.
   *
   * @param context Command context.
   *
   * @returns User information.
   */
  public viewMe(context: CommandContext<DataModel>): Promise<DataModel['users']>;

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
    context: CommandContext<DataModel>,
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
    email: DataModel['users']['email'],
    password: DataModel['users']['password'],
    passwordConfirmation: DataModel['users']['password'],
    context: CommandContext<DataModel>,
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
    context: Omit<CommandContext<DataModel>, 'user'>,
  ): Promise<Credentials>;

  /**
   * Sends a new verification email to connected user.
   *
   * @param context Command context.
   *
   * @throws If user email is already verified.
   */
  public requestEmailVerification(context: CommandContext<DataModel>): Promise<void>;

  /**
   * Verifies email of the connected user.
   *
   * @param token Verification token that was sent in the verification email.
   *
   * @param context Command context.
   *
   * @throws If verification token is not valid.
   */
  public verifyEmail(
    verificationToken: string,
    context: CommandContext<DataModel>,
  ): Promise<void>;

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
    password: DataModel['users']['password'],
    passwordConfirmation: DataModel['users']['password'],
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
  public refreshToken(
    refreshToken: string,
    context: CommandContext<DataModel>,
  ): Promise<Credentials>;

  /**
   * Signs connected user out.
   *
   * @param context Command context.
   */
  public signOut(context: CommandContext<DataModel>): Promise<void>;
}

interface Validate { errors: { keyword: string; }[]; }

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
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/Controller.ts
 */
export class Controller<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  Engine extends UsersEngine<DataModel> = UsersEngine<DataModel>,
> {
  /** HTTP 404 error code. */
  protected readonly NOT_FOUND_CODE: string;

  /** `fields` built-in query param schema. */
  protected readonly FIELDS_QUERY_PARAM_SCHEMA: StringSchema;

  /** `limit` built-in query param schema. */
  protected readonly LIMIT_QUERY_PARAM_SCHEMA: NumberSchema;

  /** `offset` built-in query param schema. */
  protected readonly OFFSET_QUERY_PARAM_SCHEMA: NumberSchema;

  /** `sortBy` built-in query param schema. */
  protected readonly SORT_BY_QUERY_PARAM_SCHEMA: StringSchema;

  /** `sortOrder` built-in query param schema. */
  protected readonly SORT_ORDER_QUERY_PARAM_SCHEMA: StringSchema;

  /** List of special Ajv keywords, used to format special types on the fly. */
  protected readonly AJV_KEYWORDS: KeywordDefinition[];

  /** List of Ajv formatters, used to format a perseid data model into its Ajv equivalent. */
  protected readonly AJV_FORMATTERS: Record<string, (
    model: FieldSchema<DataModel>,
    requireAllFields: boolean,
  ) => AjvValidationSchema>;

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
  protected parseInt: (value: string) => number;

  /** Used to format ArrayBuffers into strings. */
  protected textDecoder: TextDecoder;

  /** Increment used for `multipart/form-data` payloads parsing. */
  protected increment: number;

  /** Ajv instance for payloads validation. */
  protected ajv: Ajv;

  /** Whether to automatically handle CORS (usually in development mode). */
  protected handleCORS: boolean;

  /**
   * Handles HTTP 404 errors.
   */
  protected handleNotFound(): void;

  /**
   * Formats `error`.
   *
   * @param error Error to format.
   *
   * @param payloadType Type of payload that failed validation.
   *
   * @returns Formatted error.
   */
  protected formatError(error: unknown, payloadType: string): BadRequest;

  /**
   * Formats `output` to match fastify data types specifications.
   *
   * @param output Output to format.
   *
   * @returns Formatted output.
   */
  protected formatOutput(output: unknown): unknown;

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
  };

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
  protected auth(
    accessToken: string,
    deviceId: string,
    ignoreExpiration?: boolean,
  ): Promise<DataModel['users']>;

  /**
   * Catches and handles most common API errors thrown by `callback`.
   *
   * @param callback Callback to wrap.
   *
   * @returns Wrapped callback.
   */
  protected catchErrors<T>(callback: () => Promise<T>): Promise<T>;

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
  );
}

/**
 * Custom endpoint configuration.
 */
export interface ExpressCustomEndpoint<
  DataModel extends DefaultDataModel
> extends CustomEndpoint<DataModel> {
  /** Actual endpoint handler. */
  handler: (request: Request, response: Response) => Promise<void>;
}

/**
 * API controller, designed for Express framework.
 */
export class ExpressController<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  Engine extends UsersEngine<DataModel> = UsersEngine<DataModel>,
> extends Controller<DataModel, Model, Engine> {
  /** Built-in API handlers for auth-related endpoints. */
  protected apiHandlers: Record<string, ExpressCustomEndpoint<DataModel>>;

  /**
   * Handles thrown errors and formats a clean HTTP response.
   *
   * @param error Error thrown by express.
   *
   * @param request Express request.
   *
   * @param response Express response.
   */
  protected handleError(
    error: unknown,
    request: Request,
    response: Response,
    next: NextFunction,
  ): void;

  /**
   * Creates a new express endpoint from `settings`.
   *
   * @param settings Endpoint configuration.
   *
   * @returns Express endpoint to register.
   */
  public createEndpoint(settings: ExpressCustomEndpoint<DataModel>): {
    handler: RequestHandler;
  };

  /**
   * Registers hooks, handlers, auth and CRUD-related endpoints to `instance`.
   *
   * @param instance Express instance to register endpoints and hooks to.
   *
   * @param options Additional options to pass to express `register` function.
   */
  public createEndpoints(
    instance: Application,
    options?: { prefix?: string; },
  ): Promise<void>;
}

/**
 * Custom endpoint configuration.
 */
export interface FastifyCustomEndpoint<
  DataModel extends DefaultDataModel
> extends CustomEndpoint<DataModel> {
  /** Actual endpoint handler. */
  handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
}

/**
 * API controller, designed for Fastify framework.
 */
export class FastifyController<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  Engine extends UsersEngine<DataModel> = UsersEngine<DataModel>,
> extends Controller<DataModel, Model, Engine> {
  /** Built-in API handlers for auth-related endpoints. */
  protected apiHandlers: Record<string, FastifyCustomEndpoint<DataModel>>;

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
  ): Promise<void>;

  /**
   * Creates a new fastify endpoint from `settings`.
   *
   * @param settings Endpoint configuration.
   *
   * @returns Fastify endpoint to register.
   */
  public createEndpoint(settings: FastifyCustomEndpoint<DataModel>): {
    handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
  };

  /**
   * Registers hooks, handlers, auth and CRUD-related endpoints to `instance`.
   *
   * @param instance Fastify instance to register endpoints and hooks to.
   *
   * @param options Additional options to pass to fastify `register` function.
   */
  public createEndpoints(
    instance: FastifyInstance,
    options?: { prefix?: string; },
  ): Promise<void>;
}
