/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Id, type DefaultDataModel } from '@perseid/core';

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
  export type SearchFilters = Record<string, (
    string | Date | number | boolean | Id | null |
    (string | Date | Id | number | boolean | null)[]
  )>;

  /**
   * Database search query, used for full-text search.
   */
  export interface SearchQuery {
    /** A full-text search will be performed on that text. */
    text: string;

    /** List of fields over which to perform the full-text search. */
    on: Set<string>;
  }

  /**
   * Search request body.
   */
  export interface SearchBody {
    /** Search query. */
    query: SearchQuery | null;

    /** Search filters. */
    filters: SearchFilters | null;
  }

  /**
   * Command options for view method, controls the way results are shaped.
   */
  export interface ViewCommandOptions {
    /** List of fields to fetch. Defaults to `new Set<string>()`. */
    fields?: Set<string>;

    /**
     * Maximum allowed level of resources depth. For instance, `1` means you can only fetch fields
     * from the requested resource, `2` means you can also fetch fields from direct sub-resources,
     * `3` means you can also fetch fields from their own direct sub-resources, and so on.
     * Defaults to `3`.
     */
    maximumDepth?: number;
  }

  /**
   * Command options for list method, controls the way results are shaped.
   */
  export interface ListCommandOptions extends ViewCommandOptions {
    /** Limits the number of returned results. Defaults to `20`. */
    limit?: number;

    /** Results pagination offset to apply. Defaults to `0`. */
    offset?: number;

    /** List of fields to sort results by, along with their sorting order (asc/desc). */
    sortBy?: Record<string, 1 | -1>;
  }

  /**
   * Command options for search method, controls the way results are shaped.
   */
  export interface SearchCommandOptions extends ViewCommandOptions {
    /** Limits the number of returned results. Defaults to `20`. */
    limit?: number;

    /** Results pagination offset to apply. Defaults to `0`. */
    offset?: number;

    /** List of fields to sort results by, along with their sorting order (asc/desc). */
    sortBy?: Record<string, 1 | -1>;
  }

  /**
   * Command context, provides information about the author of changes.
   */
  export interface CommandContext<DataModel extends DefaultDataModel> {
    /** User performing the command. */
    user: DataModel['users'];

    /** Id of the device from which user is performing the command. */
    deviceId?: string;

    /** User agent of the device from which user is performing the command. */
    userAgent?: string;
  }

  /**
   * Resource creation payload (excluding all its automatic fields).
   */
  export type CreatePayload<ResourceDataModel> = {
    [K in keyof Omit<ResourceDataModel, `_${string}`>]: Resource[K] extends object
    ? CreatePayload<ResourceDataModel[K]>
    : ResourceDataModel[K];
  };

  /**
   * Resource update payload (excluding all its automatic fields).
   */
  export type UpdatePayload<ResourceDataModel> = Partial<{
    [K in keyof Omit<ResourceDataModel, `_${string}`>]: Resource[K] extends object
    ? UpdatePayload<ResourceDataModel[K]>
    : ResourceDataModel[K];
  }>;

  /**
   * Resource creation / update payload.
   */
  export type Payload<ResourceDataModel> = Partial<{
    [K in keyof ResourceDataModel]: Resource[K] extends object
    ? UpdatePayload<ResourceDataModel[K]>
    : ResourceDataModel[K];
  }>;
}
