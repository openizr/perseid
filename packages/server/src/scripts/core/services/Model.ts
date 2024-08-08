/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Model as BaseModel,
  type ArraySchema,
  type FieldSchema,
  type StringSchema,
  type ObjectSchema,
  type ResourceSchema,
  type DataModelSchema,
  type DefaultDataModel,
  type DataModelMetadata,
} from '@perseid/core';

/**
 * Data model.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/Model.ts
 */
export default class Model<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,
> extends BaseModel<DataModel> {
  /** Public data model schema, used for data model introspection on front-end. */
  protected publicSchema: DataModelSchema<DataModel>;

  /** List of relations per resource, along with their respective path in the model. */
  protected relationsPerResource: { [Resource in keyof DataModel]: Set<string> };

  /** Default data model schema. */
  public static readonly DEFAULT_MODEL: DataModelSchema<DefaultDataModel> = {
    // TODO create a specific 'point' type and proper index type in @perseid.
    // _location: {
    //   type: 'object',
    //   isRequired: true,
    //   fields: {
    //     type: {
    //       type: 'string',
    //       enum: ['Point'],
    //       isRequired: true,
    //     },
    //     coordinates: {
    //       type: 'array',
    //       isRequired: true,
    //       maxItems: 2,
    //       minItems: 2,
    //       fields: {
    //         type: 'float',
    //         maximum: 90,
    //         minimum: -90,
    //         isRequired: true,
    //       },
    //     },
    //   },
    // },
    users: {
      version: 1,
      enableAuthors: true,
      enableDeletion: false,
      enableTimestamps: true,
      fields: {
        _verifiedAt: {
          isIndexed: true,
          type: 'date',
        },
        _devices: {
          type: 'array',
          isRequired: true,
          fields: {
            type: 'object',
            isRequired: true,
            fields: {
              _userAgent: { type: 'string', isRequired: true },
              _expiration: { type: 'date', isRequired: true },
              _refreshToken: { type: 'string', isRequired: true },
              _id: { type: 'string', pattern: /^[0-9a-fA-F]{24}$/, isRequired: true },
            },
          },
        },
        _apiKeys: {
          type: 'array',
          isRequired: true,
          fields: Model.token(),
        },
        email: Model.email({ isUnique: true }),
        password: Model.password(),
        roles: {
          type: 'array',
          isRequired: true,
          fields: {
            type: 'id',
            isIndexed: true,
            isRequired: true,
            relation: 'roles',
          },
        },
      },
    },
    roles: {
      version: 1,
      enableAuthors: true,
      enableDeletion: true,
      enableTimestamps: true,
      fields: {
        name: Model.tinyText({ isUnique: true, pattern: /^[0-9A-Z_]+$/ }),
        permissions: {
          type: 'array',
          isRequired: true,
          fields: {
            type: 'string',
            isRequired: true,
            maxLength: 256,
            pattern: /^[0-9A-Z_]+$/,
          },
        },
      },
    },
  };

  /**
   * Generates public data schema from `schema`.
   *
   * @param schema Data model schema from which to generate public schema.
   *
   * @param relations Optional parameter, use it to also extract all relations declared in the
   * model. If this parameter is passed, a list of all resources referenced directly or indirectly
   * (i.e. by following subsequent relations) in the model will be generated and stored in that
   * variable. For instance, if `schema` contains a field that references a resource A, that in
   * turn references resource B, that eventually references the initial resource, the following
   * list will be generated: `["A", "B"]`. Defaults to `new Set()`.
   */
  protected generatePublicSchemaFrom(
    schema: FieldSchema<DataModel>,
    relations = new Set<string>(),
  ): FieldSchema<DataModel> {
    const { errorMessages, type, ...rest } = schema;
    if (errorMessages) {
      // No-op.
    }
    if (type === 'array') {
      const { fields } = schema;
      return {
        type,
        ...rest,
        fields: this.generatePublicSchemaFrom(fields, relations),
      } as ArraySchema<DataModel>;
    }
    if (type === 'object') {
      return {
        type,
        ...rest,
        fields: Object.keys(schema.fields).reduce((fields, key) => ({
          ...fields,
          [key]: this.generatePublicSchemaFrom(schema.fields[key], relations),
        }), {}),
      } as FieldSchema<DataModel>;
    }
    if (type === 'id' && schema.relation !== undefined) {
      const relation = schema.relation as string;
      const isRelationAlreadyProcessed = relations.has(relation);
      const data = this.get(schema.relation) as DataModelMetadata<ResourceSchema<DataModel>>;
      if (!isRelationAlreadyProcessed) {
        relations.add(relation);
        this.generatePublicSchemaFrom({ type: 'object', fields: data.schema.fields }, relations);
      }
    }
    const { isUnique, isIndexed, ...subRest } = rest as Omit<StringSchema, 'type'>;
    return {
      type,
      isIndexed: isUnique === true || isIndexed === true,
      ...subRest,
    } as FieldSchema<DataModel>;
  }

  /**
   * `email` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static email(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      errorMessages: {
        type: 'must be a valid email',
        pattern: 'must be a valid email',
      },
      maxLength: 320,
      pattern: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      ...overrides,
      isRequired: overrides.isRequired !== false,
    };
  }

  /**
   * `tinyText` custom data model schema type generator. TODO describe what is a tiny/short/... text
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static tinyText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      maxLength: 50,
      type: 'string',
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `shortText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static shortText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 100,
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `mediumText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static mediumText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 500,
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `longText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static longText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 2500,
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `hugeText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static hugeText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 10000,
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `token` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static token(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 24,
      pattern: /^[0-9A-Za-z]{24}$/,
      errorMessages: {
        type: 'must be a valid token',
        pattern: 'must be a valid token',
      },
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `password` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static password(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 500,
      pattern: /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/,
      errorMessages: {
        type: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char)',
        pattern: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char)',
      },
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `credentials` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static credentials(
    overrides: Partial<ObjectSchema<unknown>> = {},
  ): ObjectSchema<unknown> {
    return {
      type: 'object',
      fields: {
        deviceId: Model.token(),
        refreshToken: Model.token(),
        expiresIn: {
          type: 'integer',
          minimum: 0,
        },
        accessToken: {
          type: 'string',
          minLength: 10,
          maxLength: 500,
          isRequired: true,
        },
      },
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * Class constructor.
   *
   * @param schema Schema from which to generate data model.
   */
  constructor(schema: DataModelSchema<DataModel>) {
    super(schema);
    const resources = Object.keys(schema);
    const publicSchema = {} as DataModelSchema<DataModel>;
    const relationsPerResource = {} as { [Resource in keyof DataModel]: Set<string> };
    (resources as (keyof DataModel)[]).forEach((resource) => {
      relationsPerResource[resource] = new Set();
      const { fields } = this.schema[resource];
      publicSchema[resource] = this.generatePublicSchemaFrom(
        { type: 'object', fields },
        relationsPerResource[resource],
      ) as ResourceSchema<DataModel>;
    });
    this.publicSchema = publicSchema;
    this.relationsPerResource = relationsPerResource;
  }

  /**
   * Returns public data model schema for `resource`, and all its direct or indirect relations.
   *
   * @param resource Name of the resource for which to get public data model schema.
   *
   * @returns Public data model schema for all related resources if they exist, `null` otherwise.
   */
  public getPublicSchema(resource: keyof DataModel): DataModelSchema<DataModel> | null {
    const relations = this.relationsPerResource as unknown as Record<keyof DataModel, unknown>;
    if (relations[resource] === undefined) {
      return null;
    }
    const resources = [...this.relationsPerResource[resource]] as (keyof DataModel)[];
    return resources.reduce((finalSchema, currentResource) => ({
      ...finalSchema,
      [currentResource]: this.publicSchema[currentResource],
    }), { [resource]: this.publicSchema[resource] }) as DataModelSchema<DataModel>;
  }
}
