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
  type ResourceSchema,
  type DefaultDataModel,
  type DataModelMetadata,
} from '@perseid/core';
import mysql from 'mysql2/promise';
import DatabaseClient, {
  type FormattedQuery,
  type DatabaseClientSettings,
  type StructuredPayload,
} from 'scripts/core/services/AbstractDatabaseClient';
import type Logger from 'scripts/core/services/Logger';
import type BaseModel from 'scripts/core/services/Model';
import DatabaseError from 'scripts/core/errors/Database';
import type CacheClient from 'scripts/core/services/CacheClient';

/**
 * MySQL database client.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/mysql/services/MySQLDatabaseClient.ts
 */
export default class MySQLDatabaseClient<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
> extends DatabaseClient<DataModel, Model> {
  /** Data model types <> SQL types mapping, for tables creation. */
  protected readonly SQL_TYPES_MAPPING: Record<string, string> = {
    null: 'BIT',
    id: 'CHAR(24)',
    integer: 'INT',
    boolean: 'BIT',
    float: 'DOUBLE',
    binary: 'MEDIUMBLOB',
    date: 'TIMESTAMP',
    array: 'BIT',
    object: 'BIT',
  };

  /** SQL sorting keywords. */
  protected readonly SQL_SORT_MAPPING: Record<1 | -1, string> = {
    1: 'ASC',
    '-1': 'DESC',
  };

  /** MySQL client instance. */
  protected client: mysql.Pool;

  /** MySQL database connection settings. Necessary to reset pool after dropping database. */
  protected databaseSettings: DatabaseClientSettings;

  /** Used to format ArrayBuffers into strings. */
  protected textDecoder = new TextDecoder('utf-8');

  /** Used to format strings into ArrayBuffers. */
  protected textEncoder = new TextEncoder();

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
    const metadata = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
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
          fields: {
            _id: { type: 'id', isRequired: true },
            _parentId: { type: 'id', isRequired: true },
            _resourceId: { type: 'id', isRequired: true },
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
          max = (!!isIndexed || !!isUnique) ? Math.min(max ?? 255, 255) : max;
          const newType = (max !== undefined && max < 256) ? `VARCHAR(${String(max)})` : 'TEXT';
          fields[scopedPath] = { type: newType, isRequired };
        } else if (type === 'id' && currentSchema.relation !== undefined) {
          const relation = String(currentSchema.relation);
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
    searchBody: SearchBody | null = null,
    sortBy: Partial<Record<string, 1 | -1>> = {},
  ): { projections: unknown; formattedQuery: FormattedQuery; } {
    let index = 0;
    const projections = new Map([['_id', '_id']]);
    const formattedQuery: FormattedQuery = {
      structure: resource,
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
    const model = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
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
        const mappedPath = `${resource}_${String(index)}`;
        index += 1;
        projections.set(path, mappedPath);
        return mappedPath;
      }
      return existingMappedPath;
    };

    allFields.forEach((path) => {
      let currentDepth = 1;
      let isInArray = false;
      let currentTable = resource;
      let scopedPath: string[] = [];
      const currentPath: string[] = [];
      let pathInRelation: string[] = [];
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
          currentTable = relation as Resource;
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
          const { schema } = relationMetadata as DataModelMetadata<ResourceSchema<DataModel>>;
          currentSchema = { type: 'object', fields: schema.fields };
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
   * @returns Final DBMS-specific query.
   */
  protected generateQuery<Resource extends keyof DataModel>(
    resource: Resource,
    formattedQuery: FormattedQuery,
    textIndent = '',
  ): string {
    let joinClauses = '';
    const { sort } = formattedQuery;
    const newIndent = `${textIndent}  `;
    const table = this.resourcesMetadata[formattedQuery.structure].structure;
    const joinedTables = Object.keys(formattedQuery.lookups);
    for (let index = 0, { length } = joinedTables; index < length; index += 1) {
      const join = formattedQuery.lookups[joinedTables[index]];
      const subQuery = this.generateQuery(resource, join, newIndent);
      const prefix = `\n${textIndent}`;
      const onClause = `${textIndent}ON \`${table}\`.\`${String(join.localField)}\` = \`${joinedTables[index]}\`.\`${String(join.foreignField)}\``;
      joinClauses += `${prefix}LEFT JOIN (\n${subQuery}\n${textIndent}) AS \`${joinedTables[index]}\`\n${onClause}`;
    }

    const fieldsClause = (formattedQuery.match !== null || sort !== null)
      ? [`DISTINCT \`${table}\`.\`_id\``].concat(sort !== null ? Object.keys(sort).map((path) => `\`${path}\``) : []).join(', ')
      : Object.keys(formattedQuery.fields).map((fieldName) => (
        `\`${table}\`.\`${fieldName}\` AS \`${formattedQuery.fields[fieldName]}\``
      )).concat(joinedTables.map((path) => `\`${path}\`.*`)).join(`,\n${newIndent}`);
    const selectClause = `${textIndent}SELECT\n${newIndent}${fieldsClause}\n${textIndent}FROM\n${newIndent}\`${table}\``;

    let groupClause = '';
    if (sort !== null) {
      const sortClause = `\n${textIndent}ORDER BY\n${newIndent}${Object.keys(sort).map((path) => (
        `\`${path}\` ${this.SQL_SORT_MAPPING[sort[path]]}`
      )).join(`,\n${newIndent}`)}`;
      groupClause += `\n${textIndent}GROUP BY \`${table}\`.\`_id\`, ${Object.keys(sort).map((path) => `\`${path}\``).join(', ')}${sortClause}`;
    }

    const whereClause = [];
    if (formattedQuery.match !== null) {
      const { filters, query } = formattedQuery.match;
      if (query.length > 0) {
        whereClause.push(`(\n${newIndent}  ${query.map((q) => {
          const statement = (
            `\`${Object.keys(q)[0]}\` REGEXP ?`
          );
          return statement;
        }).join(`\n${newIndent}   OR `)}\n${newIndent})`);
      }
      if (filters.length > 0) {
        whereClause.push(filters.map((filter) => {
          const clause = `\`${String(Object.keys(filter)[0])}\` ${Array.isArray(Object.values(filter)[0])
            ? `IN (${(Object.values(filter)[0] as unknown[]).map(() => {
              const p = '?';
              return p;
            }).join(', ')})`
            : '= ?'}`;
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
  protected structurePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    resourceId: Id,
    payload: Payload<DataModel[Resource]>,
    mode: 'CREATE' | 'UPDATE',
  ): StructuredPayload {
    const structuredPayload: StructuredPayload = { [resource]: [] };
    const model = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;

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

      if (type === 'binary' && partialPayload !== null) {
        rootFormattedPayload[npath] = this.textDecoder.decode(partialPayload as ArrayBuffer);
      } else if (type === 'id' && partialPayload !== null) {
        rootFormattedPayload[npath] = String(partialPayload);
      } else if (type === 'array') {
        const fpath = currentPath.rootArray.join('_');
        const subTables = this.resourcesMetadata[resource].subStructuresPerPath[fpath];
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
              `_${resource}_${fpath}`,
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
                fields: {
                  _id: { type: 'id', isRequired: true },
                  _parentId: { type: 'id', isRequired: true },
                  _resourceId: { type: 'id', isRequired: true },
                  value: currentSchema.fields,
                },
              },
              newPayload,
              { scoped: [], full: currentPath.full, rootArray: currentPath.rootArray },
              newId,
              skipValidation,
            );
            structuredPayload[`_${resource}_${fpath}`].push(newPayload);
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
      resource,
      payload,
      mode === 'CREATE',
      { type: 'object', isRequired: true, fields: model.schema.fields },
      formattedPayload,
    );
    structuredPayload[resource][0] = formattedPayload;

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
  protected formatResources<Resource extends keyof DataModel & string>(
    resource: Resource,
    results: unknown[],
    fields: unknown,
    mapping: Map<string, string>,
  ): DataModel[Resource][] {
    const arraysMapping = new Map<string, number>();
    const finalResources: Record<string, Record<string, unknown>> = {};
    const model = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;

    (results as Record<string, unknown>[]).forEach((result) => {
      finalResources[result._id as string] ??= {
        _id: new Id(result._id as string),
      };

      (fields as Set<string>).forEach((path) => {
        const currentPath = [];
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
            const { schema } = relationMetadata as DataModelMetadata<ResourceSchema<DataModel>>;
            currentSchema = { type: 'object', fields: schema.fields };
          } else if (currentSchema?.type === 'object') {
            currentResource[fieldName] ??= {};
            currentResource = currentResource[fieldName] as Record<string, unknown>;
          } else if (splittedPath.length === 0) {
            if (type === 'id') {
              currentResource[fieldName] ??= new Id(result[key] as string);
            } else if (type === 'boolean') {
              currentResource[fieldName] = !!(result[key] as Buffer).readInt8();
            } else if (type === 'binary') {
              const { buffer } = this.textEncoder.encode((result[key] as string));
              currentResource[fieldName] = buffer;
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
      this.logger.debug(`[MySQLDatabaseClient][handleError] Connecting to database ${this.database}...`);
      this.client = mysql.createPool({
        host: this.databaseSettings.host,
        database: this.database,
        maxIdle: this.databaseSettings.connectionLimit,
        port: this.databaseSettings.port ?? undefined,
        user: this.databaseSettings.user ?? undefined,
        idleTimeout: this.databaseSettings.connectTimeout,
        password: this.databaseSettings.password ?? undefined,
        connectionLimit: this.databaseSettings.connectionLimit,
      });
      this.isConnected = true;
    }
    try {
      return await callback();
    } catch (error) {
      const mysqlError = error as mysql.QueryError;
      if (mysqlError.code === 'ER_DUP_ENTRY') {
        const match = /Duplicate entry '([^']+).* for key '([^']+)/.exec(mysqlError.message);
        throw new DatabaseError('DUPLICATE_RESOURCE', {
          value: (match as string[])[1],
          path: (match as string[])[2].split('index_')[1] ?? '_id',
        });
      }
      if (mysqlError.code === 'ER_ROW_IS_REFERENCED_2') {
        const path = (/FOREIGN KEY \(`([^`]+)`\)/.exec(mysqlError.message) as string[])[1];
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
    const { host } = settings;
    super(model, logger, cache, settings);

    this.databaseSettings = settings;
    this.client = mysql.createPool({
      host,
      maxIdle: settings.connectionLimit,
      port: settings.port ?? undefined,
      user: settings.user ?? undefined,
      idleTimeout: settings.connectTimeout,
      password: settings.password ?? undefined,
      connectionLimit: settings.connectionLimit,
    });

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
    // We don't wrap statements within `handleError` here as database may not exist yet.
    this.logger.info(`[MySQLDatabaseClient][dropDatabase] Dropping database ${this.database}...`);
    await this.client.execute(`DROP DATABASE IF EXISTS ${this.database};`);
    this.logger.info(`[MySQLDatabaseClient][dropDatabase] Successfully dropped database ${this.database}.`);
    this.isConnected = false;
  }

  /**
   * Creates the database.
   */
  public async createDatabase(): Promise<void> {
    // We don't wrap statements within `handleError` here as database may not exist yet.
    this.logger.info(`[MySQLDatabaseClient][createDatabase] Creating database ${this.database}...`);
    await this.client.query(
      `CREATE DATABASE IF NOT EXISTS ${this.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    );
    this.logger.info(`[MySQLDatabaseClient][createDatabase] Successfully created database ${this.database}.`);
  }

  /**
   * Creates missing database structures for current data model.
   */
  public async createMissingStructures(): Promise<void> {
    await this.handleError(async () => {
      const response = await this.client.query('SHOW TABLES;') as unknown as Record<string, string>[][];
      const existingTables = new Set(response[0].map((result) => Object.values(result)[0]));

      await forEach(Object.keys(this.resourcesMetadata), async (table) => {
        const { indexes, structure } = this.resourcesMetadata[table];
        const fields = this.resourcesMetadata[table].fields as Record<string, {
          type: string;
          isRequired: boolean;
        }>;
        if (!existingTables.has(structure)) {
          const fieldsClause = Object.keys(fields as Record<string, unknown>).map((fieldName) => {
            const { type, isRequired } = fields[fieldName];
            return `\`${fieldName}\` ${type}${isRequired ? ' NOT NULL' : ''}`;
          }).join(',\n  ');
          const sqlQuery = `CREATE TABLE \`${structure}\` (\n  ${fieldsClause},\n  PRIMARY KEY (\`_id\`)\n);`;
          this.logger.info(`[MySQLDatabaseClient][createMissingStructures] Creating table ${structure}...`);
          this.logger.debug('[MySQLDatabaseClient][createMissingStructures] Performing the following SQL query on database:');
          this.logger.debug(`[MySQLDatabaseClient][createMissingStructures] \n\n${sqlQuery}\n`);
          await this.client.query(sqlQuery);
          await forEach(indexes, async (currentIndex, index) => {
            const { unique, path } = currentIndex;
            const uniqueClause = unique ? ' UNIQUE' : '';
            const indexSqlQuery = `CREATE${uniqueClause} INDEX index_${structure}_${String(index)} ON \`${structure}\` (\`${path}\`);`;
            this.logger.debug('[MySQLDatabaseClient][createMissingStructures] Performing the following SQL query on database:');
            this.logger.debug(`[MySQLDatabaseClient][createMissingStructures] \n\n${indexSqlQuery}\n`);
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
            const constraintSqlQuery = `ALTER TABLE \`${structure}\` ADD CONSTRAINT fk_${structure}_${String(index)} FOREIGN KEY (\`${path}\`) REFERENCES \`${foreignTable}\`(\`_id\`)`;
            this.logger.debug('[MySQLDatabaseClient][createMissingStructures] Performing the following SQL query on database:');
            this.logger.debug(`[MySQLDatabaseClient][createMissingStructures] \n\n${constraintSqlQuery}\n`);
            await this.client.query(constraintSqlQuery);
          });
        }
      });

      this.logger.info('[MySQLDatabaseClient][createMissingStructures] Creating table _config...');
      await this.client.query('DROP TABLE IF EXISTS `_config`;');
      await this.client.query(
        'CREATE TABLE `_config` (`key` VARCHAR(255) NOT NULL PRIMARY KEY, `value` LONGTEXT NOT NULL);',
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
      this.logger.info('[MySQLDatabaseClient][reset] Initializing tables...');
      await this.createMissingStructures();
      this.logger.info('[MySQLDatabaseClient][reset] Successfully initialized tables.');
    });
  }

  /**
   * Makes sure that `foreignIds` reference existing resources that match specific conditions.
   *
   * @param foreignIds Foreign ids to check in database.
   *
   * @throws If any foreign id does not exist.
   */
  public async checkForeignIds<Resource extends keyof DataModel & string>(
    _resource: Resource,
    foreignIds: Map<string, { resource: keyof DataModel & string; filters: SearchFilters; }>,
  ): Promise<void> {
    if (foreignIds.size > 0) {
      const values: unknown[] = [];
      const sqlSubQueries: string[] = [];
      const missingIds = new Set<string>();
      foreignIds.forEach((value, path) => {
        const table = String(value.resource);
        const allFilters = { ...value.filters };
        const metadata = this.model.get(value.resource);
        const { schema } = metadata as DataModelMetadata<ResourceSchema<DataModel>>;
        if (!schema.enableDeletion) {
          allFilters._isDeleted = false;
        }
        const fields = new Set(Object.keys(allFilters));
        const searchBody = { query: null, filters: allFilters };
        const { formattedQuery } = this.parseFields(value.resource, fields, Infinity, searchBody);
        sqlSubQueries.push(this.generateQuery(value.resource, formattedQuery, '').replace(`DISTINCT \`${table}\`.\`_id\``, `DISTINCT \`${table}\`.\`_id\`, '${path}' as path`));
        (formattedQuery.match as unknown as Exclude<FormattedQuery['match'], null>).filters.forEach((filter) => {
          if (Object.keys(filter)[0] === '_id') {
            (filter._id as string[]).forEach((id) => missingIds.add(`${id}:${path}`));
          }
          if (Array.isArray(Object.values(filter)[0])) {
            values.push(...Object.values(filter)[0] as unknown[]);
          } else {
            values.push(Object.values(filter)[0]);
          }
        });
      });

      await this.handleError(async () => {
        const sqlQuery = sqlSubQueries.join('\nUNION\n');
        this.logger.debug('[MySQLDatabaseClient][checkForeignIds] Performing the following SQL query on database:');
        this.logger.debug(`[MySQLDatabaseClient][checkForeignIds]\n\n${sqlQuery}\n`);
        this.logger.debug(`[MySQLDatabaseClient][checkForeignIds] [\n  ${values.join(',\n  ')}\n]\n`);
        const [response] = await this.client.execute(sqlQuery, values);
        const results = (response as mysql.RowDataPacket[]);

        for (let index = 0, { length } = results; index < length; index += 1) {
          const row = results[index];
          missingIds.delete(`${String(row._id)}:${String(row.path)}`);
        }

        if (missingIds.size > 0) {
          const id = (missingIds.values().next().value as string).slice(0, 24);
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
   */
  public async create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: DataModel[Resource],
  ): Promise<void> {
    const resourceId = (payload as { _id: Id; })._id;
    const newDocuments = this.structurePayload(resource, resourceId, payload, 'CREATE');

    await this.handleError(async () => {
      const connection = await this.client.getConnection();
      await connection.beginTransaction();
      try {
        await Promise.all(Object.keys(newDocuments).map((table) => {
          const documents = newDocuments[table];
          if (documents.length > 0) {
            const sqlFields: string[] = [];
            const fieldPlaceholders: string[] = [];
            const fields = Object.keys(documents[0]);
            const values: unknown[] = [];
            documents.forEach((document, index) => {
              const placeholders: string[] = [];
              fields.forEach((fieldName) => {
                placeholders.push('?');
                if (index === 0) {
                  sqlFields.push(`\`${fieldName}\``);
                }
                values.push(document[fieldName]);
              });
              fieldPlaceholders.push(`(${placeholders.join(', ')})`);
            });
            const placeholders = fieldPlaceholders.join(',\n  ');
            const { structure } = this.resourcesMetadata[table];
            const sqlQuery = `INSERT INTO \`${structure}\` (\n  ${sqlFields.join(',\n  ')}\n)\nVALUES\n  ${placeholders};`;
            this.logger.debug('[MySQLDatabaseClient][create] Performing the following SQL query on database:');
            this.logger.debug(`[MySQLDatabaseClient][create]\n\n${sqlQuery}\n`);
            this.logger.debug(`[MySQLDatabaseClient][create] [\n  ${values.join(',\n  ')}\n]\n`);
            return connection.execute(sqlQuery, values);
          }
          return null;
        }));
        await connection.commit();
        connection.release();
      } catch (error) {
        await connection.rollback();
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
   * @returns `true` if resource has been successfully updated, `false` otherwise.
   */
  public async update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: Payload<DataModel[Resource]>,
  ): Promise<boolean> {
    let resourceExists = false;
    const resourceId = String(id);
    const newDocuments = this.structurePayload(resource, id, payload, 'UPDATE');
    const metaData = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;

    return this.handleError(async () => {
      const connection = await this.client.getConnection();
      await connection.beginTransaction();
      try {
        const tables = Object.keys(newDocuments);
        // We need to sort tables from the most specific to the root resource before deletion, in
        // order to prevent foreign keys constraints issues on nested fields deletion.
        await Promise.all([...tables].sort((a, b) => b.length - a.length).map(async (table) => {
          if (table !== resource) {
            const { structure } = this.resourcesMetadata[table];
            const sqlQuery = `DELETE FROM \`${structure}\` WHERE \`_resourceId\` = ?;`;
            this.logger.debug('[MySQLDatabaseClient][update] Performing the following SQL query on database:');
            this.logger.debug(`[MySQLDatabaseClient][update]\n\n${sqlQuery}\n`);
            this.logger.debug(`[MySQLDatabaseClient][update] [\n  ${resourceId}\n]\n`);
            await connection.execute(sqlQuery, [resourceId]);
          }
        }));

        await Promise.all(tables.map(async (table) => {
          const sqlFields: string[] = [];
          const documents = newDocuments[table];
          const { structure } = this.resourcesMetadata[table];
          if (documents.length > 0) {
            const values: unknown[] = [];
            const fieldPlaceholders: string[] = [];
            const fields = Object.keys(documents[0]);
            documents.forEach((document, index) => {
              if (table === resource) {
                fields.forEach((fieldName) => {
                  fieldPlaceholders.push(`\`${fieldName}\` = ?`);
                  values.push(document[fieldName]);
                });
              } else {
                const placeholders: string[] = [];
                fields.forEach((fieldName) => {
                  if (index === 0) {
                    sqlFields.push(`\`${fieldName}\``);
                  }
                  placeholders.push('?');
                  values.push(document[fieldName]);
                });
                fieldPlaceholders.push(`(${placeholders.join(', ')})`);
              }
            });

            if (table === resource) {
              values.push(resourceId);
            }

            const where = `\n  _id = ?${!metaData.schema.enableDeletion ? '\n  AND `_isDeleted` = false' : ''}`;
            const placeholders = fieldPlaceholders.join(',\n  ');
            const sqlQuery = (table === resource)
              ? `UPDATE \`${structure}\` SET\n  ${placeholders}\nWHERE${where};`
              : `INSERT INTO \`${structure}\` (\n  ${sqlFields.join(',\n  ')}\n)\nVALUES\n  ${placeholders};`;
            this.logger.debug('[MySQLDatabaseClient][update] Performing the following SQL query on database:');
            this.logger.debug(`[MySQLDatabaseClient][update]\n\n${sqlQuery}\n`);
            this.logger.debug(`[MySQLDatabaseClient][update] [\n  ${values.join(',\n  ')}\n]\n`);
            const [response] = await connection.execute(sqlQuery, values);
            if (table === resource) {
              resourceExists = (response as { affectedRows: number; }).affectedRows === 1;
            }
          }
        }));
        if (!resourceExists) {
          await connection.rollback();
        } else {
          await connection.commit();
        }
        connection.release();
        return resourceExists;
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    });
  }

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
  public async view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptions = this.DEFAULT_VIEW_COMMAND_OPTIONS,
  ): Promise<DataModel[Resource] | null> {
    const values: unknown[] = [String(id)];
    const fields = options.fields ?? new Set();
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const { formattedQuery, projections } = this.parseFields(resource, fields, maximumDepth);
    const metaData = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    const deletionClause = !metaData.schema.enableDeletion ? ` AND \`${resource}\`.\`_isDeleted\` = false` : '';
    const whereClause = `\nWHERE \`${resource}\`.\`_id\` = ?${deletionClause}`;
    return this.handleError(async () => {
      const sqlQuery = `${this.generateQuery(resource, formattedQuery)}${whereClause};`;
      this.logger.debug('[MySQLDatabaseClient][view] Performing the following SQL query on database:');
      this.logger.debug(`[MySQLDatabaseClient][view]\n\n${sqlQuery}\n`);
      this.logger.debug(`[MySQLDatabaseClient][view] [\n  ${values.join(',\n  ')}\n]\n`);
      const [response] = await this.client.query(sqlQuery, values) as mysql.RowDataPacket[][];
      const mapping = projections as Map<string, string>;
      return this.formatResources(resource, response, fields, mapping)[0] ?? null;
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
  public async search<Resource extends keyof DataModel & string>(
    resource: Resource,
    body: SearchBody,
    options: SearchCommandOptions = this.DEFAULT_SEARCH_COMMAND_OPTIONS,
  ): Promise<Results<DataModel[Resource]>> {
    const { sortBy } = options;
    const values: unknown[] = [];
    const query = body.query ?? null;
    const filters = body.filters ?? {};
    const filterFields = Object.keys(filters);
    const queryFields = [...(query?.on ?? [])];
    const fields = options.fields ?? new Set();
    const sortingFields = Object.keys(sortBy ?? {});
    const limit = options.limit ?? this.DEFAULT_LIMIT;
    const offset = options.offset ?? this.DEFAULT_OFFSET;
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const searchFields = new Set([...queryFields, ...sortingFields, ...filterFields]);
    const allFields = new Set([...fields, ...searchFields]);
    const metaData = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    if (!metaData.schema.enableDeletion) { filters._isDeleted = false; }
    const { formattedQuery, projections } = this.parseFields(resource, allFields, maximumDepth);
    const searchMetaData = this.parseFields(resource, searchFields, maximumDepth, {
      query,
      filters,
    }, sortBy);
    const sqlQuery = this.generateQuery(resource, formattedQuery, '  ');
    const searchQuery = this.generateQuery(resource, searchMetaData.formattedQuery, '  ');
    let fullSQLQuery = `WITH searchResults AS (\n${searchQuery}\n),`;
    fullSQLQuery += '\ncount AS (\n  SELECT\n    COUNT(_id) AS total\n  FROM\n    searchResults\n),';
    fullSQLQuery += `\npagination AS (\n  SELECT\n    _id,\n    ROW_NUMBER() OVER () AS row_num\n  FROM\n    searchResults\n  LIMIT ${String(limit)}\n  OFFSET ${String(offset)}\n)`;
    fullSQLQuery += '\nSELECT\n  count.total AS __total,\n  results.*\nFROM\n  count\nLEFT JOIN\n  pagination\nON 1 = 1';
    fullSQLQuery += `\nLEFT JOIN (\n${sqlQuery}\n) AS results\nON results._id = pagination._id\nORDER BY pagination.row_num;`;

    searchMetaData.formattedQuery.match?.query.forEach((filter) => {
      values.push(Object.values(filter)[0]);
    });
    searchMetaData.formattedQuery.match?.filters.forEach((filter) => {
      if (Array.isArray(Object.values(filter)[0])) {
        values.push(...Object.values(filter)[0] as unknown[]);
      } else {
        values.push(Object.values(filter)[0]);
      }
    });

    return this.handleError(async () => {
      this.logger.debug('[MySQLDatabaseClient][search] Performing the following SQL query on database:');
      this.logger.debug(`[MySQLDatabaseClient][search]\n\n${fullSQLQuery}\n`);
      this.logger.debug(`[MySQLDatabaseClient][search] [\n  ${values.join(',\n  ')}\n]\n`);
      const [response] = await this.client.query(fullSQLQuery, values) as mysql.RowDataPacket[][];
      const mapping = projections as Map<string, string>;
      return {
        total: parseInt(response[0].__total as string, 10),
        results: response[0]._id === null
          ? []
          : this.formatResources(resource, response, allFields, mapping),
      };
    });
  }

  /**
   * Fetches a paginated list of resources from database.
   *
   * @param resource Type of resources to fetch.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public async list<Resource extends keyof DataModel & string>(
    resource: Resource,
    options: ListCommandOptions = this.DEFAULT_LIST_COMMAND_OPTIONS,
  ): Promise<Results<DataModel[Resource]>> {
    const { sortBy } = options;
    const values: unknown[] = [];
    const filters: SearchBody['filters'] = {};
    const filterFields = Object.keys(filters);
    const fields = options.fields ?? new Set();
    const sortingFields = Object.keys(sortBy ?? {});
    const limit = options.limit ?? this.DEFAULT_LIMIT;
    const offset = options.offset ?? this.DEFAULT_OFFSET;
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const searchFields = new Set([...sortingFields, ...filterFields]);
    const allFields = new Set([...fields, ...searchFields]);
    const metaData = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    if (!metaData.schema.enableDeletion) {
      filters._isDeleted = false;
      values.push(false);
    }
    const { formattedQuery, projections } = this.parseFields(resource, allFields, maximumDepth);
    const searchMetaData = this.parseFields(resource, searchFields, maximumDepth, {
      query: null,
      filters,
    }, sortBy);
    const sqlQuery = this.generateQuery(resource, formattedQuery, '  ');
    const searchQuery = this.generateQuery(resource, searchMetaData.formattedQuery, '  ');
    let fullSQLQuery = `WITH searchResults AS (\n${searchQuery}\n),`;
    fullSQLQuery += '\ncount AS (\n  SELECT\n    COUNT(_id) AS total\n  FROM\n    searchResults\n),';
    fullSQLQuery += `\npagination AS (\n  SELECT\n    _id,\n    ROW_NUMBER() OVER () AS row_num\n  FROM\n    searchResults\n  LIMIT ${String(limit)}\n  OFFSET ${String(offset)}\n)`;
    fullSQLQuery += '\nSELECT\n  count.total AS __total,\n  results.*\nFROM\n  count\nLEFT JOIN\n  pagination\nON 1 = 1';
    fullSQLQuery += `\nLEFT JOIN (\n${sqlQuery}\n) AS results\nON results._id = pagination._id\nORDER BY pagination.row_num;`;

    return this.handleError(async () => {
      this.logger.debug('[MySQLDatabaseClient][list] Performing the following SQL query on database:');
      this.logger.debug(`[MySQLDatabaseClient][list]\n\n${fullSQLQuery}\n`);
      this.logger.debug(`[MySQLDatabaseClient][list] [\n  ${values.join(',\n  ')}\n]\n`);
      const [response] = await this.client.query(fullSQLQuery, values) as mysql.RowDataPacket[][];
      const mapping = projections as Map<string, string>;
      return {
        total: parseInt(response[0].__total as string, 10),
        results: response[0]._id === null
          ? []
          : this.formatResources(resource, response, allFields, mapping),
      };
    });
  }

  /**
   * Deletes resource with id `id` from database.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource id.
   *
   * @returns `true` if resource has been successfully deleted, `false` otherwise.
   */
  public async delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<boolean> {
    let resourceExists = false;
    const resourceId = String(id);
    const subTables = this.resourcesMetadata[String(resource)].subStructures;

    return this.handleError(async () => {
      const connection = await this.client.getConnection();
      await connection.beginTransaction();
      try {
        const values = [resourceId];
        await Promise.all(subTables.concat([resource as string]).map(async (table) => {
          const { structure } = this.resourcesMetadata[table];
          const sqlQuery = (table !== resource)
            ? `DELETE FROM \`${structure}\` WHERE \`_resourceId\` = ?;`
            : `DELETE FROM \`${structure}\` WHERE \`_id\` = ?;`;
          this.logger.debug('[MySQLDatabaseClient][delete] Performing the following SQL query on database:');
          this.logger.debug(`[MySQLDatabaseClient][delete]\n\n${sqlQuery}\n`);
          this.logger.debug(`[MySQLDatabaseClient][delete] [\n  ${values.join(',\n  ')}\n]\n`);
          const [response] = await connection.execute(sqlQuery, values);
          if (table === resource) {
            resourceExists = (response as unknown as { affectedRows: number; }).affectedRows === 1;
          }
        }));
        await connection.commit();
        connection.release();
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }

      return resourceExists;
    });
  }
}
