/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  type Ids,
  type Results,
} from '@perseid/core';
import type {
  Payload,
  SearchBody,
  UpdatePayload,
  CreatePayload,
  CommandContext,
  SearchFilters,
} from 'scripts/core/types';
import type Model from 'scripts/core/services/Model';
import type Telemetry from 'scripts/core/services/Telemetry';
import EngineFragment from 'scripts/core/services/EngineFragment';
import type AbstractDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';

type Identity<T> = T;

type PublicFragment<
  DataModel extends object,
  DatabaseClient extends AbstractDatabaseClient<DataModel>> = Omit<EngineFragment<
    DataModel,
    DatabaseClient
  >, (
  'prepareCreatePayload'
  | 'prepareUpdatePayload'
  | 'checkResourceExists'
)> & {
  definePayload: EngineFragment<DataModel, DatabaseClient>['definePayload'];
  applyPermissions: EngineFragment<DataModel, DatabaseClient>['applyPermissions'];
  defineFullPayload: EngineFragment<DataModel, DatabaseClient>['defineFullPayload'];
  getRelationFilters: EngineFragment<DataModel, DatabaseClient>['getRelationFilters'];
  checkResourceExists: EngineFragment<DataModel, DatabaseClient>['checkResourceExists'];
  defineCreatePayload: EngineFragment<DataModel, DatabaseClient>['defineCreatePayload'];
  defineUpdatePayload: EngineFragment<DataModel, DatabaseClient>['defineUpdatePayload'];
  prepareCreatePayload: EngineFragment<DataModel, DatabaseClient>['prepareCreatePayload'];
  prepareUpdatePayload: EngineFragment<DataModel, DatabaseClient>['prepareUpdatePayload'];
  isResourceCreatePayload: EngineFragment<DataModel, DatabaseClient>['isResourceCreatePayload'];
  isResourceUpdatePayload: EngineFragment<DataModel, DatabaseClient>['isResourceUpdatePayload'];
};

/**
 * Perseid engine, contains all the basic CRUD methods.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/Engine.ts
 */
export default class Engine<
  /**
   * Data model type definition.
   */
  DataModel extends object,

  /**
   * Query results type definition.
   */
  QueryResults extends Record<string, Ids> = Record<string, Ids>,

  /**
   * Database client type definition.
   */
  DatabaseClient extends AbstractDatabaseClient<
    DataModel,
    QueryResults
  > = AbstractDatabaseClient<DataModel, QueryResults>,
