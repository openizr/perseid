/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Id from 'scripts/classes/NodeId';
import toSnakeCase from 'scripts/helpers/toSnakeCase';

/**
 * Resources with an `_id` field.
 */
export interface Ids {
  /**
   * Resource id.
   */
  _id: Id;
}

/**
 * Resources with timestamps-related automatic fields.
 */
export interface Timestamps {
  /**
   * Resource creation date.
   */
  _createdAt: Date;

  /**
   * Resource last modification date.
   */
  _updatedAt: Date | null;
}

/**
 * Resources with authors-related automatic fields.
 */
export interface Authors {
  /**
   * Resource creation author.
   */
  _createdBy: Id;

  /**
   * Resource last modification author.
   */
  _updatedBy: Id | null;
}

/**
 * Soft-deletable resources.
 */
export interface Deletion {
  /**
   * Whether resource has been deleted.
   */
  _isDeleted: boolean;
}

/**
 * Users-related data model.
 */
export interface UserDataModel {
  /**
   * Set of permissions, grouped for a specific purpose.
   */
  roles: Ids & Timestamps & Authors & {
    /**
     * Role name.
     */
    name: string;

    /**
     * List of permissions granted by this role.
     */
    permissions: string[];
  };

  /**
   * User.
   */
  users: Ids & Timestamps & Deletion & Authors & {
    /**
     * User verification date.
     */
    _verifiedAt: Date | null;

    /**
     * List of user devices.
     */
    _devices: {
      /**
       * Device id.
       */
      _id: string;

      /**
       * Device user agent.
       */
      _userAgent: string;

      /**
       * Refresh token expiration date.
       */
      _expiration: Date;

      /**
       * Refresh token to use for that device.
       */
      _refreshToken: string;
    }[];
    /**
     * User email.
     */
    email: string;

    /**
     * User password.
     */
    password: string;

    /**
     * User roles.
     */
    roles: Id[];
  };
}

/**
 * Search or list results.
 */
export interface Results<Resource> {
  /**
   * Total number of results that matched query.
   */
  total: number;

  /**
   * Limited list of results that are actually returned.
   */
  results: Resource[];
}

/**
 * Common properties for all data model fields schemas.
 */
export interface GenericFieldSchema {
  /**
   * Field description, used to generate documentation.
   */
  description: string;

  /**
   * Whether field is required.
   */
  isRequired?: boolean;

  /**
   * Required permission to access this field. `null` is a special value specifying that the field
   * is private and should not be accessible to anyone, no matter their permissions. It may be
   * especially useful for fields that are not meant to be accessible to users, such as credentials.
   */
  permission?: string | null;

  /**
   * Custom error messages for when user inputs do not match data model.
   */
  errorMessages?: Record<string, string>;
}

/**
 * Data model string field schema.
 */
export interface StringSchema extends GenericFieldSchema {
  /**
   * Data type.
   */
  type: 'string';

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  isIndexed?: boolean;

  /**
   * Specific set of values allowed for that field.
   */
  enum?: string[];

  /**
   * Whether field value should be unique across all resources of that type (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  isUnique?: boolean;

  /**
   * RegExp user inputs must pass for that field.
   */
  pattern?: RegExp;

  /**
   * Field minimum length.
   */
  minLength?: number;

  /**
   * Field maximum length.
   */
  maxLength: number;
}

/**
 * Data model number field schema.
 */
export interface NumberSchema extends GenericFieldSchema {
  /**
   * Data type.
   */
  type: 'integer' | 'float';

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  isIndexed?: boolean;

  /**
   * Specific set of values allowed for that field.
   */
  enum?: number[];

  /**
   * Whether field value should be unique across all resources of that type (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  isUnique?: boolean;

  /**
   * Field minimum value.
   */
  minimum?: number;

  /**
   * Field maximum value.
   */
  maximum?: number;

  /**
   * Field exclusive minimum value.
   */
  exclusiveMinimum?: number;

  /**
   * Field exclusive maximum value.
   */
  exclusiveMaximum?: number;

  /**
   * Value to use as a multiple for user inputs.
   */
  multipleOf?: number;
}

/**
 * Data model boolean field schema.
 */
export interface BooleanSchema extends GenericFieldSchema {
  /**
   * Data type.
   */
  type: 'boolean';

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  isIndexed?: boolean;
}

/**
 * Data model id field schema.
 */
export interface IdSchema<DataModel> extends GenericFieldSchema {
  /**
   * Data type.
   */
  type: 'id';

  /**
   * Specific set of values allowed for that field.
   */
  enum?: Id[];

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  isIndexed?: boolean;

  /**
   * Whether field value should be unique across all resources of that type (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  isUnique?: boolean;

  /**
   * Name of the resource type the id refers to. See it as a foreign key.
   */
  relation?: keyof DataModel & string;
}

