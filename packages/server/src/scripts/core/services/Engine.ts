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
  UpdatePayload,
  CreatePayload,
  CommandContext,
  SearchFilters,
} from 'scripts/core/types';
import EngineError from 'scripts/core/errors/Engine';
import type Model from 'scripts/core/services/Model';
import type Telemetry from 'scripts/core/services/Telemetry';
import type AbstractDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';

const noop = (): null => null;

/**
 * Foreign IDs to check, indexed by path in data model.
 */
type Relations<DataModel> = Map<string, {
  resource: keyof DataModel & string;
  filters: SearchFilters & { _id: Id[]; } | null;
}>;

/**
 * Extends the base engine with custom methods specific to a resource.
 */
export interface EngineModule<DataModel, Resource extends keyof DataModel> {
  create?<Result = unknown>(
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
    baseCreate: (
      updatedPayload: CreatePayload<DataModel[Resource]>,
      updatedContext: CommandContext<DataModel>,
    ) => Promise<Result>,
  ): Promise<Result>;
  update?<Result = unknown>(
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
    baseUpdate: (
      updatedId: Id,
      updatedPayload: UpdatePayload<DataModel[Resource]>,
      updatedContext: CommandContext<DataModel>,
    ) => Promise<Result>,
  ): Promise<Result>;
  view?<Result = unknown>(
    id: Id,
    context: CommandContext<DataModel>,
    baseView: (updatedId: Id, updatedContext: CommandContext<DataModel>) => Promise<Result>,
  ): Promise<Result>;
  delete?(
    id: Id,
    context: CommandContext<DataModel>,
    baseDelete: (updatedId: Id, updatedContext: CommandContext<DataModel>) => Promise<void>,
  ): Promise<void>;
  list?<Result = unknown>(
    searchBody: SearchBody | null,
    context: CommandContext<DataModel>,
    baseList: (
      updatedSearchBody: SearchBody | null,
      updatedContext: CommandContext<DataModel>,
    ) => Promise<Results<Result>>,
  ): Promise<Results<Result>>;
}

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
   * Ugly hack to make the linter happy...
   */
  protected noop = noop;

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
   * List of registered modules used to override generic methods' base behavior.
   */
  protected registeredModules: {
    [Resource in keyof DataModel]?: EngineModule<DataModel, Resource>;
  } = {};

  /**
   * Extracts all relations to other resources from `partialPayload`.
   *
   * @param resource Type of resource for which to extract relations.
   *
   * @param partialPayload Current payload subset to inspect.
   *
   * @param currentSchema Schema of `partialPayload`.
   *
   * @param payload Full payload for updating or creating resource.
   *
   * @param currentPath Path of `partialPayload` in data model.
   *
   * @param relations Relations extracted so far.
   *
   * @returns Extracted relations.
   */
  private extractRelationsFromPayload<Resource extends keyof DataModel>(
    resource: Resource & string,
    partialPayload: unknown,
    currentSchema: FieldSchema<DataModel>,
    payload: UpdatePayload<DataModel[Resource]> | CreatePayload<DataModel[Resource]>,
    currentPath: string[] = [],
    relations: Relations<DataModel> = new Map(),
  ): Relations<DataModel> {
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
        relations.set(path, {
          resource: relation,
          filters: { _id: [partialPayload] },
        });
      }
    }

    return relations;
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
  private checkOperationAllowed(
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
   * @param resource Type of resource on which to perform the operation.
   *
   * @param operation Type of operation to perform.
   *
   * @param id Resource ID, if any.
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
  private async applyPermissions<Resource extends keyof DataModel>(
    resource: Resource,
    operation: string,
    _id: Id | null,
    payload: unknown,
    context: Partial<CommandContext<DataModel>>,
  ): Promise<CommandContext<DataModel>> {
    const { session } = context;
    const filteredFields = new Set<string>();
    const allFields = [...context.queryOptions?.fields ?? []]
      .concat(Object.keys(context.queryOptions?.sortBy ?? {}))
      .concat(['_id']);

    if (session !== undefined) {
      if (operation === 'LIST') {
        const listPayload = payload as SearchBody | null;
        allFields.push(...Object.keys(listPayload?.filters ?? {}).map(String));
        allFields.push(...Array.from(listPayload?.query?.on ?? []).map(String));
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

      if (!permissions.has(permission)) {
        throw new EngineError('FORBIDDEN', { permission });
      }

      return {
        ...context,
        queryOptions: { ...context.queryOptions, fields: [...filteredFields] },
      };
    }

    return Promise.resolve({
      ...context,
      queryOptions: { ...context.queryOptions, fields: allFields },
    });
  }

  /**
   * Base `create` method implementation.
   */
  private async baseCreate<
    Result = unknown,
    Resource extends keyof DataModel & string = keyof DataModel & string
  >(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Result> {
    return this.databaseClient.withSession(async (session) => {
      const options = { ...context.queryOptions, poolOrSession: session };
      await this.databaseClient.create(resource, payload as DataModel[Resource], options);
      return await this.databaseClient.view(resource, (payload as Ids)._id, options) as Result;
    });
  }

  /**
   * Base `update` method implementation.
   */
  private async baseUpdate<
    Result = unknown,
    Resource extends keyof DataModel & string = keyof DataModel & string
  >(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Result> {
    return this.databaseClient.withSession(async (session) => {
      const fullPayload = payload as Payload<DataModel[Resource]>;
      const options = { ...context.queryOptions, poolOrSession: session };
      const resourceExists = await this.databaseClient.update(resource, id, fullPayload, options);

      if (!resourceExists) {
        throw new EngineError('NO_RESOURCE', { id });
      }

      return await this.databaseClient.view(resource, id, options) as Result;
    });
  }

  /**
   * Base `view` method implementation.
   */
  private async baseView<Result = unknown>(
    resource: keyof DataModel & string,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<Result> {
    const updatedContext = await this.applyPermissions(resource, 'VIEW', id, {}, context);
    const result = await this.databaseClient.view(resource, id, updatedContext.queryOptions);

    if (result === null) {
      throw new EngineError('NO_RESOURCE', { id });
    }

    return result as Result;
  }

  /**
   * Base `list` method implementation.
   */
  private async baseList<Result = unknown>(
    resource: keyof DataModel & string,
    searchBody: SearchBody | null,
    context: CommandContext<DataModel>,
  ): Promise<Results<Result>> {
    const updatedContext = await this.applyPermissions(resource, 'LIST', null, searchBody, context);
    const options = updatedContext.queryOptions;
    return await this.databaseClient.list(resource, searchBody, options) as Results<Result>;
  }

  /**
   * Base `delete` method implementation.
   */
  private async baseDelete<Resource extends keyof DataModel & string = keyof DataModel & string>(
    resource: Resource,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<void> {
    let resourceExists = false;
    const metaData = this.model.get(resource);
    const updatedContext = await this.applyPermissions(resource, 'DELETE', id, {}, context);
    const options = updatedContext.queryOptions;

    if (metaData.schema.enableDeletion) {
      resourceExists = await this.databaseClient.delete(resource, id, options);
    } else {
      const payload: Partial<Deletion & Timestamps & Authors> = { _isDeleted: true };
      if (metaData.schema.enableTimestamps) {
        payload._updatedAt = new Date();
      }
      if (metaData.schema.enableAuthors && updatedContext.session !== undefined) {
        payload._updatedBy = updatedContext.session.user._id;
      }
      const deletePayload = payload as Payload<DataModel[Resource]>;
      resourceExists = await this.databaseClient.update(resource, id, deletePayload, options);
    }

    if (!resourceExists) {
      throw new EngineError('NO_RESOURCE', { id });
    }
  }

  /**
   * Registers `module` for `resource`, overriding any generic method by the one defined in it.
   *
   * @param resource Type of resource to register the module for.
   *
   * @param module Module to register.
   */
  protected registerModule<Resource extends keyof DataModel>(
    resource: Resource,
    module: EngineModule<DataModel, Resource>,
  ): void {
    this.registeredModules[resource] = module;
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
    this.registeredModules = {};
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
  public create<
    Key extends keyof QueryResults,
    Resource extends keyof DataModel & string = keyof DataModel & string
  >(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<QueryResults[Key]> {
    return this.telemetry.span(`${this.constructor.name}.create`, {
      kind: 'SERVER',
      attributes: {
        resource,
        'code.class.name': this.constructor.name,
      },
    }, async () => {
      this.checkOperationAllowed(resource, 'CREATE');
      const updatedContext = await this.applyPermissions(resource, 'CREATE', null, payload, context);

      const metaData = this.model.get(resource);
      const fullPayload = deepCopy(payload);

      (fullPayload as Ids)._id = new Id();

      if (metaData.schema.enableTimestamps) {
        (fullPayload as Timestamps)._updatedAt = null;
        (fullPayload as Timestamps)._createdAt = new Date();
      }

      if (metaData.schema.enableAuthors && context.session !== undefined) {
        (fullPayload as Authors)._updatedBy = null;
        (fullPayload as Authors)._createdBy = context.session.user._id;
      }

      if (metaData.schema.enableDeletion === false) {
        (fullPayload as Deletion)._isDeleted = false;
      }

      await this.databaseClient.checkRelations(
        resource,
        this.extractRelationsFromPayload(resource, payload, {
          type: 'object',
          description: '',
          isRequired: true,
          fields: this.model.get(resource).schema.fields,
        }, payload),
        updatedContext.queryOptions,
      );

      const customCreate = this.registeredModules[resource]?.create?.bind(this);
      const response = await (customCreate?.(fullPayload, updatedContext, (...args) => (
        this.baseCreate<QueryResults[Key], Resource>(resource, ...args)
      )) ?? this.baseCreate<QueryResults[Key], Resource>(resource, fullPayload, updatedContext));

      return response;
    });
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
  public update<
    Key extends keyof QueryResults,
    Resource extends keyof DataModel & string = keyof DataModel & string
  >(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<QueryResults[Key]> {
    return this.telemetry.span(`${this.constructor.name}.update`, {
      kind: 'SERVER',
      attributes: {
        resource,
        'code.class.name': this.constructor.name,
      },
    }, async () => {
      this.checkOperationAllowed(resource, 'UPDATE');
      const updatedContext = await this.applyPermissions(resource, 'UPDATE', id, payload, context);

      if (Object.keys(payload).length === 0) {
        return await this.baseView<QueryResults[Key]>(resource, id, context);
      }

      const fullPayload = deepCopy(payload);
      const metaData = this.model.get(resource);

      if (metaData.schema.enableTimestamps) {
        (fullPayload as Timestamps)._updatedAt = new Date();
      }

      if (metaData.schema.enableAuthors && context.session !== undefined) {
        (fullPayload as Authors)._updatedBy = context.session.user._id;
      }

      await this.databaseClient.checkRelations(
        resource,
        this.extractRelationsFromPayload(resource, payload, {
          type: 'object',
          description: '',
          isRequired: true,
          fields: this.model.get(resource).schema.fields,
        }, payload),
        updatedContext.queryOptions,
      );

      const customUpdate = this.registeredModules[resource]?.update?.bind(this);
      const response = await (customUpdate?.(id, fullPayload, updatedContext, (...args) => (
        this.baseUpdate<QueryResults[Key], Resource>(resource, ...args)
      )) ?? this.baseUpdate<QueryResults[Key], Resource>(
        resource,
        id,
        fullPayload,
        updatedContext,
      ));

      return response;
    });
  }

  /**
   * Fetches resource with id `id`.
   *
   * @param resource Type of resource to fetch.
   *
   * @param id Resource id.
   *
   * @param context Command context. If no session is provided, no RBAC nor options checks will be
   * performed. Useful when calling `view` from other methods like `create` or `update`, to avoid
   * duplicated checks.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public view<
    Key extends keyof QueryResults,
    Resource extends keyof DataModel & string = keyof DataModel & string
  >(
    resource: Resource,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<QueryResults[Key]> {
    return this.telemetry.span(`${this.constructor.name}.view`, {
      kind: 'SERVER',
      attributes: {
        resource,
        'code.class.name': this.constructor.name,
      },
    }, async () => {
      this.checkOperationAllowed(resource, 'VIEW');
      const customView = this.registeredModules[resource]?.view?.bind(this);
      const response = await (customView<QueryResults[Key]>?.(id, context, (...args) => (
        this.baseView<QueryResults[Key]>(resource, ...args)
      )) ?? this.baseView<QueryResults[Key]>(resource, id, context));

      return response;
    });
  }

  /**
   * Fetches a paginated list of resources matching `searchBody` constraints.
   *
   * @param resource Type of resources to fetch.
   *
   * @param searchBody Search body (filters, text query) to filter resources with.
   *
   * @param context Command context. If no session is provided, no RBAC checks will be performed.
   *
   * @returns Paginated list of resources.
   */
  public list<
    Key extends keyof QueryResults,
    Resource extends keyof DataModel & string = keyof DataModel & string
  >(
    resource: Resource,
    searchBody: SearchBody | null,
    context: CommandContext<DataModel>,
  ): Promise<Results<QueryResults[Key]>> {
    return this.telemetry.span(`${this.constructor.name}.list`, {
      kind: 'SERVER',
      attributes: {
        resource,
        'code.class.name': this.constructor.name,
      },
    }, async () => {
      this.checkOperationAllowed(resource, 'LIST');
      const customList = this.registeredModules[resource]?.list?.bind(this);
      const response = await (customList<QueryResults[Key]>?.(searchBody, context, (...args) => (
        this.baseList<QueryResults[Key]>(resource, ...args)
      )) ?? this.baseList<QueryResults[Key]>(resource, searchBody, context));

      return response;
    });
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
  public delete<Resource extends keyof DataModel & string = keyof DataModel & string>(
    resource: Resource,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<void> {
    return this.telemetry.span(`${this.constructor.name}.delete`, {
      kind: 'SERVER',
      attributes: {
        resource,
        'code.class.name': this.constructor.name,
      },
    }, async () => {
      this.checkOperationAllowed(resource, 'DELETE');
      const customDelete = this.registeredModules[resource]?.delete?.bind(this);
      await (customDelete?.(id, context, (...args) => (
        this.baseDelete(resource, ...args)
      )) ?? this.baseDelete(resource, id, context));
    });
  }
}
