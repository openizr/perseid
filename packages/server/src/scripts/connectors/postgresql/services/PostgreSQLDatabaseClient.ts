/* eslint-disable */
/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  forEach,
  type Results,
  type IdSchema,
  type DateSchema,
  type FieldSchema,
  type ObjectSchema,
  type UserDataModel,
  type Ids,
} from '@perseid/core';
import pg from 'pg';
import DatabaseClient, {
  type FormattedQuery,
  type StructuredPayload,
  type DatabaseClientSettings,
} from 'scripts/core/services/AbstractDatabaseClient';
import type {
  Payload,
  SearchBody,
  QueryOptions,
  SearchFilters,
  ViewQueryOptions,
  ListQueryOptions,
} from 'scripts/core';
import type BaseModel from 'scripts/core/services/Model';
import DatabaseError from 'scripts/core/errors/Database';
import type Telemetry from 'scripts/core/services/Telemetry';
import type CacheClient from 'scripts/core/services/CacheClient';

/**
 * Current metrics for a given PostgreSQL connection pool.
 */
export interface PoolMetrics {
  /**
   * Number of connections currently in use.
   */
  used: number;

  /**
   * Number of connections currently idle.
   */
  idle: number;

  /**
   * Number of requests currently pending.
   */
  pending: number;
}

/**
 * PostgreSQL database client settings.
 */
export interface PostgreSQLDatabaseClientSettings extends DatabaseClientSettings {
  /**
   * Maximum time to wait for a query to complete.
   */
  queryTimeout: number;

  /**
   * SSL configuration to use for database connection.
   */
  ssl: {
    ca?: string;
    rejectUnauthorized?: boolean;
  } | false;
}

/**
 * PostgreSQL database client.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/postgresql/services/PostgreSQLDatabaseClient.ts
 */
export default class PostgreSQLDatabaseClient<
  /**
   * Data model types definitions.
   */
  DataModel extends UserDataModel = UserDataModel,

  /**
   * Query results types definitions.
   */
  QueryResults extends Record<string, Ids> = Record<string, Ids>,

  /**
   * Model class types definitions.
   */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
