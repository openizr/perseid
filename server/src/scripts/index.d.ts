/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type User, type Id } from '@perseid/core';

declare global {
  /**
   * Database search filters.
   * Each key is a field name, and its related value is the filter value.
   * For instance, to fetch only resources for which `firstField` is either `'a'`, `'b'` or `'c'`
   * and `secondField` is `42`, you should write the following:
   * `{
   *    firstField: ['a', 'b', 'c'],
   *    secondField: 42,
   * }`
   */
  export interface SearchFilters {
    [fieldPath: string]: (
      string | Date | number | boolean | Id | null |
      (string | Date | Id | number | boolean | null)[]
    );
  }

  /**
   * Database search query, used for full-text search.
   */
  export interface SearchQuery {
    /** A full-text search will be performed on that text. */
    text: string;

    /** List of fields over which to perform the full-text search. */
    on: string[];
  }

  /**
   * Search request body.
   */
  export interface SearchBody {
    /** Search query. */
    query?: SearchQuery;

    /** Search filters. */
    filters?: SearchFilters;
  }

  /**
   * Command options, controls the way results are shaped.
   */
  export interface CommandOptions {
    /** Limits the number of returned results when calling `search` or `list`. Defaults to `20`. */
    limit?: number;

    /** Results pagination offset to apply when calling `search` or `list`. Defaults to `0`. */
    offset?: number;

    /** Names of the fields to sort results by. */
    sortBy?: string[];

    /** Order (asc/desc) of the fields to sort results by. */
    sortOrder?: (1 | -1)[];

    /** List of fields to return for each resource. Defaults to `[]`. */
    fields?: string[];

    /**
     * Maximum allowed level of resources depth. For instance, `1` means you can only fetch fields
     * from the requested resource, `2` means you can also fetch fields from direct sub-resources,
     * `3` means you can also fetch fields from their own direct sub-resources, and so on.
     * Defaults to `3`.
     */
    maximumDepth?: number;
  }

  /**
   * Command context, provides information about the author of changes.
   */
  export interface CommandContext {
    user: User;
    deviceId?: string;
    userAgent?: string;
  }

  /**
   * Database results.
   */
  export interface Results<T> {
    /** Total number of results that matched query. */
    total: number;

    /** Limited list of results that are actually returned. */
    results: T[];
  }

  /**
   * Any resource, excluding its automatic fields.
   */
  export type WithoutAutomaticFields<T> = {
    [K in keyof T as Exclude<K, `_${string}`>]: T[K];
  };

  /**
   * Common properties for all data model fields.
   */
  export interface GenericFieldDataModel {
    /**
     * Custom type name to assign to that field, in addition to its actual type.
     * Very useful to customize behaviours. For instance, you might want to display a specific
     * component for email addresses on front-end, even though their real type is `string`.
     */
    customType?: string;

    /** Whether field is required. */
    required?: boolean;

    /** Additional permissions required to access that field. */
    permissions?: string[];

    /** Custom error messages when user inputs do not match data model. */
    errorMessages?: {
      [errorType: string]: string;
    };
  }

  /**
   * String field data model.
   */
  export interface StringDataModel extends GenericFieldDataModel {
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
   * Number field data model.
   */
  export interface NumberDataModel extends GenericFieldDataModel {
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
   * Boolean field data model.
   */
  export interface BooleanDataModel extends GenericFieldDataModel {
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
   * Id field data model.
   */
  export interface IdDataModel<Types> extends GenericFieldDataModel {
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
   * Date field data model.
   */
  export interface DateDataModel extends GenericFieldDataModel {
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
   * Binary field data model.
   */
  export interface BinaryDataModel extends GenericFieldDataModel {
    /** Data type. */
    type: 'binary';

    /** Default value for that field. */
    default?: ArrayBuffer;
  }

  /**
   * Null field data model.
   */
  export interface NullDataModel extends GenericFieldDataModel {
    /** Data type. */
    type: 'null';
  }

  /**
   * Object field data model.
   */
  export interface ObjectDataModel<Types> extends GenericFieldDataModel {
    /** Data type. */
    type: 'object';

    /** Sub-fields data model. */
    fields: {
      [fieldName: string]: FieldDataModel<Types>;
    };
  }

  /**
   * Dynamic object field data model.
   * See https://json-schema.org/understanding-json-schema/reference/object.html#pattern-properties.
   */
  export interface DynamicObjectDataModel<Types> extends GenericFieldDataModel {
    /** Data type. */
    type: 'dynamicObject';

    /** Minimum required number of sub-fields. */
    minItems?: number;

    /** Maximum allowed number of sub-fields. */
    maxItems?: number;

    /** Sub-fields data model, keyed by pattern. */
    fields: {
      [pattern: string]: FieldDataModel<Types>;
    };
  }

  /**
   * Array field data model.
   */
  export interface ArrayDataModel<Types> extends Omit<GenericFieldDataModel, 'permissions'> {
    /** Data type. */
    type: 'array';

    /** Minimum required number of items in the array. */
    minItems?: number;

    /** Maximum allowed number of items in the array. */
    maxItems?: number;

    /** Items data model. */
    fields: FieldDataModel<Types>;

    /** Whether each array item should be unique. */
    uniqueItems?: boolean;
  }

  /**
   * Any field data model.
   */
  export type FieldDataModel<Types> = (
    NullDataModel |
    DateDataModel |
    NumberDataModel |
    StringDataModel |
    BinaryDataModel |
    BooleanDataModel |
    IdDataModel<Types> |
    ArrayDataModel<Types> |
    ObjectDataModel<Types> |
    DynamicObjectDataModel<Types>
  );

  /**
   * Collection data model.
   */
  export interface CollectionDataModel<Types> {
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
    fields: {
      [fieldName: string]: FieldDataModel<Types>;
    };
  }
}
