/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type FieldSchema,
  type ObjectSchema,
  type CollectionSchema,
  type DefaultDataModel,
} from 'scripts/types.d';

/** Data model schema. */
export type DataModelSchema<DataModel> = Record<keyof DataModel, CollectionSchema<DataModel>>;

/** Data model metadata. */
export interface DataModelMetadata<SchemaType> {
  /** Data model schema. */
  schema: SchemaType;

  /** Canonical (shortest) path to the schema, starting from collection's root. */
  canonicalPath: string[];
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
            isUnique: true,
            isRequired: true,
          },
        },
      };
      if (fullCollectionSchema.version !== undefined) {
        fullCollectionSchema.fields._version = {
          type: 'integer',
          isIndexed: true,
          isRequired: true,
        };
      }
      if (!fullCollectionSchema.enableDeletion) {
        fullCollectionSchema.fields._isDeleted = {
          type: 'boolean',
          isIndexed: true,
          isRequired: true,
        };
      }
      if (fullCollectionSchema.enableAuthors && (fullSchema as { users: unknown; }).users) {
        fullCollectionSchema.fields._createdBy = {
          type: 'id',
          isIndexed: true,
          isRequired: collection !== 'users',
          relation: 'users' as keyof DataModel,
        };
        fullCollectionSchema.fields._updatedBy = {
          type: 'id',
          isIndexed: true,
          relation: 'users' as keyof DataModel,
        };
      }
      if (fullCollectionSchema.enableTimestamps) {
        fullCollectionSchema.fields._createdAt = {
          type: 'date',
          isIndexed: true,
          isRequired: true,
        };
        fullCollectionSchema.fields._updatedAt = {
          type: 'date',
          isIndexed: true,
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
   * Returns data model metadata for `path`.
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
    let currentCanonicalPath = [collection as string];
    let currentSchema = this.schema[collection] as FieldSchema<DataModel> | undefined;

    // Walking through the schema...
    while (splittedPath.length > 0 && currentSchema !== undefined) {
      const subPath = String(splittedPath.shift());
      currentCanonicalPath.push(subPath);
      currentSchema = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields?.[subPath];

      if (currentSchema?.type === 'array') {
        currentSchema = { type: 'object', fields: { [subPath]: currentSchema.fields } };
        splittedPath.splice(0, 0, subPath);
        currentCanonicalPath.splice(-1, 1);
      } else if (currentSchema?.type === 'id' && currentSchema.relation !== undefined && splittedPath.length > 0) {
        const { relation } = currentSchema;
        currentCanonicalPath = [relation as string];
        const relationSchema = (this.get(relation) as DataModelMetadata<DataModel>).schema;
        currentSchema = { type: 'object', fields: (relationSchema as CollectionSchema<DataModel>).fields };
      }
    }

    return (currentSchema === undefined ? null : {
      schema: currentSchema,
      canonicalPath: currentCanonicalPath,
    }) as T extends keyof DataModel
      ? DataModelMetadata<CollectionSchema<DataModel>>
      : DataModelMetadata<FieldSchema<DataModel>> | null;
  }
}
