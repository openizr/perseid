/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/** Collections with an `_id` field. */
export interface Ids {
  /** Resource id. */
  _id: Id;
}

/** Collections with authors-related automatic fields. */
export interface Authors {
  /** Resource creation author. */
  _createdBy: Id | User;

  /** Resource modification author. */
  _updatedBy: Id | User | null;
}

/** Collections with timestamps-related automatic fields. */
export interface Timestamps {
  /** Resource creation date. */
  _createdAt: Date;

  /** Resource modification date. */
  _updatedAt: Date | null;
}

/** Soft-deletable collections. */
export interface Deletion {
  /** Whether resource has been deleted. */
  _isDeleted: boolean;
}

/** Versionnable collections. */
export interface Version {
  /** Resource version. */
  _version: number;
}

/** Set of permissions, grouped for a specific purpose. */
export interface Role extends Ids, Version, Timestamps, Authors {
  /** Role name. */
  name: string;

  /** List of permissions granted by this role. */
  permissions: string[];
}

/** User. */
export interface User extends Ids, Version, Timestamps, Deletion {
  /** Resource creation author. */
  _createdBy?: Id | User | null;

  /** Resource modification author. */
  _updatedBy: Id | User | null;

  /** User verification date. */
  _verifiedAt: Date | null;

  /** User permissions. */
  _permissions: Set<string>;

  /** User email. */
  email: string;

  /** User password. */
  password: string;

  /** User roles. */
  roles: (Id | Role)[];

  /** List of user API keys. */
  _apiKeys: string[];

  /** List of user devices. */
  _devices: {
    /** Device id. */
    id: string;

    /** Device user agent. */
    userAgent: string;

    /** Refresh token expiration date. */
    expiration: Date;

    /** Refresh token to use for that device. */
    refreshToken: string;
  }[];
}

/**
 * Default perseid data model.
 */
export interface DefaultDataModel {
  users: User;
  roles: Role;
}

/**
 * Search or list results.
 */
export interface Results<T> {
  /** Total number of results that matched query. */
  total: number;

  /** Limited list of results that are actually returned. */
  results: T[];
}

/**
 * Resource creation payload (excluding all its automatic fields).
 */
export type Payload<T> = {
  [K in keyof T as Exclude<K, `_${string}`>]: Payload<T[K]>;
};

/**
 * Resource update payload.
 */
export type UpdatePayload<T> = {
  [K in keyof T]?: UpdatePayload<T[K]>;
};

/**
 * Common properties for all data model fields schemas.
 */
export interface GenericFieldSchema {
  /**
   * Custom type name to assign to that field, in addition to its actual type.
   * Very useful to customize behaviours. For instance, you might want to display a specific
   * component for email addresses on front-end, even though their real type is `string`.
   */
  customType?: string;

  /** Whether field is required. */
  required?: boolean;

  /** Custom error messages for when user inputs do not match data model. */
  errorMessages?: Record<string, string>;
}

/**
 * Data model string field schema.
 */
export interface StringSchema extends GenericFieldSchema {
  /** Data type. */
  type: 'string';

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /** Specific set of values allowed for that field. */
  enum?: string[];

  /** Default value for that field. */
  default?: string;

  /**
   * Whether field's value should be unique across the whole collection (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  unique?: boolean;

  /** RegExp user inputs must pass for that field. */
  pattern?: string;

  /** Field minimum length. */
  minLength?: number;

  /** Field maximum length. */
  maxLength?: number;
}

/**
 * Data model number field schema.
 */
export interface NumberSchema extends GenericFieldSchema {
  /** Data type. */
  type: 'integer' | 'float';

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /** Specific set of values allowed for that field. */
  enum?: number[];

  /** Default value for that field. */
  default?: number;

  /**
   * Whether field's value should be unique across the whole collection (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  unique?: boolean;

  /** Field minimum value. */
  minimum?: number;

  /** Field maximum value. */
  maximum?: number;

  /** Field exclusive minimum value. */
  exclusiveMinimum?: number;

  /** Field exclusive maximum value. */
  exclusiveMaximum?: number;

  /** Value to use as a multiple for user inputs. */
  multipleOf?: number;
}

/**
 * Data model boolean field schema.
 */
export interface BooleanSchema extends GenericFieldSchema {
  /** Data type. */
  type: 'boolean';

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /** Default value for that field. */
  default?: boolean;
}

/**
 * Data model id field schema.
 */
export interface IdSchema<Types> extends GenericFieldSchema {
  /** Data type. */
  type: 'id';

  /** Specific set of values allowed for that field. */
  enum?: Id[];

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /**
   * Whether field's value should be unique across the whole collection (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  unique?: boolean;

  /** Default value for that field. */
  default?: Id;

