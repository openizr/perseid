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
  type Authors,
  type IdSchema,
  type Deletion,
  type Timestamps,
  type FieldSchema,
} from '@perseid/core';
import EngineError from 'scripts/core/errors/Engine';
import Telemetry from 'scripts/core/services/Telemetry';
import type BaseModel from 'scripts/core/services/Model';
import type BaseDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';

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
  DataModel,

  /**
   * Model class type definition.
   */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /**
   * Database client type definition.
   */
  DatabaseClient extends BaseDatabaseClient<DataModel> = BaseDatabaseClient<DataModel>,
> {
  /**
   * Used to prevent false positives in linting.
   */
  private noop = noop;

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
    payload: UpdatePayload<DataModel[Resource]> | DataModel[Resource],
  ): SearchFilters | null {
    this.noop(resource, path, ids, payload);
    return { _id: ids };
  }

  /**
   * Prepares `payload` for database insertion/update, adding automatic fields and such.
   * Business logic checks should be implemented here as well.
   *
   * @param resource Type of resource for which to validate payload.
   *
   * @param operation Type of operation to perform.
   *
   * @param payload Payload to validate and update.
   *
   * @returns Prepared and validated payload, containing automatic fields.
   */
  protected async preparePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    operation: 'UPDATE',
    payload: UpdatePayload<DataModel[Resource]>,
  ): Promise<Payload<DataModel[Resource]>>;

  protected async preparePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    operation: 'CREATE',
    payload: CreatePayload<DataModel[Resource]>,
  ): Promise<Ids & DataModel[Resource]>;

  protected async preparePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    operation: 'CREATE' | 'UPDATE',
    payload: CreatePayload<DataModel[Resource]> | UpdatePayload<DataModel[Resource]>,
  ): Promise<Payload<DataModel[Resource]> | Ids & DataModel[Resource]> {
    const metaData = this.model.get(resource);
    const fullPayload = { ...payload } as Ids & Timestamps & Deletion & Authors;

    if (metaData.schema.enableTimestamps) {
      if (operation === 'CREATE') {
        fullPayload._updatedAt = null;
        fullPayload._createdAt = new Date();
      } else {
        fullPayload._updatedAt = new Date();
      }
    }

    if (metaData.schema.enableDeletion === false) {
      if (operation === 'CREATE') {
        fullPayload._isDeleted = false;
      }
    }

    if (operation === 'CREATE') {
      fullPayload._id = new Id();
    }

    const relations = new Map<string, {
      resource: keyof DataModel;
      filters: SearchFilters | null;
    }>();

    const checkPartialPayload = (
      partialPayload: unknown,
      currentSchema: FieldSchema<DataModel>,
      currentPath: string[] = [],
    ): void => {
      const path = currentPath.join('.');
      const { type } = currentSchema;
      const { relation } = currentSchema as IdSchema<DataModel>;

      if (type === 'array' && Array.isArray(partialPayload)) {
        partialPayload.forEach((value) => {
          checkPartialPayload(value, currentSchema.fields, currentPath);
        });
      } else if (type === 'object' && partialPayload !== null) {
        const objectPayload = partialPayload as Record<string, unknown>;
        Object.keys(objectPayload).forEach((fieldName) => {
          checkPartialPayload(
            objectPayload[fieldName],
            currentSchema.fields[fieldName],
            currentPath.concat([fieldName]),
          );
        });
      } else if (type === 'id' && relation !== undefined && partialPayload instanceof Id) {
        const existingFilters = relations.get(path);
        if (existingFilters && existingFilters.filters !== null) {
          (existingFilters.filters._id as Id[]).push(partialPayload);
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
    };

    checkPartialPayload(payload, {
      type: 'object',
      isRequired: true,
      fields: metaData.schema.fields,
    });

    await this.databaseClient.checkRelations(resource, relations);

    return fullPayload as DataModel[Resource];
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
  public async create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptions,
  ): Promise<DataModel[Resource]> {
    const fullPayload = await this.preparePayload(resource, 'CREATE', payload);
    await this.databaseClient.create(resource, fullPayload);
    return this.view(resource, fullPayload._id, options);
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
  public async update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    options: ViewCommandOptions,
  ): Promise<DataModel[Resource]> {
    if (Object.keys(payload).length > 0) {
      const newPayload = await this.preparePayload(resource, 'UPDATE', payload);
      await this.databaseClient.update(resource, id, newPayload);
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
  public async view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptions,
  ): Promise<DataModel[Resource]> {
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
  public async list<Resource extends keyof DataModel & string>(
    resource: Resource,
    searchBody: SearchBody,
    options: SearchCommandOptions,
  ): Promise<Results<DataModel[Resource]>> {
    return this.databaseClient.search(resource, searchBody, options);
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
  public async delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<void> {
    let resourceExists = false;
    const metaData = this.model.get(resource);

    if (metaData.schema.enableDeletion) {
      resourceExists = await this.databaseClient.delete(resource, id);
    } else {
      const payload = { _isDeleted: true } as UpdatePayload<DataModel[Resource]>;
      const fullPayload = await this.preparePayload(resource, 'UPDATE', payload);
      resourceExists = await this.databaseClient.update(resource, id, fullPayload);
    }

    if (!resourceExists) {
      throw new EngineError('NO_RESOURCE', { id });
    }
  }
}
