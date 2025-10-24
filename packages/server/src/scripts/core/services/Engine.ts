/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  deepCopy,
  type Ids,
  type Results,
  type Authors,
  isPlainObject,
  type IdSchema,
  type Deletion,
  type Timestamps,
  type FieldSchema,
} from '@perseid/core';
import EngineError from 'scripts/core/errors/Engine';
import Telemetry from 'scripts/core/services/Telemetry';
import type DefaultModel from 'scripts/core/services/Model';
import type DefaultDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';

const noop = (...args: unknown[]): unknown => args;

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
   * Model class type definition.
   */
  Model extends DefaultModel<DataModel> = DefaultModel<DataModel>,

  /**
   * Database client type definition.
   */
  DatabaseClient extends DefaultDatabaseClient<
    DataModel,
    QueryResults
  > = DefaultDatabaseClient<DataModel, QueryResults>,
> {
  /**
   * Used to prevent false positives in linting. Don't use directly.
   */
  protected noop = noop;

  /**
   * Data model.
   */
  protected model: Model;

  /**
   * Telemetry system.
   */
  protected telemetry: Telemetry;

  /**
   * Database client.
   */
  protected databaseClient: DatabaseClient;

  /**
   * Type guard method that forces type inference on `payload`, right before update
   * in database, to overcome TypeScript limitations with conditional types inference in
   * generic contexts. Does not perform any special operations.
   *
   * @param payload Payload to force type inference on.
   *
   * @returns Payload with type inference forced.
   */
  protected defineCreatePayload<PayloadType>(
    payload: unknown,
  ): PayloadType {
    this.noop(payload);
    return payload as PayloadType;
  }

  /**
   * Type guard method that forces type inference on `payload`, right before insertion
   * in database, to overcome TypeScript limitations with conditional types inference in
   * generic contexts. Does not perform any special operations.
   *
   * @param payload Payload to force type inference on.
   *
   * @returns Payload with type inference forced.
   */
  protected defineUpdatePayload<PayloadType>(
    payload: unknown,
  ): Payload<PayloadType> {
    this.noop(payload);
    return payload as Payload<PayloadType>;
  }

  /**
   * Extracts all relations to other resources from `partialPayload`.
   * Internal method, do not use directly.
   *
   * @param resource Type of resource payload.
   *
   * @param partialPayload Payload to extract relations from.
   *
   * @param currentSchema Payload data model schema.
   *
   * @param payload Full payload that needs to be walked through.
   *
   * @param currentPath Path to the current payload in the data model.
   *
   * @param relations Final relations map. Defaults to an empty map.
   *
   * @returns List of relations to other resources, along with their filters.
   */
  private extractRelationsFromPayload<Resource extends keyof DataModel>(
    resource: Resource,
    partialPayload: unknown,
    currentSchema: FieldSchema<DataModel>,
    payload: UpdatePayload<DataModel[Resource]> | CreatePayload<DataModel[Resource]>,
    currentPath: string[] = [],
    relations = new Map<string, {
      resource: keyof DataModel;
      filters: SearchFilters & { _id: Id[]; } | null;
    }>(),
  ): Map<string, {
    resource: keyof DataModel;
    filters: SearchFilters & { _id: Id[]; } | null;
  }> {
    const path = currentPath.join('.');
    const { type } = currentSchema;
    const { relation } = currentSchema as IdSchema<DataModel>;

    if (type === 'array' && Array.isArray(partialPayload)) {
      partialPayload.forEach((value) => {
        this.extractRelationsFromPayload(
          resource,
          value,
          currentSchema.fields,
          payload,
          currentPath,
          relations,
        );
      });
    } else if (type === 'object' && isPlainObject(partialPayload)) {
      Object.keys(partialPayload).forEach((fieldName) => {
        this.extractRelationsFromPayload(
          resource,
          partialPayload[fieldName],
          currentSchema.fields[fieldName],
          payload,
          currentPath.concat([fieldName]),
          relations,
        );
      });
    } else if (type === 'id' && relation !== undefined && partialPayload instanceof Id) {
      const existingFilters = relations.get(path);
      if (existingFilters && existingFilters.filters !== null) {
        (existingFilters.filters._id).push(partialPayload);
        relations.set(path, existingFilters);
      } else {
        relations.set(currentPath.join('.'), {
          resource: relation,
          filters: this.getRelationFilters(
            resource,
            currentPath.join('.'),
            [partialPayload],
            payload,
          ),
        });
      }
    }

    return relations;
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
    this.noop(resource, path, ids, payload);
    return { _id: ids };
  }

  /**
   * Prepares creation `payload` for database insertion/update, adding automatic fields and such.
   * Business logic checks should be implemented here as well.
   *
   * @param resource Type of resource for which to validate payload.
   *
   * @param payload Payload to validate and update.
   *
   * @returns Prepared and validated payload, containing automatic fields.
   */
  protected async prepareCreatePayload<Resource extends keyof DataModel>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    context?: unknown,
  ): Promise<DataModel[Resource]> {
    this.noop(context);
    const metaData = this.model.get(resource);
    let fullPayload = this.defineCreatePayload<Ids & Timestamps & Deletion & Authors>(payload);
    fullPayload = deepCopy(fullPayload);

    fullPayload._id = new Id();

    if (metaData.schema.enableTimestamps) {
      fullPayload._updatedAt = null;
      fullPayload._createdAt = new Date();
    }

    if (metaData.schema.enableDeletion === false) {
      fullPayload._isDeleted = false;
    }

    await this.databaseClient.checkRelations(
      resource,
      this.extractRelationsFromPayload(resource, payload, {
        type: 'object',
        isRequired: true,
        fields: metaData.schema.fields,
      }, payload),
    );

    return this.defineCreatePayload<DataModel[Resource]>(fullPayload);
  }

  /**
   * Prepares update `payload` for database insertion/update, adding automatic fields and such.
   * Business logic checks should be implemented here as well.
   *
   * @param resource Type of resource for which to validate payload.
   *
   * @param payload Payload to validate and update.
   *
   * @returns Prepared and validated payload, containing automatic fields.
   */
  protected async prepareUpdatePayload<Resource extends keyof DataModel>(
    resource: Resource,
    payload: UpdatePayload<DataModel[Resource]>,
    context?: unknown,
  ): Promise<Payload<DataModel[Resource]>> {
    this.noop(context);
    const metaData = this.model.get(resource);
    const fullPayload = deepCopy(this.defineUpdatePayload<Timestamps>(payload));

    if (metaData.schema.enableTimestamps) {
      fullPayload._updatedAt = new Date();
    }

    await this.databaseClient.checkRelations(
      resource,
      this.extractRelationsFromPayload(resource, payload, {
        type: 'object',
        isRequired: true,
        fields: metaData.schema.fields,
      }, payload),
    );

    return this.defineUpdatePayload<DataModel[Resource]>(fullPayload);
  }

  /**
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param telemetry Telemetry system to use.
   *
   * @param databaseClient Database client to use.
   */
  constructor(
    model: Model,
    telemetry: Telemetry,
    databaseClient: DatabaseClient,
  ) {
    this.model = model;
    this.telemetry = telemetry;
    this.databaseClient = databaseClient;
  }

  /**
   * Creates a new resource.
   *
   * @param resource Type of resource to create.
   *
   * @param payload New resource payload.
   *
   * @param options Command options.
   *
   * @returns Newly created resource.
   */
  public async create<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptions<Key>,
    context?: unknown,
  ): Promise<QueryResults[Key]>;

  public async create<Resource extends keyof DataModel>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptionsWithoutKey,
    context?: unknown,
  ): Promise<Ids>;

  public async create<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptionsWithoutKey | ViewCommandOptions<Key>,
    context?: unknown,
  ): Promise<QueryResults[Key] | Ids> {
    this.noop(context);
    const metaData = this.model.get(resource);

    if (!metaData.schema.allowedOperations?.includes('CREATE')) {
      throw new EngineError('OPERATION_NOT_ALLOWED', { operation: 'CREATE' });
    }

    const fullPayload = await this.prepareCreatePayload(resource, payload);
    await this.databaseClient.create(resource, fullPayload);
    return this.view(resource, this.defineCreatePayload<Ids>(fullPayload)._id, options);
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
   * @param options Command options.
   *
   * @returns Updated resource.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async update<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    options: ViewCommandOptions<Key>,
    context?: unknown,
  ): Promise<QueryResults[Key]>;

  public async update<Resource extends keyof DataModel>(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    options: ViewCommandOptionsWithoutKey,
    context?: unknown,
  ): Promise<Ids>;

  public async update<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    options: ViewCommandOptionsWithoutKey | ViewCommandOptions<Key>,
    context?: unknown,
  ): Promise<QueryResults[Key] | Ids> {
    this.noop(context);
    let resourceExists = false;
    const metaData = this.model.get(resource);

    if (!metaData.schema.allowedOperations?.includes('UPDATE')) {
      throw new EngineError('OPERATION_NOT_ALLOWED', { operation: 'UPDATE' });
    }

    if (Object.keys(payload).length > 0) {
      const newPayload = await this.prepareUpdatePayload(resource, payload);
      resourceExists = await this.databaseClient.update(resource, id, newPayload);

      if (!resourceExists) {
        throw new EngineError('NO_RESOURCE', { id });
      }
    }

    return this.view(resource, id, options);
  }

  /**
   * Fetches resource with id `id`.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Resource id.
   *
   * @param options Command options.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async view<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptions<Key>,
    context?: unknown,
  ): Promise<QueryResults[Key]>;

  public async view<Resource extends keyof DataModel>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptionsWithoutKey,
    context?: unknown,
  ): Promise<Ids>;

  public async view<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptionsWithoutKey | ViewCommandOptions<Key>,
    context?: unknown,
  ): Promise<QueryResults[Key] | Ids> {
    this.noop(context);
    const metaData = this.model.get(resource);

    if (!metaData.schema.allowedOperations?.includes('VIEW')) {
      throw new EngineError('OPERATION_NOT_ALLOWED', { operation: 'VIEW' });
    }

    const result = await this.databaseClient.view(resource, id, options);

    if (result === null) {
      throw new EngineError('NO_RESOURCE', { id });
    }

    return result;
  }

  /**
   * Fetches a paginated list of resources matching `searchBody` constraints.
   *
   * @param resource Type of resources to fetch.
   *
   * @param searchBody Search body (filters, text query) to filter resources with.
   *
   * @param options Command options.
   *
   * @returns Paginated list of resources.
   */
  public async list<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    searchBody: SearchBody,
    options: ListCommandOptions<Key>,
    context?: unknown,
  ): Promise<Results<QueryResults[Key]>>;

  public async list<Resource extends keyof DataModel>(
    resource: Resource,
    searchBody: SearchBody,
    options: ListCommandOptionsWithoutKey,
    context?: unknown,
  ): Promise<Results<Ids>>;

  public async list<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    searchBody: SearchBody,
    options: ListCommandOptionsWithoutKey | ListCommandOptions<Key>,
    context?: unknown,
  ): Promise<Results<QueryResults[Key] | Ids>> {
    this.noop(context);

    const metaData = this.model.get(resource);

    if (!metaData.schema.allowedOperations?.includes('LIST')) {
      throw new EngineError('OPERATION_NOT_ALLOWED', { operation: 'LIST' });
    }

    return this.databaseClient.list(resource, searchBody, options);
  }

  /**
   * Deletes resource with id `id`.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource id.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async delete<Resource extends keyof DataModel>(
    resource: Resource,
    id: Id,
    context?: unknown,
  ): Promise<void> {
    this.noop(context);
    let resourceExists = false;
    const metaData = this.model.get(resource);

    if (!metaData.schema.allowedOperations?.includes('DELETE')) {
      throw new EngineError('OPERATION_NOT_ALLOWED', { operation: 'DELETE' });
    }

    if (metaData.schema.enableDeletion) {
      resourceExists = await this.databaseClient.delete(resource, id);
    } else {
      const fullPayload = await this.prepareUpdatePayload(resource, {});
      this.defineUpdatePayload<Deletion>(fullPayload)._isDeleted = true;
      resourceExists = await this.databaseClient.update(resource, id, fullPayload);
    }

    if (!resourceExists) {
      throw new EngineError('NO_RESOURCE', { id });
    }
  }
}
