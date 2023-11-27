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
  type ClientSession,
  type MongoServerError,
} from 'mongodb';
import {
  Id,
  forEach,
  type Results,
  type IdSchema,
  type DateSchema,
  type FieldSchema,
  type ArraySchema,
  type NumberSchema,
  type StringSchema,
  type ObjectSchema,
  type DefaultDataModel,
  type CollectionSchema,
  type DataModelMetadata,
} from '@perseid/core';
import { isPlainObject } from 'basx';
import type Logger from 'scripts/services/Logger';
import type BaseModel from 'scripts/services/Model';
import DatabaseError from 'scripts/errors/Database';
import type CacheClient from 'scripts/services/CacheClient';

type RelationsPerCollection<DataModel> = Record<keyof DataModel, Map<string, string[]>>;

/** Mongo index. */
export interface Index {
  unique?: boolean;
  key: Record<string, 1>;
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
  properties?: Record<string, MongoValidationSchema>;
  patternProperties?: Record<string, MongoValidationSchema>;
}

/** Perseid schema to Mongo validation schema formatters. */
export type MongoFormatters<DataModel> = Record<string, (schema: FieldSchema<DataModel>) => (
  MongoValidationSchema
)>;

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

const defaultMigration: MigrationCallback = (): Promise<void> => Promise.resolve();

/**
 * MongoDB database client.
 */
export default class DatabaseClient<
  /** Data model types definitions. */
  DataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
