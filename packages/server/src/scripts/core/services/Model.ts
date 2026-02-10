/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  type IdSchema,
  type ArraySchema,
  type FieldSchema,
  type StringSchema,
  type ObjectSchema,
  Model as BaseModel,
  type UserDataModel,
  type ResourceSchema,
  type DataModelSchema,
  type NumberSchema,
} from '@perseid/core';

/**
 * Data model.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/Model.ts
 */
export default class Model<
  /**
   * Data model type definition.
   */
  DataModel extends object,
> extends BaseModel<DataModel> {
  /**
   * Public data model schema, used for data model introspection on front-end.
   */
  protected publicSchema: DataModelSchema<DataModel>;

  /**
   * List of relations per resource, along with their respective path in the model.
   */
  protected relationsPerResource: Partial<Record<keyof DataModel, Set<keyof DataModel & string>>>;

  /**
   * Users-related data model schema.
   */
  public static readonly USERS_MODEL: DataModelSchema<UserDataModel> = {
    users: {
      enableAuthors: true,
      enableDeletion: false,
      enableTimestamps: true,
      description: 'User information.',
      fields: {
        _verifiedAt: {
          isIndexed: true,
          type: 'date',
          description: 'User verification date.',
        },
        // TODO rename into sessions
        _devices: {
          type: 'array',
          isRequired: true,
          permission: 'USERS.VIEW_DETAILS',
          fields: {
            type: 'object',
            isRequired: true,
            description: 'Device information.',
            fields: {
              _id: Model.token(),
              _expiration: {
                type: 'date',
                isRequired: true,
                description: 'Device refresh token expiration date.',
              },
              _userAgent: {
                type: 'string',
                maxLength: 256,
                isRequired: true,
                description: 'Device user agent.',
              },
              _refreshToken: {
                type: 'string',
                maxLength: 24,
                isRequired: true,
                description: 'Device refresh token to use for that device.',
              },
            },
          },
        },
        email: Model.email({ isUnique: true }),
        password: Model.password({ permission: null }),
        roles: {
          type: 'array',
          isRequired: true,
          fields: {
            type: 'id',
            isIndexed: true,
            isRequired: true,
            relation: 'roles',
            description: 'Role ID.',
          },
        },
      },
    },
    roles: {
      enableAuthors: true,
      enableDeletion: true,
      enableTimestamps: true,
      description: 'Role information.',
      fields: {
        name: Model.tinyText({ isUnique: true, pattern: /^[0-9A-Z_]+$/ }),
        permissions: {
          type: 'array',
          isRequired: true,
          fields: {
            type: 'string',
            isRequired: true,
            maxLength: 256,
            description: 'Permission name.',
            pattern: /^[0-9A-Z_.]+$/,
          },
        },
      },
    },
  };

  /**
   * Serializes `schema` to send it through HTTP.
   *
   * @param schema Data model field schema to serialize.
   *
   * @returns Serialized schema.
   */
  private serializeSchema(schema: FieldSchema<DataModel>): Record<string, unknown> {
    const serializedSchema: Record<string, unknown> = { ...schema };
    const { fields } = serializedSchema;
    const { pattern } = schema as StringSchema;
    if (pattern !== undefined) {
      serializedSchema.pattern = { source: pattern.source, flags: pattern.flags };
    }
    if (serializedSchema.enum !== undefined && serializedSchema.type === 'date') {
      serializedSchema.enum = (serializedSchema.enum as Date[]).map((date) => date.toISOString());
    } else if (serializedSchema.enum !== undefined && serializedSchema.type === 'id') {
      serializedSchema.enum = (serializedSchema.enum as Id[]).map((id) => String(id));
    }
    if (serializedSchema.type === 'array') {
      serializedSchema.fields = this.serializeSchema(fields as ArraySchema<DataModel>['fields']);
    } else if (fields !== undefined) {
      const objectFields = fields as ObjectSchema<DataModel>['fields'];
      serializedSchema.fields = Object.keys(objectFields).reduce((subFields, key) => ({
        ...subFields,
        [key]: this.serializeSchema(objectFields[key]),
      }), {});
    }
    return serializedSchema;
  }

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
    const {
      errorMessages, description, type, ...rest
    } = this.serializeSchema(schema);
    if (errorMessages || description) {
      // No-op.
    }
    if (type === 'array') {
      const { fields } = schema as ArraySchema<DataModel>;
      return {
        type,
        ...rest,
        fields: this.generatePublicSchemaFrom(fields, relations),
      } as ArraySchema<DataModel>;
    }
    if (type === 'object') {
      const { fields } = schema as ObjectSchema<DataModel>;
      return {
        type,
        ...rest,
        fields: Object.keys(fields).reduce((subFields, key) => ({
          ...subFields,
          [key]: this.generatePublicSchemaFrom(fields[key], relations),
        }), {}),
      } as FieldSchema<DataModel>;
    }
    const { relation } = (schema as IdSchema<DataModel>);
    if (type === 'id' && relation !== undefined) {
      const isRelationAlreadyProcessed = relations.has(relation);
      const data = this.get(relation);
      if (!isRelationAlreadyProcessed) {
        relations.add(relation);
        this.generatePublicSchemaFrom({ type: 'object', fields: data.schema.fields, description: data.schema.description }, relations);
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
      description: 'Resource email address.',
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
   * `tinyText` custom data model schema type generator.
   * A tiny text can be up to 50 characters long.
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
      description: 'Resource tiny text.',
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `shortText` custom data model schema type generator.
   * A short text can be up to 100 characters long.
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
      description: 'Resource short text.',
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `mediumText` custom data model schema type generator.
   * A medium text can be up to 500 characters long.
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
      description: 'Resource medium text.',
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `longText` custom data model schema type generator.
   * A long text can be up to 2,500 characters long.
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
      description: 'Resource long text.',
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `hugeText` custom data model schema type generator.
   * A huge text can be up to 10,000 characters long.
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
      description: 'Resource huge text.',
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `token` custom data model schema type generator. A token:
   * - can be up to 50 characters long
   * - can contain only hexadecimal characters and hyphens
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static token(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 50,
      pattern: /^[0-9A-Za-z-]{1,50}$/,
      description: 'Resource token.',
      errorMessages: {
        type: 'must be a valid token',
        pattern: 'must be a valid token',
      },
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `id` custom data model schema type generator.
   * An ID can be either a UUID or a Snowflake generated ID.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: true }`.
   *
   * @returns Generated custom data model schema.
   */
  public static id(overrides: Partial<IdSchema<unknown>> = {}): IdSchema<unknown> {
    return {
      type: 'id',
      description: 'Resource ID.',
      errorMessages: {
        type: 'must be a valid ID',
        pattern: 'must be a valid ID',
      },
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * `queryFields` custom data model schema type generator.
   * A comma-separated list of fields paths to include in the response.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: false }`.
   *
   * @returns Generated custom data model schema.
   */
  public static queryFields(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 5000,
      pattern: /^([^ ]+)(,([^ ]+))*$/,
      isRequired: overrides.isRequired ?? false,
      description: 'Comma-separated list of fields paths to include in the response.',
      errorMessages: {
        type: 'must be a coma-separated list of fields paths',
        pattern: 'must be a coma-separated list of fields paths',
      },
      ...overrides,
    };
  }

  /**
   * `queryLimit` custom data model schema type generator.
   * Maximum number of resources to return.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: false }`.
   *
   * @returns Generated custom data model schema.
   */
  public static queryLimit(overrides: Partial<NumberSchema> = {}): NumberSchema {
    return {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      isRequired: overrides.isRequired ?? false,
      description: 'Maximum number of resources to return.',
      errorMessages: {
        type: 'must be a valid length',
        minimum: 'must be valid length',
        maximum: 'cannot be greater than 100',
      },
      ...overrides,
    };
  }

  /**
   * `queryOffset` custom data model schema type generator.
   * Results pagination offset to apply.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: false }`.
   *
   * @returns Generated custom data model schema.
   */
  public static queryOffset(overrides: Partial<NumberSchema> = {}): NumberSchema {
    return {
      type: 'integer',
      minimum: 0,
      isRequired: overrides.isRequired ?? false,
      description: 'Results pagination offset to apply.',
      errorMessages: {
        type: 'must be a valid offset',
        minimum: 'must be valid offset',
      },
      ...overrides,
    };
  }

  /**
   * `sortBy` custom data model schema type generator.
   * Comma-separated list of fields paths to sort the resources by.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: false }`.
   *
   * @returns Generated custom data model schema.
   */
  public static sortBy(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 5000,
      pattern: /^([^ ]+)(,([^ ]+))*$/,
      isRequired: overrides.isRequired ?? false,
      description: 'Comma-separated list of fields paths to sort the resources by.',
      errorMessages: {
        type: 'must be a coma-separated list of fields paths',
        pattern: 'must be a coma-separated list of fields paths',
      },
      ...overrides,
    };
  }

  /**
   * `sortOrder` custom data model schema type generator.
   * Comma-separated list of sorting orders.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ isRequired: false }`.
   *
   * @returns Generated custom data model schema.
   */
  public static sortOrder(overrides: Partial<StringSchema> = {}): StringSchema {
    return {
      type: 'string',
      maxLength: 5000,
      pattern: /^(-1|1)(,(-1|1))*$/,
      isRequired: overrides.isRequired ?? false,
      description: 'Comma-separated list of sorting orders.',
      errorMessages: {
        type: 'must be a coma-separated list of sorting orders',
      },
      ...overrides,
    };
  }

  /**
   * `password` custom data model schema type generator. A password must contain at least:
   * - 8 characters
   * - one number
   * - one uppercase letter
   * - one lowercase letter
   * - one special character
   * Password length is limited to 500 characters.
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
      description: 'Resource password.',
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
      description: 'Resource credentials.',
      fields: {
        deviceId: Model.token(),
        refreshToken: Model.token(),
        expiresIn: {
          type: 'integer',
          minimum: 0,
          description: 'Resource refresh token expiration time in seconds.',
        },
        accessToken: {
          type: 'string',
          minLength: 10,
          maxLength: 500,
          isRequired: true,
          description: 'Resource access token.',
        },
      },
      isRequired: overrides.isRequired !== false,
      ...overrides,
    };
  }

  /**
   * Class constructor.
   *
   * @param schemaFragment Data model schema to generate data model from.
   * Can be the complete schema, or just a fragment of it. Defaults to `{}`.
   */
  constructor(schemaFragment?: Partial<DataModelSchema<DataModel>>) {
    super(schemaFragment);
    const publicSchema = {} as DataModelSchema<DataModel>;
    const resources = Object.keys(this.schema) as (keyof DataModel & string)[];
    const relations: Partial<Record<keyof DataModel, Set<keyof DataModel & string>>> = {};
    resources.forEach((resource) => {
      relations[resource] = new Set();
      const { fields } = (this.schema as DataModelSchema<DataModel>)[resource];
      publicSchema[resource] = this.generatePublicSchemaFrom(
        { type: 'object', fields, description: '' },
        relations[resource],
      ) as ResourceSchema<DataModel>;
    });
    this.publicSchema = publicSchema;
    this.relationsPerResource = relations;
  }

  /**
   * Returns public data model schema for `resource`, and all its direct or indirect relations.
   *
   * @param resource Name of the resource for which to get public data model schema.
   *
   * @returns Public data model schema for all related resources if they exist, `null` otherwise.
   */
  public getPublicSchema(resource: keyof DataModel & string): DataModelSchema<DataModel> | null {
    if (this.relationsPerResource[resource] === undefined) {
      return null;
    }
    const resources = [...this.relationsPerResource[resource]];
    return resources.reduce((finalSchema, currentResource) => ({
      ...finalSchema,
      [currentResource]: this.publicSchema[currentResource],
    }), { [resource]: this.publicSchema[resource] }) as DataModelSchema<DataModel>;
  }
}
