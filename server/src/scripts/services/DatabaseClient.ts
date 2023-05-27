/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Db,
  Document,
  ObjectId,
  MongoClient,
  MongoServerError,
  Binary,
  ClientSession,
} from 'mongodb';
import isNested from 'scripts/common/isNested';
import type Logger from 'scripts/services/Logger';
import type BaseModel from 'scripts/common/Model';
import DatabaseError from 'scripts/errors/Database';
import type CacheClient from 'scripts/services/CacheClient';
import { Id, forEach, type DataModel as DefaultTypes } from '@perseid/core';

// // TODO: statically validate (ts typecheck) schemas
// // https://www.mongodb.com/docs/manual/reference/operator/query/jsonSchema/#mongodb-query-op.-jsonSchema
// // https://www.mongodb.com/docs/manual/reference/bson-types/
// https://www.mongodb.com/docs/manual/core/schema-validation/
// https://www.mongodb.com/docs/manual/reference/operator/query/jsonSchema/#std-label-jsonSchema-keywords

// interface MongoValidationSchema {
//   bsonType: 'object';
//   required: string[];
//   properties: {
//     [name: string]: {
//       bsonType: BSONTypeAlias;
//       enum?: string[];
//     };
//   }
// }

type MigrationCallback = (session: ClientSession) => Promise<void>;
const defaultMigration: MigrationCallback = (): Promise<void> => Promise.resolve();

/**
 * MongoDB database client.
 */
export default class DatabaseClient<
  /** Data model types definitions. */
  Types = DefaultTypes,

  /** Model class types definitions. */
  Model extends BaseModel<Types> = BaseModel<Types>,
