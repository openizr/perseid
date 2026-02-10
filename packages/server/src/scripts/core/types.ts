/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { Id, UserDataModel } from '@perseid/core';

/* eslint-disable no-use-before-define */

type PayloadFieldInner<T> = T extends (infer U)[]
  ? U[]
  : T extends Id | Date | Buffer | ArrayBuffer
  ? T
  : T extends object
  ? Payload<T>
  : T;

// Check if T can be null BEFORE distribution happens
type PayloadField<T> = null extends T
  ? T // Nullable → subfields required
  : PayloadFieldInner<T>; // Non-nullable → subfields optional

/**
 * Resource update payload, excluding all its automatic fields.
 * Only optional objects fields and array sub-fields are required.
 */
export type Payload<T> = Partial<{
  [K in keyof T]: PayloadField<T[K]>;
}>;

/**
 * Resource creation payload, excluding all its automatic fields.
 * All the other fields are required.
 */

type CreatePayloadField<T> = T extends (infer U)[]
  ? (U extends Id | Date | Buffer | ArrayBuffer ? U[] : U extends object ? CreatePayload<U>[] : U[])
  : T extends Id | Date | Buffer | ArrayBuffer
  ? T
  : T extends object
  ? CreatePayload<T>
  : T;

// Update CreatePayload to use the helper
export type CreatePayload<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: CreatePayloadField<T[K]>;
};

type UpdatePayloadFieldInner<T> = T extends (infer U)[]
  ? (U extends Id | Date | Buffer | ArrayBuffer ? U[] : U extends object ? CreatePayload<U>[] : U[])
  : T extends Id | Date | Buffer | ArrayBuffer
  ? T
  : T extends object
  ? UpdatePayload<T>
  : T;

// Check if T can be null BEFORE distribution happens
type UpdatePayloadField<T> = null extends T
  ? CreatePayloadField<T> // Nullable → subfields required
  : UpdatePayloadFieldInner<T>; // Non-nullable → subfields optional

/**
 * Resource update payload, excluding all its automatic fields.
 * Only optional objects fields and array sub-fields are required.
 */
export type UpdatePayload<T> = Partial<{
  [K in keyof T as K extends `_${string}` ? never : K]: UpdatePayloadField<T[K]>;
}>;
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
export type SearchFilters = Record<string, (
  string | Date | number | boolean | Id | null | (string | Date | Id | number | boolean | null)[]
)>;

/**
 * Database search query, used for full-text search.
 */
export interface SearchQuery {
  /**
   * A full-text search will be performed on that text.
   */
  text: string;

  /**
   * List of fields over which to perform the full-text search.
   */
  on: Set<string>;
}

/**
 * Search request body.
 */
export interface SearchBody {
  /**
   * Search query.
   */
  query: SearchQuery | null;

  /**
   * Search filters.
   */
  filters: SearchFilters | null;
}

/**
 * Query options for all database methods.
 */
export interface QueryOptions {
  /**
   * Whether to filter out soft-deleted resources in queries. Defaults to `true`.
   */
  excludeDeletedResources?: boolean;
}

/**
 * Query options for view database client method. Provides additional controls over input/output
 * to/from data source (e.g. extra filters to apply, final results shape, sorting, pagination,
 * and such).
 */
export interface ViewQueryOptions extends QueryOptions {
  /**
   * Maximum allowed level of resources depth. For instance, `1` means you can only fetch fields
   * from the requested resource, `2` means you can also fetch fields from direct sub-resources,
   * `3` means you can also fetch fields from their own direct sub-resources, and so on.
   * Defaults to `3`.
   */
  maximumDepth?: number;

  /**
   * List of fields to fetch. Defaults to `['_id']`.
   */
  fields?: string[];
}

/**
 * Query options for list database client method. Provides additional controls over input/output
 * to/from data source (e.g. extra filters to apply, final results shape, sorting, pagination,
 * and such).
 */
export interface ListQueryOptions extends ViewQueryOptions {
  /**
   * Limits the number of returned results. Defaults to `20`.
   */
  limit?: number;

  /**
   * Results pagination offset to apply. Defaults to `0`.
   */
  offset?: number;

  /**
   * List of fields to sort results by, along with their sorting order (asc/desc).
   */
  sortBy?: Record<string, 1 | -1>;
}

/**
 * Provides information about the context in which the command is being performed (e.g. query
 * options, resource, ...). This context can be updated along the way, and used
 * as a central bus for passing information between commands.
 */
export interface CommandContext<DataModel> {
  /**
   * Query options for database client calls.
   */
  queryOptions?: ListQueryOptions;

  /**
   * Resource on which the command is being performed, if any.
   */
  resource?: {
    /**
     * Resource ID, in case of update/view/delete command.
     */
    id?: Id;

    /**
     * Resource type.
     */
    type: keyof DataModel;
  };

  /**
   * User session information.
   */
  session?: {
    /**
     * User performing the command.
     */
    user: Pick<UserDataModel['users'], '_id' | '_verifiedAt' | '_devices' | 'email'> & {
      /**
       * User permissions.
       */
      _permissions: Set<string>;

      /**
       * User roles.
       */
      roles: Pick<UserDataModel['roles'], '_id' | 'name' | 'permissions'>[];
    };

    /**
     * Id of the device from which user is performing the command.
     */
    deviceId?: string;

    /**
     * User agent of the device from which user is performing the command.
     */
    userAgent?: string;
  };
}

/**
 * Provides information about the context in which the command is being performed (e.g. connected
 * user session, query options,additional information, ...). This context can be updated along the
 * way, and used as a central bus for passing information between commands.
 */
export type UserCommandContext<DataModel> = CommandContext<DataModel> & {
  session: Exclude<CommandContext<DataModel>['session'], undefined>;
};

/**
 * Provides information about the context in which the command is being performed (e.g. query
 * options, additional information, ...), without any connected user. This context can be updated
 * along the way, and used as a central bus for passing information between commands.
 */
export type AnonymousCommandContext<DataModel> = Omit<CommandContext<DataModel>, 'session'> & {
  session: Pick<UserCommandContext<DataModel>['session'], 'deviceId' | 'userAgent'>;
};
