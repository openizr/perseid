/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {
  SearchBody,
  QueryOptions,
  SearchFilters,
  ListQueryOptions,
  ViewQueryOptions,
} from 'scripts/core';
import type { Id, Results } from '@perseid/core';

type Relations = Map<string, { resource: string; filters: SearchFilters & { _id: Id[]; } | null; }>;
type CheckRelations = (
  resource: string,
  relations: Relations,
  options?: QueryOptions,
) => Promise<void>;
type Create = (resource: string, payload: unknown, options?: ViewQueryOptions) => Promise<void>;
type Update = (
  resource: string,
  id: Id,
  payload: unknown,
  options?: ViewQueryOptions,
) => Promise<boolean>;
type Delete = (resource: string, id: Id, options?: QueryOptions) => Promise<boolean>;
type View = (resource: string, id: Id, options?: ViewQueryOptions) => Promise<unknown>;
type List = (
  resource: string,
  searchBody: SearchBody | null,
  options?: ListQueryOptions,
) => Promise<Results<unknown>>;

/**
 * `core/services/AbstractDatabaseClient` mock.
 */

export default class {
  protected model: unknown;

  protected telemetry: unknown;

  protected cache: unknown;

  public withSession = vi.fn(<T>(callback: (session: string) => Promise<T>) => callback('SESSION'));

  public checkRelations = vi.fn<CheckRelations>(() => Promise.resolve());

  public create = vi.fn<Create>(() => Promise.resolve());

  public update = vi.fn<Update>(() => Promise.resolve(true));

  public delete = vi.fn<Delete>(() => Promise.resolve(true));

  public view = vi.fn<View>((_resource, id) => Promise.resolve({ _id: id }));

  public list = vi.fn<List>(() => Promise.resolve({ total: 0, results: [] }));

  constructor(model: unknown, telemetry: unknown, cache: unknown) {
    this.model = model;
    this.telemetry = telemetry;
    this.cache = cache;
  }
}