> {
  /** Default sorting pipeline. */
  protected readonly DEFAULT_SORTING_PIPELINE: Document[] = [];

  /** Pipeline to use first when fetching results from collections that don't enable deletion. */
  protected readonly DELETION_FILTER_PIPELINE: Document[] = [{ $match: { _isDeleted: false } }];

  /** Used to calculate total number of results for a given query. */
  protected readonly TOTAL_PIPELINE = [{ $group: { _id: null, total: { $sum: 1 } } }];

  /** Default pagination offset value. */
  protected readonly DEFAULT_OFFSET = 0;

  /** Default pagination limit value. */
  protected readonly DEFAULT_LIMIT = 20;

  /** Default query options. */
  protected readonly DEFAULT_QUERY_OPTIONS: CommandOptions = {};

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

  /**
   * Formats `input` to match MongoDB data types specifications.
   *
   * @param input Input to format.
   *
   * @param model Current input data model.
   *
   * @param foreignKeys Optional parameter, use it to also extract foreign keys from input. If this
   * parameter is passed, a list of foreign keys per collection will be generated and stored in that
   * variable. Defaults to `new Map()`.
   *
   * @returns MongoDB-formatted input.
   */
  protected formatInput<Collection extends keyof Types>(
    input: Partial<Types[Collection]>,
    model: FieldDataModel<Types>,
    foreignKeys = new Map(),
  ): Partial<Types[Collection]> | ObjectId | Binary {
    const { type } = model as FieldDataModel<Types>;
    const { fields } = model as ArrayDataModel<Types>;

    // Arrays and dynamic objects...
    const isArray = (type === 'array');
    if (isArray || type === 'dynamicObject') {
      const keys: Document = isArray ? input : Object.keys(input);
      const formattedInput: Document = isArray ? [] : {};
      const patterns = isArray ? [] : Object.keys(fields).map((pattern) => new RegExp(pattern));
      for (let index = 0, { length } = keys; index < length; index += 1) {
        const key = isArray ? index : (patterns.find((p) => p.test(keys[index])) as RegExp).source;
        const actualIndex = isArray ? index : keys[index];
        formattedInput[actualIndex] = this.formatInput(
          (input as Document)[actualIndex],
          isArray ? fields : (model as DynamicObjectDataModel<Types>).fields[key],
          foreignKeys,
        );
      }
      return formattedInput as Partial<Types[Collection]>;
    }

    // Objects...
    if (type === 'object') {
      const keys = Object.keys(input);
      const formattedInput: Document = {};
      for (let index = 0, { length } = keys; index < length; index += 1) {
        formattedInput[keys[index]] = this.formatInput(
          (input as Document)[keys[index]],
          (model as ObjectDataModel<Types>).fields[keys[index]],
          foreignKeys,
        );
      }
      return formattedInput as Partial<Types[Collection]>;
    }

    // Primitive values...
    const { relation } = model as IdDataModel<Types>;
    if (type === 'id' && input !== null) {
      if (relation !== undefined) {
        foreignKeys.set(relation, foreignKeys.get(relation) ?? new Set());
        (foreignKeys.get(relation) as Set<string>).add(`${input}`);
      }
      return new ObjectId(`${input}`);
    }
    if (type === 'binary') {
      const decoder = new TextDecoder();
      return new Binary(decoder.decode(input as unknown as ArrayBuffer));
    }
    return input;
  }

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
  ): Partial<Types[Collection]> | Id | ArrayBuffer | null {
    const { type } = model as FieldDataModel<Types>;
    const { fields } = model as ArrayDataModel<Types>;

    // Null or undefined value...
    if (output === undefined || output === null) {
      return null;
    }

    // Arrays...
    if (type === 'array') {
      const formattedOutput: Document = [];
      for (let index = 0, { length } = output as unknown as string[]; index < length; index += 1) {
        formattedOutput[index] = this.formatOutput((<Document>output)[index], fields, projections);
      }
      return formattedOutput as Partial<Types[Collection]>;
    }

    // (dynamic) Objects...
    if (type === 'object' || type === 'dynamicObject') {
      const formattedOutput: Document = {};
      const keys = Object.keys(projections === 1 ? output : projections);
      const patterns = Object.keys(fields).map((pattern) => new RegExp(pattern));
      for (let index = 0, { length } = keys; index < length; index += 1) {
        const pattern = (patterns.find((p) => p.test(keys[index])) as RegExp).source;
        formattedOutput[keys[index]] = this.formatOutput(
          (output as Document)[keys[index]],
          (model as ObjectDataModel<Types>).fields[pattern],
          projections === 1 ? 1 : (projections as Document)[keys[index]],
        );
      }
      return formattedOutput as Partial<Types[Collection]>;
    }

    // Primitive values...
    if (type === 'id') {
      const { relation } = model as IdDataModel<Types>;
      return (output instanceof ObjectId || relation === undefined)
        ? new Id(`${output}`)
        : this.formatOutput(output, {
          type: 'object',
          fields: this.model.getCollection(relation).fields,
        }, projections) as Partial<Types[Collection]>;
    }
    if (type === 'binary') {
      const { buffer } = output as unknown as Binary;
      const binary = new ArrayBuffer(buffer.length);
      const arrayBuffer = new Uint8Array(binary);
      for (let i = 0; i < buffer.length; i += 1) {
        arrayBuffer[i] = buffer[i];
      }
      return binary;
    }
    return output;
  }

  /**
   * Makes sure that all `foreignKeys` reference existing resources.
   *
   * @param foreignKeys Foreign keys to check in database.
   *
   * @throws If any foreign key does not exist.
   */
  protected async checkForeignKeys(foreignKeys: Map<string, Set<string>>): Promise<void> {
    const relations: string[] = [];
    const foreignKeysPerRelation: Record<string, string[]> = {};
    foreignKeys.forEach((value, key) => {
      if (value.size > 0) {
        relations.push(key);
        foreignKeysPerRelation[key] = [...value];
      }
    });

    this.logger.debug('[DatabaseClient][checkForeignKeys] Foreign keys to analyze:');
    this.logger.debug(foreignKeysPerRelation);

    if (relations.length > 0) {
      // Performing a single aggregate gathering all requested resources is way more efficient
      // than performing one Mongo query per collection.
      const pipeline: Document[] = [
        {
          $limit: 1,
        },
        {
          $project: relations.reduce((fields, relation) => ({
            ...fields,
            [`${relation}Ids`]: foreignKeysPerRelation[relation].map((id) => new ObjectId(id)),
          }), {}),
        },
      ];
      pipeline.push(...relations.map((relation) => ({
        $lookup: {
          from: relation,
          as: relation,
          foreignField: '_id',
          localField: `${relation}Ids`,
          pipeline: [
            // Be careful: `_isDeleted` might not exist in collection.
            { $match: { _isDeleted: { $ne: true } } },
            { $project: { _id: 1 } },
          ],
        },
      })));

      this.logger.debug('[DatabaseClient][checkForeignKeys] Calling MongoDB aggregate with pipeline:');
      this.logger.debug(pipeline);

      const [response] = await this.database.collection('_config').aggregate(pipeline).toArray();

      for (let index = 0, { length } = relations; index < length; index += 1) {
        const relation = relations[index];
        if (response[relation].length < foreignKeysPerRelation[relation].length) {
          const missingResourceId = foreignKeysPerRelation[relation].find((id) => (
            response[relation].find((responseId: Document) => `${responseId._id}` === id) === undefined
          ));
          throw new DatabaseError('NO_RESOURCE', { id: missingResourceId });
        }
      }
    }
  }

  /**
   * Generates MongoDB-flavored projections object, from `path`.
   *
   * @param path Full path in the data model from which to generate projection.
   *
   * @param splittedPath Remaining path to analyze.
   *
   * @param model Current path data model.
   *
   * @param checkIndexing Whether to check that field is indexed. Defaults to `false`.
   *
   * @param projections Current path projections object.
   *
   * @returns MongoDB projections object.
   *
   * @throws If given path is not a valid field in data model.
   *
   * @throws If `checkIndexing` is `true` and given path is not an indexed field in data model.
   */
  protected projectFromPath(
    path: string,
    splittedPath: string[],
    model?: FieldDataModel<Types>,
    checkIndexing = false,
    projections: Document = {},
  ): Document {
    if (model === undefined) {
      throw new DatabaseError('INVALID_FIELD', { path });
    }

    // Primitives...
    if (splittedPath.length === 1) {
      if (checkIndexing && !(model as DateDataModel).unique && !(model as DateDataModel).index) {
        throw new DatabaseError('INVALID_INDEX', { path });
      }
      return 1 as unknown as Document;
    }

    const { type } = model;
    const field = splittedPath[1];
    const subPath = splittedPath.slice(1);

    // Arrays...
    if (type === 'array') {
      const { fields: subModel } = model as ArrayDataModel<Types>;
      return this.projectFromPath(path, splittedPath, subModel, checkIndexing, projections);
    }

    // Dynamic objects...
    if (type === 'dynamicObject') {
      const { fields: subFields } = model as DynamicObjectDataModel<Types>;
      const patterns = Object.keys(subFields).map((pattern) => new RegExp(pattern));
      const subModel = subFields[(patterns.find((p) => p.test(field)) as RegExp).source];
      return {
        ...projections,
        [field]: this.projectFromPath(path, subPath, subModel, checkIndexing, projections[field]),
      };
    }

    // External relations...
    const { relation } = model as IdDataModel<Types>;
    if (type === 'id' && relation !== undefined) {
      const subModel = { type: 'object', fields: this.model.getCollection(relation).fields };
      return {
        ...projections,
        _id: 1,
        [field]: this.projectFromPath(
          path,
          [''].concat(subPath),
          subModel,
          checkIndexing,
          projections[field],
        )[field],
      };
    }

    // Objects...
    const { fields } = model as ObjectDataModel<Types>;
    const subModel = fields?.[field];
    return {
      ...projections,
      [field]: this.projectFromPath(path, subPath, subModel, checkIndexing, projections[field]),
    };
  }

  /**
   * Generates MongoDB-flavored list of fields to project in results, from `fields`.
   *
   * @param fields Fields from which to generate projections object.
   *
   * @param model Root collection data model.
   *
   * @param checkIndexing Whether to check that fields are indexed. Defaults to `false`.
   *
   * @returns MongoDB projections.
   */
  protected generateProjectionsFrom<Collection extends keyof Types>(
    fields: string[],
    model: FieldDataModel<Collection>,
    checkIndexing = false,
  ): Document {
    let projections: Document = {};

    // No matter what, we ALWAYS project the `_id` field.
    const uniqueFields = [...new Set(fields.concat(['_id']))];
    for (let index = 0, { length } = uniqueFields; index < length; index += 1) {
      const path = uniqueFields[index];
      const rootPath = [''].concat(path.split('.'));
      projections = this.projectFromPath(path, rootPath, model, checkIndexing, projections);
    }

    return projections;
  }

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
    path: string[] = [],
    isFlatArray = false,
  ): Document[] {
    if (isNested(projections)) {
      const { type } = model;

      // External relations...
      const { relation } = model as IdDataModel<Types>;
      if (type === 'id' && relation !== undefined) {
        const fullPath = path.join('.');
        const fieldName = path.at(-1) as string;
        const rootPath = path.slice(0, path.length - 1).join('.');
        return ([{
          $lookup: {
            as: isFlatArray ? `__${fullPath}` : fullPath,
            from: relation,
            foreignField: '_id',
            localField: fullPath,
            pipeline: this.generateLookupsPipelineFrom(
              projections,
              { type: 'object', fields: this.model.getCollection(relation).fields },
            ),
          },
        }] as Document[]).concat(isFlatArray
          ? [{
            $addFields: {
              [rootPath]: {
                $map: {
                  input: `$${rootPath}`,
                  in: {
                    $mergeObjects: ['$$this', {
                      [fieldName]: {
                        $arrayElemAt: [
                          `$__${fullPath}`,
                          { $indexOfArray: [`$__${fullPath}._id`, `$$this.${fieldName}`] },
                        ],
                      },
                    }],
                  },
                },
              },
            },
          },
          {
            $project: {
              [`__${path[0]}`]: 0,
            },
          }]
          // As lookups always return arrays, this instruction transforms results to get objects.
          : [{
            $addFields: {
              [fullPath]: { $arrayElemAt: [`$${fullPath}`, 0] },
            },
          }]);
      }

      // Arrays...
      if (type === 'array') {
        const { fields } = model as ArrayDataModel<Types>;
        // "Flat" arrays directly contain primitives, and not nested structures.
        const isFlat = fields.type === 'id';
        const subPipeline = this.generateLookupsPipelineFrom(projections, fields, path, !isFlat);
        // If we are dealing with a "flat" array, we don't want to transform it to an object.
        return subPipeline.slice(0, isFlat ? -1 : undefined);
      }

      // Dynamic objects...
      if (type === 'dynamicObject') {
        const pipeline: Document[] = [];
        const { fields } = model as DynamicObjectDataModel<Types>;
        const patterns = Object.keys(fields).map((pattern) => new RegExp(pattern));
        Object.keys(projections).forEach((fieldName) => {
          const pattern = (patterns.find((p) => p.test(fieldName)) as RegExp).source;
          pipeline.push(...this.generateLookupsPipelineFrom(
            projections[fieldName],
            fields[pattern],
            path.concat([fieldName]),
            isFlatArray,
          ));
        });
        return pipeline;
      }

      // Objects...
      const pipeline: Document[] = [];
      const { fields } = model as ObjectDataModel<Types>;
      Object.keys(projections).forEach((fieldName) => {
        pipeline.push(...this.generateLookupsPipelineFrom(
          projections[fieldName],
          fields[fieldName],
          path.concat([fieldName]),
          isFlatArray,
        ));
      });
      return pipeline;
    }

    return [];
  }

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
  ): Document[] {
    if (sortBy.length !== sortOrder.length) {
      throw new DatabaseError('INVALID_SORTING', { sortBy, sortOrder });
    }
    return (sortBy.length === 0)
      ? this.DEFAULT_SORTING_PIPELINE
      : [{
        $sort: sortBy.reduce((fields, field, index) => ({
          ...fields,
          [field]: sortOrder[index],
        }), {}),
      }];
  }

  /**
   * Generates MongoDB `$skip` and `$limit` pipeline from `offset` and `limit`.
   *
   * @param offset Pagination offset.
   *
   * @param limit Maximum number of results to fetch.
   *
   * @returns Generated pagination pipeline.
   */
  protected generatePaginationPipelineFrom(offset?: number, limit?: number): Document[] {
    return [
      { $skip: offset ?? this.DEFAULT_OFFSET },
      { $limit: limit ?? this.DEFAULT_LIMIT },
    ];
  }

  /**
   * Generates MongoDB search pipeline from `searchBody`.
   *
   * @param collection Collection for which to generate search pipeline.
   *
   * @param query Search query.
   *
   * @param filters Search filters.
   *
   * @returns Generated search pipeline.
   */
  protected generateSearchPipelineFrom<U extends keyof Types>(
    collection: U,
    searchBody: SearchBody,
    filters: SearchFilters | null,
  ): (Document | null)[] {
    // This optimization splits search pipeline in two different stages: a first one on root
    // document's fields (to avoid performing lookups on unecessary documents), and a second one on
    // looked-up fields.
    const firstSearchStage: Document = { $match: { $and: [] } };
    const secondSearchStage: Document = { $match: { $and: [] } };

    // Query fields...
    const queryFields = searchBody.query?.on ?? [];
    const queryText = (<SearchQuery>searchBody.query).text;
    const firstQueryStage: Document = { $or: [] };
    const secondQueryStage: Document = { $or: [] };
    queryFields.forEach((path) => {
      const field = this.model.get(`${collection as string}.${path}`);
      const isRootField = field !== null && field.canonicalPath.split('.')[0] === collection;
      (isRootField ? firstQueryStage : secondQueryStage).$or.push({
        [path]: {
          $regex: new RegExp(queryText.split(/[ \-,.?=*\\/()'"`|+!:;[\]{}]/).map((t) => (
            `(?=.*${t.replace(/[[\]/()]/ig, (match) => `\\${match}`)})`
          )).join(''), 'i'),
        },
      });
    });
    if (firstQueryStage.$or.length > 0) {
      firstSearchStage.$match.$and.push(firstQueryStage);
    }
    if (secondQueryStage.$or.length > 0) {
      secondSearchStage.$match.$and.push(secondQueryStage);
    }

    // Filters fields...
    const filterPaths = Object.keys(filters || {});
    const firstFiltersStage: Document = {};
    const secondFiltersStage: Document = {};
    filterPaths.forEach((path) => {
      const values = (<SearchFilters>filters)[path];
      const condition: Document = {};
      const isArray = Array.isArray(values);
      const field = this.model.get(`${collection as string}.${path}`);
      if (isArray) {
        if (values.length > 1 && values[0] instanceof Date && values[1] instanceof Date) {
          [condition.$gte, condition.$lte] = values;
        } else {
          condition.$in = values.map((value) => ((value instanceof Id) ? new ObjectId(`${value}`) : value));
        }
      } else {
        const value = values;
        if (value instanceof Date) {
          condition.$gte = value;
        } else {
          condition.$eq = (value instanceof Id) ? new ObjectId(`${value}`) : value;
        }
      }
      const isRootField = field !== null && field.canonicalPath.split('.')[0] === collection;
      (isRootField ? firstFiltersStage : secondFiltersStage)[path] = condition;
    });
    if (Object.keys(firstFiltersStage).length > 0) {
      firstSearchStage.$match.$and.push(firstFiltersStage);
    }
    if (Object.keys(secondFiltersStage).length > 0) {
      secondSearchStage.$match.$and.push(secondFiltersStage);
    }

    return [
      (firstSearchStage.$match.$and.length > 0) ? firstSearchStage : null,
      (secondSearchStage.$match.$and.length > 0) ? secondSearchStage : null,
    ];
  }

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
  protected async handleError<T>(callback: () => Promise<T>): Promise<T> {
    if (!this.isConnected) {
      await this.client.connect();
      if (this.database === null) {
        throw new DatabaseError('CONNECTION_FAILED');
      }
      this.isConnected = true;
    }
    try {
      return await callback();
    } catch (error) {
      const mongoError = error as MongoServerError;
      // We don't use `instanceof` here as it would break the logic whenever current project's
      // `mongodb` NPM version differs from `@perseid/server`'s one.
      if (mongoError.constructor.name === 'MongoServerError' && mongoError.code === 11000) {
        const fieldName = Object.keys(mongoError.keyValue)[0];
        throw new DatabaseError('DUPLICATE_RESOURCE', {
          field: fieldName,
          value: mongoError.keyValue[fieldName],
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
    const { host, port, protocol } = settings;
    const { user, password, database } = settings;
    const { maxPoolSize, cacheDuration } = settings;
    this.cache = cache;
    this.model = model;
    this.logger = logger;
    this.isConnected = false;
    this.cacheDuration = cacheDuration;

    // Connection URI.
    const portString = (port !== null) ? `:${port}` : '';
    const parameters = 'retryWrites=true&w=majority';
    const credentials = (user !== null && password !== null) ? `${user}:${password}@` : '';
    const uri = `${protocol}//${credentials}${host}${portString}/${database}?${parameters}`;

    this.client = new MongoClient(uri, { maxPoolSize });
    this.database = this.client.db(`${database}`);
    this.formatOutput = this.formatOutput.bind(this);
    this.formatInput = this.formatInput.bind(this);
  }

  /**
   * Inserts `resource` into `collection`.
   *
   * @param collection Name of the collection to insert resource into.
   *
   * @param resource New resource to insert.
   */
  public async create<Collection extends keyof Types>(
    collection: Collection,
    resource: Types[Collection],
  ): Promise<void> {
    const foreignKeys = new Map();
    const model = { type: 'object', fields: this.model.getCollection(collection).fields };
    const newResource = this.formatInput(resource, model, foreignKeys);
    await this.checkForeignKeys(foreignKeys);

    this.logger.debug(
      `[DatabaseClient][create] Inserting new resource into collection "${String(collection)}":`,
    );
    this.logger.debug(resource);

    await this.handleError(async () => {
      this.database.collection(collection as string).insertOne(newResource);
    });
  }

  /**
   * Updates resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to update resource from.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   */
  public async update<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    payload: Partial<Types[Collection]>,
  ): Promise<void> {
    const foreignKeys = new Map();
    const { fields, enableDeletion } = this.model.getCollection(collection);
    const filter = enableDeletion
      ? { _id: new ObjectId(`${id}`) }
      : { ...this.DELETION_FILTER_PIPELINE[0].$match, _id: new ObjectId(`${id}`) };
    const model = { type: 'object', fields };
    const updates = this.formatInput(payload, model, foreignKeys);
    await this.checkForeignKeys(foreignKeys);

    this.logger.debug(
      `[DatabaseClient][update] Updating resource "${id}" in collection "${String(collection)}":`,
    );
    this.logger.debug(payload);

    await this.handleError(async () => {
      await this.database.collection(collection as string).updateOne(filter, { $set: updates });
    });
  }

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
  public async exclusiveUpdate<Collection extends keyof Types>(
    collection: Collection,
    filters: SearchFilters,
    payload: Partial<Types[Collection]>,
  ): Promise<boolean> {
    const foreignKeys = new Map();
    const { enableDeletion, fields } = this.model.getCollection(collection);
    const model = { type: 'object', fields };
    const updates = this.formatInput(payload, model, foreignKeys);
    await this.checkForeignKeys(foreignKeys);

    this.logger.debug(
      `[DatabaseClient][exclusiveUpdate] Updating resources in collection "${String(collection)}":`,
    );
    this.logger.debug(filters);
    this.logger.debug(payload);

    return this.handleError(async () => {
      const formattedFilters = enableDeletion
        ? filters
        : { ...this.DELETION_FILTER_PIPELINE[0].$match, ...filters };
      const response = await this.database.collection(collection as string).findOneAndUpdate(
        this.formatInput(formattedFilters, model),
        { $set: updates },
        { projection: { _id: 1 } },
      );
      return response.value !== null;
    });
  }

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
  public async view<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    options = this.DEFAULT_QUERY_OPTIONS,
  ): Promise<Types[Collection] | null> {
    const requestedFields = options.fields ?? [];
    const { fields, enableDeletion } = this.model.getCollection(collection);
    const fieldDataModel = { type: 'object', fields };
    const projections = this.generateProjectionsFrom(requestedFields, fieldDataModel);
    const lookupPipeline = this.generateLookupsPipelineFrom(projections, fieldDataModel);

    const resultsPipeline = (enableDeletion
      ? [{ $match: { _id: new ObjectId(`${id}`) } }]
      : [{ $match: { ...this.DELETION_FILTER_PIPELINE[0].$match, _id: new ObjectId(`${id}`) } }] as Document[])
      .concat(lookupPipeline)
      .concat({ $project: projections });

    this.logger.debug(
      '[DatabaseClient][view] Calling MongoDB aggregate method on collection '
      + `"${String(collection)}" with pipeline:`,
    );
    this.logger.debug(resultsPipeline);

    return this.handleError(async () => {
      const databaseCollection = this.database.collection(collection as string);
      const response = await databaseCollection.aggregate(resultsPipeline).toArray();
      const result = (response[0] ?? null) as unknown as Partial<Types[Collection]>;
      return this.formatOutput(result, fieldDataModel, projections) as Types[Collection];
    });
  }

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
  // public async search<U extends keyof Types>(
  //   collection: U,
  //   body: SearchBody,
  //   options = this.DEFAULT_QUERY_OPTIONS,
  // ): Promise<Results<T[U]>> {
  //   await this.handleConnection();
  //   const query = body.query ?? null;
  //   const filters = body.filters ?? null;
  //   const requestedFields = options.fields ?? [];
  //   const allFields = requestedFields.concat(query?.on ?? []).concat(Object.keys(filters ?? {}));
  //   const { fields, enableDeletion } = (<any>(this.model.get())).collections[collection];
  //   const resultsPipeline: any[] = (enableDeletion !== false)
  //     ? []
  //     : [{ $match: { _isDeleted: false } }];
  //   const searchProjections = this.generateProjectionsFrom(collection, allFields);
  //   // TODO change allFields. This patch is a temporary solution to prevent returning the whole
  //   // relation object whenever we query/filter on one of its fields (e.g. filtering on
  //   // _createdBy.email will return the whole user object when we pass fields=* or
  // fields=createdBy)
  //   // because project: 1 will return the whole object in mongo and if this object has
  // been looked
  //   // up then we're fucked.
  //   const projections = this.generateProjectionsFrom(collection, allFields);
  //   const lookupPipeline = this.generateLookupsPipeline(fields, searchProjections);
  //   const searchPipeline = this.generateSearchPipeline(collection, query, filters);
  //   const sortingPipeline = this.generateSortingPipeline(options.sortBy, options.sortOrder);
  //   const paginationPipeline = this.generatePaginationPipeline(options.offset, options.limit);

  //   // First search stage...
  //   if (searchPipeline[0] !== null) {
  //     resultsPipeline.push(searchPipeline[0]);
  //   }
  //   // Lookup stages...
  //   if (lookupPipeline.length > 0) {
  //     resultsPipeline.push(...lookupPipeline);
  //   }
  //   // Second search stage...
  //   if (searchPipeline[1] !== null) {
  //     resultsPipeline.push(searchPipeline[1]);
  //   }
  //   // Sorting stages...
  //   if (sortingPipeline.length > 0) {
  //     resultsPipeline.push(...sortingPipeline);
  //   }
  //   // Projection stage...
  //   resultsPipeline.push({ $project: projections });
  //   resultsPipeline.push({ $project: { _isDeleted: 0 } });
  //   // Pagination stage...
  //   resultsPipeline.push({
  //     $facet: {
  //       total: this.totalPipeline,
  //       results: paginationPipeline,
  //     },
  //   });

  //   const databaseCollection = this.database.collection(collection as string);

  //   const [response] = await databaseCollection.aggregate(resultsPipeline).toArray();

  //   return {
  //     total: response.total[0]?.total ?? 0,
  //     results: response.results.map((result: Document) =>
  // this.formatOutput(collection, result, projections)) as T[U][],
  //   };
  // }

  /**
   * Fetches a paginated list of resources from `collection`.
   *
   * @param collection Name of the collection from which to fetch resources.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public async list<Collection extends keyof Types>(
    collection: Collection,
    options = this.DEFAULT_QUERY_OPTIONS,
  ): Promise<Results<Types[Collection]>> {
    const sortBy = options.sortBy ?? [];
    const sortOrder = options.sortOrder ?? [];
    const requestedFields = options.fields ?? [];
    const { fields, enableDeletion } = this.model.getCollection(collection);
    const fieldDataModel = { type: 'object', fields };
    // We make sure that sorting fields exist in data model...
    this.generateProjectionsFrom(sortBy, fieldDataModel, true);
    const sortingPipeline = this.generateSortingPipelineFrom(sortBy, sortOrder);
    const projections = this.generateProjectionsFrom(requestedFields, fieldDataModel);
    const lookupPipeline = this.generateLookupsPipelineFrom(projections, fieldDataModel);
    const paginationPipeline = this.generatePaginationPipelineFrom(options.offset, options.limit);

    const resultsPipeline = (enableDeletion ? [] : this.DELETION_FILTER_PIPELINE)
      .concat(lookupPipeline)
      .concat(sortingPipeline)
      .concat({ $project: projections })
      .concat([{
        $facet: {
          total: this.TOTAL_PIPELINE,
          results: paginationPipeline,
        },
      }]);

    this.logger.debug(
      '[DatabaseClient][list] Calling MongoDB aggregate method on collection '
      + `"${String(collection)}" with pipeline:`,
    );
    this.logger.debug(resultsPipeline);

    return this.handleError(async () => {
      const databaseCollection = this.database.collection(collection as string);
      const [response] = await databaseCollection.aggregate(resultsPipeline).toArray();
      return {
        total: response.total[0]?.total ?? 0,
        results: response.results.map((result: Partial<Types[Collection]>) => (
          this.formatOutput(result, fieldDataModel, projections)
        )),
      };
    });
  }

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
  public async delete<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    payload: Partial<Types[Collection]> = {},
  ): Promise<boolean> {
    const { fields, enableDeletion } = this.model.getCollection(collection);
    const model = { type: 'object', fields };
    const resourceId = new ObjectId(`${id}`);

    return this.handleError(async () => {
      if (enableDeletion !== false) {
        this.logger.debug(
          `[DatabaseClient][delete] Deleting resource "${id}" from collection "${String(collection)}"...`,
        );

        const response = await this.database.collection(collection as string).deleteOne({
          _id: resourceId,
        });
        return response.deletedCount === 1;
      }

      const fullPayload = { _isDeleted: true, ...this.formatInput(payload, model) };
      this.logger.debug(
        `[DatabaseClient][delete] Updating resource "${id}" in collection "${String(collection)}":`,
      );
      this.logger.debug(fullPayload);

      const response = await this.database.collection(collection as string).updateOne({
        _id: resourceId,
        ...this.DELETION_FILTER_PIPELINE[0].$match,
      }, { $set: fullPayload });
      return response.matchedCount === 1;
    });
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
  protected formatters: Record<string, (
    field: any,
  ) => any> = {
      null() {
        return { bsonType: 'null' };
      },
      string(field) {
        const formattedField: any = { bsonType: ['string'] };
        const {
          pattern,
          maxLength,
          minLength,
          enum: enumerations,
        } = <any>field;
        if (maxLength !== undefined) {
          formattedField.maxLength = maxLength;
        }
        if (minLength !== undefined) {
          formattedField.minLength = minLength;
        }
        if (pattern !== undefined) {
          formattedField.pattern = pattern;
        }
        if (enumerations !== undefined) {
          formattedField.enum = [...enumerations];
        }
        if (!field.required) {
          formattedField.bsonType.push('null');
          if (formattedField.enum !== undefined) {
            formattedField.enum.push(null);
          }
        }
        return formattedField;
      },
      boolean(field) {
        const formattedField: any = { bsonType: ['bool'] };
        if (!field.required) {
          formattedField.bsonType.push('null');
        }
        return formattedField;
      },
      date(field) {
        const formattedField: any = { bsonType: ['date'] };
        const {
          enum: enumerations,
        } = (<any>field);
        if (enumerations !== undefined) {
          formattedField.enum = [...enumerations];
        }
        if (!field.required) {
          formattedField.bsonType.push('null');
          if (formattedField.enum !== undefined) {
            formattedField.enum.push(null);
          }
        }
        return formattedField;
      },
      id(field) {
        const {
          enum: enumerations,
        } = <any>field;
        const formattedField: any = { bsonType: ['objectId'] };
        if (enumerations !== undefined) {
          formattedField.enum = [...enumerations];
        }
        if (!field.required) {
          formattedField.bsonType.push('null');
          if (formattedField.enum !== undefined) {
            formattedField.enum.push(null);
          }
        }
        return formattedField;
      },
      binary(field) {
        const formattedField: any = { bsonType: ['binData'] };
        if (!field.required) {
          formattedField.bsonType.push('null');
        }
        return formattedField;
      },
      integer(field) {
        const formattedField: any = { bsonType: ['int'] };
        const {
          minimum,
          maximum,
          multipleOf,
          exclusiveMinimum,
          exclusiveMaximum,
          enum: enumerations,
        } = <any>field;
        if (minimum !== undefined) {
          formattedField.minimum = minimum;
        }
        if (maximum !== undefined) {
          formattedField.maximum = maximum;
        }
        if (exclusiveMinimum !== undefined) {
          formattedField.exclusiveMinimum = true;
          formattedField.minimum = exclusiveMinimum;
        }
        if (exclusiveMaximum !== undefined) {
          formattedField.exclusiveMaximum = true;
          formattedField.maximum = exclusiveMaximum;
        }
        if (multipleOf !== undefined) {
          formattedField.multipleOf = multipleOf;
        }
        if (enumerations !== undefined) {
          formattedField.enum = [...enumerations];
        }
        if (!field.required) {
          formattedField.bsonType.push('null');
          if (formattedField.enum !== undefined) {
            formattedField.enum.push(null);
          }
        }
        return formattedField;
      },
      float: (field) => {
        const formattedField: any = { bsonType: ['int', 'double'] };
        const {
          minimum,
          maximum,
          multipleOf,
          exclusiveMinimum,
          exclusiveMaximum,
          enum: enumerations,
        } = <any>field;
        if (minimum !== undefined) {
          formattedField.minimum = minimum;
        }
        if (maximum !== undefined) {
          formattedField.maximum = maximum;
        }
        if (exclusiveMinimum !== undefined) {
          formattedField.exclusiveMinimum = true;
          formattedField.minimum = exclusiveMinimum;
        }
        if (exclusiveMaximum !== undefined) {
          formattedField.exclusiveMaximum = true;
          formattedField.maximum = exclusiveMaximum;
        }
        if (multipleOf !== undefined) {
          formattedField.multipleOf = multipleOf;
        }
        if (enumerations !== undefined) {
          formattedField.enum = [...enumerations];
        }
        if (!field.required) {
          formattedField.bsonType.push('null');
          if (formattedField.enum !== undefined) {
            formattedField.enum.push(null);
          }
        }
        return formattedField;
      },
      object: (field) => {
        const formattedField: any = { bsonType: ['object'], additionalProperties: false };
        const {
          fields,
        } = <any>field;
        if (!field.required) {
          formattedField.bsonType.push('null');
        }
        formattedField.required = Object.keys(fields);
        formattedField.properties = this.createSchema(
          fields,
          (schema) => schema,
          false,
        );
        return formattedField;
      },
      dynamicObject: (field) => {
        const formattedField: any = { bsonType: ['object'], additionalProperties: false };
        const {
          fields,
          minProperties,
          maxProperties,
        } = <any>field;
        if (minProperties !== undefined) {
          formattedField.minProperties = minProperties;
        }
        if (maxProperties !== undefined) {
          formattedField.maxProperties = maxProperties;
        }
        if (!field.required) {
          formattedField.bsonType.push('null');
        }
        formattedField.patternProperties = this.createSchema(
          fields,
          (schema) => schema,
          false,
        );
        return formattedField;
      },
      array: (field) => {
        const {
          fields,
          maxItems,
          minItems,
          uniqueItems,
        } = <any>field;
        const formattedField: any = {
          bsonType: ['array'],
          items: this.createSchema({ items: fields }, (schema) => schema, false).items,
        };
        if (minItems !== undefined) {
          formattedField.minItems = minItems;
        }
        if (maxItems !== undefined) {
          formattedField.maxItems = maxItems;
        }
        if (uniqueItems !== undefined) {
          formattedField.uniqueItems = [...uniqueItems];
        }
        if (!field.required) {
          formattedField.bsonType.push('null');
        }
        return formattedField;
      },
    };

  public createSchema(
    fields: any,
    transformer: (schema: any) => any = (schema): any => schema,
    isRoot = true,
  ): any {
    const properties = Object.keys(fields).reduce((schema, fieldName) => {
      const field = ((<any>(this.model.get())).types[fields[fieldName].type] === undefined)
        ? fields[fieldName]
        : {
          ...fields[fieldName],
          ...(<any>(this.model.get())).types[fields[fieldName].type],
        };
      const format = this.formatters[field.type] || this.formatters.null;

      // Classic field...
      return {
        ...schema,
        [fieldName]: format(field),
      };
    }, {});
    return isRoot ? transformer({
      $jsonSchema: {
        bsonType: 'object',
        required: Object.keys(fields),
        additionalProperties: false,
        properties,
      },
    })
      : properties;
  }

  /**
   * Drops entire database`.
   */
  public async dropDatabase(): Promise<void> {
    await this.client.connect();
    await this.client.db(this.database.databaseName).dropDatabase();
    this.isConnected = false;
  }

  /**
   * Creates database.
   */
  public async createDatabase(): Promise<void> {
    this.isConnected = false;
    this.database = this.client.db(this.database.databaseName);
  }

  /**
   * Creates collection with name `name`.
   *
   * @param collection Name of the collection to create.
   */
  public async resetCollection<U extends keyof T>(collection: U): Promise<void> {
    const collectionName = collection as string;
    if ((<any>(this.model.get())).collections[collectionName] === undefined) {
      throw new DatabaseError('NO_COLLECTION', { collection: collectionName });
    }
    await this.handleConnection();
    const collectionExists = (await this.database
      .listCollections({ name: collectionName }).toArray()).length > 0;
    if (collectionExists) {
      await this.database.dropCollection(collectionName);
    }
    await this.database.createCollection(collectionName, {
      validator: this.createSchema((<any>(this.model.get())).collections[collectionName].fields),
    });
    await this.database.collection(collectionName)
      .createIndexes(this.getCollectionIndexedFields(collectionName));
  }

  /**
   * Performs a validation schema update and a data migration on collection with name `name`.
   *
   * @param collection Name of the collection to update.
   */
  public async updateCollection<U extends keyof T>(
    collection: U,
    migration = defaultMigration,
  ): Promise<void> {
    const collectionName = collection as string;
    if ((<any>(this.model.get())).collections[collectionName] === undefined) {
      throw new DatabaseError('NO_COLLECTION', { collection });
    }
    await this.handleConnection();
    const collectionExists = (await this.database
      .listCollections({ name: collectionName }).toArray()).length > 0;
    if (!collectionExists) {
      throw new DatabaseError('NO_COLLECTION', { collection });
    }
    const session = await this.client.startSession();
    await this.database.command({
      collMod: collectionName,
      validator: this.createSchema((<any>(this.model.get())).collections[collectionName].fields),
      validationLevel: 'strict',
    }, { session });
    await this.database.collection(collectionName).dropIndexes({ session });
    await migration(session as any);
    await this.database.collection(collectionName)
      .createIndexes(this.getCollectionIndexedFields(collectionName));
    await session.endSession();
    const invalidDocuments = await this.database.collection(collectionName).find({
      $nor: [this.createSchema((<any>(this.model.get())).collections[collectionName].fields)],
    }, { limit: 1 }).toArray();
    if (invalidDocuments.length > 0) {
      await this.database.collection(collectionName).insertOne(invalidDocuments[0]);
    }
  }

  /**
   * Returns all indexed fields for `collection`.
   *
   * @param collection Name of the collection for which to get indexes.
   *
   * @returns Collection's indexed fields.
   */
  protected getCollectionIndexedFields(collection: string, path?: string, field?: any): any {
    // TODO handle inferred fields
    if (field === undefined) {
      const { fields } = (<any>(this.model.get())).collections[collection];
      return Object.keys(fields).reduce((indexedFields, fieldName) => indexedFields.concat(
        this.getCollectionIndexedFields(collection, fieldName, fields[fieldName]),
      ), []);
    }

    const { fields, patternProperties } = field;
    if (field.type === 'object' && fields) {
      return Object.keys(fields).reduce((indexedFields, fieldName) => indexedFields.concat(
        this.getCollectionIndexedFields(collection, `${path}.${fieldName}`, fields[fieldName]),
      ), []);
    }

    if (field.type === 'object' && patternProperties) {
      // TODO
      // https://www.mongodb.com/docs/manual/core/index-wildcard/
      return [];
    }

    const indexedFields: any[] = [];
    if (field.unique) {
      indexedFields.push({ key: { [path as string]: 1 }, unique: true });
    } else if (field.index) {
      indexedFields.push({ key: { [path as string]: 1 } });
    }

    if (field.type === 'array') {
      return indexedFields.concat(this.getCollectionIndexedFields(collection, path, fields));
    }

    return indexedFields;
  }

  /**
   * Drops `collection` from database.
   *
   * @param collection Name of the collection to drop from database.
   */
  public async dropCollection(collection: string): Promise<void> {
    await this.database.dropCollection(collection);
  }

  /**
   * Resets the whole underlying database, re-creating collections, indexes, and such.
   */
  public async reset(): Promise<void> {
    await this.handleConnection();
    this.logger.info('[DatabaseClient][reset] Dropping database...');
    await this.dropDatabase();
    this.logger.info('[DatabaseClient][reset] Re-creating database...');
    await this.createDatabase();
    this.logger.info('[DatabaseClient][reset] Initializing collections...');
    await forEach(Object.keys((this.model.get() as any).collections), async (collection) => {
      await this.resetCollection(collection as keyof T);
    });
    await this.database.createCollection('_config', {
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
    await this.database.collection('_config').insertOne({});
    this.logger.info('[DatabaseClient][reset] Creating root user...');
    const collectionModel = this.model.getCollection('users' as keyof T);
    const now = new Date();
    const rootUserId = new ObjectId();
    await this.database.collection('users').insertOne({
      _id: rootUserId,
      _version: collectionModel?.version,
      _createdBy: rootUserId,
      _updatedBy: null,
      _createdAt: now,
      _updatedAt: null,
      _isDeleted: false,
      _apiKeys: [],
      _devices: {},
      _verifiedAt: now,
      email: 'root@root.io',
      password: 'Root123456!',
      roles: [],
    });
  }
}
