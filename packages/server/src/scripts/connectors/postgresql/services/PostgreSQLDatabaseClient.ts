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
  type Ids,
  type Results,
  isPlainObject,
  type IdSchema,
  type FieldSchema,
  type ObjectSchema,
  type UserDataModel,
} from '@perseid/core';
import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
  type DatabaseError as PostgreSQLDatabaseError,
} from 'pg';
import type {
  Payload,
  SearchBody,
  SearchFilters,
  ViewQueryOptions,
  ListQueryOptions,
} from 'scripts/core';
import { createHash } from 'crypto';
import type BaseModel from 'scripts/core/services/Model';
import DatabaseError from 'scripts/core/errors/Database';
import type Telemetry from 'scripts/core/services/Telemetry';
import type CacheClient from 'scripts/core/services/CacheClient';
import DatabaseClient, { type DatabaseClientSettings } from 'scripts/core/services/AbstractDatabaseClient';

type WhereClause = Exclude<FilterableQuery['where'], undefined>[number];
interface ConnectedPool { telemetryAttributes: Record<string, unknown>; pool: Pool; }
interface Session { telemetryAttributes: Record<string, unknown>; client: PoolClient; }
type FormattedValue = string | number | boolean | null | (string | number | boolean | null)[];
type JoinQuery = SelectQuery & { join: NonNullable<SelectQuery['join']>; };
type SubQuery = SelectQuery & { where: NonNullable<SelectQuery['where']>; };
type SearchQuery = SelectQuery & {
  join: NonNullable<SelectQuery['join']>;
  where: NonNullable<SelectQuery['where']>;
  orderBy: NonNullable<SelectQuery['orderBy']>;
};

/**
 * Base query definition.
 */
interface BaseQuery {
  /**
   * Name of the table to query.
   */
  table: string;

  /**
   * List of `WITH` sub-queries to include in the query.
   */
  with?: {
    /**
     * Alias to use for the sub-query.
     */
    as: string;

    /**
     * Sub-query to include in the query.
     */
    query: Query;
  }[];
}

/**
 * Base query definition with a `WHERE` clause.
 */
interface FilterableQuery extends BaseQuery {
  /**
   * List of conditions to apply to the query.
   */
  where?: (
    /**
     * Simple string condition.
     */
    string
    /**
     * EXISTS condition.
     */
    | { operator: 'EXISTS'; value: string | SelectQuery; }
    /**
     * NOT EXISTS condition.
     */
    | { operator: 'NOT EXISTS'; value: string | SelectQuery; }
    /**
     * IN condition.
     */
    | { operator: 'IN'; column: string; value: string | SelectQuery; }
    /**
     * NOT IN condition.
     */
    | { operator: 'NOT IN'; column: string; value: string | SelectQuery; }
    /**
     * OR condition.
     */
    | { operator: 'OR'; conditions: Exclude<SelectQuery['where'], undefined>; }
    /**
     * AND condition.
     */
    | { operator: 'AND'; conditions: Exclude<SelectQuery['where'], undefined>; }
    /**
     * Comparison condition.
     */
    | { column: string; value: unknown; operator: '~*' | '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IS' | 'IS NOT' | 'BETWEEN' | 'NOT BETWEEN'; }
  )[];
}

/**
 * Delete query definition.
 */
export interface DeleteQuery extends FilterableQuery {
  /**
   * Query type.
   */
  type: 'DELETE';

  /**
   * List of conditions to apply to the query.
   */
  where: NonNullable<FilterableQuery['where']>;
}

/**
 * Insert query definition.
 */
export interface InsertQuery extends BaseQuery {
  /**
   * Query type.
   */
  type: 'INSERT';

  /**
   * List of fields to insert.
   */
  fields: string[];

  /**
   * List of values to insert.
   */
  values: unknown[][];
}

/**
 * Update query definition.
 */
export interface UpdateQuery extends FilterableQuery {
  /**
   * Query type.
   */
  type: 'UPDATE';

  /**
   * Alias to use for the query.
   */
  as?: string;

  /**
   * List of fields to update.
   */
  fields: Record<string, unknown>;
}

/**
 * Select query definition.
 */
export interface SelectQuery extends FilterableQuery {
  /**
   * Query type.
   */
  type: 'SELECT';

  /**
   * Alias to use for the query.
   */
  as?: string;

  /**
   * Limit the number of results to return.
   */
  limit?: number;

  /**
   * Offset the results to return.
   */
  offset?: number;

  /**
   * List of fields to select.
   */
  fields: string[];

  /**
   * List of joins to perform.
   */
  join?: {
    /**
     * Field to join on.
     */
    on: string;

    /**
     * Alias to use for the join.
     */
    as?: string;

    /**
     * Table to join.
     */
    table: string;

    /**
     * Type of join to perform.
     */
    type?: 'LEFT' | 'INNER';
  }[];

  /**
   * List of fields to order the results by.
   */
  orderBy?: {
    /**
     * Field to order by.
     */
    field: string;

    /**
     * Direction to order the results by.
     */
    direction: 'ASC' | 'DESC';
  }[];
}

/**
 * Query definition.
 */
export type Query = SelectQuery | InsertQuery | UpdateQuery | DeleteQuery;

/**
 * Fields projections tree: must follow the data model structure down to the leaf fields.
 */
export interface Projections {
  [key: string]: Projections | 1;
}

// PostgreSQL has a hard limit of 65,535 parameters per query.
const MAXIMUM_PARAMETERS_PER_QUERY = 65535;
const CONSTRAINT_VIOLATION_CODES: Record<string, string> = {
  23505: 'RESOURCE_EXISTS',
  23503: 'RESOURCE_REFERENCED',
};

/**
 * Formats `value` into a value suitable for SQL queries.
 *
 * @param value Value to format.
 *
 * @returns Formatted value.
 */
const formatValue = (value: unknown): FormattedValue => {
  if (Array.isArray(value)) {
    return value.map(formatValue) as FormattedValue;
  }
  if (value instanceof Id) {
    return String(value);
  }
  return value as string;
};

/**
 * Builds a query filter from `condition`, wrapping it in `subQuery` when the filtered field lives
 * in another table.
 *
 * @param condition Condition to filter by.
 *
 * @param subQuery Sub query resolving the filtered field up to the root resource, if any.
 *
 * @returns Query filter.
 */
const buildQueryFilter = (condition: WhereClause, subQuery: SubQuery | undefined): WhereClause => {
  if (subQuery === undefined) {
    return condition;
  }

  return {
    operator: 'EXISTS',
    value: { ...subQuery, fields: ['1'], where: [condition, ...subQuery.where] },
  };
};

/**
 * Builds the filter matching `column` against `value`, handling special cases.
 *
 * @param column SQL column to filter on.
 *
 * @param value Value, or list of values, the column must match.
 *
 * @returns Query filter.
 */
const buildValueFilter = (column: string, value: SearchFilters[string]): WhereClause => {
  if (value === null) {
    return `${column} IS NULL`;
  }

  if (!Array.isArray(value)) {
    return { column, operator: '=', value };
  }

  const conditions: WhereClause[] = [];
  const definedValues = value.filter((item) => item !== null);

  if (definedValues.length > 0) {
    conditions.push({ column, operator: '=', value: definedValues });
  }

  if (definedValues.length < value.length) {
    conditions.push(`${column} IS NULL`);
  }

  // An empty list of values matches nothing, which `FALSE`.
  if (conditions.length === 0) {
    return 'FALSE';
  }

  return (conditions.length === 1) ? conditions[0] : { operator: 'OR', conditions };
};

/**
 * Builds the full-text search filter matching `field` against all `tokens`. Tokens are matched as
 * case-insensitive substrings, which, unlike a regular expression, can be accelerated by a
 * trigram (`pg_trgm`) GIN index.
 *
 * @param tokens Search tokens that must all be present in `field`.
 *
 * @param field Field to match.
 *
 * @returns Search filter.
 */
const buildSearchFilter = (tokens: string[], field: string): WhereClause => {
  const conditions: WhereClause[] = tokens.map((token) => ({
    column: field,
    operator: 'ILIKE',
    value: `%${token.replace(/[%_\\]/g, (match) => `\\${match}`)}%`,
  }));

  return (conditions.length === 1) ? conditions[0] : { operator: 'AND', conditions };
};

/**
 * Registers `value` as a new bound parameter in `values`, and returns its SQL placeholder.
 *
 * @param value Value to bind to the query.
 *
 * @param values Bound parameters list to register `value` in.
 *
 * @param operator Comparison operator the placeholder is used with, if any.
 *
 * @returns SQL placeholder for `value`.
 *
 * @throws If `value` is an array and `operator` does not support array comparison.
 */
