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
  type DynamicObjectSchema,
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
  key: { [path: string]: 1; };
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
  properties?: {
    [name: string]: MongoValidationSchema;
  };
  patternProperties?: {
    [pattern: string]: MongoValidationSchema;
  };
}

/** Perseid data model to Mongo validation schema formatters. */
export interface MongoFormatters<DataModel> {
  [type: string]: (model: FieldSchema<DataModel>) => MongoValidationSchema;
}

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

const decoder = new TextDecoder();
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
    id(model) {
      const { enum: enumerations } = model as IdSchema<DataModel>;
      const formattedField: MongoValidationSchema = { bsonType: ['objectId'] };
      if (enumerations !== undefined) {
        formattedField.enum = enumerations.map((id) => `${id}`);
      }
      if (!model.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    binary(model) {
      const formattedField: MongoValidationSchema = { bsonType: ['binData'] };
      if (!model.required) {
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    boolean(model) {
      const formattedField: MongoValidationSchema = { bsonType: ['bool'] };
      if (!model.required) {
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    date(model) {
      const formattedField: MongoValidationSchema = { bsonType: ['date'] };
      const { enum: enumerations } = model as DateSchema;
      if (enumerations !== undefined) {
        formattedField.enum = enumerations.map((date) => date.toISOString());
      }
      if (!model.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    float(model) {
      const formattedField: MongoValidationSchema = { bsonType: ['int', 'double'] };
      const {
        minimum,
        maximum,
        multipleOf,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
      } = model as NumberSchema;
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
      if (!model.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    integer(model) {
      const formattedField: MongoValidationSchema = { bsonType: ['int'] };
      const {
        minimum,
        maximum,
        multipleOf,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
      } = model as NumberSchema;
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
      if (!model.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    string(model) {
      const formattedField: MongoValidationSchema = { bsonType: ['string'] };
      const {
        pattern,
        maxLength,
        minLength,
        enum: enumerations,
      } = model as StringSchema;
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
      if (!model.required) {
        formattedField.enum?.push(null);
        formattedField.bsonType.push('null');
      }
      return formattedField;
    },
    object: (model) => {
      const formattedField: MongoValidationSchema = {
        bsonType: ['object'],
        additionalProperties: false,
      };
      const { fields } = model as ObjectSchema<DataModel>;
      if (!model.required) {
        formattedField.bsonType.push('null');
      }
      formattedField.required = Object.keys(fields);
      formattedField.properties = formattedField.required.reduce((properties, key) => ({
        ...properties,
        [key]: this.FORMATTERS[fields[key].type](fields[key]),
      }), {});
      return formattedField;
    },
    dynamicObject: (model) => {
      const formattedField: MongoValidationSchema = {
        bsonType: ['object'],
        additionalProperties: false,
      };
      const { fields, minItems, maxItems } = model as DynamicObjectSchema<DataModel>;
      if (minItems !== undefined) {
        formattedField.minProperties = minItems;
      }
      if (maxItems !== undefined) {
        formattedField.maxProperties = maxItems;
      }
      if (!model.required) {
        formattedField.bsonType.push('null');
      }
      formattedField.patternProperties = Object.keys(fields).reduce((patternProperties, key) => ({
        ...patternProperties,
        [key]: this.FORMATTERS[fields[key].type](fields[key]),
      }), {});
      return formattedField;
    },
    array: (model) => {
      const {
        fields,
        maxItems,
        minItems,
        uniqueItems,
      } = model as ArraySchema<DataModel>;
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
      if (!model.required) {
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
        formattedInput.push(this.formatInput((input as Document)[index]));
      }
      return formattedInput;
    }

    if (isPlainObject(input)) {
      const keys = Object.keys(input);
      const formattedInput: Document = {};
      for (let index = 0, { length } = keys; index < length; index += 1) {
        formattedInput[keys[index]] = this.formatInput((input as Document)[keys[index]]);
      }
      return formattedInput;
    }

    if (input instanceof Id) {
      return new ObjectId(`${input}`);
    }

    if (input instanceof ArrayBuffer) {
      return new Binary(decoder.decode(input as unknown as ArrayBuffer));
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
    path: (keyof Partial<DataModel[Collection]>)[] = [],
  ): Document {
    let formattedPayload: Document = {};
    const keys = Object.keys(payload) as (keyof Partial<DataModel[Collection]>)[];
    for (let index = 0, { length } = keys; index < length; index += 1) {
      const subPath = path.concat([keys[index]]);
      const flattenedPath = subPath.join('.');
      const subPayload = payload[keys[index]] as Partial<DataModel[Collection]>;
      if (isPlainObject(subPayload)) {
        const formattedSubPayload = this.formatPayload(subPayload, subPath);
        formattedPayload = { ...formattedPayload, ...formattedSubPayload };
      } else if (subPayload instanceof Id) {
        formattedPayload[flattenedPath] = new ObjectId(`${subPayload}`);
      } else if (subPayload instanceof ArrayBuffer) {
        formattedPayload[flattenedPath] = new Binary(decoder.decode(subPayload));
      } else if (Array.isArray(subPayload)) {
        formattedPayload[flattenedPath] = this.formatInput(subPayload);
      } else {
        formattedPayload[flattenedPath] = subPayload;
      }
    }
    return formattedPayload;
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
        formattedOutput[index] = this.formatOutput((<Document>output)[index], projections);
      }
      return formattedOutput as Partial<DataModel[Collection]>;
    }

    if (isPlainObject(output)) {
      const formattedOutput: Document = {};
      const keys = Object.keys(projections === 1 ? output : projections);
      for (let index = 0, { length } = keys; index < length; index += 1) {
        formattedOutput[keys[index]] = this.formatOutput(
          (output as Document)[keys[index]],
          projections === 1 ? 1 : (projections as Document)[keys[index]],
        );
      }
      return formattedOutput as Partial<DataModel[Collection]>;
    }

    if (output instanceof ObjectId) {
      return new Id(`${output}`) as unknown as Partial<DataModel[Collection]>;
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

    return (output ?? null) as Partial<DataModel[Collection]>;
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
      `[DatabaseClient][checkReferencesTo] Checking references to ${id} in ${collection as string}...`,
    );

    if (referencesToResource.size > 0) {
      // Performing a single aggregate gathering all requested resources is way more efficient
      // than performing one Mongo query per collection.
      const pipeline: Document[] = [
        { $limit: 1 },
        { $project: { _id: new ObjectId(`${id}`) } },
      ];
      pipeline.push(...[...referencesToResource.keys()].reduce((lookups, relation) => [
        ...lookups,
        ...[...(referencesToResource.get(relation) as string[]).values()].map((path) => ({
          $lookup: {
            from: relation,
            as: `${relation}__${path}`,
            foreignField: path,
            localField: '_id',
            pipeline: [{ $project: { _id: 1 } }],
          },
        })),
      ], [] as Document[]));

      this.logger.debug('[DatabaseClient][checkReferencesTo] Calling MongoDB aggregate with pipeline:');
      this.logger.debug(pipeline);

      const [response] = await this.database.collection('_config').aggregate(pipeline).toArray();

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
   * Returns all indexed fields for `collection`.
   *
   * @param collection Name of the collection for which to get indexes.
   *
   * @returns Collection's indexed fields.
   */
  protected getCollectionIndexedFields(
    model: FieldSchema<DataModel>,
    path: string[] = [],
  ): Index[] {
    if (model.type === 'object') {
      const { fields } = model;
      return Object.keys(fields).reduce((indexedFields, fieldName) => indexedFields.concat(
        this.getCollectionIndexedFields(fields[fieldName], path.concat([fieldName])),
      ), [] as Index[]);
    }
    if (model.type === 'dynamicObject') {
      const { fields } = model;
      return Object.keys(fields).reduce((indexedFields, fieldName) => indexedFields.concat(
        this.getCollectionIndexedFields(fields[fieldName], path.concat([fieldName])),
      ), [] as Index[]);
    }
    if (model.type === 'array') {
      const { fields } = model;
      return this.getCollectionIndexedFields(fields, path);
    }

    const indexedFields: Index[] = [];
    if ((model as StringSchema).unique) {
      indexedFields.push({ key: { [path.join('.')]: 1 }, unique: true });
    } else if ((model as StringSchema).index) {
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
    } else if (type === 'dynamicObject' || type === 'object') {
      const keys = Object.keys(schema.fields);
      for (let index = 0, { length } = keys; index < length; index += 1) {
        this.scanRelationsFrom(schema.fields[keys[index]], relations, path.concat([keys[index]]));
      }
    } else if (type === 'id' && schema.relation !== undefined) {
      const existingRelations = relations.get(schema.relation as string) ?? [];
      relations.set(schema.relation as string, existingRelations.concat([path.join('.')]));
    }
  }

  /**
   * Creates a Mongo validation schema from `model`.
   *
   * @param model Model from which to create validation schema.
   *
   * @returns Mongo validation schema.
   */
  protected createSchema(model: ObjectSchema<DataModel>): { $jsonSchema: MongoValidationSchema; } {
    return { $jsonSchema: this.FORMATTERS.object(model) };
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
   * @param model Current path data model.
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
    model?: FieldSchema<DataModel>,
    projections: Document = {},
    currentDepth = 1,
  ): Document {
    if (model === undefined) {
      throw new DatabaseError('INVALID_FIELD', { path });
    }
    if (currentDepth > maximumDepth) {
      throw new DatabaseError('MAXIMUM_DEPTH_EXCEEDED', { path });
    }

    // Primitives...
    const { type } = model;
    if (splittedPath.length === 1) {
      const actualModel = ((type === 'array') ? model.fields : model) as DateSchema;
      if (checkIndexing && !actualModel.unique && !actualModel.index) {
        throw new DatabaseError('INVALID_INDEX', { path });
      }
      return Object.keys(projections).length === 0 ? 1 as unknown as Document : projections;
    }

    const field = splittedPath[1];
    const subPath = splittedPath.slice(1);

    // Arrays...
    if (type === 'array') {
      const { fields: subModel } = model;
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

    // Dynamic objects...
    if (type === 'dynamicObject') {
      const { fields: subFields } = model;
      const patterns = Object.keys(subFields).map((pattern) => new RegExp(pattern));
      const subModel = subFields[(patterns.find((p) => p.test(field)) as RegExp).source];
      return {
        ...projections,
        [field]: this.projectFromPath(
          path,
          maximumDepth,
          checkIndexing,
          subPath,
          subModel,
          projections[field],
          currentDepth,
        ),
      };
    }

    // External relations...
    const { relation } = model as IdSchema<DataModel>;
    if (type === 'id' && relation !== undefined) {
      const metaData = this.model.get(relation) as DataModelMetadata<CollectionSchema<DataModel>>;
      const subModel: ObjectSchema<DataModel> = {
        type: 'object',
        fields: metaData.schema.fields,
      };
      return {
        ...projections,
        _id: 1,
        ...this.projectFromPath(
          path,
          maximumDepth,
          checkIndexing,
          [''].concat(subPath),
          subModel,
          projections,
          currentDepth + 1,
        ),
      };
    }

    // Objects...
    const { fields } = model as ObjectSchema<DataModel>;
    const subModel = fields?.[field];
    return {
      ...projections,
      [field]: this.projectFromPath(
        path,
        maximumDepth,
        checkIndexing,
        subPath,
        subModel,
        projections[field],
        currentDepth,
      ),
    };
  }

  /**
   * Generates MongoDB-flavored list of fields to project in results, from `fields`.
   * The most specific path takes precedence, which means if you have the following classic fields:
   * `['object.field', 'object']`, the output will be `{ object: { field: 1 } }`.
   *
   * @param fields Fields from which to generate projections object.
   *
   * @param model Root collection data model.
   *
   * @param maximumDepth Maximum allowed level of resources depth.
   *
   * @returns MongoDB projections.
   */
  protected generateProjectionsFrom(
    fields: { classic: string[]; indexed?: string[] },
    model: FieldSchema<DataModel>,
    maximumDepth: number,
  ): Document {
    let projections: Document = {};

    // No matter what, we ALWAYS project the `_id` field.
    const uniqueClassicFields = [...new Set(fields.classic.concat(['_id']))];
    for (let index = 0, { length } = uniqueClassicFields; index < length; index += 1) {
      const path = uniqueClassicFields[index];
      const rootPath = [''].concat(path.split('.'));
      projections = this.projectFromPath(path, maximumDepth, false, rootPath, model, projections);
    }
    const uniqueIndexedFields = [...new Set(fields.indexed)];
    for (let index = 0, { length } = uniqueIndexedFields; index < length; index += 1) {
      const path = uniqueIndexedFields[index];
      const rootPath = [''].concat(path.split('.'));
      projections = this.projectFromPath(path, maximumDepth, true, rootPath, model, projections);
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
    model: FieldSchema<DataModel>,
    path: string[] = [],
    isFlatArray = false,
  ): Document[] {
    if (isPlainObject(projections)) {
      const { type } = model;

      // External relations...
      const { relation } = model as IdSchema<DataModel>;
      if (type === 'id' && relation !== undefined) {
        const fullPath = path.join('.');
        const fieldName = path.at(-1) as string;
        const rootPath = path.slice(0, path.length - 1).join('.');
        const metaData = this.model.get(relation) as DataModelMetadata<CollectionSchema<DataModel>>;
        const subPipeline = this.generateLookupsPipelineFrom(
          projections,
          { type: 'object', fields: metaData.schema.fields },
        );
        return ([{
          $lookup: {
            as: isFlatArray ? `__${fullPath}` : fullPath,
            from: relation,
            foreignField: '_id',
            localField: fullPath,
            // MongoDB < 4 throws an error when dealing with empty pipelines in lookups.
            ...(subPipeline.length > 0 ? { pipeline: subPipeline } : {}),
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
        const { fields } = model as ArraySchema<DataModel>;
        // "Flat" arrays directly contain primitives, and not nested structures.
        const isFlat = fields.type === 'id';
        const subPipeline = this.generateLookupsPipelineFrom(projections, fields, path, !isFlat);
        // If we are dealing with a "flat" array, we don't want to transform it to an object.
        return subPipeline.slice(0, isFlat ? -1 : undefined);
      }

      // Dynamic objects...
      if (type === 'dynamicObject') {
        const pipeline: Document[] = [];
        const { fields } = model as DynamicObjectSchema<DataModel>;
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
      const { fields } = model as ObjectSchema<DataModel>;
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
          )).join(''), 'i'),
        },
      })),
    };
    if (queryStage.$or.length > 0) {
      stage.$match.$and.push(queryStage);
    }

    // Filters fields...
    const filtersStage: Document = Object.keys(filters ?? {}).reduce((conditions, path) => {
      const values = (filters as SearchFilters)[path];
      if (Array.isArray(values)) {
        if (values.length > 1 && values[0] instanceof Date && values[1] instanceof Date) {
          return { ...conditions, [path]: { $gte: values[0], $lte: values[1] } };
        }
        return {
          ...conditions,
          [path]: {
            $in: values.map((value) => ((value instanceof Id) ? new ObjectId(`${value}`) : value)),
          },
        };
      }
      if (values instanceof Date) {
        return { ...conditions, [path]: { $gte: values } };
      }
      return {
        ...conditions,
        [path]: { $eq: (values instanceof Id) ? new ObjectId(`${values}`) : values },
      };
    }, {});

    if (Object.keys(filtersStage).length > 0) {
      stage.$match.$and.push(filtersStage);
    }

    return (stage.$match.$and.length > 0) ? [stage] : [];
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
      const collectionForeignKeys = new Map();
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
          invertedRelationsPerCollection[key as keyof DataModel].set(collection as string, value);
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
        const filtersPerRelation = foreignIds.get(relation) as SearchFilters[];
        filtersPerRelation.forEach((rawFilters, index) => {
          const { _id, ...filters } = rawFilters;
          const stage = this.generateSearchPipelineFrom(null, filters);
          pipeline[1].$project[`${relation}${index}Ids`] = (_id as Id[]).map((id) => new ObjectId(`${id}`));
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

      const [response] = await this.database.collection('_config').aggregate(pipeline).toArray();

      foreignIds.forEach((filtersPerRelation, relation) => {
        filtersPerRelation.forEach((filters, index) => {
          const _id = filters._id as Id[];
          if (response[`${relation}${index}`].length < _id.length) {
            const missingResourceId = _id.find((id) => (
              response[`${relation}${index}`].find((responseId: Document) => `${responseId._id}` === `${id}`) === undefined
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
      `[DatabaseClient][create] Inserting new resource into collection ${collection as string}:`,
    );
    this.logger.debug(newResource);

    await this.handleError(async () => {
      await this.database.collection(collection as string).insertOne(newResource);
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
      ? { _id: new ObjectId(`${id}`) }
      : { ...this.DELETION_FILTER_PIPELINE[0].$match, _id: new ObjectId(`${id}`) };
    const updates = this.formatPayload(payload);

    this.logger.debug(
      `[DatabaseClient][update] Updating resource ${id} in collection ${collection as string}:`,
    );
    this.logger.debug(updates);

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
  public async exclusiveUpdate<Collection extends keyof DataModel>(
    collection: Collection,
    filters: SearchFilters,
    payload: Partial<DataModel[Collection]>,
  ): Promise<boolean> {
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const updates = this.formatPayload(payload);

    this.logger.debug(
      `[DatabaseClient][exclusiveUpdate] Updating resources in collection ${collection as string}:`,
    );
    this.logger.debug(filters);
    this.logger.debug(updates);

    return this.handleError(async () => {
      const formattedFilters = metaData.schema.enableDeletion
        ? filters
        : { ...this.DELETION_FILTER_PIPELINE[0].$match, ...filters };
      const response = await this.database.collection(collection as string).findOneAndUpdate(
        this.formatInput(formattedFilters),
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
  public async view<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id,
    options = this.DEFAULT_QUERY_OPTIONS,
  ): Promise<DataModel[Collection] | null> {
    const requestedFields = { classic: options.fields ?? [] };
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const model: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
    const projections = this.generateProjectionsFrom(requestedFields, model, maximumDepth);
    const lookupPipeline = this.generateLookupsPipelineFrom(projections, model);

    const resultsPipeline = (metaData.schema.enableDeletion
      ? [{ $match: { _id: new ObjectId(`${id}`) } }]
      : [{ $match: { ...this.DELETION_FILTER_PIPELINE[0].$match, _id: new ObjectId(`${id}`) } }] as Document[])
      .concat(lookupPipeline)
      .concat({ $project: projections });

    this.logger.debug(
      '[DatabaseClient][view] Calling MongoDB aggregate method on collection '
      + `${collection as string} with pipeline:`,
    );
    this.logger.debug(resultsPipeline);

    return this.handleError(async () => {
      const databaseCollection = this.database.collection(collection as string);
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
    const model: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const projections = this.generateProjectionsFrom(allFields, model, maximumDepth);
    const searchPipeline = this.generateSearchPipelineFrom(query, filters);
    const sortingPipeline = this.generateSortingPipelineFrom(sortBy, sortOrder);
    const lookupPipeline = this.generateLookupsPipelineFrom(projections, model);
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
      + `${collection as string} with pipeline:`,
    );
    this.logger.debug(resultsPipeline);

    return this.handleError(async () => {
      const databaseCollection = this.database.collection(collection as string);
      const [response] = await databaseCollection.aggregate(resultsPipeline).toArray();
      return {
        total: response.total[0]?.total ?? 0,
        results: (options.limit === 0)
          ? []
          : response.results.map((result: Partial<DataModel[Collection]>) => (
            this.formatOutput(result, projections)
          )),
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
    const model: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
    const maximumDepth = options.maximumDepth ?? this.DEFAULT_MAXIMUM_DEPTH;
    const projections = this.generateProjectionsFrom(allFields, model, maximumDepth);
    const lookupPipeline = this.generateLookupsPipelineFrom(projections, model);
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
      + `${collection as string} with pipeline:`,
    );
    this.logger.debug(resultsPipeline);

    return this.handleError(async () => {
      const databaseCollection = this.database.collection(collection as string);
      const [response] = await databaseCollection.aggregate(resultsPipeline).toArray();
      return {
        total: response.total[0]?.total ?? 0,
        results: (options.limit === 0)
          ? []
          : response.results.map((result: Partial<DataModel[Collection]>) => (
            this.formatOutput(result, projections)
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
  public async delete<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id,
    payload: Partial<DataModel[Collection]> = {},
  ): Promise<boolean> {
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const resourceId = new ObjectId(`${id}`);

    return this.handleError(async () => {
      if (metaData.schema.enableDeletion !== false) {
        this.logger.debug(
          `[DatabaseClient][delete] Deleting resource ${id} from collection ${collection as string}...`,
        );

        await this.checkReferencesTo(collection, id);
        const response = await this.database.collection(collection as string).deleteOne({
          _id: resourceId,
        });
        return response.deletedCount === 1;
      }

      const fullPayload = { _isDeleted: true, ...this.formatPayload(payload) };
      this.logger.debug(
        `[DatabaseClient][delete] Updating resource ${id} in collection ${collection as string}:`,
      );
      this.logger.debug(fullPayload);

      const response = await this.database.collection(collection as string).updateOne({
        _id: resourceId,
        ...this.DELETION_FILTER_PIPELINE[0].$match,
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
    this.logger.info(`[DatabaseClient][resetCollection] Resetting collection ${collection as string}...`);
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    await this.handleError(async () => {
      const collectionExists = (await this.database
        .listCollections({ name: collection }).toArray()).length > 0;
      if (collectionExists) {
        await this.database.dropCollection(collection as string);
      }
      await this.database.createCollection(collection as string, {
        validator: this.createSchema({ type: 'object', fields: metaData.schema.fields }),
      });
      await this.database.collection(collection as string)
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
    this.logger.info(`[DatabaseClient][updateCollection] Updating collection ${collection as string}...`);
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const collectionSchema: ObjectSchema<DataModel> = { type: 'object', fields: metaData.schema.fields };
    await this.handleError(async () => {
      const session = await this.client.startSession();
      const collectionIndexedFields = this.getCollectionIndexedFields(collectionSchema);
      await this.database.command({
        collMod: collection as string,
        validationLevel: 'strict', // Order matters here!
        validator: this.createSchema(collectionSchema),
      }, { session });
      await this.database.collection(collection as string).dropIndexes({ session });
      await migration(session);
      await this.database.collection(collection as string).createIndexes(collectionIndexedFields);
      await session.endSession();
      const invalidDocuments = await this.database.collection(collection as string).find({
        $nor: [this.createSchema(collectionSchema)],
      }, { limit: 1 }).toArray();
      if (invalidDocuments.length > 0) {
        await this.database.collection(collection as string).insertOne(invalidDocuments[0]);
      }
    });
  }

  /**
   * Drops `collection` from database.
   *
   * @param collection Name of the collection to drop from database.
   */
  public async dropCollection(collection: keyof DataModel): Promise<void> {
    await this.database.dropCollection(collection as string);
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
        results[currentCollection as string] = collectionErrors[currentCollection as string];
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
      if (failedIntegrityChecks) {
        throw new DatabaseError('FAILED_INTEGRITY_CHECKS');
      }
      return results;
    }

    this.logger.info(
      `[DatabaseClient][checkIntegrity] Checking integrity for collection ${collection as string}...`,
    );
    const now = new Date();
    const conditions: Document[] = [];
    const originOfTimes = new Date('2021-01-01');
    const errors: Record<string, Id[]> = {};
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

    this.logger.debug('[DatabaseClient][checkIntegrity] Calling MongoDB aggregate with pipeline:');
    this.logger.debug([{ $match: { $or: conditions } }, { $project: { _id: 1 } }]);

    errors.AUTOMATIC_FIELDS = (await this.database.collection(collection as string).aggregate([
      { $match: { $or: conditions } },
      { $project: { _id: 1 } },
    ]).toArray()).map((document) => new Id(`${document._id}`));

    errors.NO_RESOURCE = [];

    // Checking foreign keys...
    if (metaData.schema.enableAuthors) {
      errors.NO_RESOURCE.push(...(await this.database.collection(collection as string).aggregate([
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
    const relationsPipeline: Document[] = [];
    const missingRelations: Document[] = [];
    const transformations: Document[] = [{}, {}, {}];
    [...collectionRelations.keys()].forEach((relation) => {
      (collectionRelations.get(relation) as string[]).forEach((path) => {
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
      (collectionRelations.get(relation) as string[]).forEach((path) => {
        const flattenPath = path.replace(/\./g, '__');
        relationsPipeline.push({
          $lookup: {
            from: relation,
            as: `__${flattenPath}`,
            localField: flattenPath,
            foreignField: '_id',
            pipeline: [{ $project: { _id: 1 } }],
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

    errors.NO_RESOURCE.push(...(await this.database.collection(collection as string).aggregate([
      ...relationsPipeline,
      { $project: { _id: 1 } },
    ]).toArray()).map((document) => new Id(`${document._id}`)));

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
