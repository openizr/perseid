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
  type ArrayLookupDescriptor,
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
 * PostgreSQL database client settings.
 */
export interface PostgreSQLDatabaseClientSettings extends DatabaseClientSettings {
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
   * Walks the `formattedQuery` tree, generates SQL with only N:1 JOINs inlined, and collects
   * 1:N (array) lookups into `ArrayLookupDescriptor[]` for separate execution.
   *
   * @param resource Type of resource for which to generate the query.
   *
   * @param formattedQuery Formatted query to generate database query from.
   *
   * @param textIndent Current indent for SQL legibility. Defaults to `""`.
   *
   * @returns The main SQL query string and an array of 1:N lookup descriptors.
   */
  protected generateResultsQuery<Resource extends keyof DataModel>(
    _resource: Resource,
    formattedQuery: FormattedQuery,
    textIndent = '',
  ): { mainQuery: string; arrayLookups: ArrayLookupDescriptor[]; } {
    const arrayLookups: ArrayLookupDescriptor[] = [];

    const buildQuery = (
      fq: FormattedQuery,
      indent: string,
    ): string => {
      let joinClauses = '';
      const newIndent = `${indent}  `;
      const { structure } = fq;
      const table = this.tablesMapping[structure] ?? this.resourcesMetadata[structure].structure;
      const joinedTables = Object.keys(fq.lookups);

      for (let i = 0, { length } = joinedTables; i < length; i += 1) {
        const lookupKey = joinedTables[i];
        const lookup = fq.lookups[lookupKey];

        if (lookup.localField === '_id') {
          // 1:N (array) lookup — collect as separate query.
          const children: ArrayLookupDescriptor[] = [];
          this.collectArrayLookups(lookup, children);
          arrayLookups.push({
            formattedQuery: lookup,
            lookupKey,
            parentIdSourceColumn: '_id',
            children,
          });
        } else {
          // N:1 (relation) lookup — inline as LEFT JOIN.
          const subQuery = buildQuery(lookup, newIndent);
          const prefix = `\n${indent}`;
          const onClause = `${indent}ON "${table}"."${String(lookup.localField)}" = "${lookupKey}"."${String(lookup.foreignField)}"`;
          joinClauses += `${prefix}LEFT JOIN (\n${subQuery}\n${indent}) AS "${lookupKey}"\n${onClause}`;
        }
      }

      const fieldsClause = Object.keys(fq.fields).map((fieldName) => (
        `"${table}"."${fieldName}" AS "${fq.fields[fieldName]}"`
      )).concat(
        joinedTables
          .filter((key) => fq.lookups[key].localField !== '_id')
          .map((path) => `"${path}".*`),
      ).join(`,\n${newIndent}`);
      const selectClause = `${indent}SELECT\n${newIndent}${fieldsClause}\n${indent}FROM\n${newIndent}"${table}"`;

      return `${selectClause}${joinClauses}`;
    };

    const mainQuery = buildQuery(formattedQuery, textIndent);
    return { mainQuery, arrayLookups };
  }

  /**
   * Recursively collects 1:N (array) lookups from within a FormattedQuery node.
   * N:1 lookups nested inside a 1:N are handled during `generateArrayQuery`.
   *
   * @param fq The FormattedQuery node to scan.
   *
   * @param children Array to populate with nested ArrayLookupDescriptors.
   */
  protected collectArrayLookups(
    fq: FormattedQuery,
    children: ArrayLookupDescriptor[],
    parentIdColumnOverride?: string,
  ): void {
    const lookupKeys = Object.keys(fq.lookups);
    for (let i = 0, { length } = lookupKeys; i < length; i += 1) {
      const lookupKey = lookupKeys[i];
      const lookup = fq.lookups[lookupKey];
      if (lookup.localField === '_id') {
        // Nested 1:N inside this scope.
        const nestedChildren: ArrayLookupDescriptor[] = [];
        this.collectArrayLookups(lookup, nestedChildren);
        children.push({
          formattedQuery: lookup,
          lookupKey,
          parentIdSourceColumn: parentIdColumnOverride ?? '_id',
          children: nestedChildren,
        });
      } else {
        // N:1 inside this scope — recurse, passing the N:1's foreignField as the
        // parentIdSourceColumn for any 1:N children found inside the relation.
        this.collectArrayLookups(lookup, children, lookup.foreignField as string);
      }
    }
  }

