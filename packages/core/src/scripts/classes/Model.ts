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
  type IdSchema,
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
  DataModel extends DefaultDataModel = DefaultDataModel,
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

    (Object.keys(fullSchema) as (keyof DataModel & string)[]).forEach((resource) => {
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
      if (resourceSchema.enableAuthors) {
        const _createdBy: IdSchema<DataModel> = {
          type: 'id',
          isIndexed: true,
          isRequired: resource !== 'users',
          relation: 'users',
        };
        const _updatedBy: IdSchema<DataModel> = {
          type: 'id',
          isIndexed: true,
          relation: 'users',
        };
        resourceSchema.fields._createdBy = _createdBy;
        resourceSchema.fields._updatedBy = _updatedBy;
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
   * Returns the list of all the resources types in data model.
   *
   * @returns Data model resources types.
   */
  public getResources(): (keyof DataModel & string)[] {
    return Object.keys(this.schema) as (keyof DataModel & string)[];
  }

  /**
   * Returns data model metadata for `path`.
   *
   * @param path Path in the data model for which to get metadata.
   *
   * @returns Data model metadata if path exists, `null` otherwise.
   */
  public get<Path extends keyof DataModel | string>(path: Path): (
    Path extends keyof DataModel
    ? DataModelMetadata<ResourceSchema<DataModel>>
    : DataModelMetadata<FieldSchema<DataModel>> | null
  ) {
    const splittedPath = (path as string).split('.');
    const resource = splittedPath.shift() as keyof DataModel;
    let currentCanonicalPath: string[] = [resource as string];
    let currentSchema = this.schema[resource] as FieldSchema<DataModel> | undefined;

    // Walking through the schema...
    while (splittedPath.length > 0 && currentSchema !== undefined) {
      const subPath = String(splittedPath.shift());
      currentCanonicalPath.push(subPath);
      currentSchema = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields?.[subPath];

      if (currentSchema?.type === 'array') {
        currentSchema = currentSchema.fields;
      }

      if (currentSchema?.type === 'id' && currentSchema.relation !== undefined && splittedPath.length > 0) {
        const { relation } = currentSchema;
        currentCanonicalPath = [relation as string];
        const relationMetadata = this.get(relation) as DataModelMetadata<ResourceSchema<DataModel>>;
        currentSchema = { type: 'object', fields: relationMetadata.schema.fields };
      }
    }

    return (currentSchema === undefined ? null : {
      schema: currentSchema,
      canonicalPath: currentCanonicalPath,
    }) as Path extends keyof DataModel
      ? DataModelMetadata<ResourceSchema<DataModel>>
      : DataModelMetadata<FieldSchema<DataModel>> | null;
  }
}
