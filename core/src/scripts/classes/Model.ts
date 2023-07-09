/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type NullSchema,
  type FieldSchema,
  type ObjectSchema,
  type CollectionSchema,
  type DefaultDataModel,
} from 'scripts/types.d';
import toSnakeCase from 'scripts/helpers/toSnakeCase';

/** Data model schema. */
export type DataModelSchema<DataModel> = Record<keyof DataModel, CollectionSchema<DataModel>>;

/** Data model metadata. */
export interface DataModelMetadata<SchemaType> {
  permissions: Set<string>;
  schema: SchemaType;
}

/**
 * Data model.
 */
export default class Model<
  /** Data model types definitions. */
  DataModel = DefaultDataModel,
> {
  /** Data model schema. */
  protected schema: DataModelSchema<DataModel>;

  /**
   * Class constructor.
   *
   * @param schema Schema from which to generate data model. Defaults to `{}`.
   */
  constructor(schema?: DataModelSchema<DataModel>) {
    const fullSchema = { ...schema } as DataModelSchema<DataModel>;

    Object.keys(fullSchema).forEach((collectionName) => {
      const collection = collectionName as keyof DataModel;
      const fullCollectionSchema: CollectionSchema<DataModel> = {
        version: fullSchema[collection].version,
        enableAuthors: fullSchema[collection].enableAuthors ?? false,
        enableDeletion: fullSchema[collection].enableDeletion ?? true,
        enableTimestamps: fullSchema[collection].enableTimestamps ?? false,
        fields: {
          _id: {
            type: 'id',
            index: true,
            required: true,
          },
        },
      };
      if (fullCollectionSchema.version !== undefined) {
        fullCollectionSchema.fields._version = {
          type: 'integer',
          index: true,
          required: true,
        };
      }
      if (!fullCollectionSchema.enableDeletion) {
        fullCollectionSchema.fields._isDeleted = {
          type: 'boolean',
          index: true,
          required: true,
          default: false,
        };
      }
      if (fullCollectionSchema.enableAuthors && (fullSchema as { users: unknown; }).users) {
        fullCollectionSchema.fields._createdBy = {
          type: 'id',
          index: true,
          required: collection !== 'users',
          relation: 'users' as keyof DataModel,
        };
        fullCollectionSchema.fields._updatedBy = {
          type: 'id',
          index: true,
          relation: 'users' as keyof DataModel,
        };
      }
      if (fullCollectionSchema.enableTimestamps) {
        fullCollectionSchema.fields._createdAt = {
          type: 'date',
          index: true,
          required: true,
        };
        fullCollectionSchema.fields._updatedAt = {
          type: 'date',
          index: true,
        };
      }
      // To make automatic fields always appear at the top.
      fullSchema[collection] = {
        ...fullCollectionSchema,
        ...fullSchema[collection],
        fields: {
          ...fullCollectionSchema.fields,
          ...fullSchema[collection].fields,
        },
      };
    });

    this.schema = fullSchema;
  }

  /**
   * Returns the list of all the collections names in data model.
   *
   * @returns Data model collections names.
   */
  public getCollections(): (keyof DataModel)[] {
    return Object.keys(this.schema) as (keyof DataModel)[];
  }

  /**
   * Returns data model metadata (schema, permissions, ...) for `path`.
   *
   * @param path Path in the data model for which to get metadata.
   *
   * @returns Data model metadata if path exists, `null` otherwise.
   */
  public get<T>(path: T): T extends keyof DataModel
    ? DataModelMetadata<CollectionSchema<DataModel>>
    : DataModelMetadata<FieldSchema<DataModel>> | null {
    const splittedPath = (path as string).split('.');
    const collection = splittedPath.shift() as keyof DataModel;
    let currentSchema = this.schema[collection] as FieldSchema<DataModel>;
    const permissions = new Set<string>([`${toSnakeCase(collection as string)}_VIEW`]);
    const addPermission = permissions.add.bind(permissions);

    // Walking through the schema...
    while (splittedPath.length > 0 && currentSchema !== undefined) {
      const subPath = splittedPath.shift() as string;
      currentSchema = (currentSchema as ObjectSchema<DataModel>).fields?.[subPath];
      (currentSchema as ObjectSchema<DataModel>)?.permissions?.forEach(addPermission);

      if (currentSchema?.type === 'array') {
        currentSchema = { type: 'object', fields: { [subPath]: currentSchema.fields } };
        (currentSchema.fields[subPath] as NullSchema).permissions?.forEach(addPermission);
        splittedPath.splice(0, 0, subPath);
      } else if (currentSchema?.type === 'id' && currentSchema.relation !== undefined && splittedPath.length > 0) {
        const relation = currentSchema.relation as string;
        addPermission(`${toSnakeCase(relation)}_VIEW`);
        const relationSchema = (this.get(relation) as DataModelMetadata<DataModel>).schema;
        currentSchema = { type: 'object', fields: (relationSchema as CollectionSchema<DataModel>).fields };
      } else if (currentSchema?.type === 'dynamicObject') {
        const subFields = currentSchema.fields;
        const patterns = Object.keys(subFields).map((pattern) => new RegExp(pattern));
        const pattern = (patterns.find((p) => p.test(splittedPath[0])) as RegExp)?.source;
        currentSchema = { type: 'object', fields: { [splittedPath[0]]: subFields[pattern] } };
      }
    }

    return (currentSchema === undefined ? null : {
      permissions,
      schema: currentSchema,
    }) as T extends keyof DataModel
      ? DataModelMetadata<CollectionSchema<DataModel>>
      : DataModelMetadata<FieldSchema<DataModel>> | null;
  }
}
