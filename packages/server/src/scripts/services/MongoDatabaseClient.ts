/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Binary,
  type Db,
  ObjectId,
  MongoClient,
  type Document,
  type MongoServerError,
} from 'mongodb';
import {
  Id,
  forEach,
  type Results,
  type IdSchema,
  type DateSchema,
  type ArraySchema,
  type FieldSchema,
  type ObjectSchema,
  type ResourceSchema,
  type DefaultDataModel,
  type DataModelMetadata,
} from '@perseid/core';
import DatabaseClient, {
  type FormattedQuery,
  type ResourceMetadata,
  type StructuredPayload,
  type DatabaseClientSettings,
} from 'scripts/services/AbstractDatabaseClient';
import type Logger from 'scripts/services/Logger';
import type BaseModel from 'scripts/services/Model';
import DatabaseError from 'scripts/errors/Database';
import type CacheClient from 'scripts/services/CacheClient';

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
export default class MongoDatabaseClient<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
> extends DatabaseClient<DataModel, Model> {
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
  ): void {
    const metadata = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    const resourceSchema = { type: 'object' as const, isRequired: true, fields: metadata.schema.fields };
    const indexes: ResourceMetadata['indexes'] = [];
    const mongoTypesMapping: Record<string, string[]> = {
      null: ['null'],
      id: ['objectId'],
      integer: ['int'],
      string: ['string'],
      boolean: ['bool'],
      float: ['double', 'int'],
      binary: ['binData'],
      date: ['date'],
    };
    const mongoFormatters: Record<string, (
      schema: FieldSchema<DataModel>,
      path: string[],
    ) => ValidationSchema> = {
      object: (schema, path) => {
        const { isRequired, fields } = schema as ObjectSchema<DataModel>;
        const fieldNames = Object.keys(fields);
        const properties: Record<string, ValidationSchema> = {};
        const formattedSchema: ValidationSchema = {
          properties,
          additionalProperties: false,
          required: fieldNames,
          bsonType: ['object'].concat(isRequired ? [] : ['null']),
        };
        fieldNames.forEach((fieldName) => {
          const fieldSchema = fields[fieldName];
          const formatter = (mongoFormatters[fields[fieldName].type] ?? mongoFormatters.default);
          properties[fieldName] = formatter(fieldSchema, path.concat([fieldName]));
        });
        return formattedSchema;
      },
      array: (schema, path) => {
        const { isRequired, fields } = schema as ArraySchema<DataModel>;
        return {
          bsonType: ['array'].concat(isRequired ? [] : ['null']),
          items: (mongoFormatters[fields.type] ?? mongoFormatters.default)(fields, path),
        };
      },
      default: (schema, path) => {
        const { isRequired, type } = schema;
        const { isIndexed, isUnique, relation } = schema as IdSchema<DataModel>;
        const fullPath = path.join('.');
        const extraType = (!isRequired && type !== 'null') ? ['null'] : [];
        if (isIndexed && fullPath !== '_id') {
          indexes.push({ path: fullPath, unique: false });
        } else if (isUnique && fullPath !== '_id') {
          indexes.push({ path: fullPath, unique: true });
        }
        if (type === 'id' && relation !== undefined) {
          const { invertedRelations } = this.resourcesMetadata[relation as string];
          const existingPaths = invertedRelations.get(resource) ?? [];
          if (!existingPaths.includes(fullPath)) {
            existingPaths.push(fullPath);
          }
          invertedRelations.set(resource, existingPaths);
        }

        return {
          bsonType: mongoTypesMapping[type].concat(extraType),
        };
      },
    };

    this.resourcesMetadata[resource] = {
      indexes,
      constraints: [],
      subStructures: [],
      structure: resource,
      subStructuresPerPath: {},
      invertedRelations: this.resourcesMetadata[resource].invertedRelations,
      fields: mongoFormatters['object' as unknown as string](resourceSchema, []),
    };
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
    const formattedQuery: FormattedQuery = {
      structure: resource,
      lookups: {},
      sort: null,
      match: null,
      localField: null,
      foreignField: null,
      fields: { _id: '$_id' },
    };
    const projections: Document = { _id: 1 };
    const processedQueryFields = new Set();
    const processedFiltersFields = new Set();
    const sortByFields = Object.keys(sortBy);
    const queryFields = [...(searchBody?.query?.on ?? [])];
    const filterFields = Object.keys(searchBody?.filters ?? {});
    const model = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    const allFields = [...fields].concat(sortByFields).concat(filterFields).concat(queryFields);
    const formattedMatch: { query: Document[]; filters: Document[]; } = { query: [], filters: [] };
    const queryRegExp = {
      $regex: new RegExp((searchBody?.query?.text ?? '').split(this.SPLITTING_TOKENS).map((t) => (
        `(?=.*${t.replace(/[[\]/()]/ig, (match) => `\\${match}`)})`
      )).join('|'), 'i'),
    };

    allFields.forEach((path) => {
      let currentDepth = 1;
      let isInArray = false;
      let currentPath: string[] = [];
      const fullFieldPath: string[] = [];
      let currentProjections = projections;
      const splittedPath = path.split('.');
      let currentFormattedQuery = formattedQuery;
      let currentSchema = model.schema as FieldSchema<DataModel> | undefined;

      while (splittedPath.length > 0 && currentSchema !== undefined) {
        const fieldName = String(splittedPath.shift());
        const newFields = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields;
        currentSchema = newFields?.[fieldName];
        currentPath.push(fieldName);

        // We only project root fields, as `{ object: { key: 1 } }` would result in an empty object
        // even when `object` is `null` in the document. Same goes for nested arrays.
        if (currentPath.length === 1) {
          currentFormattedQuery.fields[fieldName] = `$${fieldName}`;
        }

        if (currentSchema?.type === 'array') {
          isInArray = true;
          currentSchema = currentSchema.fields;
        }

        const type = currentSchema?.type;
        const realPath = currentPath.join('.');
        const relation = (currentSchema as IdSchema<DataModel> | undefined)?.relation;

        if (type === 'object') {
          currentProjections[fieldName] ??= {};
          currentProjections = currentProjections[fieldName] as Document;
        } else if (type === 'id' && relation !== undefined && splittedPath.length > 0) {
          currentDepth += 1;
          const lookupPath = `_${currentPath.join('_')}`;
          fullFieldPath.push(lookupPath);
          currentFormattedQuery.lookups[lookupPath] ??= {
            sort: null,
            match: null,
            lookups: {},
            foreignField: '_id',
            localField: realPath,
            fields: { _id: '$_id' },
            structure: relation as string,
          };
          currentPath = [];
          if ((currentProjections[fieldName] ?? 1) === 1) {
            currentProjections[fieldName] = { _id: 1 };
          }
          currentFormattedQuery.fields[lookupPath] = `$${lookupPath}`;
          currentProjections = currentProjections[fieldName] as Document;
          currentFormattedQuery = currentFormattedQuery.lookups[lookupPath];
          const metadata = this.model.get(relation) as DataModelMetadata<ResourceSchema<DataModel>>;
          currentSchema = { type: 'object', fields: metadata.schema.fields };
        } else {
          fullFieldPath.push(realPath);
          currentProjections[fieldName] ??= 1;
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

      const finalSearchPath = fullFieldPath.join('.');

      if (sortBy[path] !== undefined) {
        formattedQuery.sort ??= {};
        formattedQuery.sort[finalSearchPath] = (sortBy as Record<string, 1 | -1>)[path];
      }

      if (searchBody?.filters?.[path] !== undefined && !processedFiltersFields.has(path)) {
        processedFiltersFields.add(path);
        const formattedFilters: Document = {};
        let value: unknown = searchBody.filters[path];
        if (Array.isArray(value) && value.length === 1) {
          [value] = value as unknown[];
        }
        if (currentSchema.type === 'id') {
          formattedFilters[finalSearchPath] = Array.isArray(value)
            ? { $in: (value as unknown[]).map((id) => new ObjectId(String(id))) }
            : { $eq: new ObjectId(String(value)) };
        } else if (currentSchema.type === 'date') {
          if (Array.isArray(value) && value.length === 2) {
            formattedFilters[finalSearchPath] = {
              $gte: ((value[0] instanceof Date) ? value[0] : new Date(String(value[0]))),
              $lte: ((value[1] instanceof Date) ? value[1] : new Date(String(value[1]))),
            };
          } else if (Array.isArray(value)) {
            formattedFilters[finalSearchPath] = {
              $in: value.map((date) => ((date instanceof Date) ? date : new Date(String(date)))),
            };
          } else {
            formattedFilters[finalSearchPath] = {
              $gte: ((value instanceof Date) ? value : new Date(String(value))),
            };
          }
        } else {
          formattedFilters[finalSearchPath] = Array.isArray(value)
            ? { $in: value }
            : { $eq: value };
        }
        formattedMatch.filters.push(formattedFilters);
      } else if (searchBody?.query?.on.has(path) && !processedQueryFields.has(path)) {
        processedQueryFields.add(path);
        formattedMatch.query.push({ [finalSearchPath]: queryRegExp });
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
   * @returns Final DBMS-specific query.
   */
  protected generateQuery<Resource extends keyof DataModel & string>(
    resource: Resource,
    formattedQuery: FormattedQuery,
  ): unknown {
    const pipeline: Document[] = [];

    Object.keys(formattedQuery.lookups).forEach((fieldName) => {
      const lookup = formattedQuery.lookups[fieldName];
      pipeline.push({
        $lookup: {
          as: fieldName,
          from: lookup.structure,
          localField: lookup.localField,
          foreignField: lookup.foreignField,
          pipeline: this.generateQuery(resource, lookup),
        },
      });
    });

    if (formattedQuery.match !== null) {
      const queryClause = (formattedQuery.match.query.length > 0)
        ? [{ $or: formattedQuery.match.query }]
        : [];
      pipeline.push({ $match: { $and: formattedQuery.match.filters.concat(queryClause) } });
    }

    return pipeline
      .concat((formattedQuery.sort !== null) ? [{ $sort: formattedQuery.sort }] : [])
      .concat([{ $project: formattedQuery.fields }]);
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
    _resourceId: Id,
    payload: Payload<DataModel[Resource]>,
    mode: 'CREATE' | 'UPDATE',
  ): StructuredPayload {
    // In CREATE mode: the whole nested structure must be passed to MongoDB.
    // In UPDATE mode: a 100% flattened structure must be passed to MongoDB.
    const rootPayload = (mode === 'CREATE') ? null : {};
    const model = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;

    const structurePartialPayload = (
      partialPayload: unknown,
      requireFullPayload: boolean,
      currentSchema?: FieldSchema<DataModel>,
      currentPath: { full: string[]; canonical: string[]; } = { full: [], canonical: [] },
    ): unknown => {
      const path = currentPath.full.join('.');

      if (currentSchema === undefined) {
        throw new DatabaseError('UNKNOWN_FIELD', { path });
      }

      const { type } = currentSchema;
      this.VALIDATORS[type](path, partialPayload, currentSchema);

      if (partialPayload === null) {
        return partialPayload;
      }

      if (type === 'id') {
        return new ObjectId(String(partialPayload));
      }

      if (type === 'binary') {
        return new Binary(new Uint8Array(partialPayload as ArrayBuffer));
      }

      if (type === 'array') {
        const { fields } = currentSchema;
        return (partialPayload as unknown[]).map((value, index) => {
          const full = currentPath.full.concat([String(index)]);
          const newPath = { canonical: [], full };
          return structurePartialPayload(value, true, fields, newPath);
        });
      }

      if (type === 'object') {
        const { fields, isRequired } = currentSchema;
        const missingFields = new Set(Object.keys(fields));
        const requireAllFields = mode === 'CREATE' || requireFullPayload || !isRequired;
        const newPayload = (requireAllFields ? {} : rootPayload) as Record<string, unknown>;
        Object.keys(partialPayload as Record<string, unknown>).forEach((fieldName) => {
          missingFields.delete(fieldName);
          const full = currentPath.full.concat([fieldName]);
          const canonical = currentPath.canonical.concat([fieldName]);
          const formattedFieldPayload = structurePartialPayload(
            (partialPayload as Record<string, unknown>)[fieldName],
            requireAllFields,
            fields[fieldName],
            { full, canonical },
          );
          if (requireAllFields || formattedFieldPayload !== rootPayload) {
            const key = requireAllFields ? fieldName : canonical.join('.');
            newPayload[key] = formattedFieldPayload;
          }
        });

        if (requireAllFields && missingFields.size > 0) {
          const fieldPath = currentPath.full.concat([[...missingFields][0]]).join('.');
          throw new DatabaseError('MISSING_FIELD', { path: fieldPath });
        }

        return newPayload;
      }

      return partialPayload;
    };

    return {
      [resource]: [structurePartialPayload(
        payload,
        mode === 'CREATE',
        { type: 'object', isRequired: true, fields: model.schema.fields },
      ) as Record<string, unknown>],
    };
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
  ): DataModel[Resource][] {
    const finalResources: DataModel[Resource][] = [];
    const model = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;

    const formatResult = (
      result: unknown,
      currentSchema: FieldSchema<DataModel>,
      currentProjections: Document | 1,
      rootResult: Document,
      path: string[] = [],
    ): unknown => {
      const fullPath = path.join('_');
      const { type } = currentSchema;

      if (result === null) {
        return null;
      }

      if (type === 'array') {
        return (result as unknown[]).map((value) => formatResult(
          value,
          currentSchema.fields,
          currentProjections,
          rootResult,
          path,
        ));
      }

      if (type === 'object') {
        const formattedObject: Document = {};
        Object.keys(currentProjections).forEach((fieldName) => {
          formattedObject[fieldName] = formatResult(
            (result as Document)[fieldName],
            currentSchema.fields[fieldName],
            (currentProjections as Document)[fieldName] as 1,
            rootResult,
            path.concat([fieldName]),
          );
        });

        return formattedObject;
      }

      if (type === 'id' && currentSchema.relation !== undefined && currentProjections !== 1) {
        const { relation } = currentSchema;
        const subModel = this.model.get(relation) as DataModelMetadata<ResourceSchema<DataModel>>;
        const newRoot = (rootResult[`_${fullPath}`] as Document[]).find((item) => (
          String(item._id) === String(result)
        )) as unknown as Document;
        const schema = { type: 'object' as const, isRequired: true, fields: subModel.schema.fields };
        return formatResult(newRoot, schema, currentProjections, newRoot);
      }

      if (result instanceof ObjectId) {
        return new Id(String(result));
      }

      if (result instanceof Binary) {
        const { buffer } = result;
        const binary = new ArrayBuffer(buffer.length);
        const arrayBuffer = new Uint8Array(binary);
        for (let i = 0; i < buffer.length; i += 1) {
          arrayBuffer[i] = buffer[i];
        }
        return binary;
      }

      return result;
    };

    results.forEach((result) => {
      const schema = { type: 'object' as const, isRequired: true, fields: model.schema.fields };
      const formattedResult = formatResult(result, schema, fields as Document, result as Document);
      finalResources.push(formattedResult as DataModel[Resource]);
    });

    return finalResources;
  }

  /**
   * Makes sure that no resource references resource with id `id`.
   *
   * @param resource Type of resource to check.
   *
   * @param id Id of the resource to check for references.
   *
   * @throws If any other resource still references resource.
   */
  protected async checkReferencesTo<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<void> {
    const referencesToResource = this.resourcesMetadata[resource].invertedRelations;

    if (referencesToResource.size > 0) {
      const pathMapping = new Map();
      // Performing a single aggregate gathering all requested resources is way more efficient
      // than performing one Mongo query per collection.
      const pipeline: Document[] = [{ $limit: 1 }, { $project: { _id: new ObjectId(String(id)) } }];
      pipeline.push(...[...referencesToResource.keys()].reduce<Document[]>((lookups, relation) => {
        const relationReferences = referencesToResource.get(relation) as unknown as string[];
        return lookups.concat([...relationReferences.values()].map((path) => {
          const flattenedPath = `${relation}__${path.replace(/\./ig, '_')}`;
          pathMapping.set(flattenedPath, `${relation}.${path}`);
          return ({
            $lookup: {
              from: relation,
              as: flattenedPath,
              foreignField: path,
              localField: '_id',
              pipeline: [{ $project: { _id: 1 } }],
            },
          });
        }));
      }, []));

      this.logger.debug('[MongoDatabaseClient][checkReferencesTo] Performing aggregation on pipeline:');
      this.logger.debug(pipeline);

      const [response] = await this.databaseConnection.collection('_config')
        .aggregate<Record<string, Document[]>>(pipeline)
        .toArray();

      const keys = Object.keys(response);
      for (let index = 0, { length } = keys; index < length; index += 1) {
        const path = keys[index];
        if (path !== '_id' && response[path].length > 0) {
          throw new DatabaseError('RESOURCE_REFERENCED', { path: pathMapping.get(path) });
        }
      }
    }
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
      this.logger.debug(`[MongoDatabaseClient][handleError] Connecting to database ${this.database}...`);
      await this.client.connect();
      if ((this.databaseConnection as unknown) === null) {
        throw new DatabaseError('CONNECTION_FAILED');
      }
      this.isConnected = true;
    }
    try {
      return await callback();
    } catch (error) {
      const mongoError = error as MongoServerError;
      if (mongoError.code === 11000) {
        const matches = /dup key: { ([^:]+): ([^:]+) }/.exec(mongoError.message) as string[];
        throw new DatabaseError('DUPLICATE_RESOURCE', {
          path: matches[1],
          value: matches[2],
        });
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
    super(model, logger, cache, settings);

    const { host, port, protocol } = settings;
    const { user, password, database } = settings;
    const { connectionLimit: maxPoolSize, connectTimeout } = settings;

    // Connection URI.
    const portString = (port !== null) ? `:${String(port)}` : '';
    const credentials = (user !== null && password !== null) ? `${user}:${password}@` : '';
    const uri = `${protocol}//${credentials}${host}${portString}/${database}`;

    this.client = new MongoClient(uri, { maxPoolSize, connectTimeoutMS: connectTimeout });
    this.databaseConnection = this.client.db(this.database);
    this.model.getResources().forEach(this.generateResourceMetadata.bind(this));
  }

  /**
   * Drops the entire database.
   */
  public async dropDatabase(): Promise<void> {
    // We don't wrap statements within `handleError` here as database may not exist yet.
    this.logger.info(`[MongoDatabaseClient][dropDatabase] Dropping database ${this.database}...`);
    await this.client.db(this.database).dropDatabase();
    this.logger.info(`[MongoDatabaseClient][dropDatabase] Successfully dropped database ${this.database}.`);
    this.isConnected = false;
  }

  /**
   * Creates the database.
   */
  public async createDatabase(): Promise<void> {
    // We don't wrap statements within `handleError` here as database may not exist yet.
    this.logger.info(`[MongoDatabaseClient][createDatabase] Creating database ${this.database}...`);
    await Promise.resolve();
    this.databaseConnection = this.client.db(this.database);
    this.logger.info(`[MongoDatabaseClient][createDatabase] Successfully created database ${this.database}.`);
  }

  /**
   * Creates missing database structures for current data model.
   */
  public async createMissingStructures(): Promise<void> {
    const response = await this.databaseConnection.listCollections().toArray();
    const existingCollections = new Set(response as unknown as string[]);

    await forEach(Object.keys(this.resourcesMetadata), async (collection) => {
      if (!existingCollections.has(collection)) {
        const { indexes, fields } = this.resourcesMetadata[collection];
        this.logger.info(`[MongoDatabaseClient][createMissingStructures] Creating collection "${collection}"...`);
        await this.databaseConnection.createCollection(collection, {
          validator: { $jsonSchema: fields },
        });
        if (indexes.length > 0) {
          const connection = this.databaseConnection.collection(collection);
          await connection.createIndexes(indexes.map((index) => ({
            key: { [index.path]: 1 },
            unique: index.unique,
          })));
        }
      }
    });

    await this.databaseConnection.createCollection('_config', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          patternProperties: {
            '^[A-Z0-9_]+$': {
              bsonType: 'string',
            },
          },
        },
      },
    });
    await this.databaseConnection.collection('_config').insertOne({});
  }

  /**
   * Resets the whole underlying database, re-creating structures, indexes, and such.
   */
  public async reset(): Promise<void> {
    await this.dropDatabase();
    await this.createDatabase();
    await this.handleError(async () => {
      this.logger.info('[MongoDatabaseClient][reset] Initializing collections...');
      await this.createMissingStructures();
      this.logger.info('[MongoDatabaseClient][reset] Successfully initialized collections.');
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
      const missingIds = new Set<string>();
      // Performing a single aggregate gathering all requested resources is way more efficient
      // than performing one Mongo query per collection.
      const pipeline: Document[] = [{ $limit: 1 }, { $project: {} }];
      foreignIds.forEach((value, path) => {
        const allFilters = { ...value.filters };
        const metadata = this.model.get(value.resource);
        const { schema } = metadata as DataModelMetadata<ResourceSchema<DataModel>>;
        if (!schema.enableDeletion) { allFilters._isDeleted = false; }
        (pipeline[1].$project as Document)[path] = (allFilters._id as Id[]).map((id) => {
          missingIds.add(`${String(id)}:${path}`);
          return new ObjectId(String(id));
        });
        const fields = new Set(Object.keys(allFilters));
        const searchBody = { query: null, filters: allFilters };
        const { formattedQuery } = this.parseFields(value.resource, fields, Infinity, searchBody);
        pipeline.push({
          $lookup: {
            from: value.resource,
            as: path,
            foreignField: '_id',
            localField: path,
            pipeline: this.generateQuery(value.resource, formattedQuery),
          },
        });
      });
      await this.handleError(async () => {
        this.logger.debug('[MongoDatabaseClient][checkForeignIds] Calling MongoDB aggregate with pipeline:');
        this.logger.debug(pipeline);
        const connection = this.databaseConnection.collection('_config');
        const [response] = await connection.aggregate(pipeline).toArray();

        foreignIds.forEach((_, path) => {
          const results = response[path] as Document[];
          for (let index = 0, { length } = results; index < length; index += 1) {
            const row = results[index];
            missingIds.delete(`${String(row._id)}:${String(path)}`);
          }
        });

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
      const connection = this.databaseConnection.collection(resource);
      this.logger.debug(`[MongoDatabaseClient][create] Inserting document in collection "${resource}":`);
      this.logger.debug(newDocuments[resource][0]);
      await connection.insertOne(newDocuments[resource][0]);
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
    const resourceId = new ObjectId(String(id));
    const updatedDocuments = this.structurePayload(resource, id, payload, 'UPDATE');
    const metadata = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    return this.handleError(async () => {
      const [document] = updatedDocuments[resource];
      const connection = this.databaseConnection.collection(resource);
      const filters: Document = { _id: resourceId };
      if (!metadata.schema.enableDeletion) { filters._isDeleted = false; }
      this.logger.debug(`[MongoDatabaseClient][update] Updating document in collection "${resource}":`);
      this.logger.debug(document);
      const response = await connection.updateOne(filters, { $set: document });
      return response.modifiedCount === 1;
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
    const fields = options.fields ?? new Set();
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const filters: Document[] = [{ $match: { _id: new ObjectId(String(id)) } }];
    const metadata = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    if (!metadata.schema.enableDeletion) { (filters[0].$match as Document)._isDeleted = false; }
    const { formattedQuery, projections } = this.parseFields(resource, fields, maximumDepth);
    const pipeline = filters.concat(this.generateQuery(resource, formattedQuery) as Document[]);
    return this.handleError(async () => {
      const connection = this.databaseConnection.collection(resource);
      this.logger.debug(`[MongoDatabaseClient][view] Performing aggregation on collection "${resource}" with pipeline:`);
      this.logger.debug(pipeline);
      const results = await connection.aggregate(pipeline).toArray();
      return this.formatResources(resource, results, projections)[0] ?? null;
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
    const fields = options.fields ?? new Set();
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const metadata = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    const queryMetadata = this.parseFields(resource, fields, maximumDepth, body, sortBy);
    const { projections, formattedQuery } = queryMetadata;
    const pipeline: Document[] = !metadata.schema.enableDeletion
      ? [{ $match: { _isDeleted: false } }]
      : [];
    pipeline.push(...this.generateQuery(resource, formattedQuery) as Document[]);
    pipeline.push({
      $facet: {
        total: [{ $group: { _id: null, total: { $sum: 1 } } }],
        results: [
          { $skip: options.offset ?? this.DEFAULT_OFFSET },
          // `$limit: 0` is forbidden in MongoDB.
          { $limit: Math.max(1, options.limit ?? this.DEFAULT_LIMIT) },
        ],
      },
    });

    return this.handleError(async () => {
      const connection = this.databaseConnection.collection(resource);
      this.logger.debug(`[MongoDatabaseClient][search] Performing aggregation on collection "${resource}" with pipeline:`);
      this.logger.debug(pipeline);
      const [response] = await connection.aggregate(pipeline).toArray();
      return {
        total: (response as { total: { total: number; }[]; }).total[0]?.total ?? 0,
        results: (options.limit === 0)
          ? []
          : this.formatResources(resource, response.results as Document[], projections),
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
    const fields = options.fields ?? new Set();
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const metadata = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    const queryMetadata = this.parseFields(resource, fields, maximumDepth, null, sortBy);
    const { projections, formattedQuery } = queryMetadata;
    const pipeline: Document[] = !metadata.schema.enableDeletion
      ? [{ $match: { _isDeleted: false } }]
      : [];
    pipeline.push(...this.generateQuery(resource, formattedQuery) as Document[]);
    pipeline.push({
      $facet: {
        total: [{ $group: { _id: null, total: { $sum: 1 } } }],
        results: [
          { $skip: options.offset ?? this.DEFAULT_OFFSET },
          // `$limit: 0` is forbidden in MongoDB.
          { $limit: Math.max(1, options.limit ?? this.DEFAULT_LIMIT) },
        ],
      },
    });

    return this.handleError(async () => {
      const connection = this.databaseConnection.collection(resource);
      this.logger.debug(`[MongoDatabaseClient][list] Performing aggregation on collection "${resource}" with pipeline:`);
      this.logger.debug(pipeline);
      const [response] = await connection.aggregate(pipeline).toArray();
      return {
        total: (response as { total: { total: number; }[]; }).total[0]?.total ?? 0,
        results: (options.limit === 0)
          ? []
          : this.formatResources(resource, response.results as Document[], projections),
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
    const resourceId = new ObjectId(String(id));
    return this.handleError(async () => {
      await this.checkReferencesTo(resource, id);
      const connection = this.databaseConnection.collection(resource);
      this.logger.debug(`[MongoDatabaseClient][delete] Deleting document with id ${String(id)} from collection "${resource}"...`);
      const response = await connection.deleteOne({ _id: resourceId });
      return response.deletedCount === 1;
    });
  }
}
