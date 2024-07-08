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
  type ResourceSchema,
  type DefaultDataModel,
} from 'scripts/types.d';

/** Data model schema. */
export type DataModelSchema<DataModel> = Record<keyof DataModel, ResourceSchema<DataModel>>;

/** Data model metadata. */
export interface DataModelMetadata<SchemaType> {
  /** Data model schema. */
  schema: SchemaType;

  /** Canonical (shortest) path to the schema, starting from resource root. */
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

    Object.keys(fullSchema).forEach((resourceName) => {
      const resource = resourceName as keyof DataModel;
      const resourceSchema: ResourceSchema<DataModel> = {
        version: fullSchema[resource].version,
        enableAuthors: fullSchema[resource].enableAuthors ?? false,
        enableDeletion: fullSchema[resource].enableDeletion ?? true,
        enableTimestamps: fullSchema[resource].enableTimestamps ?? false,
        fields: {
          _id: {
            type: 'id',
            isUnique: true,
            isRequired: true,
          },
        },
      };
      if (resourceSchema.version !== undefined) {
        resourceSchema.fields._version = {
          type: 'integer',
          isIndexed: true,
          isRequired: true,
        };
      }
      if (!resourceSchema.enableDeletion) {
        resourceSchema.fields._isDeleted = {
          type: 'boolean',
          isIndexed: true,
          isRequired: true,
        };
      }
      if (resourceSchema.enableAuthors && (fullSchema as { users: unknown; }).users) {
        resourceSchema.fields._createdBy = {
          type: 'id',
          isIndexed: true,
          isRequired: resource !== 'users',
          relation: 'users' as keyof DataModel,
        };
        resourceSchema.fields._updatedBy = {
          type: 'id',
          isIndexed: true,
          relation: 'users' as keyof DataModel,
        };
      }
      if (resourceSchema.enableTimestamps) {
        resourceSchema.fields._createdAt = {
          type: 'date',
          isIndexed: true,
          isRequired: true,
        };
        resourceSchema.fields._updatedAt = {
          type: 'date',
          isIndexed: true,
        };
      }
      // To make automatic fields always appear at the top.
      fullSchema[resource] = {
        ...resourceSchema,
        ...fullSchema[resource],
        fields: {
          ...resourceSchema.fields,
          ...fullSchema[resource].fields,
        },
      };
    });

    this.schema = fullSchema;
  }

  /**
   * Returns the list of all the resources names in data model.
   *
   * @returns Data model resources names.
   */
  public getResources(): (keyof DataModel)[] {
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
    ? DataModelMetadata<ResourceSchema<DataModel>>
    : DataModelMetadata<FieldSchema<DataModel>> | null {
    const splittedPath = (path as string).split('.');
    const resource = splittedPath.shift() as keyof DataModel;
    let currentCanonicalPath = [resource as string];
    let currentSchema = this.schema[resource] as FieldSchema<DataModel> | undefined;

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
        currentSchema = { type: 'object', fields: (relationSchema as ResourceSchema<DataModel>).fields };
      }
    }

    return (currentSchema === undefined ? null : {
      schema: currentSchema,
      canonicalPath: currentCanonicalPath,
    }) as T extends keyof DataModel
      ? DataModelMetadata<ResourceSchema<DataModel>>
      : DataModelMetadata<FieldSchema<DataModel>> | null;
  }
}