const getPlaceholder = (
  value: unknown,
  values: unknown[],
  operator?: Extract<WhereClause, { column: string; }>['operator'],
): string => {
  values.push(formatValue(value));
  const placeholder = `$${String(values.length)}`;

  if (!Array.isArray(value) || operator === undefined) {
    return placeholder;
  }

  const arrayOperators: Record<string, string> = { '=': 'ANY', '!=': 'ALL' };
  const quantifier = arrayOperators[operator];

  if (quantifier === undefined) {
    throw new DatabaseError('UNSUPPORTED_ARRAY_OPERATOR', { operator });
  }

  return `${quantifier}(${placeholder})`;
};

/**
 * Compiles the `where` clause `condition` into SQL, registering its values in `values`.
 *
 * @param condition Condition to compile.
 *
 * @param values Bound parameters list to register condition values in.
 *
 * @param tabs Indentation to prefix the compiled clause with.
 *
 * @returns Compiled SQL clause.
 */
function compileWhereClause(condition: WhereClause, values: unknown[], tabs: string): string {
  if (typeof condition === 'string') {
    return condition;
  }

  if (condition.operator === 'AND' || condition.operator === 'OR') {
    const conditions = condition.conditions.map((subCondition) => (
      compileWhereClause(subCondition, values, `${tabs}  `)
    ));

    // A single condition needs no grouping, and wrapping it would only add noise to the query.
    if (conditions.length === 1) {
      return conditions[0];
    }

    return `(\n${tabs}    ${conditions.join(`\n${tabs}    ${condition.operator} `)}\n${tabs}  )`;
  }

  if (condition.operator === 'EXISTS' || condition.operator === 'NOT EXISTS') {
    const subQuery = isPlainObject(condition.value)
      ? compileQuery(condition.value as Query, values, `${tabs}    `)
      : condition.value as string;
    return `${condition.operator} (\n${subQuery}\n${tabs}  )`;
  }

  if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
    const subQuery = isPlainObject(condition.value)
      ? `(\n${compileQuery(condition.value as Query, values, `${tabs}    `)}\n${tabs}  )`
      : `(${condition.value as string})`;
    return `${condition.column} ${condition.operator} ${subQuery}`;
  }

  const value = isPlainObject(condition.value)
    ? `(\n${compileQuery(condition.value as unknown as Query, values, `${tabs}    `)}\n${tabs}  )`
    : getPlaceholder(condition.value, values, condition.operator);
  return `${condition.column} ${condition.operator} ${value}`;
};

/**
 * Compiles the `WITH` clauses of `query` into SQL, registering their values in `values`.
 *
 * @param query Query to compile the `WITH` clauses of.
 *
 * @param values Bound parameters list to register clauses values in.
 *
 * @param tabs Indentation to prefix the compiled clauses with.
 *
 * @returns Compiled SQL clause, an empty string if `query` contains no `WITH` clause.
 */
const compileWithClauses = (query: Query, values: unknown[], tabs: string): string => {
  const withQueries = query.with?.map((subQuery) => (
    `"${subQuery.as}" AS (\n${compileQuery(subQuery.query, values, `${tabs}    `)}\n${tabs}  )`
  ));

  if (withQueries === undefined || withQueries.length === 0) {
    return '';
  }

  return `WITH\n${tabs}  ${withQueries.join(`,\n${tabs}  `)}\n`;
};

/**
 * Compiles the `where` clauses of `query` into SQL, registering their values in `values`.
 *
 * @param query Query to compile the `where` clauses of.
 *
 * @param values Bound parameters list to register clauses values in.
 *
 * @param tabs Indentation to prefix the compiled clauses with.
 *
 * @returns Compiled SQL clause, an empty string if `query` contains no `where` clause.
 */
const compileWhereClauses = (query: FilterableQuery, values: unknown[], tabs: string): string => {
  if (query.where === undefined || query.where.length === 0) {
    return '';
  }

  const conditions = query.where.map((condition) => compileWhereClause(condition, values, tabs));
  return `\n${tabs}WHERE\n${tabs}  ${conditions.join(`\n${tabs}  AND `)}`;
};

/**
 * Compiles the formatted `query` definition into a SQL query, registering its values in `values`.
 * Statements are built as a list of clauses, joined at the very end, so that indentation stays a
 * single concern of this function instead of being threaded through every branch.
 *
 * @param query Formatted query definition to compile.
 *
 * @param values Bound parameters list to register query values in.
 *
 * @param tabs Indentation to prefix the compiled query with.
 *
 * @returns Compiled SQL query.
 */
function compileQuery(query: Query, values: unknown[], tabs = ''): string {
  const clauses: string[] = [];
  const withClause = compileWithClauses(query, values, tabs);
  const alias = (typeof (query as SelectQuery).as === 'string')
    ? ` AS "${String((query as SelectQuery).as)}"`
    : '';

  if (query.type === 'SELECT') {
    // Duplicate joins are dropped, as the same table can be reached by several field paths.
    const existingJoins = new Set<string>();
    const joins: string[] = [];
    query.join?.forEach((join) => {
      const joinKey = join.as ?? join.table;
      if (!existingJoins.has(joinKey)) {
        existingJoins.add(joinKey);
        const joinAlias = (typeof join.as === 'string') ? ` AS "${join.as}"` : '';
        const joinType = (join.type === 'INNER') ? 'INNER' : 'LEFT';
        joins.push(`${joinType} JOIN\n${tabs}  "${join.table}"${joinAlias}\n${tabs}ON\n${tabs}  ${join.on}`);
      }
    });

    clauses.push(`SELECT\n${tabs}  ${query.fields.join(`,\n${tabs}  `)}`);
    clauses.push(`FROM\n${tabs}  "${query.table}"${alias}`);
    joins.forEach((join) => clauses.push(join));

    let statement = `${tabs}${withClause}${clauses.join(`\n${tabs}`)}`;
    statement += compileWhereClauses(query, values, tabs);

    if (query.orderBy !== undefined && query.orderBy.length > 0) {
      const orderBy = query.orderBy.map(({ field, direction }) => `${field} ${direction}`);
      statement += `\n${tabs}ORDER BY\n${tabs}  ${orderBy.join(`,\n${tabs}  `)}`;
    }

    if (query.limit !== undefined) {
      statement += `\n${tabs}LIMIT ${getPlaceholder(query.limit, values)}`;
    }

    if (query.offset !== undefined) {
      statement += `\n${tabs}OFFSET ${getPlaceholder(query.offset, values)}`;
    }

    return statement;
  }

  if (query.type === 'INSERT') {
    const fields = query.fields.map((field) => `"${field}"`);
    const rows = query.values.map((rowValues) => {
      const placeholders = rowValues.map((value) => getPlaceholder(value, values));
      return `${tabs}  (\n${tabs}    ${placeholders.join(`,\n${tabs}    `)}\n${tabs}  )`;
    });
    clauses.push(`INSERT INTO\n${tabs}  "${query.table}" (\n${tabs}    ${fields.join(`,\n${tabs}    `)}\n${tabs}  )`);
    clauses.push(`VALUES\n${rows.join(',\n')}`);
    return `${tabs}${withClause}${clauses.join(`\n${tabs}`)}`;
  }

  if (query.type === 'UPDATE') {
    const assignments = Object.keys(query.fields).map((field) => (
      `"${field}" = ${getPlaceholder(query.fields[field], values)}`
    ));
    clauses.push(`UPDATE\n${tabs}  "${query.table}"${alias}`);
    clauses.push(`SET\n${tabs}  ${assignments.join(`,\n${tabs}  `)}`);
    return `${tabs}${withClause}${clauses.join(`\n${tabs}`)}${compileWhereClauses(query, values, tabs)}`;
  }

  clauses.push(`DELETE FROM\n${tabs}  "${query.table}"`);
  return `${tabs}${withClause}${clauses.join(`\n${tabs}`)}${compileWhereClauses(query, values, tabs)}`;
};

/**
 * PostgreSQL database client settings.
 */
export interface PostgreSQLDatabaseClientSettings extends DatabaseClientSettings {
  /**
   * Whether to hash field paths in SQL queries. Turn this off for debugging purposes.
   * Defaults to `true`.
   */
  hashAliases: boolean;

