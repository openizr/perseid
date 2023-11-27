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
  type User,
  type Results,
  type Authors,
  type Payload,
  type Version,
  type Deletion,
  type Timestamps,
  type FieldSchema,
  type UpdatePayload,
  type CollectionSchema,
  type DataModelMetadata,
} from '@perseid/core';
import Logger from 'scripts/services/Logger';
import EngineError from 'scripts/errors/Engine';
import DatabaseError from 'scripts/errors/Database';
import type BaseModel from 'scripts/services/Model';
import type BaseDatabaseClient from 'scripts/services/DatabaseClient';

/**
 * Perseid engine, contains all the basic CRUD methods.
 */
export default class Engine<
  /** Data model types definitions. */
  DataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  DatabaseClient extends BaseDatabaseClient<DataModel> = BaseDatabaseClient<DataModel>,
> {
  /** Data model. */
  protected model: Model;

  /** Logging system. */
  protected logger: Logger;

  /** Database client. */
  protected databaseClient: DatabaseClient;

  /** Default update payload, used as a fallback when there is no change to perform on resource. */
  protected defaultPayload: Partial<Payload<unknown>> = {};

  /**
   * Returns filters to apply when checking foreign ids referencing other relations.
   *
   * @param collection Collection for which to return filters.
   *
   * @param path Path to the relation reference in data model.
   *
   * @param ids List of foreign ids to check.
   *
   * @param resource Current resource being updated, if applicable.
   *
   * @param payload Payload for updating or creating resource.
   *
   * @param context Command context.
   *
   * @returns Filters to apply to check foreign ids.
   */
  protected createRelationFilters<Collection extends keyof DataModel>(
    collection: Collection,
    path: string,
    ids: Id[],
    payload: UpdatePayload<DataModel[Collection]>,
    context: CommandContext,
  ): SearchFilters {
    this.logger.silent(collection, path, payload, context);
    return { _id: ids };
  }

  /**
   * Makes sure that foreign ids in `payload` reference existing resources that match specific
   * conditions.
   *
   * @param collection Collection for which to check foreign ids.
   *
   * @param payload Payload for updating or creating resource.
   *
   * @param context Command context.
   */
  protected async checkForeignIds<Collection extends keyof DataModel>(
    collection: Collection,
    payload: UpdatePayload<DataModel[Collection]>,
    context: CommandContext,
  ): Promise<void> {
    const foreignIds = new Map<string, Record<string, Set<string>>>();
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;

    const getForeignIds = (
      currentPayload: UpdatePayload<DataModel[Collection]> | null,
      schema: FieldSchema<DataModel>,
      path: string[],
    ): void => {
      // Null...
      if (currentPayload === null) {
        return;
      }

      // Expanded relation...
      if (schema.type === 'id' && schema.relation !== undefined && !(currentPayload instanceof Id)) {
        const relation = this.model.get(schema.relation);
        const { schema: subSchema } = relation as DataModelMetadata<CollectionSchema<DataModel>>;
        getForeignIds(currentPayload, { type: 'object', fields: subSchema.fields }, path);
        return;
      }

      // Relation...
      if (schema.type === 'id') {
        const { relation } = schema;
        if (relation !== undefined) {
          const finalPath = path.join('.');
          const relationIds = foreignIds.get(relation as string) ?? {};
          (relationIds[finalPath] as Set<string> | undefined) ??= new Set();
          relationIds[finalPath].add(`${currentPayload as string}`);
          foreignIds.set(relation as string, relationIds);
        }
        return;
      }

      // Arrays...
      if (schema.type === 'array') {
        const arrayPayload = currentPayload as unknown as DataModel[Collection][];
        for (let i = 0, { length } = arrayPayload; i < length; i += 1) {
          getForeignIds(arrayPayload[i], schema.fields, path);
        }
        return;
      }

      // Objects...
      if (schema.type === 'object') {
        const currentPayloadKeys = Object.keys(currentPayload);
        for (let i = 0, { length } = currentPayloadKeys; i < length; i += 1) {
          const key = currentPayloadKeys[i] as keyof UpdatePayload<DataModel[Collection]>;
          const subPayload = currentPayload[key] as unknown as DataModel[Collection];
          getForeignIds(subPayload, schema.fields[key as string], path);
        }
      }
    };

    getForeignIds(payload, { type: 'object', fields: metaData.schema.fields }, []);

    const filtersPerCollection = new Map<string, SearchFilters[]>();
    foreignIds.forEach((pathFilters, relation) => {
      const paths = Object.keys(pathFilters);
      filtersPerCollection.set(relation, paths.map((path) => this.createRelationFilters(
        collection,
        path,
        [...pathFilters[path]].map((id) => new Id(id)),
        payload,
        context,
      )));
    });
    await this.databaseClient.checkForeignIds(filtersPerCollection);
  }

  /**
   * Returns updated `payload` with automatic fields.
   *
   * @param collection Collection for which to generate automatic fields.
   *
   * @param resource Current resource being updated, if applicable.
   *
   * @param payload Payload to update.
   *
   * @param context Command context.
   *
   * @returns Payload with automatic fields.
   */
  protected async withAutomaticFields<Collection extends keyof DataModel>(
    collection: Collection,
    payload: Payload<DataModel[Collection]> | UpdatePayload<DataModel[Collection]>,
    context: CommandContext & { mode: 'CREATE' | 'UPDATE' },
  ): Promise<DataModel[Collection]> {
    const isCreation = (context.mode === 'CREATE');
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const fullPayload: Partial<Ids & Authors & Version & Deletion & Timestamps> = { ...payload };

    if (metaData.schema.enableAuthors) {
      if (isCreation) {
        fullPayload._updatedBy = null;
        // A null creator happens when a new user signs-up.
        (fullPayload as User)._createdBy = (context as { user?: User; }).user?._id ?? null;
      } else {
        fullPayload._updatedBy = (context as { user?: User; }).user?._id ?? null;
      }
    }

    if (metaData.schema.enableTimestamps) {
      if (isCreation) {
        fullPayload._updatedAt = null;
        fullPayload._createdAt = new Date();
      } else {
        fullPayload._updatedAt = new Date();
      }
    }

    if (isCreation) {
      fullPayload._id = new Id();
    }

    if (isCreation && metaData.schema.enableDeletion === false) {
      fullPayload._isDeleted = false;
    }

    if (isCreation && metaData.schema.version !== undefined) {
      fullPayload._version = metaData.schema.version;
    }

    return Promise.resolve(fullPayload as DataModel[Collection]);
  }

  /**
   * Performs specific checks `payload` to make sure it is valid, and updates it if necessary.
   *
   * @param collection Payload collection.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   */
  protected async checkAndUpdatePayload<Collection extends keyof DataModel>(
    collection: Collection,
    payload: UpdatePayload<DataModel[Collection]>,
    context: CommandContext & { mode: 'CREATE' | 'UPDATE' },
  ): Promise<Partial<DataModel[Collection]>> {
    return this.withAutomaticFields(collection, payload, context);
  }

  /**
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param logger Logging system to use.
   *
   * @param databaseClient Database client to use.
   */
  constructor(
    model: Model,
    logger: Logger,
    databaseClient: DatabaseClient,
  ) {
    this.model = model;
    this.logger = logger;
    this.databaseClient = databaseClient;
  }

  /**
   * Creates a new resource into `collection`.
   *
   * @param collection Name of the collection to create resource into.
   *
   * @param payload New resource payload.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Newly created resource.
   */
  public async create<Collection extends keyof DataModel>(
    collection: Collection,
    payload: Payload<DataModel[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<DataModel[Collection]> {
    const fullContext = { ...context, mode: 'CREATE' as const };
    const newPayload = payload as unknown as UpdatePayload<DataModel[Collection]>;
    this.databaseClient.checkFields(collection, options.fields ?? [], options.maximumDepth);
    const fullPayload = await this.checkAndUpdatePayload(collection, newPayload, fullContext);
    await this.checkForeignIds(collection, fullPayload, context);
    await this.databaseClient.create(collection, fullPayload as DataModel[Collection]);
    return this.view(collection, (fullPayload as DataModel[Collection] as Ids)._id, options);
  }

  /**
   * Updates resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to update resource from.
   *
   * @param id Resource id.
   *
   * @param payload Updated resource payload.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Updated resource.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public async update<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id,
    payload: UpdatePayload<DataModel[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<DataModel[Collection]> {
    if (Object.keys(payload).length > 0) {
      const fullContext = { ...context, mode: 'UPDATE' as const };
      this.databaseClient.checkFields(collection, options.fields ?? [], options.maximumDepth);
      const fullPayload = await this.checkAndUpdatePayload(collection, payload, fullContext);
      await this.checkForeignIds(collection, fullPayload, context);
      await this.databaseClient.update(collection, id, fullPayload);
    }
    return this.view(collection, id, options);
  }

  /**
   * Fetches resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to fetch resource from.
   *
   * @param id Resource id.
   *
   * @param options Command options.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public async view<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id,
    options: CommandOptions,
  ): Promise<DataModel[Collection]> {
    const resource = await this.databaseClient.view(collection, id, { fields: options.fields });

    if (resource === null) {
      throw new EngineError('NO_RESOURCE', { id });
    }

    return resource;
  }

  /**
   * Fetches a paginated list of resources from `collection`.
   *
   * @param collection Name of the collection to fetch resources from.
   *
   * @param options Command options.
   *
   * @returns Paginated list of resources.
   */
  public async list<Collection extends keyof DataModel>(
    collection: Collection,
    options: CommandOptions,
  ): Promise<Results<DataModel[Collection]>> {
    return this.databaseClient.list(collection, options);
  }

  /**
   * Fetches a paginated list of resources from `collection` according to given search options.
   *
   * @param collection Name of the collection to fetch resources from.
   *
   * @param search Search options (filters, text query) to filter resources with.
   *
   * @param options Command options.
   *
   * @returns Paginated list of resources.
   */
  public async search<Collection extends keyof DataModel>(
    collection: Collection,
    search: SearchBody,
    options: CommandOptions,
  ): Promise<Results<DataModel[Collection]>> {
    return this.databaseClient.search(collection, search, options);
  }

  /**
   * Deletes resource with id `id` from `collection`.
   *
   * @param collection Name of the collection to delete resource from.
   *
   * @param id Resource id.
   *
   * @param context Command context.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public async delete<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id,
    context: CommandContext,
  ): Promise<void> {
    const fullContext = { ...context, mode: 'UPDATE' as const };
    const payload = await this.withAutomaticFields(collection, {}, fullContext);

    if (!await this.databaseClient.delete(collection, id, payload)) {
      // We use `DatabaseError` here as we want to get the same special message as for
      // missing foreign relations.
      throw new DatabaseError('NO_RESOURCE', { id });
    }
  }

  /**
   * Resets the whole system, including database.
   */
  public async reset(...args: unknown[]): Promise<void> {
    this.logger.warn('[Engine][reset] 🕐 Resetting system in 5 seconds, it\'s still time to abort...');
    await new Promise<unknown>((resolve) => { setTimeout(() => { resolve(args.at(0)); }, 5000); });
    await this.databaseClient.reset();
  }
}