  /**
   * Generates a SELECT for a 1:N (array) sub-table with N:1 JOINs inlined.
   * Does NOT include a WHERE clause — the caller appends `WHERE "_parentId" IN (...)`.
   *
   * @param fq The FormattedQuery node for the array lookup.
   *
   * @param textIndent Current indent for SQL legibility. Defaults to `""`.
   *
   * @returns SQL SELECT string without WHERE clause.
   */
  protected generateArrayQuery(
    fq: FormattedQuery,
    textIndent = '',
  ): string {
    const buildArrayQuery = (
      currentFq: FormattedQuery,
      indent: string,
    ): string => {
      let joinClauses = '';
      const newIndent = `${indent}  `;
      const { structure } = currentFq;
      const table = this.tablesMapping[structure] ?? this.resourcesMetadata[structure].structure;
      const joinedTables = Object.keys(currentFq.lookups);

      for (let i = 0, { length } = joinedTables; i < length; i += 1) {
        const lookupKey = joinedTables[i];
        const lookup = currentFq.lookups[lookupKey];

        if (lookup.localField !== '_id') {
          // N:1 (relation) — inline as LEFT JOIN.
          const subQuery = buildArrayQuery(lookup, newIndent);
          const prefix = `\n${indent}`;
          const onClause = `${indent}ON "${table}"."${String(lookup.localField)}" = "${lookupKey}"."${String(lookup.foreignField)}"`;
          joinClauses += `${prefix}LEFT JOIN (\n${subQuery}\n${indent}) AS "${lookupKey}"\n${onClause}`;
        }
        // 1:N lookups are skipped here — they are handled as children in collectAndExecuteArrayQueries.
      }

      const fieldsClause = Object.keys(currentFq.fields).map((fieldName) => (
        `"${table}"."${fieldName}" AS "${currentFq.fields[fieldName]}"`
      )).concat(
        joinedTables
          .filter((key) => currentFq.lookups[key].localField !== '_id')
          .map((path) => `"${path}".*`),
      ).join(`,\n${newIndent}`);
      const selectClause = `${indent}SELECT\n${newIndent}${fieldsClause}\n${indent}FROM\n${newIndent}"${table}"`;

      return `${selectClause}${joinClauses}`;
    };

    return buildArrayQuery(fq, textIndent);
  }