  /**
   * Connection settings for each available connection pool. You can register as many pools as you
   * need and switch between them in queries, each having its own lifecycle and connection settings.
   * This can be especially useful to handle multi-tenancy.
   */
  pools: Record<string, DatabaseClientSettings['pools'][string] & Omit<PoolConfig, 'user' | 'password' | 'port'> & {
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
  }>;
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
  private readonly SQL_TYPES_MAPPING: Record<string, string> = {
    null: 'BOOLEAN',
    id: (Id.FORMAT === 'SNOWFLAKE') ? 'VARCHAR(24)' : 'UUID',
    integer: 'INT',
    boolean: 'BOOLEAN',
    float: 'FLOAT8',
    binary: 'BYTEA',
    date: 'TIMESTAMPTZ',
    array: 'BOOLEAN',
    object: 'BOOLEAN',
  };

  /**
   * SQL aliases, indexed by field path.
   */
  private fieldSqlAliases = new Map<string, string>();

  /**
   * Whether to hash fields aliases in SQL queries. Turn this off for debugging purposes.
   * Defaults to `true`.
   */
  private hashAliases: boolean;

  /**
   * Allows to provide a custom SQL table name for specific resources and sub-resources.
   */
  protected tablesMapping: Record<string, string>;

  /**
   * Connection settings for each available pool. You can register as many pools as you need and
   * switch between them in queries, each having its own lifecycle and connection settings. This can
   * be especially useful to handle multi-tenancy.
   */
  protected poolSettings: Map<string, PostgreSQLDatabaseClientSettings['pools'][string]>;

  /**
   * Active connection pools. Default pool is referenced with the key `default`.
   */
  protected pools: Map<string, ConnectedPool>;

  /**
   * Active sessions, indexed by session ID. A session represents a running SQL transaction.
   */
  protected sessions: Map<string, Session>;

  /**
   * Returns the SQL table name to use for `table`.
   *
   * @param table Table to get the SQL name for.
   *
   * @returns SQL table name for `table`.
   */
  private getTableName(table: string): string {
    return this.tablesMapping[table] ?? table;
  }

  /**
   * Returns a deterministic SQL alias to use for `path`.
   *
   * @param path Field path to get the SQL alias for.
   *
   * @returns SQL alias for `path`.
   */
  private getFieldSqlAlias(path: string): string {
    const existingAlias = this.fieldSqlAliases.get(path);

    if (existingAlias !== undefined) {
      return existingAlias;
    }

    const newAlias = (this.hashAliases || path.length > 63)
      ? `_${createHash('sha256').update(path).digest('hex').slice(0, 18)}`
      : path;

    this.fieldSqlAliases.set(path, newAlias);
    return newAlias;
  }

  /**
   * Builds the filter excluding soft-deleted rows of `resource`, if it is soft-deletable.
   *
   * @param resource Resource to build the deletion filter for.
   *
   * @param alias SQL alias of the table to filter.
   *
   * @param excludeDeletedResources Whether soft-deleted resources must be excluded.
   *
   * @returns Deletion filter, an empty list if `resource` is not soft-deletable.
   */
  private buildDeletionFilter(
    resource: string,
    alias: string,
    excludeDeletedResources?: boolean,
  ): string[] {
    const { enableDeletion } = this.model.get(resource as keyof DataModel & string).schema;

    if (excludeDeletedResources === false || enableDeletion !== false) {
      return [];
    }

    return [`"${alias}"."_isDeleted" = FALSE`];
  }

  /**
   * Builds a select formatted query.
   *
   * @param table Table to build the select query for.
   *
   * @param rootPath Root path of the select query.
   *
   * @returns Select query.
   */
  private buildQuery(table: string, rootPath: string): JoinQuery {
    const tableName = this.getTableName(table);
    const tableAlias = this.getFieldSqlAlias(table);
    return ({
      join: [],
      type: 'SELECT',
      as: tableAlias,
      table: tableName,
      // Array items must be returned in the order they had in the payload (= UUIDs values).
      orderBy: [{ field: `"${tableAlias}"."_id"`, direction: 'ASC' }],
      fields: [
        `"${tableAlias}"."_id" AS "${this.getFieldSqlAlias(`${rootPath}__itemId`)}"`,
        `"${tableAlias}"."_parentId" AS "${this.getFieldSqlAlias(`${rootPath}__parentId`)}"`,
        `"${tableAlias}"."value" AS "${this.getFieldSqlAlias(rootPath)}"`,
      ],
    });
  }

  /**
   * Builds a join formatted query.
   *
   * @param alias Alias of the table to join.
   *
   * @param table Table to join.
   *
   * @param type Type of join to perform.
   *
   * @param onField Field to join on.
   *
   * @param conditions Additional conditions to add to the join. Defaults to `[]`.
   *
   * @returns Join query.
   */
  private buildQueryJoin(
    alias: string,
    table: string,
    type: 'INNER' | 'LEFT',
    onField: string,
    conditions: string[] = [],
  ): Exclude<SelectQuery['join'], undefined>[number] {
    return {
      type,
      as: alias,
      table: this.getTableName(table),
      on: [`"${alias}"."_id" = ${onField}`, ...conditions].join(' AND '),
    };
  }

  /**
   * Builds an order by formatted query.
   *
   * @param field Field to order by.
   *
   * @param direction Direction to order by.
   *
   * @returns Order by query.
   */
  private buildOrderBy(
    field: string,
    direction: 'ASC' | 'DESC',
  ): NonNullable<SelectQuery['orderBy']>[number] {
    return { field, direction };
  }

  /**
   * Builds a sub query.
   *
   * @param table Table to build the sub query for.
   *
   * @param newAlias Alias of the new sub query.
   *
   * @param parentAlias Alias of the parent sub query.
   *
   * @param parentField Field of the parent sub query.
   *
   * @param value Value to filter by.
   *
   * @param whereField Field to filter by.
   *
   * @param conditions Additional conditions to add to the sub query. Defaults to `[]`.
   *
   * @returns Sub query.
   */
  private buildSubQuery(
    table: string,
    newAlias: string,
    parentAlias: string,
    parentField: string,
    value: string | SubQuery,
    whereField: string,
    conditions: string[] = [],
  ): SubQuery {
    let finalValue: string | SelectQuery = value;
    let finalOperator: 'IN' | '=' = 'IN';
    if (typeof value !== 'string') {
      const condition = value.where[0] as { operator: 'IN' | '='; column: string; value: string; };
      const redundantColumn = `"${parentAlias}"."${parentField}"`;
      if (value.where.length === 1 && condition.column === redundantColumn) {
        finalValue = condition.value;
        finalOperator = condition.operator;
      } else {
        finalValue = { ...value, fields: [redundantColumn] };
      }
    }
    return {
      as: newAlias,
      table: this.getTableName(table),
      fields: [],
      type: 'SELECT',
      where: [
        {
          column: `"${newAlias}"."${whereField}"`,
          operator: finalOperator,
          value: finalValue,
        },
        ...conditions,
      ],
    };
  }

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
          const max = (enumerations !== undefined) ? enumerations.reduce((m, value) => (
            Math.max(m, value.length)
          ), 0) : maxLength;
          // PostgreSQL has a hard limit of 2000 characters for indexed fields.
          if ((!!isIndexed || !!isUnique) && max > 2000) {
            throw new DatabaseError('INDEXED_FIELD_VALUE_TOO_LONG', { path: `${resource}.${fullPath}` });
          }
          fields[scopedPath] = { type: `VARCHAR(${String(max)})`, isRequired };
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

  /**
   * Connects to the database server.
   *
   * @param pool Name of the pool to connect to. Defaults to `default`.
   *
   * @returns Connection pool instance.
   *
   * @throws If the specified pool does not have any connection settings registered.
   */
  protected async connect(pool = 'default'): Promise<ConnectedPool> {
    const poolClient = this.pools.get(pool);

    if (poolClient !== undefined) {
      return poolClient;
    }

    const poolSettings = this.poolSettings.get(pool);
    if (poolSettings === undefined) {
      throw new DatabaseError('POOL_NOT_FOUND', { pool });
    }

    const telemetryAttributes = {
      'db.system.name': 'postgresql',
      'server.port': poolSettings.port,
      'server.address': poolSettings.host,
      'db.namespace': poolSettings.database,
    };
    this.telemetry.info('Connecting to database...', telemetryAttributes);

    const newPoolClient = new Pool({
      max: poolSettings.connectionLimit,
      lock_timeout: poolSettings.queryTimeout,
      query_timeout: poolSettings.queryTimeout,
      statement_timeout: poolSettings.queryTimeout,
      connectionTimeoutMillis: poolSettings.connectTimeout,
      ...poolSettings,
      port: poolSettings.port ?? undefined,
      user: poolSettings.user ?? undefined,
      password: poolSettings.password ?? undefined,
      // Allows reliable parsing of error details.
      options: `${poolSettings.options ?? ''} -c lc_messages=C`,
    });

    // Prevents uncaught exceptions when errors happen on idle connections.
    newPoolClient.on('error', (error) => {
      this.telemetry.error(error, {
        'db.system.name': 'postgresql',
        'db.client.connection.pool.name': pool,
      });
    });

    this.pools.set(pool, { pool: newPoolClient, telemetryAttributes });

    return { pool: newPoolClient, telemetryAttributes };
  }

