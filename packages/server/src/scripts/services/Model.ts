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
  type DataModelSchema,
  type DefaultDataModel,
  type CollectionSchema,
  type DataModelMetadata,
} from '@perseid/core';

/**
 * Data model.
 */
export default class Model<
  /** Data model types definitions. */
  DataModel = DefaultDataModel,
> extends BaseModel<DataModel> {
  /** Public data model schema, used for data model introspection on front-end. */
  protected publicSchema: DataModelSchema<DataModel>;

  /** List of relations per collection, along with their respective path in the model. */
  protected relationsPerCollection: { [Collection in keyof DataModel]: Set<string> };

  /** Default data model schema. */
  public static readonly DEFAULT_MODEL: DataModelSchema<DefaultDataModel> = {
    // TODO create a specific 'point' type and proper index type in @perseid.
    // _location: {
    //   type: 'object',
    //   required: true,
    //   fields: {
    //     type: {
    //       type: 'string',
    //       enum: ['Point'],
    //       required: true,
    //     },
    //     coordinates: {
    //       type: 'array',
    //       required: true,
    //       maxItems: 2,
    //       minItems: 2,
    //       fields: {
    //         type: 'float',
    //         maximum: 90,
    //         minimum: -90,
    //         required: true,
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
          index: true,
          type: 'date',
        },
        _devices: {
          type: 'array',
          required: true,
          fields: {
            type: 'object',
            required: true,
            fields: {
              userAgent: { type: 'string', required: true },
              expiration: { type: 'date', required: true },
              refreshToken: { type: 'string', required: true },
              id: { type: 'string', pattern: /^[0-9a-fA-F]{24}$/.source, required: true },
            },
          },
        },
        _apiKeys: {
          type: 'array',
          required: true,
          fields: Model.token(),
        },
        email: Model.email({ unique: true }),
        password: Model.password(),
        roles: {
          type: 'array',
          required: true,
          fields: {
            type: 'id',
            index: true,
            required: true,
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
        name: Model.tinyText({ index: true }), // TODO capitalized
        permissions: {
          type: 'array',
          required: true,
          fields: {
            type: 'string',
            required: true,
            pattern: /^[0-9A-Z_]+$/.source,
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
   * model. If this parameter is passed, a list of all collections referenced directly or indirectly
   * (i.e. by following subsequent relations) in the model will be generated and stored in that
   * variable. For instance, if `schema` contains a field that references a collection A, that in
   * turn references collection B, that eventually references the initial collection, the following
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
      if (!isRelationAlreadyProcessed) {
        relations.add(relation);
        const data = this.get(schema.relation) as DataModelMetadata<CollectionSchema<DataModel>>;
        this.generatePublicSchemaFrom({ type: 'object', fields: data.schema.fields }, relations);
      }
    }
    const { unique, index, ...subRest } = rest as Omit<StringSchema, 'type'>;
    return { type, index: unique ?? index, ...subRest } as FieldSchema<DataModel>;
  }

  /**
   * `email` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static email(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      customType: 'email',
      errorMessages: {
        type: 'must be a valid email',
        pattern: 'must be a valid email',
      },
      pattern: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.source,
      ...overrides,
      required: overrides.required !== false,
    };
  }

  /**
   * `tinyText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static tinyText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      maxLength: 50,
      type: 'string',
      customType: 'tinyText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `shortText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static shortText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 100,
      customType: 'shortText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `mediumText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static mediumText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 500,
      customType: 'mediumText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `longText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static longText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 2500,
      customType: 'longText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `hugeText` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static hugeText(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 10000,
      customType: 'hugeText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `token` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static token(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      customType: 'token',
      pattern: /^[0-9A-Za-z]{24}$/.source,
      errorMessages: {
        type: 'must be a valid token',
        pattern: 'must be a valid token',
      },
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `password` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static password(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      customType: 'password',
      pattern: /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/.source,
      errorMessages: {
        type: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char)',
        pattern: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char)',
      },
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `credentials` custom data model schema type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static credentials(
    overrides: Partial<ObjectSchema<unknown>> = {},
  ): ObjectSchema<unknown> {
    return {
      type: 'object',
      customType: 'credentials',
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
          required: true,
        },
      },
      required: overrides.required !== false,
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
    const collections = Object.keys(schema);
    const publicSchema = {} as DataModelSchema<DataModel>;
    const relationsPerCollection = {} as { [Collection in keyof DataModel]: Set<string> };
    (collections as (keyof DataModel)[]).forEach((collection) => {
      relationsPerCollection[collection] = new Set();
      const { fields } = this.schema[collection];
      publicSchema[collection] = this.generatePublicSchemaFrom(
        { type: 'object', fields },
        relationsPerCollection[collection],
      ) as CollectionSchema<DataModel>;
    });
    this.publicSchema = publicSchema;
    this.relationsPerCollection = relationsPerCollection;
  }

  /**
   * Returns public data model schema for `collection`, and all its direct or indirect relations.
   *
   * @param collection Name of the collection for which to get public data model schema.
   *
   * @returns Public data model schema for all related collections if they exist, `null` otherwise.
   */
  public getPublicSchema(collection: keyof DataModel): DataModelSchema<DataModel> | null {
    const relations = this.relationsPerCollection as unknown as Record<keyof DataModel, unknown>;
    if (relations[collection] === undefined) {
      return null;
    }
    // TODO include collection model...
    const collections = [...this.relationsPerCollection[collection]] as (keyof DataModel)[];
    return collections.reduce((finalSchema, currentCollection) => ({
      ...finalSchema,
      [currentCollection]: this.publicSchema[currentCollection],
    }), { [collection]: this.publicSchema[collection] }) as DataModelSchema<DataModel>;
  }
}
