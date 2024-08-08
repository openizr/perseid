/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/server/postgresql' {
  import type {
    Logger,
    CacheClient,
    FormattedQuery,
    StructuredPayload,
    Model as BaseModel,
    DatabaseClientSettings,
    AbstractDatabaseClient,
  } from '@perseid/server';
  import pg from 'pg';
  import type { Id, DefaultDataModel, Results } from '@perseid/core';

  /**
   * PostgreSQL database client.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/postgresql/services/PostgreSQLDatabaseClient.ts
   */
  export default class PostgreSQLDatabaseClient<
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
     * @param isSearchQuery Whether query is a search query or a simple `SELECT`.
     * Defaults to `false`.
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
     * Connects database client to the database server before performing any query, and handles
     * common database server errors. You should always use this method to wrap your code.
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
}
