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
  toSnakeCase,
} from '@perseid/core';
import type {
  Payload,
  SearchBody,
  UpdatePayload,
  CreatePayload,
  SearchFilters,
  CommandContext,
} from 'scripts/core/types';
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
   * Verifies that user has the right permissions to perform `operation`, using given payload and
   * context. This method should return any additional information that is relevant to perform the
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
    operation: string,
    payload: unknown,
    context: Partial<CommandContext<DataModel>>,
  ): Promise<CommandContext<DataModel>> {
    const { session } = context;
    const filteredFields = new Set<string>();
    const finalContext = context as CommandContext<DataModel>;
    const allFields = [...context.queryOptions?.fields ?? []]
      .concat(Object.keys(context.queryOptions?.sortBy ?? {}))
      .concat(['_id']);

    if (context.resource !== undefined && session !== undefined) {
      if (operation === 'LIST') {
        const listPayload = payload as SearchBody;
        allFields.push(...Object.keys(listPayload.filters ?? {}).map(String));
        allFields.push(...Array.from(listPayload.query?.on ?? []).map(String));
      }

      const requestedFields = new Set(allFields);
      const permissions = session.user._permissions;
      const metaData = this.model.get(context.resource.type);
      const permission = `${toSnakeCase(String(context.resource.type))}.${operation}`;
      const mustCheckViewPermission = (operation === 'CREATE' || operation === 'UPDATE');

      if (mustCheckViewPermission && !metaData.schema.allowedOperations?.includes('VIEW')) {
        throw new EngineError('OPERATION_NOT_ALLOWED', { operation: 'VIEW' });
      }

      if (!metaData.schema.allowedOperations?.includes(operation as 'CREATE')) {
        throw new EngineError('OPERATION_NOT_ALLOWED', { operation });
      }

      while (allFields.length > 0) {
        const path = String(allFields.shift());
        const isWildcard = path.at(-1) === '*';
        const pathWithoutWildcard = isWildcard ? path.slice(0, -2) : path;
        const getFullPath = (field: string): string => `${pathWithoutWildcard}.${field}`;

        if (path === '*') {
          allFields.push(...Object.keys(metaData.schema.fields));
        } else {
          const fieldMetaData = this.model.get(`${String(context.resource)}.${pathWithoutWildcard}`);

          if (fieldMetaData === null) {
            throw new EngineError('UNKNOWN_FIELD', { path });
          }

          if (fieldMetaData.schema.type === 'object') {
            allFields.push(...Object.keys(fieldMetaData.schema.fields).map(getFullPath));
          } else if (fieldMetaData.schema.type === 'id' && isWildcard) {
            if (fieldMetaData.schema.relation === undefined) {
              throw new EngineError('UNKNOWN_FIELD', { path });
            }
            const relationMetaData = this.model.get(fieldMetaData.schema.relation);
            allFields.push(...Object.keys(relationMetaData.schema.fields).map(getFullPath));
          } else {
            const missingPermission = fieldMetaData.permissions.find((fieldPermission) => (
              fieldPermission === null || !permissions.has(fieldPermission)
            ));
            if (missingPermission === undefined) {
              filteredFields.add(path);
            } else if (requestedFields.has(path)) {
              throw new EngineError('FORBIDDEN', { permission: missingPermission });
            }
          }
        }
      }

      // Unverified users cannot perform any operation.
      if (session.user._verifiedAt === null) {
        throw new EngineError('USER_NOT_VERIFIED');
      }

      // Users cannot update their own roles if not explicitly allowed.
      if (context.resource.type === 'users') {
        const userPayload = this.defineUpdatePayload<{ roles: Id[]; }>(payload);
        if (userPayload.roles !== undefined && !session.user._permissions.has('USERS.UPDATE_ROLES')) {
          throw new EngineError('FORBIDDEN', { permission: 'USERS.UPDATE_ROLES' });
        }
      }

      if (!session.user._permissions.has(permission)) {
        // Users can always update their own information.
        if (!(operation === 'USERS.UPDATE' && String(context.resource.id) === String(session.user._id))) {
          throw new EngineError('FORBIDDEN', { permission: operation });
        }
      }

      return {
        ...finalContext,
        queryOptions: {
          ...finalContext.queryOptions,
          fields: [...filteredFields],
        },
      };
    }

    return Promise.resolve({
      ...finalContext,
      queryOptions: {
        ...finalContext.queryOptions,
        fields: allFields,
      },
    });
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
  protected async prepareCreatePayload<Resource extends keyof DataModel>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]> {
    const metaData = this.model.get(resource);
    let fullPayload = this.defineCreatePayload<Ids & Timestamps & Deletion & Authors>(payload);
    fullPayload = deepCopy(fullPayload);

    fullPayload._id = new Id();

    if (metaData.schema.enableTimestamps) {
      fullPayload._updatedAt = null;
      fullPayload._createdAt = new Date();
    }

    if (metaData.schema.enableAuthors && context.session !== undefined) {
      fullPayload._updatedBy = null;
      fullPayload._createdBy = context.session.user._id;
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
      context.queryOptions,
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
   * @param context Command context.
   *
   * @returns Prepared and validated payload, containing automatic fields.
   */
  protected async prepareUpdatePayload<Resource extends keyof DataModel>(
    resource: Resource,
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>> {
    const metaData = this.model.get(resource);
    const fullPayload = deepCopy(this.defineUpdatePayload<Timestamps & Authors>(payload));

    if (metaData.schema.enableTimestamps) {
      fullPayload._updatedAt = new Date();
    }

    if (metaData.schema.enableAuthors && context.session !== undefined) {
      fullPayload._updatedBy = context.session.user._id;
    }

    await this.databaseClient.checkRelations(
      resource,
      this.extractRelationsFromPayload(resource, payload, {
        type: 'object',
        isRequired: true,
        fields: metaData.schema.fields,
      }, payload),
      context.queryOptions,
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
    const fullContext = { ...context, resource: { type: resource, id: undefined } };
    const updatedContext = await this.applyPermissions('CREATE', payload, fullContext);
    const fullPayload = await this.prepareCreatePayload(resource, payload, updatedContext);
    await this.databaseClient.create(resource, fullPayload, updatedContext.queryOptions);
    // Prevents duplicate RBAC checks (in both `applyPermissions` and `view` methods).
    updatedContext.session = undefined;
    return this.view(resource, this.defineCreatePayload<Ids>(fullPayload)._id, updatedContext);
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
    let resourceExists = false;
    const fullContext = { ...context, resource: { type: resource, id } };
    const updatedContext = await this.applyPermissions('UPDATE', payload, fullContext);

    if (Object.keys(payload).length > 0) {
      const options = updatedContext.queryOptions;
      const newPayload = await this.prepareUpdatePayload(resource, payload, updatedContext);
      resourceExists = await this.databaseClient.update(resource, id, newPayload, options);

      if (!resourceExists) {
        throw new EngineError('NO_RESOURCE', { id });
      }
    }

    // Prevents duplicate RBAC checks (in both `applyPermissions` and `view` methods).
    updatedContext.session = undefined;
    return this.view(resource, id, updatedContext);
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
    const fullContext = { ...context, resource: { type: resource, id } };
    const updatedContext = await this.applyPermissions('VIEW', {}, fullContext);
    const result = await this.databaseClient.view<Key>(resource, id, updatedContext.queryOptions);

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
   * @param context Command context.
   *
   * @returns Paginated list of resources.
   */
  public async list<Key extends keyof QueryResults>(
    resource: keyof DataModel,
    searchBody: SearchBody,
    context: CommandContext<DataModel>,
  ): Promise<Key extends keyof QueryResults ? Results<QueryResults[Key]> : Results<Ids>> {
    const fullContext = { ...context, resource: { type: resource, id: undefined } };
    const updatedContext = await this.applyPermissions('LIST', searchBody, fullContext);
    return this.databaseClient.list<Key>(resource, searchBody, updatedContext.queryOptions);
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
  public async delete<Resource extends keyof DataModel>(
    resource: Resource,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<void> {
    let resourceExists = false;
    const metaData = this.model.get(resource);
    const fullContext = { ...context, resource: { type: resource, id } };
    const updatedContext = await this.applyPermissions('DELETE', {}, fullContext);

    if (metaData.schema.enableDeletion) {
      resourceExists = await this.databaseClient.delete(resource, id, updatedContext.queryOptions);
    } else {
      const options = updatedContext.queryOptions;
      const fullPayload = await this.prepareUpdatePayload(resource, {}, updatedContext);
      this.defineUpdatePayload<Deletion>(fullPayload)._isDeleted = true;
      resourceExists = await this.databaseClient.update(resource, id, fullPayload, options);
    }

    if (!resourceExists) {
      throw new EngineError('NO_RESOURCE', { id });
    }
  }
}