/**
 * Data model date field schema.
 */
export interface DateSchema extends GenericFieldSchema {
  /**
   * Data type.
   */
  type: 'date';

  /**
   * Specific set of values allowed for that field.
   */
  enum?: Date[];

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  isIndexed?: boolean;

  /**
   * Whether field value should be unique across all resources of that type (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  isUnique?: boolean;
}

/**
 * Data model binary field schema.
 */
export interface BinarySchema extends GenericFieldSchema {
  /**
   * Data type.
   */
  type: 'binary';
}

/**
 * Data model null field schema.
 */
export interface NullSchema extends GenericFieldSchema {
  /**
   * Data type.
   */
  type: 'null';
}

/**
 * Data model object field schema.
 */
export interface ObjectSchema<DataModel> extends GenericFieldSchema {
  /**
   * Data type.
   */
  type: 'object';

  /**
   * Sub-fields data model.
   */
  fields: Record<string, FieldSchema<DataModel>>;
}

/**
 * Data model array field schema.
 */
export interface ArraySchema<DataModel> extends Omit<GenericFieldSchema, 'description'> {
  /**
   * Data type.
   */
  type: 'array';

  /**
   * Minimum required number of items in the array.
   */
  minItems?: number;

  /**
   * Maximum allowed number of items in the array.
   */
  maxItems?: number;

  /**
   * Items data model.
   */
  fields: Exclude<FieldSchema<DataModel>, ArraySchema<DataModel>>;

  /**
   * Whether each array item should be unique.
   */
  uniqueItems?: boolean;
}

/**
 * Any Data model field schema.
 */
export type FieldSchema<DataModel> = (
  NullSchema |
  DateSchema |
  NumberSchema |
  StringSchema |
  BinarySchema |
  BooleanSchema |
  IdSchema<DataModel> |
  ArraySchema<DataModel> |
  ObjectSchema<DataModel>
);

/**
 * Data model resource schema.
 */
export interface ResourceSchema<T> {
  /**
   * Whether to generate and manage `_createdBy` and `_updatedBy` fields for that resource.
   */
  enableAuthors?: boolean;

  /**
   * Whether to generate and manage the `_isDeleted` field for that resource.
   */
  enableDeletion?: boolean;

  /**
   * Whether to generate and managen`_createdAt` and `_updatedAt` fields for that resource.
   */
  enableTimestamps?: boolean;

  /**
   * List of allowed operations for that resource. If an operation is not allowed, engines will
   * throw an error when users try to perform it.
   * If not provided, all operations (CREATE, VIEW, LIST, UPDATE, DELETE) are allowed.
   */
  allowedOperations?: ('CREATE' | 'VIEW' | 'LIST' | 'UPDATE' | 'DELETE')[];

  /**
   * Resource fields data model.
   */
  fields: Record<string, FieldSchema<T>>;

  /**
   * Resource description, used to generate documentation.
   */
  description: string;

}

/**
 * Data model schema.
 */
export type DataModelSchema<DataModel> = Record<
  keyof DataModel & string,
  ResourceSchema<DataModel>
>;

/**
 * Data model metadata.
 */
export interface DataModelMetadata<SchemaType> {
  /**
   * Data model schema.
   */
  schema: SchemaType;

  /**
   * Depth of the path in the data model. A new level of depth is added whenever walking through
   * a new relation in the data model.
   *
   * @example
   * - `users._id` has 1 level of depth.
   * - `users.roles._id` has 2 levels of depth.
   * - `users.roles._createdBy._id` has 3 levels of depth.
   */
  depth: number;

  /**
   * List of required permissions to access data located at this path.
   *
   * @example
   * - `users._id` has [`USERS.VIEW`] permissions.
   * - `users._devices._id` has [`USERS.VIEW`, `USERS.VIEW_DETAILS`] permissions.
   */
  permissions: (string | null)[];