  /** Name of the collection the id refers to. See it as a foreign key. */
  relation?: keyof Types;
}

/**
 * Data model date field schema.
 */
export interface DateSchema extends GenericFieldSchema {
  /** Data type. */
  type: 'date';

  /** Specific set of values allowed for that field. */
  enum?: Date[];

  /**
   * Whether to index this field.
   * A database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  index?: boolean;

  /**
   * Whether field's value should be unique across the whole collection (e.g. an email address).
   * A unique database index will be created, and user will be able to use that field for sorting,
   * searching, and filtering in queries.
   */
  unique?: boolean;

  /** Default value for that field. */
  default?: Date;
}

/**
 * Data model binary field schema.
 */
export interface BinarySchema extends GenericFieldSchema {
  /** Data type. */
  type: 'binary';

  /** Default value for that field. */
  default?: ArrayBuffer;
}

/**
 * Data model null field schema.
 */
export interface NullSchema extends GenericFieldSchema {
  /** Data type. */
  type: 'null';
}

/**
 * Data model object field schema.
 */
export interface ObjectSchema<T> extends GenericFieldSchema {
  /** Data type. */
  type: 'object';

  /** Sub-fields data model. */
  fields: Record<string, FieldSchema<T>>;
}

/**
 * Data model array field schema.
 */
export interface ArraySchema<T> extends GenericFieldSchema {
  /** Data type. */
  type: 'array';

  /** Minimum required number of items in the array. */
  minItems?: number;

  /** Maximum allowed number of items in the array. */
  maxItems?: number;

  /** Items data model. */
  fields: Exclude<FieldSchema<T>, ArraySchema<T>>;

  /** Whether each array item should be unique. */
  uniqueItems?: boolean;
}

/**
 * Any Data model field schema.
 */
export type FieldSchema<Types> = (
  NullSchema |
  DateSchema |
  NumberSchema |
  StringSchema |
  BinarySchema |
  BooleanSchema |
  IdSchema<Types> |
  ArraySchema<Types> |
  ObjectSchema<Types>
);

/**
 * Data model collection schema.
 */
export interface CollectionSchema<T> {
  /**
    * Data model version for this collection. Can be useful for applying different logics depending
    * on the data model version of a given resource in that collection.
    */
  version?: number;

  /** Whether to generate and manage`_createdBy` and `_updatedBy` fields for that collection. */
  enableAuthors?: boolean;

  /** Whether to generate and manage the `_isDeleted` field for that collection. */
  enableDeletion?: boolean;

  /** Whether to generate and manage`_createdAt` and `_updatedAt` fields for that collection. */
  enableTimestamps?: boolean;

  /** Collection fields data model. */
  fields: Record<string, FieldSchema<T>>;
}

/**
 * Implementation of JS `Array.forEach` method, adapted to asynchronous callbacks.
 *
 * @param items Items to iterate on.
 *
 * @param callback Asynchronous function to execute for each item.
 */
export function forEach<T>(
  items: T[],
  callback: (item: T, index: number) => Promise<void>,
): Promise<void>;

/**
 * Transforms `text` into SNAKE_CASE.
 *
 * @param text Text to transform.
 *
 * @returns Transformed text.
 */
export function toSnakeCase(text: string): string;

/**
 * Returns `true` if `variable` is a plain object, `false` otherwise.
 *
 * @param variable Variable to check.
 *
 * @returns `true` if variable is a plain object, `false` otherwise.
 */
export function isPlainObject<T>(variable: T): boolean;

/**
 * Performs a deep copy of a variable. Only plain objects and arrays are deeply copied.
 *
 * @param variable Variable to deeply copy.
 *
 * @returns variable deep copy.
 */
export function deepCopy<T>(variable: T): T;

/**
 * Performs a deep merge of `firstVariable` and `secondVariable`. Only plain objects and arrays are
 * deeply merged. In any other case, `secondVariable` is returned if it is defined.
 *
 * @param firstVariable First object.
 *
 * @param secondVariable Second object.
 *
 * @returns Variables deep merge.
 */
export function deepMerge<T1, T2>(
  firstVariable: T1,
  secondVariable: T2,
): T1 & T2;

/** List of labels translations, grouped by key and category. */
export interface Labels {
  [key: string]: string | Labels;
}

/**
 * Handles internationalization and localization (translations, conversions, formatting and such).
 */
export class I18n {
  /** Logging system. */
  protected logger: Logger;

  /** List of labels translations, grouped by key and category. */
  protected labels: Labels;

