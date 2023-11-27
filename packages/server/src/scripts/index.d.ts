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
    /** User performing the command. */
    user: User;

    /** Id of the device from which user is performing the command. */
    deviceId?: string;

    /** User agent of the device from which user is performing the command. */
    userAgent?: string;
  }
}
