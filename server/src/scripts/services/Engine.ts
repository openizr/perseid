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
  type Authors,
  type Version,
  type Deletion,
  type Timestamps,
} from '@perseid/core';
import Logger from 'scripts/services/Logger';
import EngineError from 'scripts/errors/Engine';
import type BaseModel from 'scripts/services/Model';
import type BaseDatabaseClient from 'scripts/services/DatabaseClient';
import { isPlainObject } from 'basx';

/**
 * Perseid engine, contains all the basic CRUD methods.
 */
export default class Engine<
  /** Data model types definitions. */
  Types,

  /** Model class types definitions. */
  Model extends BaseModel<Types> = BaseModel<Types>,

  /** Database client types definition. */
  DatabaseClient extends BaseDatabaseClient<Types> = BaseDatabaseClient<Types>,
> {
  /** Data model. */
  protected model: Model;

  /** Logging system. */
  protected logger: Logger;

  /** Database client. */
  protected databaseClient: DatabaseClient;

  /** Ugly hack to avoid linter issue in `generateAutomaticFields`. */
  protected defaultUpdatedBy = null;

  /**
   * Performs a deep (recursive) merge of `resource` and `payload`. Rules are the following:
   *  - `null` is a special value that signifies "remove the item" in an array or a dynamic object.
   *    For instance, merging `[1, 2, 3]` and `[null, 2, null]` will give `[2]`.
   *  - If payload has less items than the original resource, remaining items will be added. For
   *    instance, merging `[1, 2, 3, 4]` and `[9, 10]` will give `[9, 10, 3, 4]`.
   *
   * @param resource Original resource on which to apply the deep merge.
   *
   * @param payload New values to partially update resource with.
   *
   * @param dataModel Current field data model (used to determine wether field is an array or a
   * dynamic object).
   *
   * @returns A deep merge of `resource` and `payload`.
   */
  protected deepMerge<Collection extends keyof Types>(
    resource: Types[Collection],
    payload: Partial<Types[Collection]>,
    dataModel: FieldDataModel<Types>,
  ): Partial<Types[Collection]> {
    // Primitive values...
    if (
      (!isPlainObject(payload) && !Array.isArray(payload))
      || (!isPlainObject(resource) && !Array.isArray(resource))
    ) {
      return payload;
    }

    // Arrays...
    if (dataModel.type === 'array') {
      const newArray = [];
      const { fields } = dataModel as ArrayDataModel<Types>;
      const arrayPayload = payload as unknown as Types[Collection][];
      const arrayResource = resource as unknown as Types[Collection][];
      for (let i = 0, { length } = arrayPayload; i < length; i += 1) {
        if (arrayPayload[i] !== null) {
          newArray.push(this.deepMerge(arrayResource[i], arrayPayload[i], fields));
        }
      }
      for (let i = 0, diff = arrayResource.length - arrayPayload.length; i < diff; i += 1) {
        newArray.push(arrayResource[arrayPayload.length + i]);
      }
      return newArray as unknown as Partial<Types[Collection]>;
    }

    // (dynamic) Objects...
    const isDynamic = dataModel.type === 'dynamicObject';
    const { fields } = dataModel as DynamicObjectDataModel<Types>;
    const payloadKeys = Object.keys(payload);
    const resourceKeys = Object.keys(resource as Partial<Types[Collection]>);
    const newDynamicObject: Partial<Types[Collection]> = {};
    const patterns = Object.keys(fields).map((pattern) => new RegExp(pattern));
    for (let i = 0, { length } = payloadKeys; i < length; i += 1) {
      const key = payloadKeys[i] as keyof Types[Collection];
      if (payload[key] !== null && isDynamic) {
        newDynamicObject[key] = this.deepMerge(
          resource[key] as unknown as Types[Collection],
          payload[key] as unknown as Types[Collection],
          fields[(patterns.find((p) => p.test(String(key))) as RegExp).source],
        ) as Types[Collection][keyof Types[Collection]];
      } else if (!isDynamic) {
        newDynamicObject[key] = payload[key];
      }
    }
    for (let i = 0, { length } = resourceKeys; i < length; i += 1) {
      const key = resourceKeys[i] as keyof Partial<Types[Collection]>;
      if (newDynamicObject[key] === undefined && payload[key] !== null) {
        newDynamicObject[key] = resource[key];
      }
    }
    return newDynamicObject;
  }

  /**
   * Generates automatic fields for `collection`.
   *
   * @param collectionModel Data model of the collection for which to generate automatic fields.
   *
   * @param context Command context.
   *
   * @param isCreation Whether operation is a creation, or an update of an existing resource.
   * Defaults to `false` (update mode).
   *
   * @returns An object containing automatic fields for `collection`.
   */
  protected generateAutomaticFields(
    collectionModel: CollectionDataModel<Types>,
    context: CommandContext & { _id?: Id; },
    // Defaulting to update mode is much safer: resources creation will fail as they won't have all
    // the required fields, as opposed to defaulting to creation mode, in which case fields will
    // simply be silently reset over and over.
    isCreation = false,
  ): Partial<Ids & Authors & Timestamps & Deletion & Version> {
    const automaticFields: Partial<Ids & Authors & Timestamps & Deletion & Version> = {};

    if (collectionModel.enableAuthors !== false) {
      if (isCreation) {
        automaticFields._updatedBy = this.defaultUpdatedBy;
        automaticFields._createdBy = context.user?._id ?? null;
      } else {
        automaticFields._updatedBy = context.user._id;
      }
    }

    if (collectionModel.enableTimestamps !== false) {
      if (isCreation) {
        automaticFields._updatedAt = null;
        automaticFields._createdAt = new Date();
      } else {
        automaticFields._updatedAt = new Date();
      }
    }

    if (isCreation) {
      automaticFields._id = context._id ?? new Id();
    }

    if (isCreation && collectionModel.enableDeletion === false) {
      automaticFields._isDeleted = false;
    }

    if (isCreation && collectionModel.version !== undefined) {
      automaticFields._version = collectionModel.version;
    }

    return automaticFields;
  }

  /**
   * Checks and updates `payloads` (if necessary), before creating, deleting or updating `resource`.
   *
   * @param command What type of operation will be performed.
   *
   * @param collection Collection on which the operation will be performed.
   *
   * @param payload Payload for updating, deleting or creating resource.
   *
   * @param context Command context.
   *
   * @param resourceId Id of the existing resource that will be updated or deleted, if applicable.
   *
   * @returns Updated payload.
   *
   * @throws If collection does not exist in data model.
   */
  protected async checkAndUpdatePayload<Collection extends keyof Types>(
    command: 'CREATE' | 'UPDATE' | 'DELETE',
    collection: Collection,
    payload: WithoutAutomaticFields<Types[Collection]>,
    context: CommandContext,
    resourceId?: Id,
  ): Promise<Types[Collection]> {
    const isUpdate = (command === 'UPDATE');
    const isCreation = (command === 'CREATE');
    const collectionModel = this.model.getCollection(collection);
    const updatedPayload = this.generateAutomaticFields(collectionModel, context, isCreation);

    if (isCreation || !isUpdate) {
      return {
        ...updatedPayload,
        ...payload,
      } as Types[Collection];
    }

    const fields = Object.keys(collectionModel.fields);
    const resource = await this.view(collection, resourceId as Id, { fields });
    Object.keys(payload).forEach((key) => {
      const fieldName = key as keyof Types[Collection];
      (updatedPayload as Types[Collection])[fieldName] = this.deepMerge(
        (resource as Types[Collection])[fieldName] as Types[Collection],
        (payload as Types[Collection])[fieldName] as Partial<Types[Collection]>,
        collectionModel.fields[key],
      ) as Types[Collection][keyof Types[Collection]];
    });

    return updatedPayload as Types[Collection];
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
  public async create<Collection extends keyof Types>(
    collection: Collection,
    payload: WithoutAutomaticFields<Types[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<Types[Collection]> {
    const fullPayload = await this.checkAndUpdatePayload('CREATE', collection, payload, context);
    this.databaseClient.checkFields(collection, options.fields ?? [], options.maximumDepth);
    await this.databaseClient.create(collection, fullPayload);
    return this.view(collection, (fullPayload as Ids)._id, options);
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
  public async update<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    payload: Partial<WithoutAutomaticFields<Types[Collection]>>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<Types[Collection]> {
    const data = payload as unknown as WithoutAutomaticFields<Types[Collection]>;
    const fullPayload = await this.checkAndUpdatePayload('UPDATE', collection, data, context, id);
    this.databaseClient.checkFields(collection, options.fields ?? [], options.maximumDepth);
    await this.databaseClient.update(collection, id, fullPayload);
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
  public async view<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    options: CommandOptions,
  ): Promise<Types[Collection]> {
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
  public async list<Collection extends keyof Types>(
    collection: Collection,
    options: CommandOptions,
  ): Promise<Results<Types[Collection]>> {
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
  public async search<Collection extends keyof Types>(
    collection: Collection,
    search: SearchBody,
    options: CommandOptions,
  ): Promise<Results<Types[Collection]>> {
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
  public async delete<Collection extends keyof Types>(
    collection: Collection,
    id: Id,
    context: CommandContext,
  ): Promise<void> {
    const payload = {} as WithoutAutomaticFields<Types[Collection]>;
    const fullPayload = await this.checkAndUpdatePayload('DELETE', collection, payload, context);

    if (!await this.databaseClient.delete(collection, id, fullPayload)) {
      throw new EngineError('NO_RESOURCE', { id });
    }
  }

  /**
   * Resets the whole system, including database.
   */
  public async reset(...args: unknown[]): Promise<void> {
    this.logger.warn('[Engine][reset] 🕐 Resetting system in 5 seconds, it\'s still time to abort...');
    await new Promise<unknown>((resolve) => { setTimeout(() => resolve(args.at(0)), 5000); });
    await this.databaseClient.reset();
  }
}