> {
  /** Default sorting pipeline. */
  protected readonly DEFAULT_SORTING_PIPELINE: Document[] = [];

  /** Pattern used to split full-text search queries into separate tokens. */
  protected readonly SPLITTING_TOKENS = /[ \-,.?=*\\/()'"`|+!:;[\]{}]/;

  /** Pipeline to use first when fetching results from collections that don't enable deletion. */
  protected readonly DELETION_FILTER_PIPELINE: Document[] = [{ $match: { _isDeleted: false } }];

  /** Used to calculate total number of results for a given query. */
  protected readonly TOTAL_PIPELINE = [{ $group: { _id: null, total: { $sum: 1 } } }];

  /** Default pagination offset value. */
  protected readonly DEFAULT_OFFSET = 0;

  /** Default pagination limit value. */
  protected readonly DEFAULT_LIMIT = 20;

  /** Default maximum level of resources depth. */
  protected readonly DEFAULT_MAXIMUM_DEPTH = 3;

  /** Default query options. */
  protected readonly DEFAULT_QUERY_OPTIONS: CommandOptions = {};

  /** List of formatters, used to format a perseid data model into its MongoDB equivalent. */
  protected readonly FORMATTERS: MongoFormatters<DataModel> = {
    null() {
      return { bsonType: ['null'] };
    },
    id(schema) {
      const { enum: enumerations } = schema as IdSchema<DataModel>;
      const formattedField: MongoValidationSchema = { bsonType: ['objectId'] };
      if (enumerations !== undefined) {
        formattedField.enum = enumerations.map((id) => String(id));
      }
      if (!schema.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    binary(schema) {
      const formattedField: MongoValidationSchema = { bsonType: ['binData'] };
      if (!schema.required) {
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    boolean(schema) {
      const formattedField: MongoValidationSchema = { bsonType: ['bool'] };
      if (!schema.required) {
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    date(schema) {
      const formattedField: MongoValidationSchema = { bsonType: ['date'] };
      const { enum: enumerations } = schema as DateSchema;
      if (enumerations !== undefined) {
        formattedField.enum = enumerations.map((date) => date.toISOString());
      }
      if (!schema.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    float(schema) {
      const formattedField: MongoValidationSchema = { bsonType: ['int', 'double'] };
      const {
        minimum,
        maximum,
        multipleOf,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
      } = schema as NumberSchema;
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
      if (!schema.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    integer(schema) {
      const formattedField: MongoValidationSchema = { bsonType: ['int'] };
      const {
        minimum,
        maximum,
        multipleOf,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
      } = schema as NumberSchema;
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
      if (!schema.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    string(schema) {
      const formattedField: MongoValidationSchema = { bsonType: ['string'] };
      const {
        pattern,
        maxLength,
        minLength,
        enum: enumerations,
      } = schema as StringSchema;
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
      if (!schema.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    object: (schema) => {
      const formattedField: MongoValidationSchema = {
        bsonType: ['object'],
        additionalProperties: false,
      };
      const { fields } = schema as ObjectSchema<DataModel>;
      if (!schema.required) {
        formattedField.bsonType.push('null');
      }
      formattedField.required = Object.keys(fields);
      formattedField.properties = formattedField.required.reduce((properties, key) => ({
        ...properties,
        [key]: this.FORMATTERS[fields[key].type](fields[key]),
      }), {});
      return formattedField;
    },
    array: (schema) => {
      const {
        fields,
        maxItems,
        minItems,
        uniqueItems,
      } = schema as ArraySchema<DataModel>;
      const formattedField: MongoValidationSchema = {
        bsonType: ['array'],
        items: this.FORMATTERS[fields.type](fields),
      };
      if (minItems !== undefined) {
        formattedField.minItems = minItems;
      }
      if (maxItems !== undefined) {
        formattedField.maxItems = maxItems;
      }
      if (uniqueItems !== undefined) {
        formattedField.uniqueItems = uniqueItems;
      }
      if (!schema.required) {
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
  };

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
  protected relationsPerCollection: RelationsPerCollection<DataModel>;

  /** List of fields in data model referencing each collection, grouped by this collection. */
  protected invertedRelationsPerCollection: RelationsPerCollection<DataModel>;

  /**
   * Formats `input` to match MongoDB data types specifications.
   *
   * @param input Input to format.
   *
   * @returns MongoDB-formatted input.
   */
  protected formatInput<Collection extends keyof DataModel>(
    input: Partial<DataModel[Collection]>,
  ): Document {
    if (Array.isArray(input)) {
      const formattedInput: Document[] = [];
      for (let index = 0, { length } = input; index < length; index += 1) {
        formattedInput.push(this.formatInput(input[index] as Partial<DataModel[keyof DataModel]>));
      }
      return formattedInput;
    }

    if (isPlainObject(input)) {
      const keys = Object.keys(input);
      const formattedInput: Document = {};
      for (let index = 0, { length } = keys; index < length; index += 1) {
        const key = keys[index];
        const subInput = (input as Record<string, Partial<DataModel[keyof DataModel]>>)[key];
        formattedInput[key] = this.formatInput(subInput);
      }
      return formattedInput;
    }

    if (input instanceof Id) {
      return new ObjectId(String(input));
    }

    if (input instanceof ArrayBuffer) {
      return new Binary(new Uint8Array(input));
    }

    return input;
  }

  /**
   * Formats `payload` for MongoDB update.
   *
   * @param payload Payload to format.
   *
   * @returns MongoDB-formatted payload.
   */
  protected formatPayload<Collection extends keyof DataModel>(
    payload: Partial<DataModel[Collection]>,
  ): Document {
    if (payload instanceof Id) {
      return new ObjectId(String(payload));
    }
    if (payload instanceof ArrayBuffer) {
      return new Binary(new Uint8Array(payload));
    }
    if (Array.isArray(payload)) {
      return payload.map(this.formatPayload.bind(this));
    }
    if (isPlainObject(payload)) {
      const formattedPayload: Document = {};
      const keys = Object.keys(payload) as (keyof Partial<DataModel[Collection]>)[];
      for (let index = 0, { length } = keys; index < length; index += 1) {
        const subPayload = payload[keys[index]] as Partial<DataModel[Collection]>;
        formattedPayload[keys[index] as string] = this.formatPayload(subPayload);
      }
      return formattedPayload;
    }
    return payload;
  }

  /**
   * Formats `output` to match database-independent data types specifications.
   *
   * @param output Output to format.
   *
   * @param projections List of current output fields to return.
   *
   * @returns Formatted output.
   */
  protected formatOutput<Collection extends keyof DataModel>(
    output: Document,
    projections: Document | 1,
  ): Partial<DataModel[Collection]> {
    if (Array.isArray(output)) {
      const formattedOutput: Document = [];
      for (let index = 0, { length } = output as unknown as string[]; index < length; index += 1) {
        formattedOutput[index] = this.formatOutput(output[index] as Document, projections);
      }
      return formattedOutput as Partial<DataModel[Collection]>;
    }

    if (isPlainObject(output)) {
      const formattedOutput: Document = {};
      const keys = Object.keys(projections === 1 ? output : projections);
      for (let index = 0, { length } = keys; index < length; index += 1) {
        formattedOutput[keys[index]] = this.formatOutput(
          output[keys[index]] as Document,
          projections === 1 ? 1 : projections[keys[index]] as Document,
        );
      }
      return formattedOutput as Partial<DataModel[Collection]>;
    }

    if (output instanceof ObjectId) {
      return new Id(String(output)) as unknown as Partial<DataModel[Collection]>;
    }

    if (output instanceof Binary) {
      const { buffer } = output;
      const binary = new ArrayBuffer(buffer.length);
      const arrayBuffer = new Uint8Array(binary);
      for (let i = 0; i < buffer.length; i += 1) {
        arrayBuffer[i] = buffer[i];
      }
      return binary as unknown as Partial<DataModel[Collection]>;
    }

    return (output as unknown ?? null) as Partial<DataModel[Collection]>;
  }

  /**
   * Makes sure that no collection references resource with id `id` from `collection`.
   *
   * @param collection Name of the collection the resource belongs to.
   *
   * @param id Id of the resource to check for references.
   *
   * @throws If any collection still references resource.
   */
  protected async checkReferencesTo(collection: keyof DataModel, id: Id): Promise<void> {
    const referencesToResource = this.invertedRelationsPerCollection[collection];

    this.logger.debug(
      `[DatabaseClient][checkReferencesTo] Checking references to ${String(id)} in ${String(collection)}...`,
    );

    if (referencesToResource.size > 0) {
      // Performing a single aggregate gathering all requested resources is way more efficient
      // than performing one Mongo query per collection.
      const pipeline: Document[] = [
        { $limit: 1 },
        { $project: { _id: new ObjectId(String(id)) } },
      ];
      pipeline.push(...[...referencesToResource.keys()].reduce<Document[]>((lookups, relation) => {
        const relationReferences = referencesToResource.get(relation) as unknown as string[];
        return lookups.concat([...relationReferences.values()].map((path) => ({
          $lookup: {
            from: relation,
            as: `${relation}__${path}`,
            foreignField: path,
            localField: '_id',
            pipeline: [{ $project: { _id: 1 } }],
          },
        })));
      }, []));

      this.logger.debug('[DatabaseClient][checkReferencesTo] Calling MongoDB aggregate with pipeline:');
      this.logger.debug(pipeline);

      const [response] = await this.database.collection('_config')
        .aggregate<Record<string, Document[]>>(pipeline)
        .toArray();

      const keys = Object.keys(response);
      for (let index = 0, { length } = keys; index < length; index += 1) {
        const path = keys[index];
        if (path !== '_id' && response[path].length > 0) {
          throw new DatabaseError('RESOURCE_REFERENCED', { collection: path.split('__')[0] });
        }
      }
    }
  }

  /**
   * Returns all indexed fields for `schema`.
   *
   * @param schema Current data model schema for which to get indexes.
   *
   * @returns Collection's indexed fields.
   */
  protected getCollectionIndexedFields(
    schema: FieldSchema<DataModel>,
    path: string[] = [],
  ): Index[] {
    if (schema.type === 'object') {
      const { fields } = schema;
      return Object.keys(fields).reduce<Index[]>((indexedFields, fieldName) => indexedFields.concat(
        this.getCollectionIndexedFields(fields[fieldName], path.concat([fieldName])),
      ), []);
    }
    if (schema.type === 'array') {
      const { fields } = schema;
      return this.getCollectionIndexedFields(fields, path);
    }

    const indexedFields: Index[] = [];
    if ((schema as StringSchema).unique) {
      indexedFields.push({ key: { [path.join('.')]: 1 }, unique: true });
    } else if ((schema as StringSchema).index) {
      indexedFields.push({ key: { [path.join('.')]: 1 } });
    }
    return indexedFields;
  }

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
    schema: FieldSchema<DataModel>,
    relations: Map<string, string[]>,
    path: string[] = [],
  ): void {
    const { type } = schema;
    if (type === 'array') {
      this.scanRelationsFrom(schema.fields, relations, path);
    } else if (type === 'object') {
      const keys = Object.keys(schema.fields);
      for (let index = 0, { length } = keys; index < length; index += 1) {
        this.scanRelationsFrom(schema.fields[keys[index]], relations, path.concat([keys[index]]));
      }
    } else if (type === 'id' && schema.relation !== undefined) {
      const existingRelations = relations.get(String(schema.relation)) ?? [];
      relations.set(String(schema.relation), existingRelations.concat([path.join('.')]));
    }
  }

  /**
   * Creates a Mongo validation schema from `schema`.
   *
   * @param schema Model from which to create validation schema.
   *
   * @returns Mongo validation schema.
   */
  protected createSchema(schema: ObjectSchema<DataModel>): { $jsonSchema: MongoValidationSchema; } {
    return { $jsonSchema: this.FORMATTERS.object(schema) };
  }

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
   * @param schema Current path data model schema.
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
    schema?: FieldSchema<DataModel>,
    projections: Document = {},
    currentDepth = 1,
  ): Document {
    if (schema === undefined) {
      throw new DatabaseError('INVALID_FIELD', { path });
    }
    if (currentDepth > maximumDepth) {
      throw new DatabaseError('MAXIMUM_DEPTH_EXCEEDED', { path });
    }

    // Primitives...
    const { type } = schema;
    if (splittedPath.length === 1) {
      const actualModel = ((type === 'array') ? schema.fields : schema) as DateSchema;
      if (checkIndexing && !actualModel.unique && !actualModel.index) {
        throw new DatabaseError('INVALID_INDEX', { path });
      }
      return Object.keys(projections).length === 0 ? 1 as unknown as Document : projections;
    }

    const field = splittedPath[1];
    const subPath = splittedPath.slice(1);

    // Arrays...
    if (type === 'array') {
      const { fields: subModel } = schema;
      return this.projectFromPath(
        path,
        maximumDepth,
        checkIndexing,
        splittedPath,
        subModel,
        projections,
        currentDepth,
      );
    }

    // External relations...
    const { relation } = schema as IdSchema<DataModel>;
    if (type === 'id' && relation !== undefined) {
      const metaData = this.model.get(relation) as DataModelMetadata<CollectionSchema<DataModel>>;
      const subModel: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
      const subFields = subPath[0] === '*' ? Object.keys(subModel.fields) : [String(subPath.at(-1))];
      return {
        ...projections,
        _id: 1,
        ...subFields.reduce((subProjections, key) => ({
          ...subProjections,
          ...this.projectFromPath(
            path,
            maximumDepth,
            checkIndexing,
            [''].concat(subPath.slice(0, -1).concat([key])),
            subModel,
            projections,
            currentDepth + 1,
          ),
        }), {}),
      };
    }

    // Objects...
    if (type === 'object') {
      const { fields } = schema;
      const subModel = fields[field];
      return {
        ...projections,
        [field]: this.projectFromPath(
          path,
          maximumDepth,
          checkIndexing,
          subPath,
          subModel,
          projections[field] as Document,
          currentDepth,
        ),
      };
    }

    // Invalid field...
    return this.projectFromPath(
      path,
      maximumDepth,
      checkIndexing,
      subPath,
      undefined,
      projections,
      currentDepth,
    );
  }

  /**
   * Generates MongoDB-flavored list of fields to project in results, from `fields`.
   * The most specific path takes precedence, which means if you have the following classic fields:
   * `['object.field', 'object']`, the output will be `{ object: { field: 1 } }`.
   *
   * @param fields Fields from which to generate projections object.
   *
   * @param schema Root collection schema.
   *
   * @param maximumDepth Maximum allowed level of resources depth.
   *
   * @returns MongoDB projections.
   */
  protected generateProjectionsFrom(
    fields: { classic: string[]; indexed?: string[] },
    schema: FieldSchema<DataModel>,
    maximumDepth: number,
  ): Document {
    let projections: Document = {};

    // Handles '*' notation.
    const starIndex = fields.classic.indexOf('*');
    if (starIndex >= 0) {
      fields.classic.splice(starIndex, 1);
      fields.classic.push(...Object.keys((schema as ObjectSchema<DataModel>).fields));
    }

    // No matter what, we ALWAYS project the `_id` field.
    const uniqueClassicFields = [...new Set(fields.classic.concat(['_id']))];
    for (let index = 0, { length } = uniqueClassicFields; index < length; index += 1) {
      const path = uniqueClassicFields[index];
      const rootPath = [''].concat(path.split('.'));
      projections = this.projectFromPath(path, maximumDepth, false, rootPath, schema, projections);
    }
    const uniqueIndexedFields = [...new Set(fields.indexed)];
    for (let index = 0, { length } = uniqueIndexedFields; index < length; index += 1) {
      const path = uniqueIndexedFields[index];
      const rootPath = [''].concat(path.split('.'));
      projections = this.projectFromPath(path, maximumDepth, true, rootPath, schema, projections);
    }

    return projections;
  }

  /**
   * Generates MongoDB `$lookup`s pipeline from `projections`.
   *
   * @param projections Projections from which to generate pipeline.
   *
   * @param schema Current path data model schema.
   *
   * @param path Current path in data model. Used for recursivity, do not use it directly!
   *
   * @param isFlatArray Whether current path is part of a flat array.
   * Used for recursivity, do not use it directly!
   *
   * @returns Generated `$lookup`s pipeline.
   */
  protected generateLookupsPipelineFrom(
    projections: Document,
    schema: FieldSchema<DataModel>,
    path: string[] = [],
    isFlatArray = false,
  ): Document[] {
    if (isPlainObject(projections)) {
      const { type } = schema;

      // External relations...
      const { relation } = schema as IdSchema<DataModel>;
      if (type === 'id' && relation !== undefined) {
        const fullPath = path.join('.');
        const fieldName = String(path.at(-1));
        const rootPath = path.slice(0, path.length - 1).join('.');
        const metaData = this.model.get(relation) as DataModelMetadata<CollectionSchema<DataModel>>;
        const subPipeline = this.generateLookupsPipelineFrom(
          projections,
          { type: 'object', fields: metaData.schema.fields },
        );
        return ([{
          $lookup: {
            as: `__${fullPath}`,
            from: relation,
            foreignField: '_id',
            localField: fullPath,
            // MongoDB < 4 throws an error when dealing with empty pipelines in lookups.
            ...(subPipeline.length > 0 ? { pipeline: subPipeline } : {}),
          },
        }] as Document[]).concat(isFlatArray
          // TODO apply the same check null as below
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
          : [
            // We don't want to end-up with an empty array if the initial array is `null`.
            {
              $addFields: {
                [fullPath]: { $cond: { if: { $eq: [`$${fullPath}`, null] }, then: null, else: `$__${fullPath}` } },
              },
            },
            // As lookups always return arrays, this instruction transforms results to get objects.
            {
              $addFields: {
                [fullPath]: { $arrayElemAt: [`$${fullPath}`, 0] },
              },
            }]);
      }

      // Arrays...
      if (type === 'array') {
        const { fields } = schema;
        // "Flat" arrays directly contain primitives, and not nested structures.
        const isFlat = fields.type === 'id';
        const subPipeline = this.generateLookupsPipelineFrom(projections, fields, path, !isFlat);
        // If we are dealing with a "flat" array, we don't want to transform it to an object.
        return subPipeline.slice(0, isFlat ? -1 : undefined);
      }

      // Objects...
      const pipeline: Document[] = [];
      const { fields } = schema as ObjectSchema<DataModel>;
      Object.keys(projections).forEach((fieldName) => {
        pipeline.push(...this.generateLookupsPipelineFrom(
          projections[fieldName] as Document,
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
      // `$limit: 0` is forbidden in MongoDB.
      { $limit: Math.max(1, limit ?? this.DEFAULT_LIMIT) },
    ];
  }

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
  ): Document[] {
    // @TODO We need two stages, otherwise filters applied at the root would not match values once
    // looked-up. For instance, applying the following filter:
    // `{ roles: [new Id('638d1949d649cfa9373569d6')] }` while also querying `roles.name` field
    // would first generate a lookup stage before filtering, which would return no result.

    const stage: Document = { $match: { $and: [] } };

    // Query fields...
    const queryText = query?.text ?? '';
    const queryFields = query?.on ?? [];
    const queryStage: Document = {
      $or: queryFields.map((path) => ({
        [path]: {
          $regex: new RegExp(queryText.split(this.SPLITTING_TOKENS).map((t) => (
            `(?=.*${t.replace(/[[\]/()]/ig, (match) => `\\${match}`)})`
          )).join('|'), 'i'),
        },
      })),
    };
    if ((queryStage.$or as Document[]).length > 0) {
      (stage.$match as { $and: Document[]; }).$and.push(queryStage);
    }

    // Filters fields...
    const filtersStage: Document = Object.keys(filters ?? {}).reduce((conditions, path) => {
      const values = filters?.[path];
      if (Array.isArray(values)) {
        if (values.length > 1 && values[0] instanceof Date && values[1] instanceof Date) {
          return { ...conditions, [path]: { $gte: values[0], $lte: values[1] } };
        }
        return {
          ...conditions,
          [path]: {
            $in: values.map((value) => (
              (value instanceof Id) ? new ObjectId(String(value)) : value
            )),
          },
        };
      }
      if (values instanceof Date) {
        return { ...conditions, [path]: { $gte: values } };
      }
      return {
        ...conditions,
        [path]: { $eq: (values instanceof Id) ? new ObjectId(String(values)) : values },
      };
    }, {});

    if (Object.keys(filtersStage).length > 0) {
      (stage.$match as { $and: Document[]; }).$and.push(filtersStage);
    }

    return ((stage.$match as { $and: Document[]; }).$and.length > 0) ? [stage] : [];
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
      if ((this.database as unknown) === null) {
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
        const fieldName = Object.keys(mongoError.keyValue as Document)[0];
        throw new DatabaseError('DUPLICATE_RESOURCE', {
          field: fieldName,
          value: (mongoError.keyValue as Document)[fieldName],
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
    const credentials = (user !== null && password !== null) ? `${user}:${password}@` : '';
    const uri = `${protocol}//${credentials}${host}${portString}/${database}`;

    this.client = new MongoClient(uri, { maxPoolSize });
    this.database = this.client.db(`${database}`);
    this.formatInput = this.formatInput.bind(this);
    this.formatOutput = this.formatOutput.bind(this);
    this.checkIntegrity = this.checkIntegrity.bind(this);

    // Generating the list of paths for which each collection is a foreign key...
    const collections = this.model.getCollections();
    const relationsPerCollection: Partial<RelationsPerCollection<DataModel>> = {};
    collections.forEach((collection) => {
      const collectionForeignKeys = new Map<string, string[]>();
      const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
      this.scanRelationsFrom({ type: 'object', fields: metaData.schema.fields }, collectionForeignKeys);
      relationsPerCollection[collection] = collectionForeignKeys;
    });
    const invertedRelationsPerCollection = collections.reduce((invertedRelations, collection) => ({
      ...invertedRelations,
      [collection]: new Map(),
    }), {}) as RelationsPerCollection<DataModel>;
    (Object.keys(relationsPerCollection) as (keyof DataModel)[]).forEach((collection) => {
      (relationsPerCollection as RelationsPerCollection<DataModel>)[collection].forEach(
        (value, key) => {
          invertedRelationsPerCollection[key as keyof DataModel].set(String(collection), value);
        },
      );
    });
    this.invertedRelationsPerCollection = invertedRelationsPerCollection;
    this.relationsPerCollection = relationsPerCollection as RelationsPerCollection<DataModel>;
  }

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
    collection: keyof DataModel,
    fields: string[],
    maximumDepth = this.DEFAULT_MAXIMUM_DEPTH,
  ): void {
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const collectionModel: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
    this.generateProjectionsFrom({ classic: fields }, collectionModel, maximumDepth);
  }

  /**
   * Makes sure that `foreignIds` reference existing resources that match specific conditions.
   *
   * @param foreignIds Foreign ids to check in database.
   *
   * @throws If any foreign id does not exist.
   */
  public async checkForeignIds(
    foreignIds: Map<string, SearchFilters[]>,
  ): Promise<void> {
    this.logger.debug('[DatabaseClient][checkForeignIds] Foreign ids to analyze:');
    this.logger.debug(foreignIds);

    if (foreignIds.size > 0) {
      // Performing a single aggregate gathering all requested resources is way more efficient
      // than performing one Mongo query per collection.
      const pipeline: Document[] = [{ $limit: 1 }, { $project: {} }];
      [...foreignIds.keys()].forEach((relation) => {
        const filtersPerRelation = foreignIds.get(relation) as unknown as SearchFilters[];
        filtersPerRelation.forEach((rawFilters, index) => {
          const { _id, ...filters } = rawFilters;
          const stage = this.generateSearchPipelineFrom(null, filters);
          (pipeline[1].$project as Document)[`${relation}${index}Ids`] = (_id as Id[]).map((id) => (
            new ObjectId(String(id))
          ));
          pipeline.push({
            $lookup: {
              from: relation,
              as: `${relation}${index}`,
              foreignField: '_id',
              localField: `${relation}${index}Ids`,
              pipeline: stage.concat([
                // Be careful: `_isDeleted` might not exist in collection.
                { $match: { _isDeleted: { $ne: true } } },
                { $project: { _id: 1 } },
              ]),
            },
          });
        });
      });
      this.logger.debug('[DatabaseClient][checkForeignIds] Calling MongoDB aggregate with pipeline:');
      this.logger.debug(pipeline);

      const [response] = await this.database.collection('_config')
        .aggregate<Record<string, Document[]>>(pipeline)
        .toArray();

      foreignIds.forEach((filtersPerRelation, relation) => {
        filtersPerRelation.forEach((filters, index) => {
          const _id = filters._id as Id[];
          if (response[`${relation}${index}`].length < _id.length) {
            const missingResourceId = _id.find((id) => (
              response[`${relation}${index}`].find((responseId: Document) => (
                `${responseId._id}` === String(id)
              )) === undefined
            ));
            throw new DatabaseError('NO_RESOURCE', { id: missingResourceId });
          }
        });
      });
    }
  }

  /**
   * Inserts `resource` into `collection`.
   *
   * @param collection Name of the collection to insert resource into.
   *
   * @param resource New resource to insert.
   */
  public async create<Collection extends keyof DataModel>(
    collection: Collection,
    resource: DataModel[Collection],
  ): Promise<void> {
    const newResource = this.formatInput(resource);

    this.logger.debug(
      `[DatabaseClient][create] Inserting new resource into collection ${String(collection)}:`,
    );
    this.logger.debug(newResource);

    await this.handleError(async () => {
      await this.database.collection(String(collection)).insertOne(newResource);
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
  public async update<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id,
    payload: Partial<DataModel[Collection]>,
  ): Promise<void> {
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const filter = metaData.schema.enableDeletion
      ? { _id: new ObjectId(String(id)) }
      : { ...this.DELETION_FILTER_PIPELINE[0].$match, _id: new ObjectId(String(id)) } as Document;
    const updates = this.formatPayload(payload);

    this.logger.debug(
      `[DatabaseClient][update] Updating resource ${String(id)} in collection ${String(collection)}:`,
    );
    this.logger.debug(updates);

    await this.handleError(async () => {
      await this.database.collection(String(collection)).updateOne(filter, { $set: updates });
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
  public async exclusiveUpdate<Collection extends keyof DataModel>(
    collection: Collection,
    filters: SearchFilters,
    payload: Partial<DataModel[Collection]>,
  ): Promise<boolean> {
    const updates = this.formatPayload(payload);
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;

    this.logger.debug(
      `[DatabaseClient][exclusiveUpdate] Updating resources in collection ${String(collection)}:`,
    );
    this.logger.debug(filters);
    this.logger.debug(updates);

    return this.handleError(async () => {
      const formattedFilters = metaData.schema.enableDeletion
        ? filters
        : { ...this.DELETION_FILTER_PIPELINE[0].$match, ...filters } as Document;
      const response = await this.database.collection(String(collection)).findOneAndUpdate(
        this.formatInput(formattedFilters as Partial<DataModel[keyof DataModel]>),
        { $set: updates },
        { projection: { _id: 1 } },
      );
      return response !== null;
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
  public async view<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id,
    options = this.DEFAULT_QUERY_OPTIONS,
  ): Promise<DataModel[Collection] | null> {
    const requestedFields = { classic: options.fields ?? [] };
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const schema: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
    const projections = this.generateProjectionsFrom(requestedFields, schema, maximumDepth);
    const lookupPipeline = this.generateLookupsPipelineFrom(projections, schema);

    const _id = new ObjectId(String(id));
    const resultsPipeline = (metaData.schema.enableDeletion
      ? [{ $match: { _id } }] as Document[]
      : [{ $match: { ...this.DELETION_FILTER_PIPELINE[0].$match as Document, _id } }] as Document[])
      .concat(lookupPipeline)
      .concat({ $project: projections });

    this.logger.debug(
      '[DatabaseClient][view] Calling MongoDB aggregate method on collection '
      + `${String(collection)} with pipeline:`,
    );
    this.logger.debug(resultsPipeline);

    return this.handleError(async () => {
      const databaseCollection = this.database.collection(String(collection));
      const response = await databaseCollection.aggregate(resultsPipeline).toArray();
      const result = (response[0] ?? null) as unknown as Partial<DataModel[Collection]>;
      return this.formatOutput(result, projections) as DataModel[Collection];
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
  public async search<Collection extends keyof DataModel>(
    collection: Collection,
    body: SearchBody,
    options = this.DEFAULT_QUERY_OPTIONS,
  ): Promise<Results<DataModel[Collection]>> {
    const query = body.query ?? null;
    const filters = body.filters ?? null;
    const sortBy = options.sortBy ?? [];
    const sortOrder = options.sortOrder ?? [];
    const requestedFields = options.fields ?? [];
    const allFields = {
      classic: requestedFields,
      indexed: sortBy.concat(query?.on ?? []).concat(Object.keys(filters ?? {})),
    };
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const schema: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const projections = this.generateProjectionsFrom(allFields, schema, maximumDepth);
    const searchPipeline = this.generateSearchPipelineFrom(query, filters);
    const sortingPipeline = this.generateSortingPipelineFrom(sortBy, sortOrder);
    const lookupPipeline = this.generateLookupsPipelineFrom(projections, schema);
    const paginationPipeline = this.generatePaginationPipelineFrom(options.offset, options.limit);

    const resultsPipeline = (metaData.schema.enableDeletion ? [] : this.DELETION_FILTER_PIPELINE)
      .concat(lookupPipeline)
      .concat(searchPipeline)
      .concat(sortingPipeline)
      .concat([
        { $project: projections },
        {
          $facet: {
            total: this.TOTAL_PIPELINE,
            results: paginationPipeline,
          },
        },
      ]);

    this.logger.debug(
      '[DatabaseClient][search] Calling MongoDB aggregate method on collection '
      + `${String(collection)} with pipeline:`,
    );
    this.logger.debug(resultsPipeline);

    return this.handleError(async () => {
      const databaseCollection = this.database.collection(String(collection));
      const [response] = await databaseCollection.aggregate(resultsPipeline).toArray();
      return {
        total: (response as { total: { total: number; }[]; }).total[0]?.total ?? 0,
        results: (options.limit === 0)
          ? []
          : (response.results as Partial<DataModel[Collection]>[]).map((result) => (
            this.formatOutput(result, projections)
          )) as DataModel[Collection][],
      };
    });
  }

  /**
   * Fetches a paginated list of resources from `collection`.
   *
   * @param collection Name of the collection from which to fetch resources.
   *
   * @param options Query options. Defaults to `{}`.
   *
   * @returns Paginated list of resources.
   */
  public async list<Collection extends keyof DataModel>(
    collection: Collection,
    options = this.DEFAULT_QUERY_OPTIONS,
  ): Promise<Results<DataModel[Collection]>> {
    const sortBy = options.sortBy ?? [];
    const sortOrder = options.sortOrder ?? [];
    const requestedFields = options.fields ?? [];
    const allFields = { classic: requestedFields, indexed: sortBy };
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const schema: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const projections = this.generateProjectionsFrom(allFields, schema, maximumDepth);
    const lookupPipeline = this.generateLookupsPipelineFrom(projections, schema);
    const sortingPipeline = this.generateSortingPipelineFrom(sortBy, sortOrder);
    const paginationPipeline = this.generatePaginationPipelineFrom(options.offset, options.limit);

    const resultsPipeline = (metaData.schema.enableDeletion ? [] : this.DELETION_FILTER_PIPELINE)
      .concat(lookupPipeline)
      .concat(sortingPipeline)
      .concat([
        { $project: projections },
        {
          $facet: {
            total: this.TOTAL_PIPELINE,
            results: paginationPipeline,
          },
        },
      ]);

    this.logger.debug(
      '[DatabaseClient][list] Calling MongoDB aggregate method on collection '
      + `${String(collection)} with pipeline:`,
    );
    this.logger.debug(resultsPipeline);

    return this.handleError(async () => {
      const databaseCollection = this.database.collection(String(collection));
      const [response] = await databaseCollection.aggregate(resultsPipeline).toArray();
      return {
        total: (response as { total: { total: number; }[]; }).total[0]?.total ?? 0,
        results: (options.limit === 0)
          ? []
          : (response.results as Partial<DataModel[Collection]>[]).map((result) => (
            this.formatOutput(result, projections)
          )) as DataModel[Collection][],
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
  public async delete<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id,
    payload: Partial<DataModel[Collection]> = {},
  ): Promise<boolean> {
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const resourceId = new ObjectId(String(id));

    return this.handleError(async () => {
      if (metaData.schema.enableDeletion !== false) {
        this.logger.debug(
          `[DatabaseClient][delete] Deleting resource ${String(id)} from collection ${String(collection)}...`,
        );

        await this.checkReferencesTo(collection, id);
        const response = await this.database.collection(String(collection)).deleteOne({
          _id: resourceId,
        });
        return response.deletedCount === 1;
      }

      const fullPayload = { _isDeleted: true, ...this.formatPayload(payload) };
      this.logger.debug(
        `[DatabaseClient][delete] Updating resource ${String(id)} in collection ${String(collection)}:`,
      );
      this.logger.debug(fullPayload);

      const response = await this.database.collection(String(collection)).updateOne({
        _id: resourceId,
        ...this.DELETION_FILTER_PIPELINE[0].$match as Document,
      }, { $set: fullPayload });
      return response.matchedCount === 1;
    });
  }

  /**
   * Drops entire database`.
   */
  public async dropDatabase(): Promise<void> {
    await this.handleError(async () => {
      await this.client.db(this.database.databaseName).dropDatabase();
      this.isConnected = false;
    });
  }

  /**
   * Creates database.
   */
  public async createDatabase(): Promise<void> {
    await Promise.resolve();
    this.isConnected = false;
    this.database = this.client.db(this.database.databaseName);
  }

  /**
   * Creates collection with name `name`.
   *
   * @param collection Name of the collection to create.
   */
  public async resetCollection<Collection extends keyof DataModel>(
    collection: Collection,
  ): Promise<void> {
    this.logger.info(`[DatabaseClient][resetCollection] Resetting collection ${String(collection)}...`);
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    await this.handleError(async () => {
      const collectionExists = (await this.database
        .listCollections({ name: collection }).toArray()).length > 0;
      if (collectionExists) {
        await this.database.dropCollection(String(collection));
      }
      await this.database.createCollection(String(collection), {
        validator: this.createSchema({ type: 'object', fields: metaData.schema.fields }),
      });
      await this.database.collection(String(collection))
        .createIndexes(this.getCollectionIndexedFields({ type: 'object', fields: metaData.schema.fields }));
    });
  }

  /**
   * Performs a validation schema update and a data migration on collection with name `name`.
   *
   * @param collection Name of the collection to update.
   *
   * @param migration Optional migration to perform. Defaults to an empty Promise.
   */
  public async updateCollection<Collection extends keyof DataModel>(
    collection: Collection,
    migration = defaultMigration,
  ): Promise<void> {
    this.logger.info(`[DatabaseClient][updateCollection] Updating collection ${String(collection)}...`);
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const collectionSchema: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
    await this.handleError(async () => {
      const session = this.client.startSession();
      const collectionIndexedFields = this.getCollectionIndexedFields(collectionSchema);
      await this.database.command({
        collMod: String(collection),
        validationLevel: 'strict', // Order matters here!
        validator: this.createSchema(collectionSchema),
      }, { session });
      await this.database.collection(String(collection)).dropIndexes({ session });
      await migration(session);
      await this.database.collection(String(collection)).createIndexes(collectionIndexedFields);
      await session.endSession();
      const invalidDocuments = await this.database.collection(String(collection)).find({
        $nor: [this.createSchema(collectionSchema)],
      }, { limit: 1 }).toArray();
      if (invalidDocuments.length > 0) {
        await this.database.collection(String(collection)).insertOne(invalidDocuments[0]);
      }
    });
  }

  /**
   * Drops `collection` from database.
   *
   * @param collection Name of the collection to drop from database.
   */
  public async dropCollection(collection: keyof DataModel): Promise<void> {
    await this.database.dropCollection(String(collection));
  }

  /**
   * Resets the whole underlying database, re-creating collections, indexes, and such.
   */
  public async reset(): Promise<void> {
    await this.handleError(async () => {
      this.logger.info('[DatabaseClient][reset] Dropping database...');
      await this.dropDatabase();
      this.logger.info('[DatabaseClient][reset] Re-creating database...');
      await this.createDatabase();
      this.logger.info('[DatabaseClient][reset] Initializing collections...');
      await forEach(this.model.getCollections(), async (collection) => {
        await this.resetCollection(collection);
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
    });
  }

  /**
   * Performs integrity checks on `collection` if specified, or on the whole database.
   *
   * @param collection Name of the collection on which to perform the integrity checks.
   *
   * @returns List of found integrity errors, per collection.
   *
   * @throws If integrity checks failed.
   */
  public async checkIntegrity(
    collection?: keyof DataModel,
  ): Promise<Record<string, Record<string, Id[]>>> {
    if (collection === undefined) {
      const results: Record<string, Record<string, Id[]>> = {};
      await forEach(this.model.getCollections(), async (currentCollection) => {
        const collectionErrors = await this.checkIntegrity(currentCollection);
        results[String(currentCollection)] = collectionErrors[String(currentCollection)];
      });
      let failedIntegrityChecks = false;
      Object.keys(results).forEach((currentCollection) => {
        Object.keys(results[currentCollection]).forEach((type) => {
          if (results[currentCollection][type].length > 0) {
            failedIntegrityChecks = true;
          }
        });
      });
      this.logger.info('[DatabaseClient][checkIntegrity] Integrity checks results:');
      this.logger.info(results);
      if (failedIntegrityChecks as boolean) {
        throw new DatabaseError('FAILED_INTEGRITY_CHECKS');
      }
      return results;
    }

    this.logger.info(
      `[DatabaseClient][checkIntegrity] Checking integrity for collection ${String(collection)}...`,
    );
    const now = new Date();
    const conditions: Document[] = [];
    const originOfTimes = new Date('2021-01-01');
    const errors: Record<string, Id[]> = { NO_RESOURCE: [], AUTOMATIC_FIELDS: [] };
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;

    // Checking automatic fields...
    if (metaData.schema.enableDeletion === false && metaData.schema.enableTimestamps) {
      // Incorrect deletion.
      conditions.push({ _isDeleted: true, _updatedAt: null });
    }
    if (metaData.schema.enableTimestamps) {
      // _createdAt not in time range.
      conditions.push({
        $or: [{ _createdAt: { $lt: originOfTimes } }, { _createdAt: { $gte: now } }],
      });
      // _updatedAt not in time range.
      conditions.push({
        $and: [
          { _updatedAt: { $ne: null } },
          {
            $or: [
              { _updatedAt: { $gte: now } },
              { $expr: { $lte: ['$_updatedAt', '$_createdAt'] } },
            ],
          },
        ],
      });
    }
    if (metaData.schema.enableAuthors && metaData.schema.enableTimestamps) {
      // Either one of _updatedAt / _updatedBy is null and not the other one.
      conditions.push({ _updatedAt: { $eq: null }, _updatedBy: { $ne: null } });
      conditions.push({ _updatedBy: { $eq: null }, _updatedAt: { $ne: null } });
    }

    if (conditions.length > 0) {
      this.logger.debug('[DatabaseClient][checkIntegrity] Calling MongoDB aggregate with pipeline:');
      this.logger.debug([{ $match: { $or: conditions } }, { $project: { _id: 1 } }]);

      errors.AUTOMATIC_FIELDS = (await this.database.collection(String(collection)).aggregate([
        { $match: { $or: conditions } },
        { $project: { _id: 1 } },
      ]).toArray()).map((document) => new Id(`${document._id}`));
    }

    // Checking foreign keys...
    if (metaData.schema.enableAuthors) {
      errors.NO_RESOURCE.push(...(await this.database.collection(String(collection)).aggregate([
        {
          $lookup: {
            from: 'users',
            as: '__createdBy',
            localField: '_createdBy',
            foreignField: '_id',
            let: { createdAt: '$_createdAt' },
            pipeline: [{
              $match: {
                $or: [
                  { _createdAt: { $exists: false } },
                  { _createdAt: { $exists: true }, $expr: { $lt: ['$_createdAt', '$$createdAt'] } },
                ],
              },
            }],
          },
        },
        {
          $lookup: {
            from: 'users',
            as: '__updatedBy',
            localField: '_updatedBy',
            foreignField: '_id',
          },
        },
        {
          $match: {
            $or: [
              // Missing users relation.
              { _updatedBy: { $ne: null }, '__updatedBy._id': { $exists: false } },
              // Missing users relation.
              { _createdBy: { $ne: null }, '__createdBy._id': { $exists: false } },
            ],
          },
        },
        { $project: { _id: 1 } },
      ]).toArray()).map((document) => new Id(`${document._id}`)));
    }

    // Checking foreign keys...
    const collectionRelations = this.relationsPerCollection[collection];
    if (collectionRelations.size > 0) {
      const relationsPipeline: Document[] = [];
      const missingRelations: Document[] = [];
      const transformations: Document[] = [{ _createdAt: 1 }, { _createdAt: 1 }, { _createdAt: 1 }];
      [...collectionRelations.keys()].forEach((relation) => {
        collectionRelations.get(relation)?.forEach((path) => {
          // We need to flatten paths to prevent MongoDB memory overflow errors.
          const flattenPath = path.replace(/\./g, '__');
          transformations[0][flattenPath] = { $ifNull: [`$${path}`, []] };
          transformations[1][flattenPath] = {
            $cond: {
              if: { $eq: [{ $type: `$${flattenPath}` }, 'array'] },
              then: `$${flattenPath}`,
              else: [`$${flattenPath}`],
            },
          };
          transformations[2][flattenPath] = {
            $setUnion: [`$${flattenPath}`, []],
          };
          missingRelations.push({
            $expr: {
              $ne: [
                { $size: `$__${flattenPath}` },
                { $size: `$${flattenPath}` },
              ],
            },
          });
        });
      });
      relationsPipeline.push({ $project: transformations[0] });
      relationsPipeline.push({ $project: transformations[1] });
      relationsPipeline.push({ $project: transformations[2] });
      [...collectionRelations.keys()].forEach((relation) => {
        collectionRelations.get(relation)?.forEach((path) => {
          const flattenPath = path.replace(/\./g, '__');
          relationsPipeline.push({
            $lookup: {
              from: relation,
              as: `__${flattenPath}`,
              localField: flattenPath,
              foreignField: '_id',
              let: { createdAt: '$_createdAt' },
              pipeline: [
                // Resources that have been deleted before being referenced by other resources.
                {
                  $match: {
                    $or: [
                      { _isDeleted: { $ne: true } },
                      {
                        _isDeleted: true,
                        _updatedAt: { $exists: true },
                        $expr: { $lt: ['$$createdAt', '$_updatedAt'] },
                      },
                    ],
                  },
                },
                { $project: { _id: 1 } },
              ],
            },
          });
        });
      });
      relationsPipeline.push({
        $match: { $or: missingRelations },
      });
      this.logger.debug('[DatabaseClient][checkIntegrity] Calling MongoDB aggregate with pipeline:');
      this.logger.debug([
        ...relationsPipeline,
        { $project: { _id: 1 } },
      ]);
      errors.NO_RESOURCE.push(...(await this.database.collection(String(collection)).aggregate([
        ...relationsPipeline,
        { $project: { _id: 1 } },
      ]).toArray()).map((document) => new Id(`${document._id}`)));
    }

    if (collection === 'users') {
      errors.AUTOMATIC_FIELDS.push(...(await this.database.collection('users').aggregate([
        {
          $match: {
            $and: [
              { _verifiedAt: { $ne: null } },
              {
                $or: [
                  { _verifiedAt: { $gte: now } },
                  { $expr: { $lt: ['$_verifiedAt', '$_createdAt'] } },
                ],
              },
            ],
          },
        },
        { $project: { _id: 1 } },
      ]).toArray()).map((document) => new Id(`${document._id}`)));
    }

    return { [collection]: errors };
  }
}