  /**
   * Generates a list of formatted queries and projections for `resource` and `type` of operation.
   *
   * @param resource Type of resource to plan queries for.
   *
   * @param type Type of operation to plan queries for.
   *
   * @param id ID of the resource, if any.
   *
   * @param payload Resource or search payload, if any.
   *
   * @param options Query options.
   *
   * @returns List of formatted queries and projections.
   *
   * @throws If any payload field does meet its schema definition.
   *
   * @throws If payload field does not match data model.
   *
   * @throws If a required field is not provided in payload.
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
  protected planQueries<Resource extends keyof DataModel>(
    resource: Resource & string,
    type: 'CREATE',
    id: null,
    payload: DataModel[Resource],
    options: ViewQueryOptions,
  ): { projections: Projections; queries: Record<string, InsertQuery>; };

  protected planQueries<Resource extends keyof DataModel>(
    resource: Resource & string,
    type: 'UPDATE',
    id: Id,
    payload: Payload<DataModel[Resource]>,
    options: ViewQueryOptions,
  ): { projections: Projections; queries: Record<string, InsertQuery | UpdateQuery | DeleteQuery> };

  protected planQueries(
    resource: keyof DataModel & string,
    type: 'DELETE',
    id: Id,
    payload: null,
    options: ViewQueryOptions,
  ): { projections: Projections; queries: Record<string, DeleteQuery>; };

  protected planQueries(
    resource: keyof DataModel & string,
    type: 'VIEW',
    id: Id,
    payload: null,
    options: ViewQueryOptions,
  ): { projections: Projections; queries: Record<string, SelectQuery>; };

  protected planQueries(
    resource: keyof DataModel & string,
    type: 'LIST',
    id: null,
    payload: SearchBody | null,
    options: ListQueryOptions,
  ): { projections: Projections; queries: Record<string, SelectQuery>; };

  protected planQueries<Resource extends keyof DataModel>(
    resource: Resource & string,
    type: 'VIEW' | 'LIST' | 'CREATE' | 'UPDATE' | 'DELETE',
    id: Id | null,
    payload: SearchBody | DataModel[Resource] | Payload<DataModel[Resource]> | null,
    options: ViewQueryOptions | ListQueryOptions,
  ): { projections: Projections; queries: Record<string, Query>; } {
    const model = this.model.get(resource);
    const finalProjections: Projections = { _id: 1 };
    const deletionFilter = this.buildDeletionFilter(
      resource,
      this.getFieldSqlAlias(this.getTableName(resource)),
      options.excludeDeletedResources,
    );
    const idFilter: NonNullable<SelectQuery['where']> = (id === null) ? [] : [{
      column: `"${this.getFieldSqlAlias(this.getTableName(resource))}"."_id"`,
      operator: '=',
      value: id,
    }];

    if (type === 'DELETE') {
      return {
        projections: finalProjections,
        queries: {
          [resource]: {
            table: this.getTableName(resource),
            type: 'DELETE',
            where: idFilter.concat(deletionFilter),
          },
        },
      };
    }

    if (type === 'CREATE' || type === 'UPDATE') {
      let deleteIndex = 0;
      const resourceId = id ?? (payload as Ids)._id;
      const resourceRow: Record<string, unknown> = {};
      // Tables of the arrays directly owned by the resource row. Deleting their rows is enough to
      // also clear the tables of the arrays they contain, as foreign keys make deletions cascade.
      const rootArrayTables = new Set<string>();
      const rowsPerTable: Record<string, Record<string, unknown>[]> = { [resource]: [resourceRow] };

      // Fills `row` with the flattened columns of `value`. `path` is the full path of `value` from
      // the root resource, used for array tables naming and errors, `column` is its column name in
      // `row`, reset at each array table crossing, and `parentId` is the id of the row owning it.
      const structureRow = (
        value: unknown,
        schema: FieldSchema<DataModel> | undefined,
        row: Record<string, unknown>,
        path: string,
        pathInResource: string,
        column: string,
        parentId: Id,
        skipValidation: boolean,
        requireFullPayload: boolean,
      ): void => {
        if (schema === undefined) {
          throw new DatabaseError('UNKNOWN_FIELD', { path });
        }

        const { type: fieldType } = schema;
        if (!skipValidation) {
          this.VALIDATORS[fieldType](path, value, schema);
        }

        // Array values live in their own table: the owner row only keeps a marker telling whether
        // the array is null, and each item becomes a row in that table, linked to its owner by
        // "_parentId" and to the root resource by "_resourceId".
        if (fieldType === 'array') {
          const table = `_${resource}_${path.replace(/\./g, '_')}`;
          // Registered even when the array is null or empty, as its previous rows must still be
          // deleted on update. Arrays owned by the resource row are the first level ones.
          rowsPerTable[table] ??= [];
          if (row === resourceRow) {
            rootArrayTables.add(table);
          }
          if (value === null) {
            Object.assign(row, { [column]: null });
          } else {
            Object.assign(row, { [column]: true });
            const itemPath = `${path}.value`;
            (value as unknown[]).forEach((item) => {
              const itemId = new Id();
              const itemRow: Record<string, unknown> = {
                _id: itemId,
                _parentId: parentId,
              };
              rowsPerTable[table].push(itemRow);
              structureRow(
                item,
                schema.fields,
                itemRow,
                itemPath,
                pathInResource,
                'value',
                itemId,
                skipValidation,
                true,
              );
            });
          }
        }

        // Nested objects are flattened into their owner row, each leaf becoming its own column
        // (e.g. "value__refreshToken"), plus a marker column for the object itself. A `null`
        // object nullifies all its sub-columns, and its sub-payloads don't need validation.
        if (fieldType === 'object') {
          const isNull = (value === null);
          const { fields, isRequired } = schema;
          const pathPrefix = (path === '') ? '' : `${path}.`;
          const columnPrefix = (column === '') ? '' : `${column}_`;
          const pathInResourcePrefix = (pathInResource === '') ? '' : `${pathInResource}.`;
          const missingFields = new Set(Object.keys(fields));
          const requireAllFields = type === 'CREATE' || requireFullPayload || !isRequired;
          if (column !== '') {
            Object.assign(row, { [column]: isNull ? null : true });
          }
          const subFields = isNull
            ? missingFields
            : Object.keys(value as Record<string, unknown>);
          subFields.forEach((fieldName) => {
            missingFields.delete(fieldName);
            structureRow(
              isNull ? null : (value as Record<string, unknown>)[fieldName],
              fields[fieldName],
              row,
              pathPrefix + fieldName,
              pathInResourcePrefix + fieldName,
              columnPrefix + fieldName,
              parentId,
              isNull || skipValidation,
              requireAllFields,
            );
          });
          if (requireAllFields && missingFields.size > 0) {
            const fieldPath = pathInResourcePrefix + [...missingFields][0];
            throw new DatabaseError('MISSING_FIELD', { path: fieldPath });
          }
        }

        if (fieldType !== 'array' && fieldType !== 'object') {
          row[column] = value;
        }
      };

      structureRow(payload, {
        type: 'object',
        isRequired: true,
        fields: model.schema.fields,
        description: model.schema.description,
      }, resourceRow, '', '', '', resourceId, false, type === 'CREATE');

      const isUpdate = (type === 'UPDATE');
      const queries: Record<string, InsertQuery | UpdateQuery | DeleteQuery> = {};
      const previousRows: NonNullable<DeleteQuery['where']>[number] = {
        operator: '=',
        column: '"_parentId"',
        value: resourceId,
      };

      // Tables are walked in payload order, which always yields an array table after the one it is
      // nested in, and is therefore a safe execution order for the generated queries.
      Object.keys(rowsPerTable).forEach((key) => {
        const rows = rowsPerTable[key];
        const table = this.getTableName(key);

        // Previous rows of first level arrays are deleted right before the new ones are inserted.
        // Deeper arrays don't need it, as foreign keys make that deletion cascade to them.
        if (isUpdate && rootArrayTables.has(key)) {
          queries[`_delete_${String(deleteIndex)}`] = { table, type: 'DELETE', where: [previousRows] };
          deleteIndex += 1;
        }

        if (isUpdate && key === resource) {
          queries[key] = {
            table,
            type: 'UPDATE',
            fields: rows[0],
            as: this.getFieldSqlAlias(table),
            where: idFilter.concat(deletionFilter),
          };
        } else if (rows.length > 0) {
          const fields = Object.keys(rows[0]);
          // Large arrays are inserted in several batches to prevent reaching PostgreSQL hard limit.
          const maximumRows = Math.max(1, Math.floor(MAXIMUM_PARAMETERS_PER_QUERY / fields.length));
          for (let index = 0; index < rows.length; index += maximumRows) {
            const batch = rows.slice(index, index + maximumRows);
            queries[(index === 0) ? key : `${key}_${String(index)}`] = {
              table,
              fields,
              type: 'INSERT',
              values: batch.map((row) => fields.map((field) => row[field])),
            };
          }
        }
      });

      return { projections: finalProjections, queries };
    }

    const isView = (type === 'VIEW');
    const queryJoins = new Set<string>();
    const searchJoins = new Set<string>();
    const searchBody = payload as SearchBody | null;
    const filters = (isView ? {} : searchBody?.filters ?? {});
    const sortBy = (options as ListQueryOptions).sortBy ?? {};
    const resourceTable = this.getTableName(resource);
    const sortByFields = new Set(Object.keys(sortBy));
    const filterFields = new Set(Object.keys(filters));
    const rootAlias = this.getFieldSqlAlias(resourceTable);
    const fetchFields = new Set(['_id', ...(options.fields ?? [])]);
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    // All query fields must match the same tokens, so they are extracted once for the whole query.
    const searchTokens = (isView ? '' : searchBody?.query?.text ?? '')
      .slice(0, 100)
      .split(this.SPLITTING_TOKENS)
      .filter((token) => token !== '')
      .slice(0, 8);
    const queryFields = new Set((searchTokens.length === 0) ? [] : searchBody?.query?.on ?? []);
    const searchFields = new Set([...sortByFields, ...filterFields, ...queryFields]);
    const allFields = new Set([...fetchFields, ...sortByFields, ...filterFields, ...queryFields]);
    const searchQuery: NonNullable<SelectQuery['where']>[0] = { operator: 'OR', conditions: [] };
    const queries: Record<string, JoinQuery> & { _search: SearchQuery; } = {
      [resource]: {
        join: [],
        fields: [],
        as: rootAlias,
        type: 'SELECT',
        table: resourceTable,
        where: [{ column: `"${rootAlias}"."_id"`, operator: '=', value: [] }],
        orderBy: [{ field: `array_position($1, "${rootAlias}"."_id")`, direction: 'ASC' }],
      },
      _search: {
        join: [],
        orderBy: [],
        as: rootAlias,
        type: 'SELECT',
        table: resourceTable,
        limit: (options as ListQueryOptions).limit ?? this.DEFAULT_LIMIT,
        offset: (options as ListQueryOptions).offset ?? this.DEFAULT_OFFSET,
        fields: [`"${rootAlias}"."_id"`, 'COUNT(*) OVER () AS __total'],
        where: [...deletionFilter, ...(queryFields.size > 0 ? [searchQuery] : [])],
      },
    };

    allFields.forEach((path) => {
      let currentDepth = 1;
      const segments = path.split('.');
      const isFetchField = fetchFields.has(path);
      const isFilterField = filterFields.has(path);
      const isQueryField = queryFields.has(path);
      const isSortByField = sortByFields.has(path);
      const isSearchField = searchFields.has(path);
      let currentProjections = finalProjections;
      let currentQuery = queries[resource] as JoinQuery;
      let currentSchema = model.schema as FieldSchema<DataModel> | undefined;

      // Necessary to reference the previous alias when performing joins.
      let currentAlias = rootAlias;
      // Stores the full path from the root resource to the leaf (e.g.
      // "users_roles__createdBy_email"). It is used as a unique identifier for aliases
      // generation, queries indexing, and results formatting.
      let fullFlattenedPath: string = resource;
      // Stores the real field path in the current table. It is reset at each new table
      // crossing, and contains `value` for arrays (e.g. "value__refreshToken"). It is used to
      // get the right SQL column to compare in `IN (SELECT ...)` subqueries.
      let flattenedPathInTable = '';
      // Stores the name of the current table to use for nested `IN (SELECT ...)` and JOIN
      // subqueries. It is reset at each new resource crossing, and does not
      // contain `value` for arrays (e.g. "_users__devices." for "users._devices._refreshToken").
      let currentTable: string = resource;

      // When using filters or queries on arrays, we need to create a subquery that will resolve
      // joined values up to the root resource. These variables store intermediate results.
      // `existsQuery` for search query, `selectQuery` for subsequent queries.
      let existsQuery: SubQuery | undefined;
      let selectQuery: SubQuery = {
        fields: [],
        as: rootAlias,
        type: 'SELECT',
        table: resourceTable,
        where: [{ column: `"${rootAlias}"."_id"`, operator: '=', value: isView ? id : [] }],
      };

      while (segments.length > 0) {
        let isArrayValueLeaf = false;
        const fieldName = String(segments.shift());
        const isLeaf = (segments.length === 0);
        const subSchema = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; } | undefined);
        currentSchema = subSchema?.fields?.[fieldName];
        fullFlattenedPath = `${fullFlattenedPath}_${fieldName}`;
        flattenedPathInTable = (flattenedPathInTable === '') ? fieldName : `${flattenedPathInTable}_${fieldName}`;

        // Array values live in their own table, linked to the owner row by "_parentId".
        // Crossing one switches tables: seal the query we're leaving (its row filter is now
        // fully known), chain both ownership subqueries one level deeper, then re-anchor the
        // whole walk state (table, alias, in-table path, schema, fetch query) on the array table.
        if (currentSchema?.type === 'array') {
          if (isFetchField) {
            currentQuery.where ??= [...selectQuery.where];
          }
          const newTable = `_${currentTable.replace(/^_/, '')}_${flattenedPathInTable.replace(/^value_/, '')}`;
          const newAlias = this.getFieldSqlAlias(newTable);
          const newQuery = existsQuery ?? `"${currentAlias}"."_id"`;
          existsQuery = this.buildSubQuery(newTable, newAlias, currentAlias, '_id', newQuery, '_parentId');
          selectQuery = this.buildSubQuery(newTable, newAlias, currentAlias, '_id', selectQuery, '_parentId');
          currentTable = newTable;
          currentAlias = newAlias;
          flattenedPathInTable = 'value';
          currentSchema = currentSchema.fields;
          isArrayValueLeaf = isLeaf;
          if (isFetchField) {
            queries[fullFlattenedPath] ??= this.buildQuery(newTable, fullFlattenedPath);
            currentQuery = queries[fullFlattenedPath];
          }
        }

        // Checked as an own property, as a field named after one of `Object.prototype` members
        // would otherwise resolve to that member instead of being rejected.
        const fields: Record<string, unknown> = subSchema?.fields ?? {};

        if (currentSchema === undefined || !Object.prototype.hasOwnProperty.call(fields, fieldName)) {
          throw new DatabaseError('UNKNOWN_QUERY_FIELD', { path });
        }

        if (currentDepth > maximumDepth) {
          throw new DatabaseError('MAXIMUM_QUERY_FIELDS_DEPTH_EXCEEDED', { path });
        }

        if (isSortByField && existsQuery !== undefined) {
          throw new DatabaseError('UNSORTABLE_FIELD', { path });
        }

        const { relation, isIndexed, isUnique } = currentSchema as IdSchema<DataModel>;

        // Leaves are where the field is actually resolved into a SQL column, to either fetch it,
        // filter on it, match it against the search query, or sort on it.
        if (isLeaf) {
          if (currentSchema.type === 'object') {
            throw new DatabaseError('INVALID_QUERY_FIELD', { path });
          }

          if (!isIndexed && !isUnique && isSearchField) {
            throw new DatabaseError('UNINDEXED_FIELD', { path });
          }

          // A full-text search matches substrings, which only makes sense on text: any other type
          // has no such notion, and the database would reject the comparison altogether.
          if (isQueryField && currentSchema.type !== 'string') {
            throw new DatabaseError('UNSEARCHABLE_FIELD', { path });
          }

          const column = `"${currentAlias}"."${flattenedPathInTable}"`;

          if (isFilterField) {
            const condition = buildValueFilter(column, filters[path]);
            queries._search.where.push(buildQueryFilter(condition, existsQuery));
          }

          if (isQueryField) {
            const condition = buildSearchFilter(searchTokens, column);
            searchQuery.conditions.push(buildQueryFilter(condition, existsQuery));
          }

          if (isSortByField) {
            const direction = (sortBy[path] === 1) ? 'ASC' : 'DESC';
            queries._search.orderBy.push(this.buildOrderBy(column, direction));
          }

          if (isFetchField) {
            currentProjections[fieldName] ??= 1;
            currentQuery.where ??= [...selectQuery.where];
            if (!isArrayValueLeaf) {
              currentQuery.fields.push(`${column} AS "${this.getFieldSqlAlias(fullFlattenedPath)}"`);
            }
          }
        }

        // Relation fields mean moving to the related resource's table, linked to the previous
        // resource by "_id". Crossing one switches tables: seal the query we're leaving (its row
        // filter is now fully known), chain both ownership subqueries one level deeper, then
        // re-anchor the whole walk state (table, alias, in-table path, schema, fetch query) on the
        // related resource's table.
        if (!isLeaf && currentSchema.type === 'id' && relation !== undefined) {
          currentDepth += 1;
          const newTable = relation;
          const newAlias = this.getFieldSqlAlias(fullFlattenedPath);

          // Soft-deleted resources must not be reachable through filters, search or sorting.
          const relationDeletionFilter = !isSearchField ? [] : this.buildDeletionFilter(
            newTable,
            newAlias,
            options.excludeDeletedResources,
          );

          existsQuery = (existsQuery === undefined)
            ? existsQuery
            : this.buildSubQuery(newTable, newAlias, currentAlias, flattenedPathInTable, existsQuery, '_id', relationDeletionFilter);
          selectQuery = this.buildSubQuery(newTable, newAlias, currentAlias, flattenedPathInTable, selectQuery, '_id');

          if (existsQuery === undefined && isSearchField && !searchJoins.has(newAlias)) {
            searchJoins.add(newAlias);
            const onField = `"${currentAlias}"."${flattenedPathInTable}"`;
            queries._search.join.push(this.buildQueryJoin(newAlias, newTable, 'LEFT', onField, relationDeletionFilter));
          }

          if (isFetchField && !queryJoins.has(newAlias)) {
            queryJoins.add(newAlias);
            const joinType = currentSchema.isRequired ? 'INNER' : 'LEFT';
            const onField = `"${currentAlias}"."${flattenedPathInTable}"`;
            currentQuery.join.push(this.buildQueryJoin(newAlias, newTable, joinType, onField));
            const idFieldAlias = this.getFieldSqlAlias(`${fullFlattenedPath}__id`);
            currentQuery.fields.push(`"${newAlias}"."_id" AS "${idFieldAlias}"`);
          }

          currentTable = newTable;
          currentAlias = newAlias;
          flattenedPathInTable = '';
          const { schema } = this.model.get(relation);
          currentSchema = { type: 'object', fields: schema.fields, description: schema.description };
          if (isFetchField && (currentProjections[fieldName] ?? 1) === 1) {
            currentProjections[fieldName] = { _id: 1 };
          }
        }

        if (!isLeaf && isFetchField) {
          currentProjections[fieldName] ??= {};
        }

        if (isFetchField) {
          currentProjections = currentProjections[fieldName] as Projections;
        }
      }
    });

    // Sorting fields are not necessarily unique, and `LIMIT` / `OFFSET` over a non-deterministic
    // order makes rows shift between pages: the resource id is thus always used as a final
    // tiebreaker, after any requested sorting.
    queries._search.orderBy.push(this.buildOrderBy(`"${rootAlias}"."_id"`, 'ASC'));

    const { _search, ...rest } = queries;

    if (isView) {
      delete queries[resource].orderBy;
      queries[resource].where = idFilter.concat(deletionFilter);
      return { projections: finalProjections, queries: rest };
    }

    return { projections: finalProjections, queries: { _search, ...rest } };
  }

  /**
   * Compiles formatted `queries` definitions into SQL queries.
   *
   * @param queries Formatted queries definitions from which to compile SQL queries.
   *
   * @returns Compiled SQL queries.
   */
  protected compileQueries(
    queries: Record<string, Query>,
  ): Record<string, { query: string, values: unknown[]; }> {
    const compiledQueries: Record<string, { query: string; values: unknown[]; }> = {};

    Object.keys(queries).forEach((key) => {
      const values: unknown[] = [];
      const query = `${compileQuery(queries[key], values)};`;

      if (values.length > MAXIMUM_PARAMETERS_PER_QUERY) {
        throw new DatabaseError('TOO_MANY_QUERY_PARAMETERS', {
          query: key,
          parameters: values.length,
        });
      }

      compiledQueries[key] = { query, values };
    });

    return compiledQueries;
  }

