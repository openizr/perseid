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
import DatabaseError from 'scripts/errors/Database';
import type BaseModel from 'scripts/services/Model';
import type BaseDatabaseClient from 'scripts/services/DatabaseClient';

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

  /** Default update payload, used as a fallback when there is no change to perform on resource. */
  protected defaultPayload: Partial<Payload<unknown>> = {};

  /**
   * Performs a deep (recursive) merge of `resource` and `payload`. Rules are the following:
   *  - `null` is a special value that signifies "remove the item" in an array or a dynamic object.
   *    For instance, merging `[1, 2, 3]` and `[null, 2, null]` will give `[2]`.
   *  - If payload has less items than the original resource, remaining items will be added. For
   *    instance, merging `[1, 2, 3, 4]` and `[9, 10]` will give `[9, 10, 3, 4]`.
   *  - If `payload` and `resource` are deeply equal, a special `unchanged` value is returned.
   *
   * @param resource Original resource on which to apply the deep merge.
   *
   * @param payload New values to partially update resource with.
   *
   * @param dataModel Current field data model (used to determine wether field is an array or a
   * dynamic object).
   *
   * @param foreignIds Optional parameter, use it to also extract foreign ids from payload. If this
   * parameter is passed, a list of foreign ids per collection will be generated and stored in that
   * variable. Defaults to `new Map()`.
   *
   * @param path Current path in schema. Used for recursivity, do not use it directly!
   *
   * @returns A deep merge of `resource` and `payload`.
   */
  protected deepMerge<Collection extends keyof Types>(
    resource: Partial<Types[Collection]>,
    payload: UpdatePayload<Types[Collection]>,
    dataModel: FieldDataModel<Types>,
    foreignIds: Map<string, Record<string, Set<string>>> = new Map(),
    path: string[] = [],
  ): UpdatePayload<Types[Collection]> {
    const { type } = dataModel;

    // Expanded relation...
    if (type === 'id' && dataModel.relation !== undefined && payload !== null && !(payload instanceof Id)) {
      return this.deepMerge(resource, payload, {
        type: 'object', fields: this.model.getCollection(dataModel.relation).fields,
      }, foreignIds, path);
    }

    // Relation...
    if (type === 'id' && payload !== null) {
      const { relation } = dataModel;
      if (relation !== undefined) {
        const finalPath = path.join('.');
        const relationIds = foreignIds.get(relation as string) ?? {};
        relationIds[finalPath] ??= new Set();
        relationIds[finalPath].add(`${payload}`);
        foreignIds.set(relation as string, relationIds);
      }
      return (path.length > 1 || `${resource}` !== `${payload}`) ? payload : this.defaultPayload;
    }

    // Arrays...
    if (type === 'array' && payload !== null) {
      const newArray = [];
      const { fields } = dataModel as ArrayDataModel<Types>;
      const arrayPayload = payload as unknown as Types[Collection][];
      const arrayResource = (resource ?? this.defaultPayload) as unknown as Types[Collection][];
      for (let i = 0, { length } = arrayPayload; i < length; i += 1) {
        if (arrayPayload[i] !== null) {
          const mergedValue = this.deepMerge(
            arrayResource[i] ?? this.defaultPayload,
            arrayPayload[i],
            fields,
            foreignIds,
            path,
          );
          if (mergedValue !== this.defaultPayload) {
            newArray.push(mergedValue);
          }
        }
      }
      for (let i = 0, diff = arrayResource.length - arrayPayload.length; i < diff; i += 1) {
        newArray.push(arrayResource[arrayPayload.length + i]);
      }
      return (path.length > 1 || newArray.length > 0)
        ? newArray as unknown as UpdatePayload<Types[Collection]>
        : this.defaultPayload;
    }

    // (dynamic) Objects...
    if ((type === 'dynamicObject' || type === 'object') && payload !== null) {
      const isDynamic = type === 'dynamicObject';
      const { fields } = dataModel as DynamicObjectDataModel<Types>;
      const payloadKeys = Object.keys(payload);
      const newDynamicObject: UpdatePayload<Types[Collection]> = {};
      const resourceKeys = Object.keys(resource ?? this.defaultPayload);
      const patterns = Object.keys(fields).map((pattern) => new RegExp(pattern));
      const ignoreKeys = new Set();
      for (let i = 0, { length } = payloadKeys; i < length; i += 1) {
        const key = payloadKeys[i] as keyof UpdatePayload<Types[Collection]>;
        if ((isDynamic && payload[key] !== null) || !isDynamic) {
          const mergedValue = this.deepMerge(
            resource?.[key] ?? this.defaultPayload,
            payload[key] as unknown as Types[Collection],
            fields[!isDynamic
              ? payloadKeys[i] : (patterns.find((p) => p.test(String(key))) as RegExp).source],
            foreignIds,
            path.concat([key as string]),
          ) as Types[Collection][keyof Payload<Types[Collection]>];
          if (mergedValue !== this.defaultPayload) {
            newDynamicObject[key] = mergedValue;
          } else {
            ignoreKeys.add(key);
          }
        }
      }
      // Completes final payload with existing values from resource.
      // path.length > 0 here because we always start from an object.
      if (path.length > 0) {
        for (let i = 0, { length } = resourceKeys; i < length; i += 1) {
          const key = resourceKeys[i] as keyof UpdatePayload<Types[Collection]>;
          if (newDynamicObject[key] === undefined && payload[key] !== null
            && !ignoreKeys.has(key)) {
            newDynamicObject[key] = (resource as Types[Collection])[key];
          }
        }
        return newDynamicObject;
      }
      return (Object.keys(newDynamicObject).length > 0) ? newDynamicObject : this.defaultPayload;
    }

    // Primitive value...
    return (path.length > 1 || (resource !== this.defaultPayload && `${resource}` !== `${payload}`)) ? payload : this.defaultPayload;
  }

  /**
   * Makes sure that `foreignIds` reference existing resources that match specific conditions.
   *
   * @param collection Collection for which to check foreign ids.
   *
   * @param resource Current resource being updated, if applicable.
   *
   * @param payload Payload for updating or creating resource.
   *
   * @param foreignIds Foreign ids map, generated from `deepMerge`.
   *
   * @param context Command context.
   */
  protected async checkForeignIds<Collection extends keyof Types>(
    collection: Collection,
    resource: Types[Collection] | null,
    payload: UpdatePayload<Types[Collection]>,
    foreignIds: Map<string, Record<string, Set<string>>>,
    context: CommandContext,
  ): Promise<void> {
    const filtersPerCollection = new Map();
    foreignIds.forEach((pathFilters, relation) => {
      const paths = Object.keys(pathFilters);
      filtersPerCollection.set(relation, paths.map((path) => this.createRelationFilters(
        collection,
        path,
        [...pathFilters[path]].map((id) => new Id(id)),
        resource,
        payload,
        context,
      )));
    });
    await this.databaseClient.checkForeignIds(filtersPerCollection);
  }

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
  protected createRelationFilters<Collection extends keyof Types>(
    collection: Collection,
    path: string,
    ids: Id[],
    resource: Types[Collection] | null,
    payload: UpdatePayload<Types[Collection]>,
    context: CommandContext,
  ): SearchFilters {
    this.logger.silent(collection, path, resource, payload, context);
    return { _id: ids };
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
  protected withAutomaticFields<Collection extends keyof Types>(
    collection: Collection,
    resource: Types[Collection] | null,
    payload: Payload<Types[Collection]> | UpdatePayload<Types[Collection]>,
    context: CommandContext,
  ): Types[Collection] {
    const isCreation = (resource === null);
    const collectionModel = this.model.getCollection(collection);
    const fullPayload: Partial<Ids & Authors & Version & Deletion & Timestamps> = { ...payload };

    if (collectionModel.enableAuthors) {
      if (isCreation) {
        fullPayload._updatedBy = null;
        fullPayload._createdBy = context.user?._id ?? null;
      } else {
        fullPayload._updatedBy = context.user._id;
      }
    }

    if (collectionModel.enableTimestamps) {
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

    if (isCreation && collectionModel.enableDeletion === false) {
      fullPayload._isDeleted = false;
    }

    if (isCreation && collectionModel.version !== undefined) {
      fullPayload._version = collectionModel.version;
    }

    return fullPayload as Types[Collection];
  }

  /**
   * Performs specific checks `payload` to make sure it is valid, and updates it if necessary.
   *
   * @param collection Payload collection.
   *
   * @param resource Current resource being updated, if applicable.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   */
  protected async checkAndUpdatePayload<Collection extends keyof Types>(
    collection: Collection,
    resource: Types[Collection] | null,
    payload: UpdatePayload<Types[Collection]>,
    context: CommandContext,
  ): Promise<Partial<Types[Collection]>> {
    return this.withAutomaticFields(collection, resource, payload, context);
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
    payload: Payload<Types[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<Types[Collection]> {
    const foreignIds = new Map();
    const { fields } = this.model.getCollection(collection);
    const resource = this.defaultPayload as Types[Collection];
    const newPayload = payload as unknown as UpdatePayload<Types[Collection]>;
    this.databaseClient.checkFields(collection, options.fields ?? [], options.maximumDepth);
    const fullPayload = await this.checkAndUpdatePayload(collection, null, newPayload, context);
    this.deepMerge(resource, fullPayload, { type: 'object', fields }, foreignIds);
    await this.checkForeignIds(collection, resource, fullPayload, foreignIds, context);
    await this.databaseClient.create(collection, fullPayload as Types[Collection]);
    return this.view(collection, (fullPayload as Types[Collection] as Ids)._id, options);
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
    payload: UpdatePayload<Types[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<Types[Collection]> {
    const foreignIds = new Map();
    const { fields } = this.model.getCollection(collection);
    const resource = await this.view(collection, id, { fields: Object.keys(fields) });
    this.databaseClient.checkFields(collection, options.fields ?? [], options.maximumDepth);
    const fullPayload = await this.checkAndUpdatePayload(collection, resource, payload, context);
    const finalPayload = this.deepMerge(resource, fullPayload, { type: 'object', fields }, foreignIds);
    if (finalPayload !== this.defaultPayload) {
      await this.checkForeignIds(collection, resource, finalPayload, foreignIds, context);
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
    const resource = {} as Types[Collection];
    const payload = await this.withAutomaticFields(collection, resource, {}, context);

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
    await new Promise<unknown>((resolve) => { setTimeout(() => resolve(args.at(0)), 5000); });
    await this.databaseClient.reset();
  }
}