  /**
   * Canonical (shortest) path to the schema, starting from resource root.
   *
   * @example
   * - Canonical path for `users._id` is [`users`, `_id`].
   * - Canonical path for `users.roles._id` is [`roles`, `_id`].
   * - Canonical path for `users.roles._createdBy._id` is [`users`, `_id`].
   */
  canonicalPath: string[];
}

/**
 * Provides useful methods to interact with the data model schema.
 */
export default class Model<
  /**
   * Data model type definition.
   */
  DataModel extends object,
> {
  /**
   * Data model schema.
   */
  protected schema: Partial<DataModelSchema<DataModel>>;

  /**
   * Class constructor.
   *
   * @param schemaFragment Data model schema to generate data model from.
   * Can be the complete schema, or just a fragment of it. Defaults to `{}`.
   */
  constructor(schemaFragment?: Partial<DataModelSchema<DataModel>>) {
    this.schema = {};
    this.addFragment(schemaFragment ?? {});
  }

  /**
   * Adds `schemaFragment` to the existing data model.
   *
   * @param schemaFragment Fragment of data model schema. Contains a subset of resources schemas.
   */
  public addFragment(schemaFragment: Partial<DataModelSchema<DataModel>>): void {
    const fullSchema = schemaFragment as DataModelSchema<DataModel>;
    const defaultAllowedOperations: ('CREATE' | 'VIEW' | 'LIST' | 'UPDATE' | 'DELETE')[] = [
      'CREATE',
      'VIEW',
      'LIST',
      'UPDATE',
      'DELETE',
    ];
    (Object.keys(schemaFragment) as (keyof DataModel & string)[]).forEach((resource) => {
      const resourceSchema: ResourceSchema<DataModel> = {
        description: fullSchema[resource].description,
        enableAuthors: fullSchema[resource].enableAuthors ?? false,
        enableDeletion: fullSchema[resource].enableDeletion ?? true,
        enableTimestamps: fullSchema[resource].enableTimestamps ?? false,
        allowedOperations: fullSchema[resource].allowedOperations ?? defaultAllowedOperations,
        fields: {
          _id: {
            type: 'id',
            isUnique: true,
            isRequired: true,
            description: 'Resource unique identifier.',
          },
        },
      };
      if (!resourceSchema.enableDeletion) {
        resourceSchema.fields._isDeleted = {
          type: 'boolean',
          isIndexed: true,
          isRequired: true,
          description: 'Whether the resource has been deleted.',
        };
      }
      if (resourceSchema.enableAuthors) {
        const _createdBy: IdSchema<DataModel> = {
          type: 'id',
          isIndexed: true,
          isRequired: resource !== 'users',
          relation: 'users' as keyof DataModel & string,
          description: 'Resource creation author.',
        };
        const _updatedBy: IdSchema<DataModel> = {
          type: 'id',
          isIndexed: true,
          relation: 'users' as keyof DataModel & string,
          description: 'Resource last modification author.',
        };
        resourceSchema.fields._createdBy = _createdBy;
        resourceSchema.fields._updatedBy = _updatedBy;
      }
      if (resourceSchema.enableTimestamps) {
        resourceSchema.fields._createdAt = {
          type: 'date',
          isIndexed: true,
          isRequired: true,
          description: 'Resource creation date.',
        };
        resourceSchema.fields._updatedAt = {
          type: 'date',
          isIndexed: true,
          description: 'Resource last modification date.',
        };
      }
      // To make automatic fields always appear at the top.
      this.schema[resource] = {
        ...resourceSchema,
        ...schemaFragment[resource],
        fields: {
          ...resourceSchema.fields,
          ...fullSchema[resource].fields,
        },
      };
    });
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
  public get(path: keyof DataModel): DataModelMetadata<ResourceSchema<DataModel>>;

  public get(path: string): DataModelMetadata<FieldSchema<DataModel>> | null;

  public get(
    path: keyof DataModel | string,
  ): DataModelMetadata<ResourceSchema<DataModel> | FieldSchema<DataModel>> | null {
    let depth = 1;
    const splittedPath = String(path).split('.');
    const resource = splittedPath.shift() as keyof DataModel & string;
    let currentCanonicalPath: string[] = [resource];
    const permissions = new Set<string | null>([`${toSnakeCase(resource)}.VIEW`]);
    let currentSchema = this.schema[resource] as FieldSchema<DataModel> | undefined;

    // Walking through the schema...
    while (splittedPath.length > 0 && currentSchema !== undefined) {
      const subPath = String(splittedPath.shift());
      currentCanonicalPath.push(subPath);
      currentSchema = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields?.[subPath];

      if (currentSchema?.permission !== undefined) {
        permissions.add(currentSchema.permission);
      }

      if (currentSchema?.type === 'array' && splittedPath.length > 0) {
        currentSchema = currentSchema.fields;
      }

      if (currentSchema?.type === 'id' && currentSchema.relation !== undefined && splittedPath.length > 0) {
        depth += 1;
        const { relation } = currentSchema;
        currentCanonicalPath = [relation];
        const relationMetadata = this.get(relation);
        permissions.add(`${toSnakeCase((relation))}.VIEW`);
        currentSchema = {
          type: 'object',
          fields: relationMetadata.schema.fields,
          description: relationMetadata.schema.description,
        };
      }
    }

    return (currentSchema === undefined ? null : {
      depth,
      schema: currentSchema,
      permissions: [...permissions],
      canonicalPath: currentCanonicalPath,
    });
  }
}