  /**
   * Performs a SQL query on the database with `settings`.
   *
   * @param settings Query settings. Contains:
   * - `query`: SQL query to perform.
   * - `values`: Values to bind to the query.
   * - `poolOrSession`: Pool or session ID to use for the query.
   * - `telemetryAttributes`: Telemetry attributes to add to the query span.
   * Defaults to `{ poolOrSession: 'default' }`.
   *
   * @returns Query result.
   *
   * @throws If the specified pool or session does not exist.
   */
  protected async query<T extends QueryResultRow = QueryResultRow>(settings: {
    query: string;
    values?: unknown[];
    poolOrSession?: string;
    telemetryAttributes?: Record<string, string | number | boolean | undefined>;
  }): Promise<QueryResult<T>> {
    const { query, values = [] } = settings;
    const { poolOrSession = 'default', telemetryAttributes = {} } = settings;
    let sqlErrorCode: string | undefined;

    const session = this.sessions.get(poolOrSession);
    const client = session ?? await this.connect(poolOrSession);
    let connection = (session === undefined) ? (client as ConnectedPool).pool : session.client;

    const startTime = this.telemetry.now();
    return this.telemetry.span(`${this.constructor.name}.query`, {
      attributes: {
        ...client.telemetryAttributes,
        'db.query.text': settings.query,
        'code.class.name': this.constructor.name,
        ...telemetryAttributes,
      },
    }, async (span) => {
      let result: QueryResult<T>;

      try {
        // We manually performs the connection to the pool as it allows us to measure the connection
        // wait time.
        if (session === undefined) {
          connection = await (connection as Pool).connect();
          this.telemetry.measure('db.client.connection.wait_time', this.telemetry.duration(startTime), {
            'db.client.connection.pool.name': poolOrSession,
          });
        }
        result = await connection.query<T>(query, values);
      } catch (error) {
        const postgreError = error as PostgreSQLDatabaseError;
        sqlErrorCode = postgreError.code;
        span.setStatus({ code: 'ERROR' });

        // Network failure, timeout, etc. are rethrown as-is.
        if (sqlErrorCode === undefined) {
          throw error;
        }

        const path = (CONSTRAINT_VIOLATION_CODES[sqlErrorCode] === undefined)
          ? null
          : /Key \((.+?)\)=/.exec(postgreError.detail ?? '')?.[1] ?? null;

        if (path !== null) {
          throw new DatabaseError(CONSTRAINT_VIOLATION_CODES[sqlErrorCode], { path });
        }

        throw new DatabaseError('DATABASE_ERROR', {
          code: sqlErrorCode,
          message: postgreError.message,
        });
      } finally {
        if (session === undefined) {
          (connection as PoolClient).release();
        }
        span.setAttributes({
          'error.type': sqlErrorCode,
          'db.response.status_code': sqlErrorCode,
        });
        this.telemetry.measure('db.client.operation.duration', this.telemetry.duration(startTime), {
          ...client.telemetryAttributes,
          'error.type': sqlErrorCode,
          'db.response.status_code': sqlErrorCode,
          ...telemetryAttributes,
        });
      }

      return result;
    });
  }

