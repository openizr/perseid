/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { deepMerge, deepCopy } from 'basx';
import { type DataModel as DefaultTypes } from '@perseid/core';

/** Data model types definitions. */
export type DataModel<Types> = Record<keyof Types, CollectionDataModel<Types>>;

/**
 * Data model.
 */
export default class Model<
  /** Data model types definitions. */
  Types = DefaultTypes,
> {
  /** Generated data model. */
  protected model: DataModel<Types>;

  /** Public data model schema, used for data model introspection on front-end. */
  protected publicSchema: DataModel<Types>;

  /** List of relations per collection, along with their respective path in the model. */
  protected relationsPerCollection: Record<keyof Types, Set<string>>;

  /** Default data model schema. */
  public static readonly DEFAULT_MODEL: DataModel<DefaultTypes> = {
    users: {
      version: 1,
      enableAuthors: true,
      enableDeletion: false,
      enableTimestamps: true,
      fields: {
        _verifiedAt: {
          index: true,
          type: 'date',
          permissions: ['USERS_DETAILS_VIEW'],
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
            permissions: ['O_AUTH_CREDENTIALS_VIEW'],
          },
        },
        _apiKeys: {
          type: 'array',
          required: true,
          fields: Model.token({ permissions: ['O_AUTH_CREDENTIALS_VIEW'] }),
        },
        email: Model.email({ unique: true }),
        password: Model.password({ permissions: ['O_AUTH_CREDENTIALS_VIEW'] }),
        roles: {
          type: 'array',
          required: true,
          fields: {
            type: 'id',
            index: true,
            required: true,
            relation: 'roles',
            permissions: ['USERS_DETAILS_VIEW'],
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
   * Generates public data schema from `model`.
   *
   * @param model Model from which to generate schema.
   *
   * @param relations Optional parameter, use it to also extract all relations declared in the
   * model. If this parameter is passed, a list of all collections referenced directly or indirectly
   * (i.e. by following subsequent relations) in the model will be generated and stored in that
   * variable. For instance, if `model` contains a field that references a collection A, that in
   * turn references collection B, that eventually references the initial collection, the following
   * list will be generated: `["A", "B"]`. Defaults to `new Set()`.
   */
  protected generatePublicSchemaFrom(
    model: FieldDataModel<Types>,
    relations: Set<string> = new Set(),
  ): FieldDataModel<Types> {
    const { errorMessages, type, ...rest } = model;
    if (errorMessages) {
      // No-op.
    }
    if (type === 'array') {
      const { fields } = model;
      return <ArrayDataModel<Types>>{
        type,
        ...rest,
        fields: this.generatePublicSchemaFrom(fields, relations),
      };
    }
    if (type === 'dynamicObject' || type === 'object') {
      return {
        type,
        ...rest,
        fields: Object.keys(model.fields).reduce((fields, key) => ({
          ...fields,
          [key]: this.generatePublicSchemaFrom(model.fields[key], relations),
        }), {}),
      } as FieldDataModel<Types>;
    }
    if (type === 'id' && model.relation !== undefined) {
      const relation = model.relation as string;
      const isRelationAlreadyProcessed = relations.has(relation);
      if (!isRelationAlreadyProcessed) {
        relations.add(relation);
        const { fields } = this.getCollection(model.relation);
        this.generatePublicSchemaFrom({ type: 'object', fields }, relations);
      }
    }
    const { unique, index, ...subRest } = rest as Omit<StringDataModel, 'type'>;
    return <FieldDataModel<Types>>{ type, index: unique || index, ...subRest };
  }

  /**
   * `email` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static email(overrides: Partial<StringDataModel> = {}): StringDataModel {
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
   * `tinyText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static tinyText(overrides: Partial<StringDataModel> = {}): StringDataModel {
    return {
      maxLength: 50,
      type: 'string',
      customType: 'tinyText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `shortText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static shortText(overrides: Partial<StringDataModel> = {}): StringDataModel {
    return {
      type: 'string',
      maxLength: 100,
      customType: 'shortText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `mediumText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static mediumText(overrides: Partial<StringDataModel> = {}): StringDataModel {
    return {
      type: 'string',
      maxLength: 500,
      customType: 'mediumText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `longText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static longText(overrides: Partial<StringDataModel> = {}): StringDataModel {
    return {
      type: 'string',
      maxLength: 2500,
      customType: 'longText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `hugeText` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static hugeText(overrides: Partial<StringDataModel> = {}): StringDataModel {
    return {
      type: 'string',
      maxLength: 10000,
      customType: 'hugeText',
      required: overrides.required !== false,
      ...overrides,
    };
  }

  /**
   * `token` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static token(overrides: Partial<StringDataModel> = {}): StringDataModel {
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
   * `password` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static password(overrides: Partial<StringDataModel> = {}): StringDataModel {
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
   * `credentials` custom data model type generator.
   *
   * @param overrides Additional parameters to override field with.
   * Defaults to `{ required: true }`.
   *
   * @returns Generated custom data model.
   */
  public static credentials(
    overrides: Partial<ObjectDataModel<unknown>> = {},
  ): ObjectDataModel<unknown> {
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
  constructor(schema: DataModel<Types>) {
    const model = deepCopy(schema);

    Object.keys(model).forEach((collectionName) => {
      const collection = collectionName as keyof Types;
      const automaticFields: CollectionDataModel<Types> = {
        version: model[collection].version,
        enableAuthors: model[collection].enableAuthors ?? false,
        enableDeletion: model[collection].enableDeletion ?? true,
        enableTimestamps: model[collection].enableTimestamps ?? false,
        fields: {
          _id: {
            type: 'id',
            index: true,
            required: true,
          },
        },
      };
      if (automaticFields.version !== undefined) {
        automaticFields.fields._version = {
          type: 'integer',
          index: true,
          required: true,
        };
      }
      if (!automaticFields.enableDeletion) {
        automaticFields.fields._isDeleted = {
          type: 'boolean',
          index: true,
          required: true,
          default: false,
        };
      }
      if (automaticFields.enableAuthors && (model as { users: unknown; }).users !== undefined) {
        automaticFields.fields._createdBy = {
          type: 'id',
          index: true,
          required: collection !== 'users',
          relation: 'users' as keyof Types,
        };
        automaticFields.fields._updatedBy = {
          type: 'id',
          index: true,
          relation: 'users' as keyof Types,
        };
      }
      if (automaticFields.enableTimestamps) {
        automaticFields.fields._createdAt = {
          type: 'date',
          index: true,
          required: true,
        };
        automaticFields.fields._updatedAt = {
          type: 'date',
          index: true,
        };
      }
      // To make automatic fields always appear at the top.
      model[collection] = deepMerge(automaticFields, model[collection]);
    });

    this.model = model;
    const collections = Object.keys(model);
    const publicSchema: Partial<DataModel<Types>> = {};
    const relationsPerCollection: Record<string, Set<string>> = {};
    collections.forEach((collection) => {
      relationsPerCollection[collection] = new Set();
      const { fields } = model[collection as keyof Types];
      publicSchema[collection as keyof Types] = this.generatePublicSchemaFrom(
        { type: 'object', fields },
        relationsPerCollection[collection],
      ) as CollectionDataModel<Types>;
    });
    this.publicSchema = publicSchema as DataModel<Types>;
    this.relationsPerCollection = relationsPerCollection as Record<keyof Types, Set<string>>;
  }

  /**
   * Returns the list of all data model collections names.
   *
   * @returns Data model collections names.
   */
  public getCollections(): (keyof Types)[] {
    return Object.keys(this.model) as (keyof Types)[];
  }

  /**
   * Returns generated data model for collection `collection`.
   *
   * @param collection Name of the collection for which to get data model.
   *
   * @returns Collection generated data model.
   */
  public getCollection(collection: keyof Types): Readonly<CollectionDataModel<Types>> {
    return this.model[collection];
  }

  /**
   * Returns public data model schema for `collection`, and all its direct or indirect relations.
   *
   * @param collection Name of the collection for which to get public data model schema.
   *
   * @returns Public data model schema for all related collections.
   */
  public getPublicSchema(collection: keyof Types): DataModel<Types> {
    const collections = [...this.relationsPerCollection[collection]] as (keyof Types)[];
    return collections.reduce((finalSchema, currentCollection) => ({
      ...finalSchema,
      [currentCollection]: this.publicSchema[currentCollection],
    }), {} as DataModel<Types>);
  }
}