> extends DatabaseClient<DataModel, QueryResults, Model> {
  /**
   * Data model types <> SQL types mapping, for tables creation.
   */
  protected readonly SQL_TYPES_MAPPING: Record<string, string> = {
    null: 'BOOLEAN',
    id: (Id.FORMAT === 'SNOWFLAKE') ? 'CHAR(24)' : 'UUID',
    integer: 'INT',
    boolean: 'BOOLEAN',
    float: 'FLOAT8',
    binary: 'BYTEA',
    date: 'TIMESTAMP',
    array: 'BOOLEAN',
    object: 'BOOLEAN',
  };

  /**
   * SQL sorting keywords.
   */
  protected readonly SQL_SORT_MAPPING: Record<1 | -1, string> = {
    1: 'ASC',
    '-1': 'DESC',
  };

  /**
   * PostgreSQL client instance.
   */
  protected client: pg.Pool;

  /**
   * Active sessions, indexed by session ID. A session represents a running SQL transaction.
   */
  protected sessions: Map<string, pg.PoolClient>;

  /**
   * Active connection pools, used to handle multi-tenancy. Default pool is referenced with the
   * key `default`.
   */
  protected pools: Map<string, pg.Pool>;

  /**
   * Last connections metrics values by pool, used to update telemetry metrics.
   */
  protected lastMetrics: Map<string, PoolMetrics>;

  /**
   * PostgreSQL database connection settings. Necessary to reset pool after dropping database.
   */
  protected databaseSettings: PostgreSQLDatabaseClientSettings;

  /**
   * Used to format ArrayBuffers into strings.
   */
  protected textDecoder = new TextDecoder('utf-8');

  /**
   * Used to format strings into ArrayBuffers.
   */
  protected textEncoder = new TextEncoder();

  /**
   * Allows to provide a custom SQL table name for specific resources and sub-resources.
   */
  protected tablesMapping: Record<string, string>;

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
  ): void {
    const metadata = this.model.get(resource);
    const resourceSchema = { type: 'object', isRequired: true, fields: metadata.schema.fields };

    const generateMetadata = (
      table: string,
      currentSchema: FieldSchema<DataModel>,
      currentPath: { scoped: string[]; full: string[]; },
      // Used to keep the full path of the first array we cross in data model, as any subchange
      // will necessary trigger a deletion / insertion of all the array entries in all sub-tables.
      arrayPath?: string,
      // When setting an optional object to `null`, we need to clear all its properties (set them
      // also to `null`) in database, even if they are required.
      isOptionalObject?: boolean,
    ): void => {
      const { type } = currentSchema;
      const sqlType = this.SQL_TYPES_MAPPING[type];
      const fullPath = currentPath.full.join('_');
      const scopedPath = currentPath.scoped.join('_');
      const isRequired = !!currentSchema.isRequired && !isOptionalObject;
      const { subStructuresPerPath } = this.resourcesMetadata[resource];
      const fields = this.resourcesMetadata[table].fields as Record<string, unknown>;
      if (type === 'array') {
        const subTable = `_${resource}_${fullPath}`;
        this.resourcesMetadata[resource].subStructures.push(subTable);
        const subTableIndex = this.resourcesMetadata[resource].subStructures.length;
        fields[scopedPath] = { type: sqlType, isRequired };
        subStructuresPerPath[fullPath] ??= new Set<string>();
        subStructuresPerPath[arrayPath ?? fullPath] ??= new Set<string>();
        subStructuresPerPath[fullPath].add(subTable);
        subStructuresPerPath[arrayPath ?? fullPath].add(subTable);
        this.resourcesMetadata[subTable] = {
          fields: {},
          structure: `_${resource}_${String(subTableIndex)}`,
          constraints: [
            { path: '_parentId', relation: table },
            { path: '_resourceId', relation: resource },
          ],
          indexes: [
            { path: '_parentId', unique: false },
            { path: '_resourceId', unique: false },
          ],
          subStructures: [],
          subStructuresPerPath: {},
          invertedRelations: new Map(),
        };
        generateMetadata(subTable, {
          type: 'object',
          isRequired: true,
          description: 'Array value.',
          fields: {
            _id: { type: 'id', isRequired: true, description: 'ID of the array value.' },
            _parentId: { type: 'id', isRequired: true, description: 'ID of the parent array.' },
            _resourceId: { type: 'id', isRequired: true, description: 'ID of the resource.' },
            value: currentSchema.fields,
          },
        }, { scoped: [], full: currentPath.full }, arrayPath ?? fullPath);
      } else if (type === 'object') {
        if (currentPath.scoped.length > 0) {
          fields[scopedPath] = { type: sqlType, isRequired };
        }
        Object.keys(currentSchema.fields).forEach((fieldName) => {
          const fieldSchema = currentSchema.fields[fieldName];
          generateMetadata(table, fieldSchema, {
            scoped: currentPath.scoped.concat([fieldName]),
            full: currentPath.full.concat([fieldName]),
          }, arrayPath, !isRequired);
        });
      } else {
        if (type === 'string') {
          const { isIndexed, isUnique } = currentSchema;
          const { maxLength, enum: enumerations } = currentSchema;
          let max = (enumerations !== undefined) ? enumerations.reduce((m, value) => (
            Math.max(m, value.length)
          ), 0) : maxLength;
          max = (!!isIndexed || !!isUnique) ? Math.min(max, 255) : max;
          const newType = (max < 256) ? `VARCHAR(${String(max)})` : 'TEXT';
          fields[scopedPath] = { type: newType, isRequired };
        } else if (type === 'id' && currentSchema.relation !== undefined) {
          const { relation } = currentSchema;
          this.resourcesMetadata[table].constraints.push({ path: scopedPath, relation });
          fields[scopedPath] = { type: sqlType, isRequired };
        } else {
          fields[scopedPath] = { type: sqlType, isRequired };
        }
        if ((currentSchema as IdSchema<DataModel>).isIndexed && scopedPath !== '_id') {
          this.resourcesMetadata[table].indexes.push({ path: scopedPath, unique: false });
        } else if ((currentSchema as IdSchema<DataModel>).isUnique && scopedPath !== '_id') {
          this.resourcesMetadata[table].indexes.push({ path: scopedPath, unique: true });
        }
      }
    };

    generateMetadata(resource, resourceSchema as ObjectSchema<DataModel>, { scoped: [], full: [] });
  }

  // TODO build formatted queries as pipelines, no need for a query builder as long as we can
  // customize filters, fields, etc.
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
  protected parseFields<Resource extends keyof DataModel>(
    resource: Resource,
    fields: Set<string>,
    maximumDepth: number,
    searchBody: SearchBody | null = null,
    sortBy: Partial<Record<string, 1 | -1>> = {},
  ): { projections: unknown; formattedQuery: FormattedQuery; } {
    let index = 0;
    const projections = new Map([['_id', '_id']]);
    const formattedQuery: FormattedQuery = {
      structure: String(resource),
      sort: null,
      match: null,
      lookups: {},
      localField: null,
      foreignField: null,
      fields: { _id: '_id' },
    };
    const sortByFields = Object.keys(sortBy);
    const processedQueryFields = new Set();
    const processedFiltersFields = new Set();
    const queryFields = [...(searchBody?.query?.on ?? [])];
    const filterFields = Object.keys(searchBody?.filters ?? {});
    const model = this.model.get(resource);
    const allFields = [...fields].concat(sortByFields).concat(filterFields).concat(queryFields);
    const formattedMatch: {
      query: Record<string, unknown>[];
      filters: Record<string, unknown>[];
    } = { query: [], filters: [] };
    const queryRegExp = new RegExp((searchBody?.query?.text ?? '').split(this.SPLITTING_TOKENS).map((t) => (
      `(?=.*${t.replace(/[[\]/()]/ig, (match) => `\\${match}`)})`
    )).join('|'), 'i').source;

    const getMappedField = (path: string): string => {
      if (searchBody !== null) {
        return path;
      }
      const existingMappedPath = projections.get(path);
      if (existingMappedPath === undefined) {
        const mappedPath = `${String(resource)}_${String(index)}`;
        index += 1;
        projections.set(path, mappedPath);
        return mappedPath;
      }
      return existingMappedPath;
    };

    allFields.forEach((path) => {
      let currentDepth = 1;
      let isInArray = false;
      let scopedPath: string[] = [];
      const currentPath: string[] = [];
      let pathInRelation: string[] = [];
      let currentTable = String(resource);
      const splittedPath = path.split('.');
      let currentFormattedQuery = formattedQuery;
      let currentSchema = model.schema as FieldSchema<DataModel> | undefined;

      while (splittedPath.length > 0 && currentSchema !== undefined) {
        const fieldName = String(splittedPath.shift());
        const newFields = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields;
        currentSchema = newFields?.[fieldName];
        scopedPath.push(fieldName);
        currentPath.push(fieldName);
        pathInRelation.push(fieldName);
        let flattenedFullPath = currentPath.join('_');
        let flattenedScopedPath = scopedPath.join('_');

        if (currentSchema?.type === 'array') {
          isInArray = true;
          currentFormattedQuery.fields[flattenedScopedPath] = getMappedField(flattenedFullPath);
          currentFormattedQuery.lookups[flattenedScopedPath] ??= {
            sort: null,
            match: null,
            lookups: {},
            localField: '_id',
            structure: `_${currentTable}_${pathInRelation.join('_')}`,
            foreignField: getMappedField(`${flattenedFullPath}__parentId`),
            fields: { _id: getMappedField(`${flattenedFullPath}__id`), _parentId: getMappedField(`${flattenedFullPath}__parentId`) },
          };
          scopedPath = ['value'];
          currentPath.push('value');
          pathInRelation.push('value');
          currentFormattedQuery = currentFormattedQuery.lookups[flattenedScopedPath];
          currentSchema = currentSchema.fields;
        }

        const type = currentSchema?.type;
        const relation = (currentSchema as IdSchema<DataModel> | undefined)?.relation;
        flattenedFullPath = currentPath.join('_');
        flattenedScopedPath = scopedPath.join('_');

        if (type === 'object') {
          currentFormattedQuery.fields[flattenedScopedPath] = getMappedField(flattenedFullPath);
        } else if (type === 'id' && relation !== undefined && splittedPath.length > 0) {
          currentDepth += 1;
          currentTable = relation;
          currentFormattedQuery.fields[flattenedScopedPath] = getMappedField(flattenedFullPath);
          currentFormattedQuery.lookups[flattenedScopedPath] ??= {
            lookups: {},
            sort: null,
            match: null,
            structure: currentTable,
            localField: flattenedScopedPath,
            foreignField: getMappedField(`${flattenedFullPath}__id`),
            fields: { _id: getMappedField(`${flattenedFullPath}__id`) },
          };
          scopedPath = [];
          pathInRelation = [];
          currentFormattedQuery = currentFormattedQuery.lookups[flattenedScopedPath];
          const relationMetadata = this.model.get(relation);
          const { schema } = relationMetadata;
          currentSchema = { type: 'object', fields: schema.fields, description: schema.description };
        } else if (splittedPath.length === 0) {
          currentFormattedQuery.fields[flattenedScopedPath] = getMappedField(flattenedFullPath);
        }
      }

      if (currentSchema === undefined) {
        throw new DatabaseError('UNKNOWN_FIELD', { path });
      } else if (currentSchema.type === 'object') {
        throw new DatabaseError('INVALID_FIELD', { path });
      } else if (currentDepth > maximumDepth) {
        throw new DatabaseError('MAXIMUM_DEPTH_EXCEEDED', { path });
      } else if (sortBy[path] !== undefined && isInArray) {
        throw new DatabaseError('UNSORTABLE_FIELD', { path });
      } else if ((
        sortBy[path] !== undefined
        || searchBody?.filters?.[path] !== undefined
        || searchBody?.query?.on.has(path)
      ) && !(currentSchema as DateSchema).isIndexed && !(currentSchema as DateSchema).isUnique) {
        throw new DatabaseError('UNINDEXED_FIELD', { path });
      }

      const finalSearchPath = currentPath.join('_');
      const key = getMappedField(finalSearchPath);

      if (sortBy[path] !== undefined) {
        formattedQuery.sort ??= {};
        formattedQuery.sort[key] = (sortBy as Record<string, 1 | -1>)[path];
      }

      if (searchBody?.filters?.[path] !== undefined && !processedFiltersFields.has(path)) {
        processedFiltersFields.add(path);
        let value = searchBody.filters[path];
        if (value instanceof Id) {
          value = String(value);
        } else if (Array.isArray(value)) {
          value = value.map((item) => ((item instanceof Id) ? String(item) : item));
        }
        formattedMatch.filters.push({ [key]: value });
      } else if (searchBody?.query?.on.has(path) && !processedQueryFields.has(path)) {
        processedQueryFields.add(path);
        formattedMatch.query.push({ [key]: queryRegExp });
      }
    });

    if (formattedMatch.filters.length > 0 || formattedMatch.query.length > 0) {
      formattedQuery.match = formattedMatch;
    }

    return { formattedQuery, projections };
  }

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
    textIndent = '',
    startPlaceholderIndex = 1,
  ): string {
    let joinClauses = '';
    const { sort } = formattedQuery;
    const newIndent = `${textIndent}  `;
    const { structure } = formattedQuery;
    const table = this.tablesMapping[structure] ?? this.resourcesMetadata[structure].structure;
    const joinedTables = Object.keys(formattedQuery.lookups);
    for (let index = 0, { length } = joinedTables; index < length; index += 1) {
      const join = formattedQuery.lookups[joinedTables[index]];
      const subQuery = this.generateQuery(resource, join, newIndent);
      const prefix = `\n${textIndent}`;
      const onClause = `${textIndent}ON "${table}"."${String(join.localField)}" = "${joinedTables[index]}"."${String(join.foreignField)}"`;
      joinClauses += `${prefix}LEFT JOIN (\n${subQuery}\n${textIndent}) AS "${joinedTables[index]}"\n${onClause}`;
    }

    const sortFields = Object.keys(sort ?? {}).reduce<string[]>((finalFields, path) => (
      (path === '_id') ? finalFields : finalFields.concat([`"${path}"`])
    ), []);
    const fieldsClause = (formattedQuery.match !== null || sort !== null)
      ? [`DISTINCT "${table}"."_id"`].concat(sort !== null ? sortFields : []).join(', ')
      : Object.keys(formattedQuery.fields).map((fieldName) => (
        `"${table}"."${fieldName}" AS "${formattedQuery.fields[fieldName]}"`
      )).concat(joinedTables.map((path) => `"${path}".*`)).join(`,\n${newIndent}`);
    const selectClause = `${textIndent}SELECT\n${newIndent}${fieldsClause}\n${textIndent}FROM\n${newIndent}"${table}"`;

    let groupClause = '';
    if (sort !== null) {
      const sortClause = `\n${textIndent}ORDER BY\n${newIndent}${Object.keys(sort).map((path) => (
        `${(path === '_id') ? `"${table}"."${path}"` : `"${path}"`} ${this.SQL_SORT_MAPPING[sort[path]]}`
      )).join(`,\n${newIndent}`)}`;
      groupClause += `\n${textIndent}GROUP BY ${[`"${table}"."_id"`].concat(sortFields).join(', ')}${sortClause}`;
    }

    const whereClause = [];
    let placeholderIndex = startPlaceholderIndex;
    if (formattedQuery.match !== null) {
      const { filters, query } = formattedQuery.match;
      if (query.length > 0) {
        whereClause.push(`(\n${newIndent}  ${query.map((q) => {
          const statement = (
            `"${Object.keys(q)[0]}" ~* $${String(placeholderIndex)}`
          );
          placeholderIndex += 1;
          return statement;
        }).join(`\n${newIndent}   OR `)}\n${newIndent})`);
      }
      if (filters.length > 0) {
        whereClause.push(filters.map((filter) => {
          let clause = '';
          if (Array.isArray(Object.values(filter)[0])) {
            const includesNullValue = (Object.values(filter)[0] as unknown[]).includes(null);
            clause = `"${Object.keys(filter)[0]}" IN (${(Object.values(filter)[0] as unknown[]).filter((value) => value !== null).map(() => {
              const p = `$${String(placeholderIndex)}`;
              placeholderIndex += 1;
              return p;
            }).join(', ')})`;
            clause = includesNullValue ? `(${clause} OR "${Object.keys(filter)[0]}" IS NULL)` : clause;
          } else if (Object.values(filter)[0] === null) {
            clause = `"${Object.keys(filter)[0]}" IS NULL`;
          } else {
            clause = `"${Object.keys(filter)[0]}" = $${String(placeholderIndex)}`;
            placeholderIndex += 1;
          }
          return clause;
        }).join(`\n${newIndent}AND `));
      }
    }

    const fullWhereClause = (whereClause.length > 0)
      ? `\n${textIndent}WHERE\n${newIndent}${whereClause.join(`\n${newIndent}AND `)}`
      : '';

    return `${selectClause}${joinClauses}${fullWhereClause}${groupClause}`;
  }

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
  protected structurePayload<Resource extends keyof DataModel>(
    resource: Resource,
    resourceId: Id,
    payload: Payload<DataModel[Resource]>,
    mode: 'CREATE' | 'UPDATE',
  ): StructuredPayload {
    const structuredPayload: StructuredPayload = { [resource]: [] };
    const model = this.model.get(resource);

    const structurePartialPayload = (
      currentTable: string,
      partialPayload: unknown,
      requireFullPayload: boolean,
      currentSchema?: FieldSchema<DataModel>,
      currentFormattedPayload: Record<string, unknown> = {},
      currentPath: { full: string[]; scoped: string[]; rootArray: string[]; } = {
        full: [],
        scoped: [],
        rootArray: [],
      },
      parentId: Id | null = null,
      skipValidation = false,
    ): void => {
      const path = currentPath.full.join('.');
      const npath = currentPath.scoped.join('_');
      const rootFormattedPayload = currentFormattedPayload;

      if (currentSchema === undefined) {
        throw new DatabaseError('UNKNOWN_FIELD', { path });
      }

      const { type } = currentSchema;
      if (!skipValidation) {
        this.VALIDATORS[type](path, partialPayload, currentSchema);
      }

      if (type === 'date' && partialPayload instanceof Date) {
        rootFormattedPayload[npath] = partialPayload.toISOString();
      } else if (type === 'id' && partialPayload instanceof Id) {
        rootFormattedPayload[npath] = String(partialPayload);
      } else if (type === 'array') {
        const fpath = currentPath.rootArray.join('_');
        const subTables = this.resourcesMetadata[String(resource)].subStructuresPerPath[fpath];
        subTables.forEach((subTable) => {
          structuredPayload[subTable] ??= [];
        });
        if (partialPayload === null) {
          rootFormattedPayload[npath] = null;
        } else {
          rootFormattedPayload[npath] = true;
          (partialPayload as unknown[]).forEach((subPayload) => {
            const newId = new Id();
            const newPayload = {};
            structurePartialPayload(
              `_${String(resource)}_${fpath}`,
              {
                _id: newId,
                _parentId: parentId ?? resourceId,
                _resourceId: resourceId,
                value: subPayload,
              },
              true,
              {
                type: 'object',
                isRequired: true,
                description: 'Object value.',
                fields: {
                  _id: { type: 'id', isRequired: true, description: 'ID of the object value.' },
                  _parentId: { type: 'id', isRequired: true, description: 'ID of the parent object.' },
                  _resourceId: { type: 'id', isRequired: true, description: 'ID of the resource.' },
                  value: currentSchema.fields,
                },
              },
              newPayload,
              { scoped: [], full: currentPath.full, rootArray: currentPath.rootArray },
              newId,
              skipValidation,
            );
            structuredPayload[`_${String(resource)}_${fpath}`].push(newPayload);
          });
        }
      } else if (type === 'object') {
        const { fields, isRequired } = currentSchema;
        const missingFields = new Set(Object.keys(fields));
        const requireAllFields = mode === 'CREATE' || requireFullPayload || !isRequired;

        if (partialPayload === null) {
          rootFormattedPayload[npath] = null;
          missingFields.forEach((fieldName) => {
            const full = currentPath.full.concat([fieldName]);
            const scoped = currentPath.scoped.concat([fieldName]);
            const rootArray = currentPath.rootArray.concat([fieldName]);
            structurePartialPayload(
              currentTable,
              null,
              requireAllFields,
              fields[fieldName],
              rootFormattedPayload,
              { full, scoped, rootArray },
              parentId,
              true,
            );
          });
        } else {
          if (currentPath.scoped.length > 0) {
            rootFormattedPayload[npath] = true;
          }
          Object.keys(partialPayload as Record<string, unknown>).forEach((fieldName) => {
            missingFields.delete(fieldName);
            const full = currentPath.full.concat([fieldName]);
            const scoped = currentPath.scoped.concat([fieldName]);
            const rootArray = currentPath.rootArray.concat([fieldName]);
            structurePartialPayload(
              currentTable,
              (partialPayload as Record<string, unknown>)[fieldName],
              requireAllFields,
              fields[fieldName],
              rootFormattedPayload,
              { full, scoped, rootArray },
              parentId,
              skipValidation,
            );
          });
          if (requireAllFields && missingFields.size > 0) {
            const fieldPath = currentPath.full.concat([[...missingFields][0]]).join('.');
            throw new DatabaseError('MISSING_FIELD', { path: fieldPath });
          }
        }
      } else {
        rootFormattedPayload[npath] = partialPayload;
      }
    };

    const formattedPayload = {};
    structurePartialPayload(
      String(resource),
      payload,
      mode === 'CREATE',
      {
        type: 'object', isRequired: true, fields: model.schema.fields, description: model.schema.description,
      },
      formattedPayload,
    );
    structuredPayload[String(resource)][0] = formattedPayload;

    return structuredPayload;
  }

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
  protected formatResources<Resource extends keyof DataModel>(
    resource: Resource,
    results: unknown[],
    fields: unknown,
    mapping: Map<string, string>,
  ): DataModel[Resource][] {
    const arraysMapping = new Map<string, number>();
    const finalResources: Record<string, Record<string, unknown>> = {};
    const model = this.model.get(resource);

    (results as Record<string, unknown>[]).forEach((result) => {
      finalResources[result._id as string] ??= {
        _id: new Id(result._id as string),
      };

      (fields as Set<string>).forEach((path) => {
        const currentPath: string[] = [];
        const splittedPath = path.split('.');
        let currentResource = finalResources[result._id as string];
        let currentSchema = model.schema as FieldSchema<DataModel> | undefined;

        while (splittedPath.length > 0 && currentSchema !== undefined) {
          let fieldName: string | number = String(splittedPath.shift());
          const subFields = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields;
          currentSchema = subFields?.[fieldName];
          currentPath.push(fieldName);

          if (currentSchema?.type === 'array') {
            const fullPath = currentPath.join('_');
            const key = mapping.get(fullPath) as unknown as string;

            if (result[key] === null) {
              currentResource[fieldName] = null;
              break;
            } else {
              currentResource[fieldName] ??= [];
              const id = result[mapping.get(`${fullPath}__id`) as unknown as string] as string | null;
              if (id === null) {
                break;
              } else {
                if (!arraysMapping.has(id)) {
                  arraysMapping.set(id, (currentResource[fieldName] as unknown[]).length);
                }
                currentPath.push('value');
                currentSchema = currentSchema.fields;
                currentResource = currentResource[fieldName] as Record<string, unknown>;
                fieldName = arraysMapping.get(id) as unknown as number;
              }
            }
          }

          const type = currentSchema?.type;
          const fullPath = currentPath.join('_');
          const key = mapping.get(fullPath) as unknown as string;
          const relation = (currentSchema as IdSchema<DataModel> | undefined)?.relation;

          if (result[key] === null) {
            currentResource[fieldName] = null;
            break;
          }

          if (type === 'id' && relation !== undefined && splittedPath.length > 0) {
            const isUndefined = currentResource[fieldName] === undefined;
            if (isUndefined || currentResource[fieldName] instanceof Id) {
              currentResource[fieldName] = {
                _id: new Id(result[key] as string),
              };
            }
            currentResource = currentResource[fieldName] as Record<string, unknown>;
            const relationMetadata = this.model.get(relation);
            const { schema } = relationMetadata;
            currentSchema = { type: 'object', fields: schema.fields, description: schema.description };
          } else if (currentSchema?.type === 'object') {
            currentResource[fieldName] ??= {};
            currentResource = currentResource[fieldName] as Record<string, unknown>;
          } else if (splittedPath.length === 0) {
            if (type === 'id') {
              currentResource[fieldName] ??= new Id(result[key] as string);
            } else {
              currentResource[fieldName] = result[key];
            }
          }
        }
      });
    });

    return Object.values(finalResources) as DataModel[Resource][];
  }

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
  protected async handleError<T>(callback: () => Promise<T>): Promise<T> {
    if (!this.isConnected) {
      this.telemetry.debug(`[PostgreSQLDatabaseClient][handleError] Connecting to database ${this.database}...`);
      this.client = new pg.Pool({
        database: this.database,
        ssl: this.databaseSettings.ssl,
        host: this.databaseSettings.host,
        max: this.databaseSettings.connectionLimit,
        port: this.databaseSettings.port ?? undefined,
        user: this.databaseSettings.user ?? undefined,
        password: this.databaseSettings.password ?? undefined,
        idleTimeoutMillis: this.databaseSettings.connectTimeout,
        connectionTimeoutMillis: this.databaseSettings.connectTimeout,
      });
      this.isConnected = true;
    }
    try {
      return await callback();
    } catch (error) {
      const postgreError = error as pg.DatabaseError;
      if (postgreError.code === '23505') {
        const match = /Key \(([^)]+)\)=\(([^)]+)\)/.exec(postgreError.detail as unknown as string);
        throw new DatabaseError('DUPLICATE_RESOURCE', {
          path: (match as string[])[1],
          value: (match as string[])[2].trim(),
        });
      }
      if (postgreError.code === '23503') {
        const path = (/Key \(([^)]+)\)=/.exec(postgreError.detail as unknown as string) as string[])[1];
        throw new DatabaseError('RESOURCE_REFERENCED', { path });
      }
      throw error;
    }
  }

  /**
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param telemetry Logging system to use.
   *
   * @param cache Cache client instance to use for results caching.
   *
   * @param settings Database client settings.
   */
  public constructor(
    model: Model,
    telemetry: Telemetry,
    cache: CacheClient,
    settings: PostgreSQLDatabaseClientSettings,
  ) {
    super(model, telemetry, cache, settings);
    this.tablesMapping = {};
    this.client = null as unknown as pg.Pool;
    this.databaseSettings = settings;
    this.pools = new Map<string, pg.Pool>();
    this.sessions = new Map<string, pg.PoolClient>();
    this.lastMetrics = new Map<string, { used: number; idle: number; pending: number; }>();
    this.model.getResources().forEach((resource) => {
      this.generateResourceMetadata(resource);
      // Reversing the sub-tables array is essential to delete dependencies in the right order.
      this.resourcesMetadata[resource].subStructures.reverse();
    });
    this.telemetry.createHistogram('db.client.operation.duration', {
      unit: 's',
      valueType: 1, // DOUBLE
      description: 'Duration of database client operations.',
      advice: {
        explicitBucketBoundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      },
    });
    this.telemetry.createUpDownCounter('db.client.connection.count', {
      description: 'The number of connections that are currently in state described by the state attribute.',
      unit: '{connection}',
    });
    this.telemetry.createUpDownCounter('db.client.connection.pending_requests', {
      description: 'The number of current pending requests for an open connection.',
      unit: '{request}',
    });
  }

  /**
   * Drops the entire database.
   */
  public async dropDatabase(): Promise<void> {
    this.isConnected = false;
    const message = '[PostgreSQLDatabaseClient][dropDatabase] PostgreSQL does not support database'
      + ' dropping while being connected to this database. You must perform this operation directly'
      + ' on database.';
    await (this.telemetry.warn as unknown as (_: string) => Promise<void>)(message);
  }

  /**
   * Creates the database.
   */
  public async createDatabase(): Promise<void> {
    this.isConnected = false;
    const message = '[PostgreSQLDatabaseClient][createDatabase] Database is already created - '
      + 'skipping creation.';
    await (this.telemetry.warn as unknown as (_: string) => Promise<void>)(message);
  }

  /**
   * Creates missing database structures for current data model.
   */
  public async createMissingStructures(): Promise<void> {
    await this.handleError(async () => {
      const query = 'SELECT table_schema, table_name\nFROM information_schema.tables\nWHERE table_'
        + 'type = \'BASE TABLE\'\nAND table_schema NOT IN (\'information_schema\', \'pg_catalog\');';
      const response = await this.client.query<{ table_name: string; }>(query);
      const existingTables = new Set(response.rows.map((row) => row.table_name));

      await forEach(Object.keys(this.resourcesMetadata), async (table) => {
        const { indexes, structure } = this.resourcesMetadata[table];
        const fields = this.resourcesMetadata[table].fields as Record<string, {
          type: string;
          isRequired: boolean;
        }>;
        if (!existingTables.has(structure)) {
          const fieldsClause = Object.keys(fields as Record<string, unknown>).map((fieldName) => {
            const { type, isRequired } = fields[fieldName];
            return `"${fieldName}" ${type}${isRequired ? ' NOT NULL' : ''}`;
          }).join(',\n  ');
          const sqlQuery = `CREATE TABLE "${structure}" (\n  ${fieldsClause},\n  PRIMARY KEY ("_id")\n);`;
          this.telemetry.info(`[PostgreSQLDatabaseClient][createMissingStructures] Creating table ${structure}...`);
          this.telemetry.debug('[PostgreSQLDatabaseClient][createMissingStructures] Performing the following SQL query on database:');
          this.telemetry.debug(`[PostgreSQLDatabaseClient][createMissingStructures] \n\n${sqlQuery}\n`);
          await this.client.query(sqlQuery);
          await forEach(indexes, async (currentIndex, index) => {
            const { unique, path } = currentIndex;
            const uniqueClause = unique ? ' UNIQUE' : '';
            const indexSqlQuery = `CREATE${uniqueClause} INDEX index_${structure}_${String(index)} ON "${structure}" ("${path}");`;
            this.telemetry.debug('[PostgreSQLDatabaseClient][createMissingStructures] Performing the following SQL query on database:');
            this.telemetry.debug(`[PostgreSQLDatabaseClient][createMissingStructures] \n\n${indexSqlQuery}\n`);
            await this.client.query(indexSqlQuery);
          });
        }
      });

      await forEach(Object.keys(this.resourcesMetadata), async (table) => {
        const { constraints, structure } = this.resourcesMetadata[table];
        if (!existingTables.has(structure)) {
          await forEach(constraints, async (constraint, index) => {
            const { path, relation } = constraint;
            const foreignTable = this.resourcesMetadata[relation].structure;
            const constraintSqlQuery = `ALTER TABLE "${structure}" ADD CONSTRAINT fk_${structure}_${String(index)} FOREIGN KEY ("${path}") REFERENCES "${foreignTable}"("_id")`;
            this.telemetry.debug('[PostgreSQLDatabaseClient][createMissingStructures] Performing the following SQL query on database:');
            this.telemetry.debug(`[PostgreSQLDatabaseClient][createMissingStructures] \n\n${constraintSqlQuery}\n`);
            await this.client.query(constraintSqlQuery);
          });
        }
      });

      this.telemetry.info('[PostgreSQLDatabaseClient][createMissingStructures] Creating table _config...');
      await this.client.query('DROP TABLE IF EXISTS "_config";');
      await this.client.query(
        'CREATE TABLE "_config" ("key" VARCHAR(255) NOT NULL PRIMARY KEY, "value" TEXT NOT NULL);',
      );
    });
  }

  /**
   * Resets the whole underlying database, re-creating structures, indexes, and such.
   */
  public async reset(): Promise<void> {
    await this.dropDatabase();
    await this.createDatabase();
    await this.handleError(async () => {
      this.telemetry.info('[PostgreSQLDatabaseClient][reset] Initializing tables...');
      await this.createMissingStructures();
      this.telemetry.info('[PostgreSQLDatabaseClient][reset] Successfully initialized tables.');
    });
  }

  /**
   * Makes sure that `relations` reference existing resources that match specific conditions.
   *
   * @param resource Type of resource to check relations for.
   *
   * @param relations Foreign ids to check in database.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @throws If any foreign id does not exist.
   */
  public async checkRelations<Resource extends keyof DataModel>(
    _resource: Resource,
    relations: Map<string, { resource: keyof DataModel; filters: SearchFilters | null; }>,
    options?: QueryOptions,
  ): Promise<void> {
    if (relations.size > 0) {
      let placeholderIndex = 1;
      const values: unknown[] = [];
      const sqlSubQueries: string[] = [];
      const missingIds = new Set<string>();
      relations.forEach((value, path) => {
        const table = String(value.resource);
        const allFilters = { ...value.filters };
        const fields = new Set(Object.keys(allFilters));
        const searchBody = { query: null, filters: allFilters };
        const { formattedQuery } = this.parseFields(value.resource, fields, Infinity, searchBody);
        const extraFilters = this.getResourceFilters(value.resource, null, options);
        if (Object.keys(extraFilters).length > 0) {
          formattedQuery.match ??= {
            filters: [],
            query: [],
          };
        }
        Object.keys(extraFilters).forEach((key) => {
          if (formattedQuery.match) {
            formattedQuery.match.filters.push({ [key]: extraFilters[key] });
          }
        });
        sqlSubQueries.push(this.generateQuery(value.resource, formattedQuery, '', placeholderIndex).replace(`DISTINCT "${table}"."_id"`, `DISTINCT "${table}"."_id", '${path}' as path`));
        (formattedQuery.match as unknown as Exclude<FormattedQuery['match'], null>).filters.forEach((filter) => {
          if (Object.keys(filter)[0] === '_id') {
            (filter._id as string[]).forEach((id) => missingIds.add(`${id}:${path}`));
          }
          if (Array.isArray(Object.values(filter)[0])) {
            placeholderIndex += (Object.values(filter)[0] as unknown[]).length;
            values.push(...Object.values(filter)[0] as unknown[]);
          } else {
            placeholderIndex += 1;
            values.push(Object.values(filter)[0]);
          }
        });
      });

      await this.handleError(async () => {
        const sqlQuery = sqlSubQueries.join('\nUNION\n');
        this.telemetry.debug('[PostgreSQLDatabaseClient][checkRelations] Performing the following SQL query on database:');
        this.telemetry.debug(`[PostgreSQLDatabaseClient][checkRelations]\n\n${sqlQuery}\n`);
        this.telemetry.debug(`[PostgreSQLDatabaseClient][checkRelations] [\n  ${values.join(',\n  ')}\n]\n`);
        const response = await this.client.query<Record<string, string>>(sqlQuery, values);

        for (let index = 0, { length } = response.rows; index < length; index += 1) {
          const row = response.rows[index];
          missingIds.delete(`${row._id}:${row.path}`);
        }

        if (missingIds.size > 0) {
          const id = (missingIds.values().next().value as unknown as string).split(':')[0];
          throw new DatabaseError('NO_RESOURCE', { id });
        }
      });
    }
  }

  /**
   * Creates a new resource in database.
   *
   * @param resource Type of resource to create.
   *
   * @param payload New resource payload.
   *
   * @param options Query options. Defaults to `{}`.
   */
  public async create<Resource extends keyof DataModel>(
    resource: Resource,
    payload: DataModel[Resource],
    options: ViewQueryOptions = this.DEFAULT_VIEW_COMMAND_OPTIONS,
  ): Promise<void> {
    const resourceId = (payload as { _id: Id; })._id;
    const newDocuments = this.updatePayload(
      String(resource),
      this.structurePayload(resource, resourceId, payload as Payload<DataModel[Resource]>, 'CREATE'),
      options,
    );

    await this.handleError(async () => {
      const connection = await this.client.connect();
      await connection.query('BEGIN');
      try {
        await Promise.all(Object.keys(newDocuments).map(async (table) => {
          const documents = newDocuments[table];
          if (documents.length > 0) {
            const sqlFields: string[] = [];
            const fieldPlaceholders: string[] = [];
            const fields = Object.keys(documents[0]);
            const values: unknown[] = [];
            const { length } = fields;
            documents.forEach((document, index) => {
              const placeholders: string[] = [];
              fields.forEach((fieldName, fieldIndex) => {
                placeholders.push(`$${String(length * index + fieldIndex + 1)}`);
                if (index === 0) {
                  sqlFields.push(`"${fieldName}"`);
                }
                values.push(document[fieldName]);
              });
              fieldPlaceholders.push(`(${placeholders.join(', ')})`);
            });
            const placeholders = fieldPlaceholders.join(',\n  ');
            const structure = this.tablesMapping[table] ?? this.resourcesMetadata[table].structure;
            const sqlQuery = `INSERT INTO "${structure}" (\n  ${sqlFields.join(',\n  ')}\n)\nVALUES\n  ${placeholders};`;
            this.telemetry.debug('[PostgreSQLDatabaseClient][create] Performing the following SQL query on database:');
            this.telemetry.debug(`[PostgreSQLDatabaseClient][create]\n\n${sqlQuery}\n`);
            this.telemetry.debug(`[PostgreSQLDatabaseClient][create] [\n  ${values.join(',\n  ')}\n]\n`);
            return connection.query(sqlQuery, values);
          }
          return null;
        }));
        await connection.query('COMMIT');
        connection.release();
      } catch (error) {
        await connection.query('ROLLBACK');
        connection.release();
        throw error;
      }
    });
  }

  /**
   * Updates resource with id `id` in database.
   *
   * @param resource Type of resource to update.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns `true` if resource has been successfully updated, `false` otherwise.
   */
  public async update<Resource extends keyof DataModel>(
    resource: Resource,
    id: Id,
    payload: Payload<DataModel[Resource]>,
    options: ViewQueryOptions = this.DEFAULT_VIEW_COMMAND_OPTIONS,
  ): Promise<boolean> {
    let resourceExists = false;
    const resourceId = String(id);
    const newDocuments = this.structurePayload(resource, id, payload, 'UPDATE');

    return this.handleError(async () => {
      const connection = await this.client.connect();
      await connection.query('BEGIN');
      try {
        const tables = Object.keys(newDocuments);

        // If only the main resource is being updated, we don't need to use any lock as
        // the operation will be atomic anyway.
        if (tables.length > 1) {
          const mainStructure = this.tablesMapping[String(resource)]
            ?? this.resourcesMetadata[String(resource)].structure;
          await connection.query(`SELECT * FROM "${mainStructure}" WHERE "_id" = $1 FOR UPDATE;`, [resourceId]);
        }

        // We need to sort tables from the most specific to the root resource before deletion, in
        // order to prevent foreign keys constraints issues on nested fields deletion.
        await Promise.all([...tables].sort((a, b) => b.length - a.length).map(async (table) => {
          if (table !== resource) {
            const structure = this.tablesMapping[table] ?? this.resourcesMetadata[table].structure;
            const sqlQuery = `DELETE FROM "${structure}" WHERE "_resourceId" = $1;`;
            this.telemetry.debug('[PostgreSQLDatabaseClient][update] Performing the following SQL query on database:');
            this.telemetry.debug(`[PostgreSQLDatabaseClient][update]\n\n${sqlQuery}\n`);
            this.telemetry.debug(`[PostgreSQLDatabaseClient][update] [\n  ${resourceId}\n]\n`);
            await connection.query(sqlQuery, [resourceId]);
          }
        }));

        await Promise.all(tables.map(async (table) => {
          const sqlFields: string[] = [];
          const documents = newDocuments[table];
          const structure = this.tablesMapping[table] ?? this.resourcesMetadata[table].structure;
          if (documents.length > 0) {
            const values: unknown[] = [];
            const fieldPlaceholders: string[] = [];
            const fields = Object.keys(documents[0]);
            const { length } = fields;
            documents.forEach((document, index) => {
              if (table === resource) {
                fields.forEach((fieldName, fieldIndex) => {
                  fieldPlaceholders.push(`"${fieldName}" = $${String(length * index + fieldIndex + 1)}`);
                  values.push(document[fieldName]);
                });
              } else {
                const placeholders: string[] = [];
                fields.forEach((fieldName, fieldIndex) => {
                  if (index === 0) {
                    sqlFields.push(`"${fieldName}"`);
                  }
                  placeholders.push(`$${String(length * index + fieldIndex + 1)}`);
                  values.push(document[fieldName]);
                });
                fieldPlaceholders.push(`(${placeholders.join(', ')})`);
              }
            });

            const filters = this.getResourceFilters(resource, id, options);
            const where = Object.keys(filters).map((key, index) => {
              if (table === resource) {
                values.push(filters[key]);
              }
              return `\n  "${key}" = $${String(fieldPlaceholders.length + index + 1)}`;
            }).join('\n  AND ');
            const placeholders = fieldPlaceholders.join(',\n  ');
            const sqlQuery = (table === resource)
              ? `UPDATE "${structure}" SET\n  ${placeholders}\nWHERE${where};`
              : `INSERT INTO "${structure}" (\n  ${sqlFields.join(',\n  ')}\n)\nVALUES\n  ${placeholders};`;
            this.telemetry.debug('[PostgreSQLDatabaseClient][update] Performing the following SQL query on database:');
            this.telemetry.debug(`[PostgreSQLDatabaseClient][update]\n\n${sqlQuery}\n`);
            this.telemetry.debug(`[PostgreSQLDatabaseClient][update] [\n  ${values.join(',\n  ')}\n]\n`);
            const response = await connection.query(sqlQuery, values);
            if (table === resource) {
              resourceExists = response.rowCount === 1;
            }
          }
        }));
        if (!resourceExists) {
          await connection.query('ROLLBACK');
        } else {
          await connection.query('COMMIT');
        }
        connection.release();
        return resourceExists;
      } catch (error) {
        await connection.query('ROLLBACK');
        connection.release();
        throw error;
      }
    });
  }

  // TODO method that handles treansactions => withSession + callback
  // TODO correct trace teleemtry + anonyluzatiuon
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
  public async view<
    Key extends keyof QueryResults,
    Resource extends keyof DataModel = keyof DataModel
  >(
    resource: Resource,
    id: Id,
    options: ViewQueryOptions = this.DEFAULT_VIEW_COMMAND_OPTIONS,
  ): Promise<(Key extends keyof QueryResults ? QueryResults[Key] : Ids) | null> {
    const values: unknown[] = [];
    const fields = new Set([...(options.fields ?? [])]);
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const { formattedQuery, projections } = this.parseFields(resource, fields, maximumDepth);
    const filters = this.getResourceFilters(resource, id, options);
    const where = Object.keys(filters).map((key, index) => {
      values.push(filters[key]);
      return `\n  "${key}" = $${String(index + 1)}`;
    }).join('\n  AND ');
    const whereClause = `\nWHERE ${where}`;

    return this.handleError(async () => {
      const sqlQuery = `${this.generateQuery(resource, formattedQuery)}${whereClause};`;
      this.telemetry.debug('[PostgreSQLDatabaseClient][view] Performing the following SQL query on database:');
      this.telemetry.debug(`[PostgreSQLDatabaseClient][view]\n\n${sqlQuery}\n`);
      this.telemetry.debug(`[PostgreSQLDatabaseClient][view] [\n  ${values.join(',\n  ')}\n]\n`);
      const response = await this.client.query<Record<string, unknown>>(sqlQuery, values);
      const mapping = projections as Map<string, string>;
      return (
        this.formatResources(resource, response.rows, fields, mapping)[0] ?? null
      ) as unknown as (Key extends keyof QueryResults ? QueryResults[Key] : Ids);
    });
  }

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
  public async list<
    Key extends keyof QueryResults,
    Resource extends keyof DataModel = keyof DataModel
  >(
    resource: Resource,
    searchBody: SearchBody,
    options: ListQueryOptions = this.DEFAULT_LIST_COMMAND_OPTIONS,
  ): Promise<Key extends keyof QueryResults ? Results<QueryResults[Key]> : Results<Ids>> {
    const { sortBy } = options;
    const values: unknown[] = [];
    const query = searchBody.query ?? null;
    const filters = searchBody.filters ?? {};
    const filterFields = Object.keys(filters);
    const queryFields = [...(query?.on ?? [])];
    const sortingFields = Object.keys(sortBy ?? {});
    const fields = new Set([...options.fields ?? []]);
    const limit = options.limit ?? this.DEFAULT_LIMIT;
    const offset = options.offset ?? this.DEFAULT_OFFSET;
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const searchFields = new Set([...queryFields, ...sortingFields, ...filterFields]);
    const allFields = new Set([...fields, ...searchFields]);
    const { formattedQuery, projections } = this.parseFields(resource, allFields, maximumDepth);
    const searchMetaData = this.parseFields(resource, searchFields, maximumDepth, {
      query,
      filters,
    }, sortBy);
    const extraFilters = this.getResourceFilters(resource, null, options);
    if (Object.keys(extraFilters).length > 0) {
      searchMetaData.formattedQuery.match ??= {
        filters: [],
        query: [],
      };
    }
    Object.keys(extraFilters).forEach((key) => {
      if (searchMetaData.formattedQuery.match) {
        searchMetaData.formattedQuery.match.filters.push({ [key]: extraFilters[key] });
      }
    });
    const searchQuery = this.generateQuery(resource, searchMetaData.formattedQuery, '  ');

    // Build search CTE that returns only __total, _id, row_num (no inline results JOIN).
    let searchCTE = `WITH searchResults AS (\n${searchQuery}\n),`;
    searchCTE += '\ncount AS (\n  SELECT\n    COUNT(_id) AS total\n  FROM\n    searchResults\n),';
    searchCTE += `\npagination AS (\n  SELECT\n    _id,\n    ROW_NUMBER() OVER () AS row_num\n  FROM\n    searchResults\n  LIMIT ${String(limit)}\n  OFFSET ${String(offset)}\n)`;
    searchCTE += '\nSELECT\n  count.total AS __total,\n  pagination._id,\n  pagination.row_num';
    searchCTE += '\nFROM\n  count\nLEFT JOIN\n  pagination\nON 1 = 1\nORDER BY pagination.row_num;';

    searchMetaData.formattedQuery.match?.query.forEach((filter) => {
      values.push(Object.values(filter)[0]);
    });
    searchMetaData.formattedQuery.match?.filters.forEach((filter) => {
      if (Array.isArray(Object.values(filter)[0])) {
        values.push(...Object.values(filter)[0] as unknown[]);
      } else if (Object.values(filter)[0] !== null) {
        values.push(Object.values(filter)[0]);
      }
    });

    return this.handleError(async () => {
      const sqlQuery = this.generateQuery(resource, formattedQuery, '  ');
      const searchQuery = this.generateQuery(resource, searchMetaData.formattedQuery, '  ');
      let fullSQLQuery = `WITH searchResults AS (\n${searchQuery}\n),`;
      fullSQLQuery += '\ncount AS (\n  SELECT\n    COUNT(_id) AS total\n  FROM\n    searchResults\n),';
      fullSQLQuery += `\npagination AS (\n  SELECT\n    _id,\n    ROW_NUMBER() OVER () AS row_num\n  FROM\n    searchResults\n  LIMIT ${String(limit)}\n  OFFSET ${String(offset)}\n)`;
      fullSQLQuery += '\nSELECT\n  count.total AS __total,\n  results.*\nFROM\n  count\nLEFT JOIN\n  pagination\nON 1 = 1';
      fullSQLQuery += `\nLEFT JOIN (\n${sqlQuery}\n) AS results\nON results._id = pagination._id\nORDER BY pagination.row_num;`;
      this.telemetry.debug('[PostgreSQLDatabaseClient][list] Performing the following SQL query on database:');
      this.telemetry.debug(`[PostgreSQLDatabaseClient][list]\n\n${fullSQLQuery}\n`);
      this.telemetry.debug(`[PostgreSQLDatabaseClient][list] [\n  ${values.join(',\n  ')}\n]\n`);
      const response = await this.client.query<Omit<QueryResults[Key], '_id'> & {
        __total: string;
        _id: string | null;
      }>(fullSQLQuery, values);
      const mapping = projections as Map<string, string>;
      return {
        total: parseInt(response.rows[0]?.__total ?? '0', 10),
        results: (response.rows[0]?._id ?? null) === null
          ? []
          : this.formatResources(
            resource,
            response.rows,
            allFields,
            mapping,
          ),
      } as unknown as Key extends keyof QueryResults ? Results<QueryResults[Key]> : Results<Ids>;
    });
  }

  /**
   * Deletes resource with id `id` from database.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource id.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns `true` if resource has been successfully deleted, `false` otherwise.
   */
  public async delete<Resource extends keyof DataModel>(
    resource: Resource,
    id: Id,
    options: QueryOptions = this.DEFAULT_VIEW_COMMAND_OPTIONS,
  ): Promise<boolean> {
    let resourceExists = false;
    const resourceId = String(id);
    const subTables = this.resourcesMetadata[String(resource)].subStructures;

    return this.handleError(async () => {
      const connection = await this.client.connect();
      await connection.query('BEGIN');
      try {
        await Promise.all(subTables.concat([resource as string]).map(async (table) => {
          const values: unknown[] = (table !== resource) ? [resourceId] : [];
          const fieldPlaceholders: string[] = [];
          const structure = this.tablesMapping[table] ?? this.resourcesMetadata[table].structure;
          const filters = this.getResourceFilters(resource, id, options);
          const where = Object.keys(filters).map((key, index) => {
            if (table === resource) {
              values.push(filters[key]);
            }
            return `\n  "${key}" = $${String(fieldPlaceholders.length + index + 1)}`;
          }).join('\n  AND ');
          const sqlQuery = (table !== resource)
            ? `DELETE FROM "${structure}" WHERE "_resourceId" = $1;`
            : `DELETE FROM "${structure}" WHERE${where};`;
          this.telemetry.debug('[PostgreSQLDatabaseClient][delete] Performing the following SQL query on database:');
          this.telemetry.debug(`[PostgreSQLDatabaseClient][delete]\n\n${sqlQuery}\n`);
          this.telemetry.debug(`[PostgreSQLDatabaseClient][delete] [\n  ${values.join(',\n  ')}\n]\n`);
          const response = await connection.query(sqlQuery, values);
          if (table === resource) {
            resourceExists = response.rowCount === 1;
          }
        }));
        await connection.query('COMMIT');
        connection.release();
      } catch (error) {
        await connection.query('ROLLBACK');
        connection.release();
        throw error;
      }

      return resourceExists;
    });
  }

  /**
   * Gracefully shuts down the database client, releasing all remaining connections to the server.
   */
  public async shutdown(): Promise<void> {
    await Promise.all([
      this.client.end(),
      ...Array.from(this.pools.values()).map((pool) => pool.end()),
    ]);
  }


  /**
   * Connects to the database server.
   *
   * @param pool Name of the pool to connect to. Defaults to `default`.
   *
   * @returns Connection pool instance.
   */
  protected async connect(pool = 'default'): Promise<pg.Pool> {
    const poolClient = this.pools.get(pool);

    if (poolClient !== undefined) {
      return poolClient;
    }

    this.telemetry.info('Connecting to database...', {
      'db.system.name': 'postgresql',
      'db.namespace': this.database,
      'server.address': this.databaseSettings.host,
      'server.port': this.databaseSettings.port ?? undefined,
    });

    this.lastMetrics.set(pool, { used: 0, idle: 0, pending: 0 });
    const newPoolClient = new pg.Pool({
      database: this.database,
      ssl: this.databaseSettings.ssl,
      host: this.databaseSettings.host,
      max: this.databaseSettings.connectionLimit,
      port: this.databaseSettings.port ?? undefined,
      user: this.databaseSettings.user ?? undefined,
      password: this.databaseSettings.password ?? undefined,
      lock_timeout: this.databaseSettings.queryTimeout,
      query_timeout: this.databaseSettings.queryTimeout,
      statement_timeout: this.databaseSettings.queryTimeout,
      idleTimeoutMillis: this.databaseSettings.connectTimeout,
      connectionTimeoutMillis: this.databaseSettings.connectTimeout,
    });

    const updateMetrics = () => {
      const lastMetrics = this.lastMetrics.get(pool) as PoolMetrics;
      const { totalCount, idleCount, waitingCount } = newPoolClient;
      const currentUsed = totalCount - idleCount;
      this.telemetry.measure('db.client.connection.count', currentUsed - lastMetrics.used, {
        'db.client.connection.state': 'used',
        'db.client.connection.pool.name': pool,
      });
      this.telemetry.measure('db.client.connection.count', idleCount - lastMetrics.idle, {
        'db.client.connection.state': 'idle',
        'db.client.connection.pool.name': pool,
      });
      this.telemetry.measure('db.client.connection.pending_requests', waitingCount - lastMetrics.pending, {
        'db.client.connection.pool.name': pool,
      });
     lastMetrics.used = currentUsed;
     lastMetrics.idle = idleCount;
     lastMetrics.pending = waitingCount;
    };
    newPoolClient.on('connect', updateMetrics);
    newPoolClient.on('acquire', updateMetrics);
    newPoolClient.on('remove', updateMetrics);
    newPoolClient.on('release', updateMetrics);

    this.pools.set(pool, newPoolClient);
    return newPoolClient;
  }

  /**
   * Performs a SQL query on the database with `settings`.
   *
   * @param settings Query settings. Contains:
   * - `query`: SQL query to perform.
   * - `values`: Values to bind to the query.
   * - `poolOrSession`: Pool or session ID to use for the query.
   * - `telemetryAttributes`: Telemetry attributes to add to the query span.
   *
   * @returns Query result.
   */
  public async query<T extends pg.QueryResultRow = pg.QueryResultRow>(settings: {
    query: string;
    values?: unknown[];
    poolOrSession?: string;
    telemetryAttributes?: Record<string, string | number | boolean | undefined>;
  }): Promise<pg.QueryResult<T>> {
    const { query, values = [] } = settings;
    const { poolOrSession = 'default', telemetryAttributes = {} } = settings;
    let sqlErrorCode: string | undefined;
    const defaultAttributes: Record<string, string | number | boolean | undefined> = {
      'db.namespace': this.database,
      'db.system.name': 'postgresql',
      'server.address': this.databaseSettings.host,
      'server.port': this.databaseSettings.port ?? undefined,
    };

    const client = this.sessions.get(poolOrSession)
      ?? this.pools.get(poolOrSession)
      ?? await this.connect(poolOrSession);

    const startTime = this.telemetry.now();
    return this.telemetry.span(`${this.constructor.name}.query`, {
      attributes: {
        ...defaultAttributes,
        'db.query.text': settings.query,
        'code.class.name': this.constructor.name,
        ...telemetryAttributes,
      },
    }, async (span) => {
      try {
        return await client.query<T>(query, values);
      } catch (error) {
        const postgreError = error as pg.DatabaseError;
        // TODO
        if (postgreError.code === '23505') {
          const match = /Key \(([^)]+)\)=\(([^)]+)\)/.exec(postgreError.detail as unknown as string);
          throw new DatabaseError('DUPLICATE_RESOURCE', {
            path: (match as string[])[1],
            value: (match as string[])[2].trim(),
          });
        }
        if (postgreError.code === '23503') {
          const path = (/Key \(([^)]+)\)=/.exec(postgreError.detail as unknown as string) as string[])[1];
          throw new DatabaseError('RESOURCE_REFERENCED', { path });
        }
        sqlErrorCode = postgreError.code;
        span.setStatus({ code: 'ERROR' });
        throw error;
      } finally {
        span.setAttributes({
          'error.type': sqlErrorCode,
          'db.response.status_code': sqlErrorCode,
        });
        this.telemetry.measure('db.client.operation.duration', this.telemetry.duration(startTime), {
          ...defaultAttributes,
          'error.type': sqlErrorCode,
          'db.response.status_code': sqlErrorCode,
          ...telemetryAttributes,
        });
      }
    });
  }

  /**
   * Starts a new session to perform multiple database operations atomically.
   * Automatically handles transaction start, commit and rollback in case of error, as well as
   * connection release.
   *
   * @param callback Callback containing the operations to execute within the session.
   *
   * @param pool Name of the pool to use for the session. Defaults to `default`.
   *
   * @returns Result of the callback execution, if any.
   */
  public async withSession<T>(
    callback: (session: string, cancel: () => void) => Promise<T>,
    pool = 'default',
  ): Promise<T> {
    let isCancelled = false;
    const newSessionId = String(new Id());
    const poolClient = await this.connect(pool);
    const connection = await poolClient.connect()
    this.sessions.set(newSessionId, connection);
    const cancel = async () => {
      isCancelled = true;
      await this.query({
        query: 'ROLLBACK;',
        poolOrSession: newSessionId,
      });
      this.sessions.delete(newSessionId);
    };
    try {
      await this.query({
        query: 'BEGIN;',
        poolOrSession: newSessionId,
      });
      const response = await callback(newSessionId, cancel);
      if (!isCancelled) {
        await this.query({
          query: 'COMMIT;',
          poolOrSession: newSessionId,
        });
      }
      return response;
    } catch (error) {
      await cancel();
      throw error;
    } finally {
      connection.release();
      this.sessions.delete(newSessionId);
    }
  }
}