  /**
   * Executes array (1:N) queries, stores results in `arrayResultsMap`, and recursively handles
   * nested array lookups.
   *
   * @param connection PostgreSQL client connection to use for queries.
   *
   * @param parentIds List of parent IDs to filter by.
   *
   * @param lookups Array of ArrayLookupDescriptor to execute.
   *
   * @param arrayResultsMap Map to store results keyed by lookupKey.
   */
  protected async collectAndExecuteArrayQueries(
    connection: pg.PoolClient,
    parentIds: string[],
    lookups: ArrayLookupDescriptor[],
    arrayResultsMap: Map<string, unknown[]>,
  ): Promise<void> {
    await Promise.all(lookups.map(async (descriptor) => {
      if (parentIds.length === 0) {
        arrayResultsMap.set(descriptor.lookupKey, []);
        return;
      }

      const placeholders = parentIds.map((_, idx) => `$${String(idx + 1)}`).join(', ');
      const { structure } = descriptor.formattedQuery;
      const table = this.tablesMapping[structure] ?? this.resourcesMetadata[structure].structure;
      const baseQuery = this.generateArrayQuery(descriptor.formattedQuery);
      const sqlQuery = `${baseQuery}\nWHERE\n  "${table}"."_parentId" IN (${placeholders});`;

      this.telemetry.debug('[PostgreSQLDatabaseClient][collectAndExecuteArrayQueries] Performing the following SQL query on database:');
      this.telemetry.debug(`[PostgreSQLDatabaseClient][collectAndExecuteArrayQueries]\n\n${sqlQuery}\n`);
      this.telemetry.debug(`[PostgreSQLDatabaseClient][collectAndExecuteArrayQueries] [\n  ${parentIds.join(',\n  ')}\n]\n`);

      const response = await connection.query<Record<string, unknown>>(sqlQuery, parentIds);
      arrayResultsMap.set(descriptor.lookupKey, response.rows);

      // Recurse for children — each child may need different parent IDs depending on
      // whether it's nested inside a N:1 relation or directly inside this 1:N.
      if (descriptor.children.length > 0) {
        await Promise.all(descriptor.children.map(async (child) => {
          const childParentIds = [...new Set(
            response.rows
              .map((row) => row[child.parentIdSourceColumn] as string | null)
              .filter((v): v is string => v !== null),
          )];
          await this.collectAndExecuteArrayQueries(
            connection,
            childParentIds,
            [child],
            arrayResultsMap,
          );
        }));
      }
    }));
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
   * When `arrayResults` is provided (multi-query mode), the main `results` contain one row per
   * resource (no cartesian product from arrays). Array data is stitched in from `arrayResults`.
   *
   * When `arrayResults` is not provided, behaves exactly as the legacy single-query mode.
   *
   * @param resource Type of resource to format.
   *
   * @param results List of database raw results to format.
   *
   * @param fields Fields tree used to format results.
   *
   * @param mapping Mapping between DBMS-specific field name and real field path.
   *
   * @param arrayResults Optional map of array lookup results keyed by lookup key.
   *
   * @returns Formatted results.
   */
  protected formatResources<Resource extends keyof DataModel>(
    resource: Resource,
    results: unknown[],
    fields: unknown,
    mapping: Map<string, string>,
    arrayResults?: Map<string, unknown[]>,
    arrayLookups?: ArrayLookupDescriptor[],
  ): DataModel[Resource][] {
    if (arrayResults !== undefined && arrayLookups !== undefined) {
      return this.formatResourcesMultiQuery(resource, results, fields, mapping, arrayResults, arrayLookups);
    }
    return this.formatResourcesLegacy(resource, results, fields, mapping);
  }

  /**
   * Legacy single-query formatting (cartesian product mode). Used by `checkRelations` and when
   * there are no 1:N lookups.
   */
  protected formatResourcesLegacy<Resource extends keyof DataModel>(
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
   * Multi-query formatting: builds base resources from main query rows (one row per resource),
   * then stitches array data from separate query results.
   */
  protected formatResourcesMultiQuery<Resource extends keyof DataModel>(
    resource: Resource,
    results: unknown[],
    fields: unknown,
    mapping: Map<string, string>,
    arrayResults: Map<string, unknown[]>,
    arrayLookups: ArrayLookupDescriptor[],
  ): DataModel[Resource][] {
    const finalResources: Record<string, Record<string, unknown>> = {};
    const allObjectsById = new Map<string, Record<string, unknown>>();
    const model = this.model.get(resource);

    // Phase 1: Build base resources from main query rows (no arrays in main results).
    (results as Record<string, unknown>[]).forEach((result) => {
      const resourceId = result._id as string;
      finalResources[resourceId] ??= {
        _id: new Id(resourceId),
      };
      allObjectsById.set(resourceId, finalResources[resourceId]);

      (fields as Set<string>).forEach((path) => {
        const currentPath: string[] = [];
        const splittedPath = path.split('.');
        let currentResource = finalResources[resourceId];
        let currentSchema = model.schema as FieldSchema<DataModel> | undefined;

        while (splittedPath.length > 0 && currentSchema !== undefined) {
          const fieldName: string = String(splittedPath.shift());
          const subFields = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields;
          currentSchema = subFields?.[fieldName];
          currentPath.push(fieldName);

          if (currentSchema?.type === 'array') {
            // In multi-query mode, arrays are populated in Phase 2.
            const fullPath = currentPath.join('_');
            const key = mapping.get(fullPath) as unknown as string;
            if (result[key] === null) {
              currentResource[fieldName] = null;
            } else if (currentResource[fieldName] === undefined) {
              currentResource[fieldName] = [];
            }
            break;
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

    // Phase 2: Stitch array data from separate query results.
    this.stitchArrayResults(
      resource,
      fields as Set<string>,
      mapping,
      arrayResults,
      finalResources,
      allObjectsById,
      model as any,
      arrayLookups,
    );

    return Object.values(finalResources) as DataModel[Resource][];
  }

  /**
   * Stitches array results from separate queries into the base resource objects.
   * Processes descriptors in order (parents before children) to ensure allObjectsById is populated.
   */
  protected stitchArrayResults<Resource extends keyof DataModel>(
    _resource: Resource,
    fields: Set<string>,
    mapping: Map<string, string>,
    arrayResults: Map<string, unknown[]>,
    finalResources: Record<string, Record<string, unknown>>,
    allObjectsById: Map<string, Record<string, unknown>>,
    model: { schema: FieldSchema<DataModel>; },
    arrayLookups: ArrayLookupDescriptor[],
  ): void {
    // Flatten the descriptor tree in pre-order (parents before children).
    const flatDescriptors: ArrayLookupDescriptor[] = [];
    const flatten = (descriptors: ArrayLookupDescriptor[]): void => {
      for (let i = 0; i < descriptors.length; i += 1) {
        flatDescriptors.push(descriptors[i]);
        flatten(descriptors[i].children);
      }
    };
    flatten(arrayLookups);

    for (let d = 0; d < flatDescriptors.length; d += 1) {
      const descriptor = flatDescriptors[d];
      const rows = arrayResults.get(descriptor.lookupKey) ?? [];
      const arrayPath = this.findArrayPathForLookupKey(fields, model, descriptor.lookupKey);
      if (arrayPath === null) continue;

      // Use the formattedQuery's field aliases directly — these are always correct
      // regardless of whether it's a root or child descriptor.
      const parentIdKey = descriptor.formattedQuery.fields._parentId;
      const idKey = descriptor.formattedQuery.fields._id;

      // Determine the array item schema by walking the model from the root.
      const itemSchema = this.findItemSchemaForArrayPath(fields, model, descriptor.lookupKey);
      if (itemSchema === null) continue;

      // Determine the full mapping prefix for this array's items.
      // Reverse-lookup from the _parentId alias to find the mapping key prefix.
      let mappingPrefix: string[] | null = null;
      mapping.forEach((alias, key) => {
        if (alias === parentIdKey && key.endsWith('__parentId')) {
          const base = key.substring(0, key.length - '__parentId'.length);
          mappingPrefix = base.split('_').concat(['value']);
        }
      });
      if (mappingPrefix === null) continue;

      // Derive the full field path prefix from mappingPrefix by stripping 'value' segments.
      // e.g., ['roles', 'value', 'permissions', 'value'] -> 'roles.permissions'
      const fullFieldPrefix = (mappingPrefix as string[])
        .filter((seg) => seg !== 'value')
        .join('.');

      // Collect sub-paths: field path segments AFTER the array, using the full field prefix.
      const subPaths: string[] = [];
      fields.forEach((fieldPath) => {
        if (fieldPath.startsWith(`${fullFieldPrefix}.`)) {
          subPaths.push(fieldPath.substring(fullFieldPrefix.length + 1));
        }
      });

      // Group rows by _parentId.
      const rowsByParent = new Map<string, Record<string, unknown>[]>();
      (rows as Record<string, unknown>[]).forEach((row) => {
        const parentId = row[parentIdKey] as string;
        if (parentId != null) {
          let parentRows = rowsByParent.get(parentId);
          if (parentRows === undefined) {
            parentRows = [];
            rowsByParent.set(parentId, parentRows);
          }
          parentRows.push(row);
        }
      });

      rowsByParent.forEach((childRows, parentId) => {
        const parentObj = allObjectsById.get(parentId) ?? finalResources[parentId];
        if (parentObj === undefined) return;

        // Navigate to the array field in the parent.
        let container = parentObj;
        for (let i = 0; i < arrayPath.length - 1; i += 1) {
          const segment = arrayPath[i];
          if (container[segment] == null) return;
          container = container[segment] as Record<string, unknown>;
        }

        const arrayFieldName = arrayPath[arrayPath.length - 1];
        if (container[arrayFieldName] === null) return;
        container[arrayFieldName] ??= [];
        const arr = container[arrayFieldName] as unknown[];

        childRows.forEach((childRow) => {
          const childId = childRow[idKey] as string;

          const item = this.buildArrayItem(
            childRow, itemSchema, subPaths, mapping,
            mappingPrefix as string[],
          );
          arr.push(item);

          if (childId != null && typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>;
            allObjectsById.set(childId, itemObj);
            // For relation expansions, also register under the relation's _id so that
            // nested array lookups (whose _parentId references the relation) can find this item.
            if (itemObj._id instanceof Id) {
              const relId = String(itemObj._id);
              if (relId !== childId) {
                allObjectsById.set(relId, itemObj);
              }
            }
          }
        });
      });
    }
  }

  /**
   * Finds the array item schema for a given lookupKey by walking all field paths.
   */
  protected findItemSchemaForArrayPath(
    fields: Set<string>,
    model: { schema: FieldSchema<DataModel>; },
    lookupKey: string,
  ): FieldSchema<DataModel> | null {
    for (const fieldPath of fields) {
      const splittedPath = fieldPath.split('.');
      const currentPath: string[] = [];
      let scopedPath: string[] = [];
      let currentSchema = model.schema as FieldSchema<DataModel> | undefined;

      for (let i = 0; i < splittedPath.length; i += 1) {
        const seg = splittedPath[i];
        const subFields = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields;
        currentSchema = subFields?.[seg];
        currentPath.push(seg);
        scopedPath.push(seg);

        if (currentSchema?.type === 'array') {
          const flatPath = currentPath.join('_');
          const flatScopedPath = scopedPath.join('_');
          if (flatPath === lookupKey || flatScopedPath === lookupKey) {
            return currentSchema.fields;
          }

          currentPath.push('value');
          scopedPath.push('value');
          currentSchema = currentSchema.fields;

          const relation = (currentSchema as IdSchema<DataModel> | undefined)?.relation;
          if (currentSchema?.type === 'id' && relation !== undefined) {
            const relationMetadata = this.model.get(relation);
            const { schema } = relationMetadata;
            currentSchema = {
              type: 'object',
              fields: schema.fields,
              description: schema.description,
            } as unknown as FieldSchema<DataModel>;
            scopedPath = [];
          }
        } else if (currentSchema?.type === 'id') {
          const relation = (currentSchema as IdSchema<DataModel>).relation;
          if (relation !== undefined && i < splittedPath.length - 1) {
            const relationMetadata = this.model.get(relation);
            const { schema } = relationMetadata;
            currentSchema = {
              type: 'object',
              fields: schema.fields,
              description: schema.description,
            } as unknown as FieldSchema<DataModel>;
            scopedPath = [];
          }
        }
      }
    }
    return null;
  }

  /**
   * Builds a single array item from a child row, handling primitives, relations, and objects.
   */
  protected buildArrayItem(
    childRow: Record<string, unknown>,
    itemSchema: FieldSchema<DataModel>,
    subPaths: string[],
    mapping: Map<string, string>,
    mappingPrefix: string[],
  ): unknown {
    const flatPrefix = mappingPrefix.join('_');
    const valueKey = mapping.get(flatPrefix) as string;
    const rawValue = valueKey != null ? childRow[valueKey] : null;

    // Case 1: Array of ids with relation expansion (e.g., roles.name, roles.permissions).
    if (itemSchema.type === 'id') {
      const relation = (itemSchema as IdSchema<DataModel>).relation;
      if (relation !== undefined && subPaths.length > 0) {
        if (rawValue === null || rawValue === undefined) return null;
        const obj: Record<string, unknown> = {};
        // Set _id from the relation JOIN.
        const relIdKey = mapping.get(`${flatPrefix}__id`) as string;
        if (relIdKey && childRow[relIdKey] != null) {
          obj._id = new Id(childRow[relIdKey] as string);
        }
        // Get the relation schema and walk sub-paths.
        const relationMetadata = this.model.get(relation);
        const relSchema: FieldSchema<DataModel> = {
          type: 'object',
          fields: relationMetadata.schema.fields,
          description: relationMetadata.schema.description,
        } as unknown as FieldSchema<DataModel>;
        subPaths.forEach((subPath) => {
          this.walkAndExtract(childRow, subPath.split('.'), relSchema, mapping, mappingPrefix, obj);
        });
        return obj;
      }
      // Simple id (no relation or no sub-paths).
      if (rawValue === null || rawValue === undefined) return null;
      return new Id(rawValue as string);
    }

    // Case 2: Array of objects.
    if (itemSchema.type === 'object') {
      const obj: Record<string, unknown> = {};
      subPaths.forEach((subPath) => {
        this.walkAndExtract(childRow, subPath.split('.'), itemSchema, mapping, mappingPrefix, obj);
      });
      return obj;
    }

    // Case 3: Array of other primitives (string, number, boolean, date, etc.).
    return rawValue;
  }

  /**
   * Walks a field path within a schema and extracts the value from the row into the target object.
   * Handles relations, nested objects, nested arrays, and leaf values.
   */
  protected walkAndExtract(
    row: Record<string, unknown>,
    pathSegments: string[],
    schema: FieldSchema<DataModel>,
    mapping: Map<string, string>,
    mappingPrefix: string[],
    targetObj: Record<string, unknown>,
  ): void {
    let currentSchema: FieldSchema<DataModel> | undefined = schema;
    let currentObj = targetObj;
    const currentPath = [...mappingPrefix];
    const remaining = [...pathSegments];

    while (remaining.length > 0 && currentSchema !== undefined) {
      const fieldName = remaining.shift() as string;
      const subFields = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields as any;
      currentSchema = subFields?.[fieldName];
      currentPath.push(fieldName);

      if (currentSchema?.type === 'array') {
        // Nested array — set to [] or null based on marker column.
        const fullPath = currentPath.join('_');
        const markerKey = mapping.get(fullPath) as string;
        if (markerKey && row[markerKey] === null) {
          currentObj[fieldName] = null;
        } else if (currentObj[fieldName] === undefined) {
          currentObj[fieldName] = [];
        }
        return;
      }

      const type = currentSchema?.type;
      const fullPath = currentPath.join('_');
      const key = mapping.get(fullPath) as string;
      const relation = (currentSchema as IdSchema<DataModel> | undefined)?.relation;

      if (key == null || row[key] === null || row[key] === undefined) {
        currentObj[fieldName] = null;
        return;
      }

      if (type === 'id' && relation !== undefined && remaining.length > 0) {
        const isUndefined = currentObj[fieldName] === undefined;
        if (isUndefined || currentObj[fieldName] instanceof Id) {
          currentObj[fieldName] = { _id: new Id(row[key] as string) };
        }
        currentObj = currentObj[fieldName] as Record<string, unknown>;
        const relationMetadata = this.model.get(relation);
        const { schema: relSchema } = relationMetadata;
        currentSchema = {
          type: 'object',
          fields: relSchema.fields,
          description: relSchema.description,
        } as unknown as FieldSchema<DataModel>;
      } else if (currentSchema?.type === 'object') {
        currentObj[fieldName] ??= {};
        currentObj = currentObj[fieldName] as Record<string, unknown>;
      } else if (remaining.length === 0) {
        if (type === 'id') {
          currentObj[fieldName] ??= new Id(row[key] as string);
        } else {
          currentObj[fieldName] = row[key];
        }
      }
    }
  }

  /**
   * Finds the array field path segments corresponding to a given lookupKey.
   * Handles relations within the path (e.g., for arrays nested inside relation fields).
   *
   * For root lookupKeys (e.g., 'roles'), returns the navigation path from the resource root.
   * For child lookupKeys (e.g., 'permissions' inside a relation), returns the navigation path
   * from the parent object (which is the expanded relation item).
   */
  protected findArrayPathForLookupKey(
    fields: Set<string>,
    model: { schema: FieldSchema<DataModel>; },
    lookupKey: string,
  ): string[] | null {
    for (const fieldPath of fields) {
      const splittedPath = fieldPath.split('.');
      const currentPath: string[] = [];
      // scopedPath tracks the path within the current scope (reset at relation boundaries).
      let scopedPath: string[] = [];
      let currentSchema = model.schema as FieldSchema<DataModel> | undefined;

      for (let i = 0; i < splittedPath.length; i += 1) {
        const seg = splittedPath[i];
        const subFields = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields;
        currentSchema = subFields?.[seg];
        currentPath.push(seg);
        scopedPath.push(seg);

        if (currentSchema?.type === 'array') {
          // Check full path (for root lookups).
          const flatPath = currentPath.join('_');
          if (flatPath === lookupKey) {
            return [...currentPath];
          }
          // Check scoped path (for child lookups inside relations).
          const flatScopedPath = scopedPath.join('_');
          if (flatScopedPath === lookupKey) {
            return [...scopedPath];
          }

          // Continue into nested arrays.
          currentPath.push('value');
          scopedPath.push('value');
          currentSchema = currentSchema.fields;

          // If the array item is a relation, traverse it.
          const relation = (currentSchema as IdSchema<DataModel> | undefined)?.relation;
          if (currentSchema?.type === 'id' && relation !== undefined) {
            const relationMetadata = this.model.get(relation);
            const { schema } = relationMetadata;
            currentSchema = {
              type: 'object',
              fields: schema.fields,
              description: schema.description,
            } as unknown as FieldSchema<DataModel>;
            // Reset scoped path — we're now in the relation's scope.
            scopedPath = [];
          }
        } else if (currentSchema?.type === 'id') {
          // Relation traversal outside arrays.
          const relation = (currentSchema as IdSchema<DataModel>).relation;
          if (relation !== undefined && i < splittedPath.length - 1) {
            const relationMetadata = this.model.get(relation);
            const { schema } = relationMetadata;
            currentSchema = {
              type: 'object',
              fields: schema.fields,
              description: schema.description,
            } as unknown as FieldSchema<DataModel>;
            // Reset scoped path.
            scopedPath = [];
          }
        }
      }
    }
    return null;
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
    this.model.getResources().forEach((resource) => {
      this.generateResourceMetadata(resource);
      // Reversing the sub-tables array is essential to delete dependencies in the right order.
      this.resourcesMetadata[resource].subStructures.reverse();
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
    const { mainQuery, arrayLookups } = this.generateResultsQuery(resource, formattedQuery);
    const filters = this.getResourceFilters(resource, id, options);
    const where = Object.keys(filters).map((key, index) => {
      values.push(filters[key]);
      return `\n  "${key}" = $${String(index + 1)}`;
    }).join('\n  AND ');
    const whereClause = `\nWHERE ${where}`;
    const mapping = projections as Map<string, string>;

    return this.handleError(async () => {
      if (arrayLookups.length === 0) {
        // No 1:N lookups — single query, same as legacy path.
        const sqlQuery = `${mainQuery}${whereClause};`;
        this.telemetry.debug('[PostgreSQLDatabaseClient][view] Performing the following SQL query on database:');
        this.telemetry.debug(`[PostgreSQLDatabaseClient][view]\n\n${sqlQuery}\n`);
        this.telemetry.debug(`[PostgreSQLDatabaseClient][view] [\n  ${values.join(',\n  ')}\n]\n`);
        const response = await this.client.query<Record<string, unknown>>(sqlQuery, values);
        return (
          this.formatResources(resource, response.rows, fields, mapping)[0] ?? null
        ) as unknown as (Key extends keyof QueryResults ? QueryResults[Key] : Ids);
      }

      // Multi-query path for 1:N lookups.
      const connection = await this.client.connect();
      try {
        await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ');

        const mainSqlQuery = `${mainQuery}${whereClause};`;
        this.telemetry.debug('[PostgreSQLDatabaseClient][view] Performing the following SQL query on database:');
        this.telemetry.debug(`[PostgreSQLDatabaseClient][view]\n\n${mainSqlQuery}\n`);
        this.telemetry.debug(`[PostgreSQLDatabaseClient][view] [\n  ${values.join(',\n  ')}\n]\n`);
        const mainResponse = await connection.query<Record<string, unknown>>(mainSqlQuery, values);

        if (mainResponse.rows.length === 0) {
          await connection.query('COMMIT');
          connection.release();
          return null;
        }

        const resourceIds = [...new Set(mainResponse.rows.map((row) => row._id as string))];
        const arrayResultsMap = new Map<string, unknown[]>();
        await this.collectAndExecuteArrayQueries(connection, resourceIds, arrayLookups, arrayResultsMap);

        await connection.query('COMMIT');
        connection.release();

        return (
          this.formatResources(resource, mainResponse.rows, fields, mapping, arrayResultsMap, arrayLookups)[0] ?? null
        ) as unknown as (Key extends keyof QueryResults ? QueryResults[Key] : Ids);
      } catch (error) {
        await connection.query('ROLLBACK');
        connection.release();
        throw error;
      }
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
    const { mainQuery: resultsQuery, arrayLookups } = this.generateResultsQuery(resource, formattedQuery, '  ');
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

    const mapping = projections as Map<string, string>;

    return this.handleError(async () => {
      // Step 1: Execute search CTE to get total count and matched IDs.
      this.telemetry.debug('[PostgreSQLDatabaseClient][search] Performing the following SQL query on database:');
      this.telemetry.debug(`[PostgreSQLDatabaseClient][search]\n\n${searchCTE}\n`);
      this.telemetry.debug(`[PostgreSQLDatabaseClient][search] [\n  ${values.join(',\n  ')}\n]\n`);
      const searchResponse = await this.client.query<{
        __total: string;
        _id: string | null;
        row_num: string | null;
      }>(searchCTE, values);

      const total = parseInt(searchResponse.rows[0]?.__total ?? '0', 10);
      const matchedIds = searchResponse.rows
        .map((row) => row._id)
        .filter((id): id is string => id !== null);

      if (matchedIds.length === 0) {
        return {
          total,
          results: [],
        } as unknown as Key extends keyof QueryResults ? Results<QueryResults[Key]> : Results<Ids>;
      }

      // Build WHERE _id IN (...) clause for the results query.
      const idPlaceholders = matchedIds.map((_, idx) => `$${String(idx + 1)}`).join(', ');
      const resultsWhereClause = `\nWHERE\n  "_id" IN (${idPlaceholders})`;

      if (arrayLookups.length === 0) {
        // No 1:N lookups — single query for results.
        const resultsSqlQuery = `${resultsQuery}${resultsWhereClause};`;
        this.telemetry.debug('[PostgreSQLDatabaseClient][search] Performing the following SQL query on database:');
        this.telemetry.debug(`[PostgreSQLDatabaseClient][search]\n\n${resultsSqlQuery}\n`);
        this.telemetry.debug(`[PostgreSQLDatabaseClient][search] [\n  ${matchedIds.join(',\n  ')}\n]\n`);
        const resultsResponse = await this.client.query<Record<string, unknown>>(resultsSqlQuery, matchedIds);
        const formattedResults = this.formatResources(resource, resultsResponse.rows, allFields, mapping);

        // Reorder results to match pagination order.
        const idOrder = new Map(matchedIds.map((id, idx) => [id, idx]));
        formattedResults.sort((a, b) => {
          const aId = String((a as unknown as { _id: Id })._id);
          const bId = String((b as unknown as { _id: Id })._id);
          return (idOrder.get(aId) ?? 0) - (idOrder.get(bId) ?? 0);
        });

        return {
          total,
          results: formattedResults,
        } as unknown as Key extends keyof QueryResults ? Results<QueryResults[Key]> : Results<Ids>;
      }

      // Multi-query path for 1:N lookups.
      const connection = await this.client.connect();
      try {
        await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ');

        const resultsSqlQuery = `${resultsQuery}${resultsWhereClause};`;
        this.telemetry.debug('[PostgreSQLDatabaseClient][search] Performing the following SQL query on database:');
        this.telemetry.debug(`[PostgreSQLDatabaseClient][search]\n\n${resultsSqlQuery}\n`);
        this.telemetry.debug(`[PostgreSQLDatabaseClient][search] [\n  ${matchedIds.join(',\n  ')}\n]\n`);
        const resultsResponse = await connection.query<Record<string, unknown>>(resultsSqlQuery, matchedIds);

        const arrayResultsMap = new Map<string, unknown[]>();
        await this.collectAndExecuteArrayQueries(connection, matchedIds, arrayLookups, arrayResultsMap);

        await connection.query('COMMIT');
        connection.release();

        const formattedResults = this.formatResources(resource, resultsResponse.rows, allFields, mapping, arrayResultsMap, arrayLookups);

        // Reorder results to match pagination order.
        const idOrder = new Map(matchedIds.map((id, idx) => [id, idx]));
        formattedResults.sort((a, b) => {
          const aId = String((a as unknown as { _id: Id })._id);
          const bId = String((b as unknown as { _id: Id })._id);
          return (idOrder.get(aId) ?? 0) - (idOrder.get(bId) ?? 0);
        });

        return {
          total,
          results: formattedResults,
        } as unknown as Key extends keyof QueryResults ? Results<QueryResults[Key]> : Results<Ids>;
      } catch (error) {
        await connection.query('ROLLBACK');
        connection.release();
        throw error;
      }
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
   * Closes the database client, releasing all remaining connections to the database server.
   */
  public async close(): Promise<void> {
    await this.client.end();
  }
}