  /**
   * Formats `resultsPerQuery` into database-agnostic rows, containing only requested fields.
   *
   * @param resource Type of resource to format.
   *
   * @param projections Fields tree used to format rows.
   *
   * @param resultsPerQuery List of database raw results to format, per SQL query.
   *
   * @returns Formatted rows.
   */
  protected formatRows<T = unknown>(
    resource: keyof DataModel & string,
    projections: Projections | 1,
    resultsPerQuery: Record<string, Record<string, unknown>[]>,
  ): T {
    // Rows of an array query, grouped by the id of the row that owns them. Indexing them on first
    // use avoids scanning the whole query results again for each of their parents, which gets
    // especially costly for nested arrays, as those have one parent per item of their own parent.
    const indexesPerPath = new Map<string, Map<string, Record<string, unknown>[]>>();

    const getItemRows = (path: string, parentId: string): Record<string, unknown>[] => {
      const existingIndex = indexesPerPath.get(path);
      if (existingIndex !== undefined) {
        return existingIndex.get(parentId) ?? [];
      }

      const index = new Map<string, Record<string, unknown>[]>();
      resultsPerQuery[path].forEach((itemRow) => {
        const itemParentId = String(itemRow[this.getFieldSqlAlias(`${path}__parentId`)]);
        const itemRows = index.get(itemParentId);
        if (itemRows === undefined) {
          index.set(itemParentId, [itemRow]);
        } else {
          itemRows.push(itemRow);
        }
      });
      indexesPerPath.set(path, index);

      return index.get(parentId) ?? [];
    };

    // Formats the field at `path`, which is its full flattened path from the root resource, and
    // resolves both its SQL alias in `row` and, for arrays, the query its own rows come from.
    // `parentId` is the id of the row owning that field, a `null` one meaning it has no value.
    const format = (
      path: string,
      projection: Projections | 1,
      row: Record<string, unknown> | null,
      schema: FieldSchema<DataModel>,
      parentId: string | null,
    ): unknown => {
      const value = row?.[this.getFieldSqlAlias(path)];

      if (value === null || parentId === null) {
        return null;
      }

      // Array values live in their own query, each of its rows being linked to the row that owns
      // the array by "_parentId".
      if (schema.type === 'array') {
        const idAlias = this.getFieldSqlAlias(`${path}__itemId`);
        return getItemRows(path, parentId).map((itemRow) => (
          format(path, projection, itemRow, schema.fields, itemRow[idAlias] as string | null)
        ));
      }

      // Relations are formatted against the related resource's schema, their joined columns living
      // in that very same row.
      const { relation } = schema as IdSchema<DataModel>;
      if (schema.type === 'id' && relation !== undefined && projection !== 1) {
        const { fields } = this.model.get(relation).schema;
        const subParentId = row?.[this.getFieldSqlAlias(`${path}__id`)] as string | null;
        return format(path, projection, row, { fields, type: 'object', description: '' }, subParentId);
      }

      if (schema.type === 'object' && projection !== 1) {
        const finalResult: Record<string, unknown> = {};
        Object.keys(projection).forEach((fieldName) => {
          const subPath = `${path}_${fieldName}`;
          const subSchema = schema.fields[fieldName];
          const subProjection = projection[fieldName];
          finalResult[fieldName] = format(subPath, subProjection, row, subSchema, parentId);
        });

        return finalResult;
      }

      return (schema.type === 'id') ? new Id(value as string) : value;
    };

    return resultsPerQuery[resource].map((row) => format(resource, projections, row, {
      type: 'object',
      fields: this.model.get(resource).schema.fields,
      description: '',
    }, row[this.getFieldSqlAlias(`${resource}__id`)] as string)) as T;
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
    this.pools = new Map();
    this.sessions = new Map();
    this.poolSettings = new Map();
    this.hashAliases = settings.hashAliases;
    Object.keys(settings.pools).forEach((pool) => {
      this.poolSettings.set(pool, settings.pools[pool]);
    });
    this.model.getResources().forEach((resource) => {
      this.generateResourceMetadata(resource);
      // Reversing the sub-tables array is essential to delete dependencies in the right order.
      this.resourcesMetadata[resource].subStructures.reverse();
    });
    this.telemetry.createHistogram('db.client.connection.wait_time', {
      unit: 's',
      valueType: 1, // DOUBLE
      description: 'The time it took to obtain an open connection from the pool.',
      advice: {
        explicitBucketBoundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      },
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
    }, (observe) => {
      this.pools.forEach(({ pool }, name) => {
        observe(pool.totalCount - pool.idleCount, {
          'db.client.connection.state': 'used',
          'db.client.connection.pool.name': name,
        });
        observe(pool.idleCount, {
          'db.client.connection.state': 'idle',
          'db.client.connection.pool.name': name,
        });
      });
    });
    this.telemetry.createUpDownCounter('db.client.connection.pending_requests', {
      description: 'The number of current pending requests for an open connection.',
      unit: '{request}',
    }, (observe) => {
      this.pools.forEach(({ pool }, name) => {
        observe(pool.waitingCount, { 'db.client.connection.pool.name': name });
      });
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
    callback: (session: string, cancel: () => Promise<void>) => Promise<T>,
    pool = 'default',
  ): Promise<T> {
    return this.telemetry.span(`${this.constructor.name}.withSession`, {
      kind: 'CLIENT',
      attributes: { pool, 'code.class.name': this.constructor.name },
    }, async () => {
      let isCancelled = false;
      let destroyConnection = false;
      let sessionError: Error | undefined;
      const newSessionId = String(new Id());
      const startTime = this.telemetry.now();
      const { pool: poolClient, telemetryAttributes } = await this.connect(pool);
      const connection = await poolClient.connect();
      this.telemetry.measure('db.client.connection.wait_time', this.telemetry.duration(startTime), {
        'db.client.connection.pool.name': pool,
      });
      this.sessions.set(newSessionId, { client: connection, telemetryAttributes });
      const cancel = async (): Promise<void> => {
        isCancelled = true;
        try {
          await this.query({
            query: 'ROLLBACK;',
            poolOrSession: newSessionId,
          });
        } catch (rollbackError) {
          destroyConnection = true;
          throw rollbackError;
        } finally {
          this.sessions.delete(newSessionId);
        }
      };
      let response: T;

      try {
        await this.query({
          query: 'BEGIN;',
          poolOrSession: newSessionId,
        });
        response = await callback(newSessionId, cancel);
        if (!isCancelled) {
          try {
            await this.query({
              query: 'COMMIT;',
              poolOrSession: newSessionId,
            });
          } catch (commitError) {
            destroyConnection = true;
            throw commitError;
          }
        }
      } catch (error) {
        sessionError = error as Error;

        if (!isCancelled) {
          try {
            await cancel();
            destroyConnection = false;
          } catch (rollbackError) {
            // Rolling back often fails for the very reason the transaction failed: the original
            // error is always the one propagated, as it is the one describing what went wrong.
            this.telemetry.warn(rollbackError as Error, {
              'db.client.connection.pool.name': pool,
            });
          }
        }

        throw sessionError;
      } finally {
        // Releasing with an error destroys the connection instead of returning it to the pool:
        // only a connection left in an unknown state is worth that cost.
        connection.release(destroyConnection ? sessionError : undefined);
        this.sessions.delete(newSessionId);
      }

      return response;
    });
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
    resource: Resource & string,
    payload: DataModel[Resource],
    options: ViewQueryOptions = this.DEFAULT_VIEW_COMMAND_OPTIONS,
  ): Promise<void> {
    return this.telemetry.span(`${this.constructor.name}.create`, {
      kind: 'CLIENT',
      attributes: {
        resource,
        pool_or_session: options.poolOrSession,
        'code.class.name': this.constructor.name,
        ...options.telemetryAttributes,
      },
    }, async () => {
      const { queries } = this.planQueries(resource, 'CREATE', null, payload, options);
      const sqlQueries = this.compileQueries(queries);

      const execute = async (session?: string): Promise<void> => {
        await forEach(Object.keys(sqlQueries), async (key) => {
          await this.query({
            poolOrSession: session,
            query: sqlQueries[key].query,
            values: sqlQueries[key].values,
          });
        });
      };

      return (options.poolOrSession !== undefined && this.sessions.has(options.poolOrSession))
        ? execute(options.poolOrSession)
        : this.withSession(execute, options.poolOrSession);
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
  public async update<Resource extends keyof DataModel = keyof DataModel>(
    resource: Resource & string,
    id: Id,
    payload: Payload<DataModel[Resource]>,
    options: ViewQueryOptions = this.DEFAULT_VIEW_COMMAND_OPTIONS,
  ): Promise<boolean> {
    return this.telemetry.span(`${this.constructor.name}.update`, {
      kind: 'CLIENT',
      attributes: {
        resource,
        id: String(id),
        pool_or_session: options.poolOrSession,
        'code.class.name': this.constructor.name,
        ...options.telemetryAttributes,
      },
    }, async () => {
      const { queries } = this.planQueries(resource, 'UPDATE', id, payload, options);
      const sqlQueries = this.compileQueries(queries);

      const deleteQueryKeys: string[] = [];
      const insertQueryKeys: string[] = [];
      Object.keys(queries).forEach((key) => {
        if (queries[key].type === 'DELETE') {
          deleteQueryKeys.push(key);
        } else if (key !== resource) {
          insertQueryKeys.push(key);
        }
      });

      const execute = async (session?: string, cancel?: () => Promise<void>): Promise<boolean> => {
        // A payload touching nothing but arrays leaves the resource row itself unchanged, which
        // would make for an empty `UPDATE ... SET`. The row is then only locked instead, both to
        // check that the resource exists and to serialize concurrent updates of its arrays.
        const useFallbackQuery = Object.keys((queries[resource] as UpdateQuery).fields).length < 1;
        const rootQuery = !useFallbackQuery ? sqlQueries[resource] : this.compileQueries({
          [resource]: {
            type: 'SELECT',
            fields: ['1'],
            table: this.getTableName(resource),
            where: (queries[resource] as UpdateQuery).where,
            as: this.getFieldSqlAlias(this.getTableName(resource)),
          },
        })[resource];
        const response = await this.query({
          poolOrSession: session,
          values: rootQuery.values,
          query: useFallbackQuery ? rootQuery.query.replace(/;$/, ' FOR UPDATE;') : rootQuery.query,
        });

        if (response.rowCount === 0) {
          await cancel?.();
          return false;
        }

        await forEach(deleteQueryKeys, async (key) => {
          await this.query({
            poolOrSession: session,
            query: sqlQueries[key].query,
            values: sqlQueries[key].values,
          });
        });

        await forEach(insertQueryKeys, async (key) => {
          await this.query({
            poolOrSession: session,
            query: sqlQueries[key].query,
            values: sqlQueries[key].values,
          });
        });

        return true;
      };

      return (options.poolOrSession !== undefined && this.sessions.has(options.poolOrSession))
        ? execute(options.poolOrSession)
        : this.withSession(execute, options.poolOrSession);
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
  public async delete<Resource extends keyof DataModel = keyof DataModel>(
    resource: Resource & string,
    id: Id,
    options: ViewQueryOptions = this.DEFAULT_VIEW_COMMAND_OPTIONS,
  ): Promise<boolean> {
    return this.telemetry.span(`${this.constructor.name}.delete`, {
      kind: 'CLIENT',
      attributes: {
        resource,
        id: String(id),
        pool_or_session: options.poolOrSession,
        'code.class.name': this.constructor.name,
        ...options.telemetryAttributes,
      },
    }, async () => {
      const { queries } = this.planQueries(resource, 'DELETE', id, null, options);
      const sqlQueries = this.compileQueries(queries);

      const response = await this.query({
        query: sqlQueries[resource].query,
        values: sqlQueries[resource].values,
        poolOrSession: options.poolOrSession,
      });

      return (response.rowCount ?? 0) > 0;
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
  public async view<
    Key extends keyof QueryResults,
    Resource extends keyof DataModel = keyof DataModel,
  >(
    resource: Resource & string,
    id: Id,
    options: ViewQueryOptions,
  ): Promise<(Key extends keyof QueryResults ? QueryResults[Key] : Ids) | null> {
    return this.telemetry.span(`${this.constructor.name}.view`, {
      kind: 'CLIENT',
      attributes: {
        resource,
        id: String(id),
        pool_or_session: options.poolOrSession,
        'code.class.name': this.constructor.name,
        ...options.telemetryAttributes,
      },
    }, async () => {
      const finalResults: Record<string, Record<string, unknown>[]> = {};
      const { projections, queries } = this.planQueries(resource, 'VIEW', id, null, options);
      const { [String(resource)]: resourceQuery, ...sqlQueries } = this.compileQueries(queries);

      finalResults[resource] = await this.query<Record<string, unknown>>({
        query: resourceQuery.query,
        values: resourceQuery.values,
        poolOrSession: options.poolOrSession,
      }).then((response) => response.rows);

      if (finalResults[resource].length === 0) {
        return null;
      }

      await forEach(Object.keys(sqlQueries), (key) => this.query<Record<string, unknown>>({
        query: sqlQueries[key].query,
        values: sqlQueries[key].values,
        poolOrSession: options.poolOrSession,
      }).then(({ rows }) => { finalResults[key] = rows; }), 5);

      return this.formatRows<null[]>(resource, projections, finalResults)[0];
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
    Resource extends keyof DataModel = keyof DataModel,
  >(
    resource: Resource & string,
    searchBody: SearchBody | null,
    options: ListQueryOptions,
  ): Promise<Results<Key extends keyof QueryResults ? QueryResults[Key] : Ids>> {
    return this.telemetry.span(`${this.constructor.name}.list`, {
      kind: 'CLIENT',
      attributes: {
        resource,
        limit: options.limit,
        offset: options.offset,
        pool_or_session: options.poolOrSession,
        'code.class.name': this.constructor.name,
        ...options.telemetryAttributes,
      },
    }, async () => {
      const offset = (options.offset ?? this.DEFAULT_OFFSET);
      const { projections, queries } = this.planQueries(resource, 'LIST', null, searchBody, options);
      const { _search, ...sqlQueries } = this.compileQueries(queries);

      const response = await this.query<{ __total: string | null; _id: string; }>({
        query: _search.query,
        values: _search.values,
        poolOrSession: options.poolOrSession,
      });

      if (response.rows.length === 0 && offset === 0) {
        return { total: 0, results: [] };
      }

      // Paginating with overflowed offset gives no rows in the response although there may actually
      // be results. This second query makes sure to return the total number of results.
      if (response.rows.length === 0) {
        const { _search: countQuery } = this.compileQueries({
          _search: {
            ...queries._search,
            limit: 1,
            offset: 0,
            orderBy: [],
            fields: ['COUNT(*) AS __total'],
          },
        });

        const countResponse = await this.query<{ __total: string | null; _id: string; }>({
          query: countQuery.query,
          values: countQuery.values,
          poolOrSession: options.poolOrSession,
        });

        return {
          total: parseInt(countResponse.rows[0]?.__total ?? '0', 10),
          results: [],
        };
      }

      const ids = response.rows.map((row) => row._id);
      const finalResults: Record<string, Record<string, unknown>[]> = {};

      await forEach(Object.keys(sqlQueries), (key) => this.query<Record<string, string>>({
        values: [ids],
        query: sqlQueries[key].query,
        poolOrSession: options.poolOrSession,
      }).then(({ rows }) => { finalResults[key] = rows; }), 5);

      return {
        total: parseInt(response.rows[0]?.__total ?? '0', 10),
        results: this.formatRows(resource, projections, finalResults),
      };
    });
  }

  /**
   * Gracefully shuts down the database client, releasing all remaining connections to the server.
   */
  public async shutdown(): Promise<void> {
    const pools = Array.from(this.pools.values());
    return this.telemetry.span(`${this.constructor.name}.shutdown`, {
      kind: 'CLIENT',
      attributes: {
        pools: pools.length,
        'code.class.name': this.constructor.name,
      },
    }, async () => {
      await Promise.all(pools.map((pool) => pool.pool.end()));
      this.pools.clear();
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
    resource: Resource & string,
    relations: Map<string, {
      resource: keyof DataModel & string;
      filters: { _id: Id[]; } & SearchFilters;
    }>,
    options?: Pick<ViewQueryOptions, 'poolOrSession' | 'excludeDeletedResources'>,
  ): Promise<void> {
    return this.telemetry.span(`${this.constructor.name}.checkRelations`, {
      kind: 'CLIENT',
      attributes: {
        resource,
        relations: relations.size,
        pool_or_session: options?.poolOrSession,
        'code.class.name': this.constructor.name,
      },
    }, async () => {
      if (relations.size > 0) {
        const values: unknown[] = [];
        const sqlSubQueries: string[] = [];
        const missingIds = new Set<string>();
        relations.forEach((value, path) => {
          const searchBody = { query: null, filters: value.filters };
          const queryOptions = { ...options, maximumDepth: Infinity };
          const { queries } = this.planQueries(value.resource, 'LIST', null, searchBody, queryOptions);
          delete queries._search.limit;
          delete queries._search.offset;
          delete queries._search.orderBy;
          queries._search.fields = [`DISTINCT "${queries._search.as}"."_id"`, `${getPlaceholder(path, values)} as path`];
          sqlSubQueries.push(`${compileQuery(queries._search, values)};`);
          value.filters._id.forEach((id) => missingIds.add(`${id}:${path}`));
        });

        let query = '';
        for (let index = 0, { length } = sqlSubQueries; index < length; index += 1) {
          query += (query === '') ? sqlSubQueries[index].replace(/;$/, '') : `\nUNION ALL\n${sqlSubQueries[index].replace(/;$/, '')}`;
        }

        const response = await this.query({
          values,
          query: `${query};`,
          poolOrSession: options?.poolOrSession,
        });

        for (let index = 0, { length } = response.rows; index < length; index += 1) {
          const row = response.rows[index];
          missingIds.delete(`${row._id}:${row.path}`);
        }

        if (missingIds.size > 0) {
          const id = (missingIds.values().next().value as unknown as string).split(':')[0];
          throw new DatabaseError('NO_RESOURCE', { id });
        }
      }
    });
  }
}