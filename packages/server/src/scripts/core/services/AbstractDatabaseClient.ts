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
  type Results,
  type IdSchema,
  type DateSchema,
  type FieldSchema,
  type ArraySchema,
  type BinarySchema,
  type NumberSchema,
  type StringSchema,
  type ObjectSchema,
  type BooleanSchema,
  type DefaultDataModel,
} from '@perseid/core';
import type Logger from 'scripts/core/services/Logger';
import DatabaseError from 'scripts/core/errors/Database';
import type BaseModel from 'scripts/core/services/Model';
import type CacheClient from 'scripts/core/services/CacheClient';

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
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/AbstractDatabaseClient.ts
 */
export default abstract class AbstractDatabaseClient<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
> {
  /** Pattern used to split full-text search queries into separate tokens. */
  protected readonly SPLITTING_TOKENS = /[ \-,.?=*\\/()'"`|+!:;[\]{}]/;

  /** Default pagination offset value. */
  protected readonly DEFAULT_OFFSET = 0;

  /** Default pagination limit value. */
  protected readonly DEFAULT_LIMIT = 20;

  /** Default maximum level of resources depth. */
  protected readonly DEFAULT_MAXIMUM_DEPTH = 3;

  /** Default search command options. */
  protected readonly DEFAULT_SEARCH_COMMAND_OPTIONS: SearchCommandOptions = {};

  /** Default list command options. */
  protected readonly DEFAULT_LIST_COMMAND_OPTIONS: ListCommandOptions = {};

  /** Default view command options. */
  protected readonly DEFAULT_VIEW_COMMAND_OPTIONS: ViewCommandOptions = {};

  /** List of payload validators, used to check payloads integrity. */
  protected readonly VALIDATORS: Record<string, (
    path: string,
    payload: unknown,
    schema: FieldSchema<DataModel>,
  ) => void> = {
      null(path, payload) {
        if (payload !== null) {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }
      },
      boolean(path, payload, schema) {
        const { isRequired } = schema as BooleanSchema;

        if ((payload !== null || isRequired) && payload !== false && payload !== true) {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }
      },
      id(path, payload, schema) {
        const { enum: enumerations, isRequired } = schema as IdSchema<DataModel>;

        if ((payload !== null || isRequired) && !(payload instanceof Id)) {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }

        if (payload !== null) {
          const isSameId = (value: Id): boolean => String(value) === String(payload);
          if (enumerations !== undefined && !enumerations.some(isSameId)) {
            throw new DatabaseError('INVALID_FIELD_VALUE', { path });
          }
        }
      },
      date(path, payload, schema) {
        const { enum: enumerations, isRequired } = schema as DateSchema;

        if ((payload !== null || isRequired)
          && (!(payload instanceof Date) || Number.isNaN(payload))
        ) {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }

        if (payload !== null) {
          const isSameDate = (value: Date): boolean => value.getTime() === payload.getTime();
          if (enumerations !== undefined && !enumerations.some(isSameDate)) {
            throw new DatabaseError('INVALID_FIELD_VALUE', { path });
          }
        }
      },
      binary(path, payload, schema) {
        const { isRequired } = schema as BinarySchema;

        if (
          (payload !== null || isRequired)
          && !(payload instanceof ArrayBuffer)
          && !(payload instanceof Buffer)
        ) {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }
      },
      float(path, payload, schema) {
        const tolerance = 1e-10;
        const { maximum, minimum } = schema as NumberSchema;
        const { exclusiveMaximum, exclusiveMinimum } = schema as NumberSchema;
        const { isRequired, enum: enumerations, multipleOf } = schema as NumberSchema;

        if ((payload !== null || isRequired) && typeof payload !== 'number') {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }

        if (payload !== null) {
          if (maximum !== undefined && payload > maximum) {
            throw new DatabaseError('FIELD_VALUE_ABOVE_MAXIMUM', { path });
          }

          if (exclusiveMaximum !== undefined && payload >= exclusiveMaximum) {
            throw new DatabaseError('FIELD_VALUE_ABOVE_STRICT_MAXIMUM', { path });
          }

          if (minimum !== undefined && payload < minimum) {
            throw new DatabaseError('FIELD_VALUE_BELOW_MINIMUM', { path });
          }

          if (exclusiveMinimum !== undefined && payload <= exclusiveMinimum) {
            throw new DatabaseError('FIELD_VALUE_BELOW_STRICT_MINIMUM', { path });
          }

          if (enumerations !== undefined && !enumerations.includes(payload)) {
            throw new DatabaseError('INVALID_FIELD_VALUE', { path });
          }

          if (multipleOf !== undefined && Math.abs(payload % multipleOf) >= tolerance) {
            throw new DatabaseError('INVALID_FIELD_VALUE', { path });
          }
        }
      },
      integer(path, payload, schema) {
        const { maximum, minimum } = schema as NumberSchema;
        const { exclusiveMaximum, exclusiveMinimum } = schema as NumberSchema;
        const { isRequired, enum: enumerations, multipleOf } = schema as NumberSchema;

        if ((payload !== null || isRequired) && typeof payload !== 'number') {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }

        if (payload !== null) {
          if (maximum !== undefined && payload > maximum) {
            throw new DatabaseError('FIELD_VALUE_ABOVE_MAXIMUM', { path });
          }

          if (exclusiveMaximum !== undefined && payload >= exclusiveMaximum) {
            throw new DatabaseError('FIELD_VALUE_ABOVE_STRICT_MAXIMUM', { path });
          }

          if (minimum !== undefined && payload < minimum) {
            throw new DatabaseError('FIELD_VALUE_BELOW_MINIMUM', { path });
          }

          if (exclusiveMinimum !== undefined && payload <= exclusiveMinimum) {
            throw new DatabaseError('FIELD_VALUE_BELOW_STRICT_MINIMUM', { path });
          }

          if (enumerations !== undefined && !enumerations.includes(payload)) {
            throw new DatabaseError('INVALID_FIELD_VALUE', { path });
          }

          if (multipleOf !== undefined && payload % multipleOf !== 0) {
            throw new DatabaseError('INVALID_FIELD_VALUE', { path });
          }
        }
      },
      string(path, payload, schema) {
        const { isRequired, enum: enumerations } = schema as StringSchema;
        const { maxLength, minLength, pattern } = schema as StringSchema;

        if ((payload !== null || isRequired) && typeof payload !== 'string') {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }

        if (payload !== null) {
          if (maxLength !== undefined && payload.length > maxLength) {
            throw new DatabaseError('FIELD_VALUE_TOO_LONG', { path });
          }

          if (payload.trim().length === 0) {
            throw new DatabaseError('FIELD_VALUE_TOO_SHORT', { path });
          }

          if (minLength !== undefined && payload.length < minLength) {
            throw new DatabaseError('FIELD_VALUE_TOO_SHORT', { path });
          }

          if (pattern !== undefined && !new RegExp(pattern).test(payload)) {
            throw new DatabaseError('FIELD_VALUE_PATTERN_MISMATCH', { path });
          }

          if (enumerations !== undefined && !enumerations.includes(payload)) {
            throw new DatabaseError('INVALID_FIELD_VALUE', { path });
          }
        }
      },
      array: (path, payload, schema) => {
        const { isRequired } = schema as ArraySchema<DataModel>;
        const { maxItems, minItems, uniqueItems } = schema as ArraySchema<DataModel>;

        if ((payload !== null || isRequired) && !Array.isArray(payload)) {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }

        if (payload !== null) {
          if (maxItems !== undefined && payload.length > maxItems) {
            throw new DatabaseError('FIELD_VALUE_ABOVE_MAXIMUM_ITEMS', { path });
          }

          if (minItems !== undefined && payload.length < minItems) {
            throw new DatabaseError('FIELD_VALUE_BELOW_MINIMUM_ITEMS', { path });
          }

          if (uniqueItems && (new Set(payload)).size !== payload.length) {
            throw new DatabaseError('FIELD_VALUE_HAS_DUPLICATE_ITEMS', { path });
          }
        }
      },
      object: (path, payload, schema) => {
        const { isRequired } = schema as ObjectSchema<DataModel>;

        if ((payload !== null || isRequired) && !isPlainObject(payload)) {
          throw new DatabaseError('INVALID_FIELD_TYPE', { path });
        }
      },
    };

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
  ) {
    this.cache = cache;
    this.model = model;
    this.logger = logger;
    this.isConnected = false;
    this.resourcesMetadata = {};
    this.database = settings.database;
    // This step is necessary to make sure all resource metadata skeletons exist before updating
    // their `invertedRelations` in `generateResourceMetadata` method.
    this.model.getResources().forEach((resource) => {
      this.resourcesMetadata[resource] = {
        fields: {},
        indexes: [],
        constraints: [],
        subStructures: [],
        structure: resource,
        subStructuresPerPath: {},
        invertedRelations: new Map(),
      };
    });
  }

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