  /** Ugly trick to bypass linter :(. */
  protected specialChar: string;

  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   *
   * @param labels List of available labels for translation.
   */
  public constructor(logger: Logger, labels: Labels);

  /**
   * Translates `label` injecting values from `variables` if necessary.
   *
   * @param label Label to translate.
   *
   * @param values Optional list of values to inject in the translated label. Defaults to `{}`.
   *
   * @returns Translated label.
   */
  public t(label: string, values?: Record<string, unknown>): string;

  /**
   * Translates numeric `value`.
   *
   * @param value Value to translate.
   *
   * @returns Translated value.
   */
  public numeric(value: number): string;

  /**
   * Translates date `value`.
   *
   * @param value Value to translate.
   *
   * @returns Translated value.
   */
  public dateTime(value: Date): string;
}

/**
 * Isomorphic universally unique identifiers generator.
 * Inspired from mongodb ObjectId implementation and Snowflake algorithm.
 * An id is a 12-byte value, constructed as follows:
 *  - A 4-byte timestamp
 *  - A 5-byte process-specific id
 *  - A 3-byte script-specific id
 */
export class Id {
  /** Bytes mask. */
  protected mask: number;

  /** Id value. */
  protected value: Buffer;

  /** Id string representation. */
  protected id: string;

  /** Unique set of bytes, specific to current process. */
  static uniqueId: Buffer | null;

  /** Increment that ensures that all ids generated from the same script are unique. */
  static index: number;

  /**
   * Returns incremented counter.
   *
   * @returns Incremented counter.
   */
  protected getCounter(): number;

  /**
   * Generates a new id.
   * A slightly different algorithm is used depending on the environment (node / browser).
   *
   * @returns Generated id.
   */
  protected generate(): Buffer;

  /**
   * Class constructor.
   *
   * @param value Id string representation. If not defined, a new id will be generated.
   */
  constructor(value?: string);

  /**
   * Returns id string representation.
   *
   * @returns Id string representation.
   */
  public toString(): string;

  /**
   * Returns id value representation.
   *
   * @returns Id value representation.
   */
  public valueOf(): string;

  /**
   * Returns id JSON representation.
   *
   * @returns Id JSON representation.
   */
  public toJSON(): string;
}

/**
 * Abstract class that represents a logging system.
 * Extend this class with a real implementation depending on the environment (node/browser).
 */
export abstract class Logger {
  /**
   * Information that is diagnostically helpful to people more than just developers
   * (IT, sysadmins, etc.).
   * This should be the minimum logging level in development.
   */
  public abstract debug(...args: unknown[]): void;

  /**
   * Generally useful information to log (service start/stop, configuration assumptions, etc).
   * Info we want to always have available but usually don't care about under normal circumstances.
   * This should be the minimum logging level in (pre)production.
   */
  public abstract info(...args: unknown[]): void;

  /**
   * Anything that can potentially cause application oddities, but which is not a serious concern
   * (Such as switching from a primary to backup server, retrying an operation, missing secondary
   * data, etc.). Not much to worry about, but it is still important to analyze warnings on a
   * regular basis to identify potential issues.
   */
  public abstract warn(...args: unknown[]): void;

  /**
   * Any error which is fatal to the operation, but not the service or application (can't open a
   * required file, missing data, etc.). These errors will force user (administrator, or direct
   * user) intervention. These are usually reserved for incorrect connection strings, missing
   * services, uncaught exceptions, etc. Constitutes a degradation of service, which means
   * engineering team must be immediately notified.
   */
  public abstract error(...args: unknown[]): void;

  /**
   * Any error that is forcing a shutdown of the service or application to prevent data loss
   * (or further data loss). Reserved only for the most heinous errors and situations where there is
   * guaranteed to have been data corruption or loss. Constitutes an interruption of service, which
   * means engineering and SysAdmin / DevOps teams must be immediatly notified.
   */
  public abstract fatal(...args: unknown[]): void;

  /**
   * Gracefully closes the logging system (before stopping the program, for instance).
   */
  public abstract close(): Promise<void>;
}

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
export class Model<
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
  constructor(schema?: DataModelSchema<DataModel>);

  /**
   * Returns the list of all the collections names in data model.
   *
   * @returns Data model collections names.
   */
  public getCollections(): (keyof DataModel)[];

  /**
   * Returns data model metadata for `path`.
   *
   * @param path Path in the data model for which to get metadata.
   *
   * @returns Data model metadata if path exists, `null` otherwise.
   */
  public get<T>(path: T): T extends keyof DataModel
    ? DataModelMetadata<CollectionSchema<DataModel>>
    : DataModelMetadata<FieldSchema<DataModel>> | null;
}
