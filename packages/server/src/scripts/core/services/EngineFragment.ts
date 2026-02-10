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
  deepCopy,
  toSnakeCase,
  type Authors,
  type Results,
  type Deletion,
  isPlainObject,
  type IdSchema,
  type Timestamps,
  type FieldSchema,
} from '@perseid/core';
import type {
  Payload,
  SearchBody,
  SearchFilters,
  UpdatePayload,
  CreatePayload,
  CommandContext,
} from 'scripts/core/types';
import { EngineError } from 'scripts/core';
import type Model from 'scripts/core/services/Model';
import type Telemetry from 'scripts/core/services/Telemetry';
import type AbstractDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';

type Identity<T> = T;
const noop = (): null => null;
/**
 * Contains the main logic of the Perseid Engine.
 * This class is meant to be used by other engine fragments to implement their own logic.
 * Engine fragments are useful to split large codebases into smaller, more manageable pieces, each
 * responsible for a specific part of the engine.
 */
export default class EngineFragment<
  /**
   * Data model type definition.
   */
  DataModel extends object,

  /**
   * Database client type definition.
   */
  DatabaseClient extends AbstractDatabaseClient<DataModel> = AbstractDatabaseClient<DataModel>,
> {
  /**
   * Ugly hack to make the linter happy...
   */
  protected noop = noop;

  /**
   * Resources handled by this fragment.
   */
  public readonly resources: (keyof DataModel)[] = [];

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
    _resource: Resource,
    _path: string,
    ids: Id[],
    payload: UpdatePayload<DataModel[Resource]> | CreatePayload<DataModel[Resource]>,
  ): SearchFilters & { _id: Id[]; } | null {
    this.noop();
    return (typeof payload !== 'undefined') ? { _id: ids } : { _id: ids };
  }

  /**
   * Extracts all relations to other resources from `partialPayload`.
   *
   * @param resource
   * @param partialPayload
   * @param currentSchema
   * @param payload
   * @param currentPath
   * @param relations
   * @returns
   */
  protected extractRelationsFromPayload<Resource extends keyof DataModel>(
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
   * Checks if the resource exists.
   *
   * @param resourceExists If the resource exists.
   *
   * @param id Resource ID.
   *
   * @throws If resource does not exist.
   */
  protected checkResourceExists(resourceExists: boolean, id: Id): void {
    this.noop();
    if (!resourceExists) {
      throw new EngineError('NO_RESOURCE', { id });
    }
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
    this.noop();
    return payload as CreatePayload<DataModel[Resource]>;
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
    this.noop();
    return payload as UpdatePayload<DataModel[Resource]>;
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
    this.noop();
    return payload as Payload<DataModel[Resource]>;
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
    this.noop();
    return payload as DataModel[Resource];
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
    this.noop();
    return typeof payload !== 'undefined' && resource === expectedResource;
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
    this.noop();
    return typeof payload !== 'undefined' && resource === expectedResource;
  }

  /**
   * Checks if `operation` is allowed for `resource`, according to data model definition.
   *
   * @param resource Type of resource to check.
   *
   * @param operation Type of operation (CREATE, UPDATE, DELETE, LIST, VIEW) to check.
   *
   * @throws If operation is not allowed for that resource.
   */
  protected checkOperationAllowed(
    resource: keyof DataModel,
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'LIST' | 'VIEW',
  ): void {
    const metaData = this.model.get(resource);
    const isWriteOperation = (operation === 'CREATE' || operation === 'UPDATE');

    if (isWriteOperation && !metaData.schema.allowedOperations?.includes('VIEW')) {
      throw new EngineError('OPERATION_NOT_ALLOWED', { operation: 'VIEW' });
    }

    if (!metaData.schema.allowedOperations?.includes(operation)) {
      throw new EngineError('OPERATION_NOT_ALLOWED', { operation });
    }
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
    const { session } = context;
    const filteredFields = new Set<string>();
    const finalContext = context;
    const allFields = [...context.queryOptions?.fields ?? []]
      .concat(Object.keys(context.queryOptions?.sortBy ?? {}))
      .concat(['_id']);

    if (session !== undefined) {
      if (operation === 'LIST') {
        const listPayload = payload as SearchBody;
        allFields.push(...Object.keys(listPayload.filters ?? {}).map(String));
        allFields.push(...Array.from(listPayload.query?.on ?? []).map(String));
      }

      const requestedFields = new Set(allFields);
      const permissions = session.user._permissions;
      const metaData = this.model.get(resource);
      const permission = `${toSnakeCase(String(resource))}.${operation}`;

      while (allFields.length > 0) {
        const path = String(allFields.shift());
        const isWildcard = path.endsWith('*');
        const pathWithoutWildcard = isWildcard ? path.slice(0, -2) : path;
        const getFullPath = (field: string): string => `${pathWithoutWildcard}.${field}`;

        if (path === '*') {
          allFields.push(...Object.keys(metaData.schema.fields));
        } else {
          const resourcePath = `${String(resource)}.${pathWithoutWildcard}`;
          const fieldMetaData = this.model.get(resourcePath);

          if (fieldMetaData === null) {
            throw new EngineError('UNKNOWN_QUERY_FIELD', { path });
          }

          let fieldSchema = fieldMetaData.schema;
          if (fieldSchema.type === 'array') {
            fieldSchema = fieldSchema.fields;
          }

          if (fieldSchema.type === 'object') {
            allFields.push(...Object.keys(fieldSchema.fields).map(getFullPath));
          } else if (fieldSchema.type === 'id' && isWildcard) {
            if (fieldSchema.relation === undefined) {
              throw new EngineError('UNKNOWN_QUERY_FIELD', { path });
            }
            const relationMetaData = this.model.get(fieldSchema.relation);
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
      if (resource === 'users') {
        const userPayload = payload as { roles?: Id[]; };
        if (userPayload.roles !== undefined && !session.user._permissions.has('USERS.UPDATE_ROLES')) {
          throw new EngineError('FORBIDDEN', { permission: 'USERS.UPDATE_ROLES' });
        }
      }

      if (!session.user._permissions.has(permission)) {
        // Users can always update their own information.
        if (!(operation === 'USERS.UPDATE' && String(id) === String(session.user._id))) {
          throw new EngineError('FORBIDDEN', { permission });
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
   * Prepares creation `payload` for insertion in database, adding automatic fields and such.
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
    let fullPayload = payload as Deletion & Timestamps & Authors & Ids;
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
        description: '',
        isRequired: true,
        fields: metaData.schema.fields,
      }, payload),
      context.queryOptions,
    );

    return fullPayload as DataModel[Resource];
  }

  /**
   * Prepares update `payload` for update in database, adding automatic fields and such.
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
    const typedPayload = payload as Timestamps & Authors;
    const fullPayload = deepCopy(typedPayload);

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
        description: '',
        isRequired: true,
        fields: metaData.schema.fields,
      }, payload),
      context.queryOptions,
    );

    return fullPayload as Payload<DataModel[Resource]>;
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
    model: Model<DataModel>,
    telemetry: Telemetry,
    databaseClient: DatabaseClient,
  ) {
    this.model = model;
    this.telemetry = telemetry;
    this.databaseClient = databaseClient;
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
    const { queryOptions: options } = context;
    const result = await this.databaseClient.view(resource, id, options);

    if (result === null) {
      throw new EngineError('NO_RESOURCE', { id });
    }

    return result as Result;
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
    return await this.databaseClient.list(
      resource,
      searchBody,
      context.queryOptions,
    ) as Results<Result>;
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
  public async create<Result = unknown, Resource extends keyof DataModel = keyof DataModel>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Result> {
    this.checkOperationAllowed(resource, 'CREATE');
    const updatedContext = await this.applyPermissions(resource, 'CREATE', null, payload, context);
    const fullPayload = await this.prepareCreatePayload(resource, payload, updatedContext);
    await this.databaseClient.create(resource, fullPayload, updatedContext.queryOptions);
    const id = (fullPayload as Ids)._id;
    return this.unsafeView(resource, id, updatedContext);
  }

  /**
   * Updates resource with ID `id`.
   *
   * @param resource Type of resource to update.
   *
   * @param id Resource ID.
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
    Result = unknown,
    Resource extends keyof DataModel = keyof DataModel
  >(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Result> {
    this.checkOperationAllowed(resource, 'UPDATE');
    const updatedContext = await this.applyPermissions(resource, 'UPDATE', id, payload, context);

    if (Object.keys(payload).length > 0) {
      const options = updatedContext.queryOptions;
      const newPayload = await this.prepareUpdatePayload(resource, payload, updatedContext);
      const resourceExists = await this.databaseClient.update(resource, id, newPayload, options);
      this.checkResourceExists(resourceExists, id);
    }

    return this.unsafeView(resource, id, updatedContext);
  }

  /**
   * Deletes resource with ID `id`.
   *
   * @param resource Type of resource to delete.
   *
   * @param id Resource ID.
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
    let resourceExists = false;
    const metaData = this.model.get(resource);
    this.checkOperationAllowed(resource, 'DELETE');
    const updatedContext = await this.applyPermissions(resource, 'DELETE', id, {}, context);

    if (metaData.schema.enableDeletion) {
      resourceExists = await this.databaseClient.delete(resource, id, updatedContext.queryOptions);
    } else {
      const options = updatedContext.queryOptions;
      const payload = await this.prepareUpdatePayload(resource, {}, updatedContext);
      (payload as Deletion)._isDeleted = true;
      resourceExists = await this.databaseClient.update(resource, id, payload, options);
    }

    this.checkResourceExists(resourceExists, id);
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
  public async list<Result = unknown>(
    resource: keyof DataModel,
    searchBody: SearchBody,
    context: CommandContext<DataModel>,
  ): Promise<Results<Result>> {
    this.checkOperationAllowed(resource, 'LIST');
    const updatedContext = await this.applyPermissions(resource, 'LIST', null, searchBody, context);
    return this.unsafeList(resource, searchBody, updatedContext);
  }

  /**
   * Fetches resource with ID `id`.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Resource ID.
   *
   * @param context Command context. If no session is provided, no RBAC nor options checks will be
   * performed. This can be especially useful when calling `view` methods from other methods like
   * `create` or `update`, to improve performance by avoiding duplicated checks.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async view<Result = unknown>(
    resource: keyof DataModel,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<Result> {
    this.checkOperationAllowed(resource, 'VIEW');
    const updatedContext = await this.applyPermissions(resource, 'VIEW', id, {}, context);
    return this.unsafeView(resource, id, updatedContext);
  }
}
