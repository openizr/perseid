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
  toSnakeCase,
  type Results,
  type Authors,
  type IdSchema,
  type Deletion,
  type Timestamps,
  type FieldSchema,
  type ObjectSchema,
  type DefaultDataModel,
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
  /** Data model types definitions. */
  DataModel extends DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
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
   * Makes sure that user has all necessary permissions to perform `operation`.
   *
   * @param operation Name of the operation to perform.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param payload Operation payload, if applicable, `null` otherwise.
   *
   * @param context Request context.
   *
   * @throws If user email address is not yet verified.
   *
   * @throws If user is missing any of the required permissions.
   *
   * @throws If user account is not verified yet.
   */
  protected async rbac<Resource extends keyof DataModel & string>(
    requiredPermissions: Set<string>,
    existingResource: DataModel[Resource] | null,
    payload: unknown,
    context: CommandContext<DataModel>,
  ): Promise<void> {
    const user = context.user as unknown as DataModel['users'];
    const { _verifiedAt, _permissions } = user;
    const isMe = String((existingResource as DataModel['users'] | null)?._id) === String(user._id);

    // Users can always update their own information.
    if (isMe) {
      requiredPermissions.delete('UPDATE_USERS');
    }

    // Unverified users cannot perform any operation.
    if (_verifiedAt === null && requiredPermissions.size > 0) {
      throw new EngineError('USER_NOT_VERIFIED');
    }

    if (
      requiredPermissions.has('UPDATE_USERS')
      && !_permissions.has('UPDATE_USERS_ROLES')
      && (payload as DataModel['users'] | null)?.roles !== undefined
    ) {
      await Promise.resolve(this);
      throw new EngineError('FORBIDDEN', { permission: 'UPDATE_USERS_ROLES' });
    }

    requiredPermissions.forEach((permission) => {
      if (!_permissions.has(permission)) {
        throw new EngineError('FORBIDDEN', {
          // `_PRIVATE` is a special permission that actually doesn't exist, but
          // prevents anyone from accessing the `password` users field.
          permission: (permission === '_PRIVATE')
            ? null
            : permission,
        });
      }
    });
  }

  /**
   * Parses `fields`, making sure they are all valid paths in `resource` data model, transforming
   * `*` specific statements into the proper list of sub-fields, and checking user permissions for
   * specific fields.
   *
   * @param resource Type of resource for which to parse fields.
   *
   * @param fields List of fields to fetch from database.
   *
   * @param context Command context.
   *
   * @param maximumDepth Maximum allowed level of resources depth. Defaults to `3`.
   *
   * @returns List of parsed fields.
   *
   * @throws If field path does not exist in data model.
   *
   * @throws If maximum level of resources depth is exceeded.
   *
   * @throws If user does not have sufficient permissions to access to any of the fields.
   */
  protected parseFields<Resource extends keyof DataModel & string>(
    resource: Resource,
    fields: Set<string>,
    maximumDepth = 3,
  ): {
    fields: Set<string>;
    permissions: Set<string>;
  } {
    const finalFields = new Set<string>();
    const requiredPermissions = new Set<string>();
    const allFields = [...fields].concat(['_id']);
    const metaData = this.model.get(resource);

    while (allFields.length > 0) {
      let currentDepth = 1;
      const path = String(allFields.shift());
      let currentResource: keyof DataModel = resource;

      if (path === '*') {
        Object.keys(metaData.schema.fields).forEach((subField) => {
          allFields.push(subField);
        });
      } else {
        let canonicalPath: string[] = [];
        const currentPath: string[] = [];
        const splittedPath = path.split('.');
        let currentSchema = metaData.schema as FieldSchema<DataModel> | undefined;

        while (splittedPath.length > 0 && currentSchema !== undefined) {
          const fieldName = String(splittedPath.shift());
          currentPath.push(fieldName);
          canonicalPath.push(fieldName);
          const subFields = (currentSchema as { fields?: ObjectSchema<DataModel>['fields']; }).fields;
          currentSchema = subFields?.[fieldName] as unknown as FieldSchema<DataModel>;

          if (fieldName === 'roles') {
            requiredPermissions.add('VIEW_USERS_ROLES');
          }

          if (fieldName === '_devices' || fieldName === '_apiKeys' || fieldName === '_verifiedAt') {
            requiredPermissions.add('VIEW_USERS_AUTH_DETAILS');
          }

          if (currentSchema.type === 'array') {
            currentSchema = currentSchema.fields;
          }

          const { type } = currentSchema;
          const { relation } = currentSchema as IdSchema<DataModel>;

          if (type === 'object') {
            const { fields: objectFields } = currentSchema as unknown as ObjectSchema<DataModel>;
            if (splittedPath.length === 0 || (splittedPath.length === 1 && splittedPath[0] === '*')) {
              Object.keys(objectFields).forEach((subField) => {
                allFields.push(currentPath.concat(subField).join('.'));
              });
              break;
            }
          } else if (type === 'id' && relation !== undefined && splittedPath.length > 0) {
            currentDepth += 1;
            canonicalPath = [];
            currentResource = relation;
            const relationMetaData = this.model.get(relation);
            requiredPermissions.add(`VIEW_${toSnakeCase(currentResource as string)}`);
            const { schema } = relationMetaData;
            currentSchema = { type: 'object', fields: schema.fields };
            if ((splittedPath.length === 1 && splittedPath[0] === '*')) {
              Object.keys(schema.fields).forEach((subField) => {
                allFields.push(currentPath.concat(subField).join('.'));
              });
              break;
            }
          } else {
            const [subPath] = canonicalPath;
            if (currentResource === 'users' && subPath === 'password') {
              requiredPermissions.add('_PRIVATE');
            }
            finalFields.add(path);
          }
        }

        if (currentSchema === undefined) {
          throw new EngineError('UNKNOWN_FIELD', { path });
        } else if (currentDepth > maximumDepth) {
          throw new EngineError('MAXIMUM_DEPTH_EXCEEDED', { path });
        }
      }
    }

    return {
      fields: finalFields,
      permissions: requiredPermissions,
    };
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
   * @param context Command context.
   *
   * @returns Filters to apply to check foreign IDs, or `null` if they should not be checked.
   */
  protected getRelationFilters<Resource extends keyof DataModel>(
    resource: Resource,
    path: string,
    ids: Id[],
    payload: UpdatePayload<DataModel[Resource]> | DataModel[Resource],
    context: CommandContext<DataModel>,
  ): SearchFilters | null {
    this.noop(resource, path, ids, payload, context);
    return { _id: ids };
  }

  /**
   * Performs business checks against `payload`, and prepares it for database insertion/update.
   *
   * @param resource Type of resource for which to validate payload.
   *
   * @param operation Operation to perform.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   */
  protected async validate<Resource extends keyof DataModel & string>(
    resource: Resource,
    operation: 'UPDATE',
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>>;

  protected async validate<Resource extends keyof DataModel & string>(
    resource: Resource,
    operation: 'CREATE',
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Ids & DataModel[Resource]>;

  protected async validate<Resource extends keyof DataModel & string>(
    resource: Resource,
    operation: 'CREATE' | 'UPDATE',
    payload: CreatePayload<DataModel[Resource]> | UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]> | Ids & DataModel[Resource]> {
    const metaData = this.model.get(resource);
    const fullPayload = { ...payload } as Ids & Timestamps & Deletion & Authors;

    if (metaData.schema.enableAuthors && context.user !== undefined) {
      if (operation === 'CREATE') {
        fullPayload._updatedBy = null;
        fullPayload._createdBy = context.user._id;
      } else {
        fullPayload._updatedBy = context.user._id;
      }
    }

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
              context,
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
   * @param context Command context.
   *
   * @returns Newly created resource.
   */
  public async create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]> {
    const fields = options.fields ?? new Set<string>();
    const parsedFields = this.parseFields(resource, fields, options.maximumDepth);
    parsedFields.permissions.add(`CREATE_${toSnakeCase(resource)}`);
    await this.rbac(parsedFields.permissions, null, payload, context);
    const fullPayload = await this.validate(resource, 'CREATE', payload, context);
    await this.databaseClient.create(resource, fullPayload);
    return this.view(resource, fullPayload._id, { fields: parsedFields.fields }, context);
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
   * @param context Command context.
   *
   * @returns Updated resource.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public async update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    options: ViewCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]> {
    const fields = options.fields ?? new Set<string>();
    const parsedFields = this.parseFields(resource, fields, options.maximumDepth);
    parsedFields.permissions.add(`UPDATE_${toSnakeCase(resource)}`);
    await this.rbac(parsedFields.permissions, null, payload, context);
    if (Object.keys(payload).length > 0) {
      const newPayload = await this.validate(resource, 'UPDATE', payload, context);
      await this.databaseClient.update(resource, id, newPayload);
    }

    return this.view(resource, id, { fields: parsedFields.fields }, context);
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
   * @param context Command context.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public async view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]> {
    const fields = options.fields ?? new Set<string>();
    const parsedFields = this.parseFields(resource, fields, options.maximumDepth);
    parsedFields.permissions.add(`VIEW_${toSnakeCase(resource)}`);
    await this.rbac(parsedFields.permissions, null, null, context);
    const result = await this.databaseClient.view(resource, id, {
      fields: parsedFields.fields,
      maximumDepth: options.maximumDepth,
    });

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
   * @param context Command context.
   *
   * @returns Paginated list of resources.
   */
  public async list<Resource extends keyof DataModel & string>(
    resource: Resource,
    searchBody: SearchBody,
    options: SearchCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<Results<DataModel[Resource]>> {
    const queryFields = [...searchBody.query?.on ?? []];
    const sortFields = Object.keys(options.sortBy ?? {});
    const filterFields = Object.keys(searchBody.filters ?? {});
    const searchFields = queryFields.concat(filterFields).concat(sortFields);
    const fields = new Set([...options.fields ?? []].concat(searchFields));
    const parsedFields = this.parseFields(resource, fields, options.maximumDepth);
    parsedFields.permissions.add(`LIST_${toSnakeCase(resource)}`);
    await this.rbac(parsedFields.permissions, null, null, context);
    return this.databaseClient.search(resource, searchBody, {
      ...options,
      fields: parsedFields.fields,
      maximumDepth: options.maximumDepth,
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
   * @param context Command context.
   *
   * @throws If resource does not exist or has been deleted.
   */
  public async delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    context: CommandContext<DataModel>,
  ): Promise<void> {
    let resourceExists = false;
    await this.rbac(new Set([`DELETE_${toSnakeCase(resource)}`]), null, null, context);
    const metaData = this.model.get(resource);

    if (metaData.schema.enableDeletion) {
      resourceExists = await this.databaseClient.delete(resource, id);
    } else {
      const payload = { _isDeleted: true } as UpdatePayload<DataModel[Resource]>;
      const fullPayload = await this.validate(resource, 'UPDATE', payload, context);
      resourceExists = await this.databaseClient.update(resource, id, fullPayload);
    }

    if (!resourceExists) {
      throw new EngineError('NO_RESOURCE', { id });
    }
  }
}