> {
  /**
   * Data model.
   */
  protected model: Model<DataModel>;

  /**
   * Telemetry system.
   */
  protected telemetry: Telemetry;

  /**
   * Database client.
   */
  protected databaseClient: DatabaseClient;

  /**
   * Registered engine fragments, indexed by resource type.
   */
  protected fragmentPerResource: Partial<Record<
    keyof DataModel,
    PublicFragment<DataModel, DatabaseClient>>
  >;

  /**
   * Default engine fragment, used as fallback for resources not registered
   * in `fragmentPerResource`.
   */
  protected defaultFragment: PublicFragment<DataModel, DatabaseClient>;

  /**
   * Registers a new `EngineFragment` instance.
   *
   * @param fragment `EngineFragment` instance to register.
   */
  protected registerFragment(
    fragment: EngineFragment<DataModel, AbstractDatabaseClient<DataModel>>,
  ): void {
    fragment.resources.forEach((resource) => {
      this.fragmentPerResource[resource] = (
        fragment as unknown as PublicFragment<DataModel, DatabaseClient>
      );
    });
  }

  /**
   * Type guard method that forces type inference on `payload`, to overcome TypeScript limitations
   * with conditional types inference in generic contexts. Does not perform any special operations.
   *
   * @param payload Payload to force type inference on.
   *
   * @returns Type-safe payload (as received by the Engine `create` method).
   */
  protected defineCreatePayload<Resource extends keyof DataModel>(
    payload: CreatePayload<DataModel[keyof DataModel]>,
  ): CreatePayload<DataModel[Resource]> {
    return this.defaultFragment.defineCreatePayload<Resource>(payload);
  }

  /**
   * Type guard method that forces type inference on `payload`, to overcome TypeScript limitations
   * with conditional types inference in generic contexts. Does not perform any special operations.
   *
   * @param payload Payload to force type inference on.
   *
   * @returns Type-safe payload (as received by the Engine `update` method).
   */
  protected defineUpdatePayload<Resource extends keyof DataModel>(
    payload: UpdatePayload<DataModel[keyof DataModel]>,
  ): UpdatePayload<DataModel[Identity<Resource>]> {
    return this.defaultFragment.defineUpdatePayload<Resource>(payload);
  }

  /**
   * Type guard method that forces type inference on `payload`, to overcome TypeScript limitations
   * with conditional types inference in generic contexts. Does not perform any special operations.
   *
   * @param payload Payload to force type inference on.
   *
   * @returns Type-safe payload (before update in database).
   */
  protected definePayload<Resource extends keyof DataModel>(
    payload: Payload<DataModel[keyof DataModel]>,
  ): Payload<DataModel[Identity<Resource>]> {
    return this.defaultFragment.definePayload<Resource>(payload);
  }

  /**
   * Type guard method that forces type inference on `payload`, to overcome TypeScript limitations
   * with conditional types inference in generic contexts. Does not perform any special operations.
   *
   * @param payload Payload to force type inference on.
   *
   * @returns Type-safe payload (before creation in database).
   */
  protected defineFullPayload<Resource extends keyof DataModel>(
    payload: DataModel[keyof DataModel],
  ): DataModel[Identity<Resource>] {
    return this.defaultFragment.defineFullPayload<Resource>(payload);
  }

  /**
   * Type guard method that checks if the payload is a valid create payload for the given resource.
   *
   * @param resource Resource type.
   *
   * @param expectedResource Expected resource type.
   *
   * @param payload Payload to check.
   */
  protected isResourceCreatePayload<Resource extends keyof DataModel>(
    resource: keyof DataModel,
    expectedResource: Resource,
    payload: unknown,
  ): payload is CreatePayload<DataModel[Resource]> {
    return this.defaultFragment.isResourceCreatePayload(resource, expectedResource, payload);
  }

  /**
   * Type guard method that checks if the payload is a valid update payload for the given resource.
   *
   * @param resource Resource type.
   *
   * @param expectedResource Expected resource type.
   *
   * @param payload Payload to check.
   */
  protected isResourceUpdatePayload<Resource extends keyof DataModel>(
    resource: keyof DataModel,
    expectedResource: Resource,
    payload: unknown,
  ): payload is UpdatePayload<DataModel[Resource]> {
    return this.defaultFragment.isResourceUpdatePayload(resource, expectedResource, payload);
  }

  /**
   * Returns filters to apply when checking foreign IDs referencing other relations.
   * If `null` is returned, foreign IDs will not be checked.
   *
   * @param resource Type of resource for which to return filters.
   *
   * @param path Path to the relation reference in data model.
   *
   * @param ids List of foreign IDs to check.
   *
   * @param payload Payload for updating or creating resource.
   *
   * @returns Filters to apply to check foreign IDs, or `null` if they should not be checked.
   */
  protected getRelationFilters<Resource extends keyof DataModel>(
    resource: Resource,
    path: string,
    ids: Id[],
    payload: UpdatePayload<DataModel[Resource]> | CreatePayload<DataModel[Resource]>,
  ): SearchFilters & { _id: Id[]; } | null {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.getRelationFilters(resource, path, ids, payload);
  }

  /**
   * Verifies that user has the right permissions to perform `operation`, using given `payload` and
   * `context`. This method should return any additional information that is relevant to perform the
   * operation in granted scope, such as filtered options, updated payload, sub-resources for
   * narrowing down the scope, etc.
   *
   * @param operation Type of operation to perform.
   *
   * @param payload Operation payload.
   *
   * @param context Command context. If no session is provided, RBAC checks will not be performed.
   *
   * @returns Updated context, allowing to perform the operation in granted scope.
   *
   * @throws If field path does not exist in data model.
   *
   * @throws If maximum level of resources depth is exceeded.
   *
   * @throws If user does not have sufficient permissions to perform the operation.
   *
   * @throws If `operation` is not allowed for the given resource.
   */
  protected async applyPermissions(
    resource: keyof DataModel,
    operation: string,
    id: Id | null,
    payload: unknown,
    context: Partial<CommandContext<DataModel>>,
  ): Promise<CommandContext<DataModel>> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.applyPermissions(
      resource,
      operation,
      id,
      payload,
      context,
    );
  }

  /**
   * Checks if the resource exists.
   *
   * @param resourceExists If the resource exists.
   *
   * @param id Resource ID.
   *
   * @throws If resource does not exist.
   */
  protected checkResourceExists(resourceExists: boolean, id: Id): void {
    this.defaultFragment.checkResourceExists(resourceExists, id);
  }

  /**
   * Prepares creation `payload` for database insertion/update, adding automatic fields and such.
   * Business logic checks should be implemented here as well.
   *
   * @param resource Type of resource for which to validate payload.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   *
   * @returns Prepared and validated payload, containing automatic fields.
   */
  protected prepareCreatePayload<Resource extends keyof DataModel>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.prepareCreatePayload(resource, payload, context);
  }

  /**
   * Prepares update `payload` for database insertion/update, adding automatic fields and such.
   * Business logic checks should be implemented here as well.
   *
   * @param resource Type of resource for which to validate payload.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   *
   * @returns Prepared and validated payload, containing automatic fields.
   */
  protected prepareUpdatePayload<Resource extends keyof DataModel>(
    resource: Resource,
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.prepareUpdatePayload(resource, payload, context);
  }

  /**
   * Class constructor.
   *
   * @param model Model instance to use.
   *
   * @param telemetry Telemetry instance to use.
   *
   * @param databaseClient DatabaseClient instance to use.
   */
  constructor(
    model: Model<DataModel>,
    telemetry: Telemetry,
    databaseClient: DatabaseClient,
  ) {
    this.model = model;
    this.telemetry = telemetry;
    this.databaseClient = databaseClient;
    this.fragmentPerResource = {};
    this.defaultFragment = new EngineFragment<DataModel, DatabaseClient>(
      model,
      telemetry,
      databaseClient,
    ) as unknown as PublicFragment<DataModel, DatabaseClient>;
  }

  /**
   * Creates a new resource.
   *
   * @param resource Type of resource to create.
   *
   * @param payload New resource payload.
   *
   * @param context Command context, if any.
   *
   * @returns Newly created resource.
   */
  public async create<
    Key extends keyof QueryResults,
    Resource extends keyof DataModel = keyof DataModel
  >(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Key extends keyof QueryResults ? QueryResults[Key] : Ids> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.create(resource, payload, context);
  }

  /**
   * Updates resource with id `id`.
   *
   * @param resource Type of resource to update.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   *
   * @param context Command context.
   *
   * @returns Updated resource.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async update<
    Key extends keyof QueryResults,
    Resource extends keyof DataModel = keyof DataModel
  >(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Key extends keyof QueryResults ? QueryResults[Key] : Ids> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.update(resource, id, payload, context);
  }

  /**
   * Fetches resource with id `id`.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Resource id.
   *
   * @param context Command context. If no session is provided, no RBAC nor options checks will be
   * performed. This can be especially useful when calling `view` methods from other methods like
   * `create` or `update`, to improve performance by avoiding duplicated checks.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async view<Key extends keyof QueryResults>(
    resource: keyof DataModel,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<Key extends keyof QueryResults ? QueryResults[Key] : Ids> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.view(resource, id, context);
  }

  /**
   * Fetches resource with id `id`, without performing any RBAC checks. This can be especially
   * useful when fetching resources from other methods like `create` or `update`, to improve
   * performance by avoiding duplicated checks.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Resource id.
   *
   * @param context Command context.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async unsafeView<Result = unknown>(
    resource: keyof DataModel,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<Result> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.unsafeView(resource, id, context);
  }

  /**
   * Fetches a paginated list of resources matching `searchBody` constraints, without performing
   * any RBAC checks. This can be especially useful when fetching resources from other methods like
   * `create` or `update`, to improve performance by avoiding duplicated checks.
   *
   * @param resource Type of resource to fetch.
   *
   * @param searchBody Search body (filters, text query) to filter resources with.
   *
   * @param context Command context.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async unsafeList<Result = unknown>(
    resource: keyof DataModel,
    searchBody: SearchBody,
    context: CommandContext<DataModel>,
  ): Promise<Results<Result>> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.unsafeList(resource, searchBody, context);
  }

  /**
   * Fetches a paginated list of resources matching `searchBody` constraints.
   *
   * @param resource Type of resources to fetch.
   *
   * @param searchBody Search body (filters, text query) to filter resources with.
   *
   * @param context Command context.
   *
   * @returns Paginated list of resources.
   */
  public async list<Key extends keyof QueryResults>(
    resource: keyof DataModel,
    searchBody: SearchBody,
    context: CommandContext<DataModel>,
  ): Promise<Results<Key extends keyof QueryResults ? QueryResults[Key] : Ids>> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.list<Key extends keyof QueryResults ? QueryResults[Key] : Ids>(
      resource,
      searchBody,
      context,
    );
  }

  /**
   * Deletes resource with id `id`.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource id.
   *
   * @param context Command context.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async delete(
    resource: keyof DataModel,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<void> {
    const fragment = this.fragmentPerResource[resource] ?? this.defaultFragment;
    return fragment.delete(resource, id, context);
  }
}
