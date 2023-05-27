/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Document } from 'mongodb';
import DatabaseClient from 'scripts/services/DatabaseClient';

/*
 * Exposes protected methods of the DatabaseClient class for testing purposes.
 */
export default class TestDatabaseClient extends DatabaseClient {
  // public generateProjectionsFrom(collection: string, fields: string[]): Projections {
  //   return super.generateProjectionsFrom(collection, fields);
  // }

  // public generateSortingPipeline(sortBy: string[], sortOrder: string[]): Document[] {
  //   return super.generateSortingPipeline(sortBy, sortOrder);
  // }

  public generatePaginationPipeline(offset?: number, limit?: number): Document[] {
    return super.generatePaginationPipeline(offset, limit);
  }

  // public generateSearchPipeline(
  //   collection: string,
  //   query: Query | null,
  //   filters: Filters | null,
  // ): (Document | null)[] {
  //   return super.generateSearchPipeline(collection, query, filters);
  // }

  public generateLookupsPipeline(
    model: FieldsModel,
    projections: Projections,
    path?: string,
  ): Document[] {
    return super.generateLookupsPipeline(model, projections, path);
  }
}
