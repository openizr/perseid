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
  type Version,
  type IdSchema,
  type Deletion,
  type Timestamps,
  type FieldSchema,
  type ObjectSchema,
  type ResourceSchema,
  type DefaultDataModel,
  type DataModelMetadata,
} from '@perseid/core';
import Logger from 'scripts/services/Logger';
import EngineError from 'scripts/errors/Engine';
import type BaseModel from 'scripts/services/Model';
import type BaseDatabaseClient from 'scripts/services/AbstractDatabaseClient';

/**
 * Perseid engine, contains all the basic CRUD methods.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/Engine.ts
 */
export default class Engine<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel,

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
    const { _verifiedAt, _permissions } = context.user;
    const isMe = String((existingResource as DataModel['users'] | null)?._id) === String(context.user._id);

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
    const metaData = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;

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
          currentSchema = subFields?.[fieldName];

          if (fieldName === 'roles') {
            requiredPermissions.add('VIEW_USERS_ROLES');
          }

          if (fieldName === '_devices' || fieldName === '_apiKeys' || fieldName === '_verifiedAt') {
            requiredPermissions.add('VIEW_USERS_AUTH_DETAILS');
          }

          if (currentSchema?.type === 'array') {
            currentSchema = currentSchema.fields;
          }

          const type = currentSchema?.type;
          const relation = (currentSchema as IdSchema<DataModel> | undefined)?.relation;

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
            const { schema } = relationMetaData as DataModelMetadata<ResourceSchema<DataModel>>;
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
   * Returns the list of fields to fetch when retrieving an existing resource for update.
   *
   * @param resource Type of resource for which to get existing fields.
   *
   * @returns Fields list.
   */
  protected getResourceFields<Resource extends keyof DataModel & string>(
    resource: Resource,
  ): Set<string> {
    this.logger.silent(resource);
    return new Set();
  }

  /**
   * Returns filters to apply when checking foreign ids referencing other relations.
   *
   * @param resource Type of resource for which to return filters.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param path Path to the relation reference in data model.
   *
   * @param ids List of foreign ids to check.
   *
   * @param payload Payload for updating or creating resource.
   *
   * @param context Command context.
   *
   * @returns Filters to apply to check foreign ids.
   */
  protected getRelationFilters<Resource extends keyof DataModel & string>(
    resource: Resource,
    existingResource: DataModel[Resource] | null,
    path: string,
    ids: Id[],
    payload: UpdatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): SearchFilters {
    this.logger.silent(resource, existingResource, path, payload, context);
    return { _id: ids };
  }

  /**
   * Returns updated `payload` with automatic fields.
   *
   * @param resource Type of resource for which to generate automatic fields.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param payload Payload to update.
   *
   * @param context Command context.
   *
   * @returns Payload with automatic fields.
   */
  protected async withAutomaticFields<Resource extends keyof DataModel & string>(
    resource: Resource,
    existingResource: DataModel[Resource] | null,
    payload: Payload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>> {
    const isCreation = (existingResource === null);
    const metaData = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    const fullPayload: Payload<Ids & Authors & Version & Deletion & Timestamps> = { ...payload };

    if (metaData.schema.enableAuthors) {
      if (isCreation) {
        fullPayload._updatedBy = null;
        // A null creator happens when a new user signs-up.
        (fullPayload as DataModel['users'])._createdBy = (context as { user?: DataModel['users']; }).user?._id ?? null;
      } else {
        fullPayload._updatedBy = (context as { user?: DataModel['users']; }).user?._id ?? null;
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

    return Promise.resolve(fullPayload as Payload<DataModel[Resource]>);
  }

  /**
   * Performs specific checks `payload` to make sure it is valid, and updates it if necessary.
   *
   * @param resource Type of resource for which to check and update payload.
   *
   * @param existingResource Existing resource being updated, if applicable, `null` otherwise.
   *
   * @param payload Payload to validate and update.
   *
   * @param context Command context.
   */
  protected async checkAndUpdatePayload<Resource extends keyof DataModel & string>(
    resource: Resource,
    existingResource: DataModel[Resource] | null,
    payload: Payload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>> {
    const metaData = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    const foreignIds = new Map<string, {
      resource: keyof DataModel & string;
      filters: SearchFilters;
    }>();

    const checkPartialPayload = (
      partialPayload: unknown,
      currentSchema: FieldSchema<DataModel>,
      currentPath: string[] = [],
    ): void => {
      const path = currentPath.join('.');
      const { type } = currentSchema;
      const { relation } = currentSchema as IdSchema<DataModel>;

      if (type === 'array' && partialPayload !== null) {
        (partialPayload as unknown[]).forEach((value) => {
          checkPartialPayload(value, currentSchema.fields, currentPath);
        });
      } else if (type === 'object' && partialPayload !== null) {
        const { fields } = currentSchema;
        Object.keys(partialPayload as Record<string, unknown>).forEach((fieldName) => {
          checkPartialPayload(
            (partialPayload as Record<string, unknown>)[fieldName],
            fields[fieldName],
            currentPath.concat([fieldName]),
          );
        });
      } else if (type === 'id' && relation !== undefined && partialPayload !== null) {
        const existingFilters = foreignIds.get(path);
        if (existingFilters !== undefined) {
          (existingFilters.filters._id as Id[]).push(partialPayload as Id);
          foreignIds.set(path, existingFilters);
        } else {
          foreignIds.set(currentPath.join('.'), {
            resource: relation as keyof DataModel & string,
            filters: this.getRelationFilters(
              resource,
              existingResource,
              currentPath.join('.'),
              [partialPayload as Id],
              payload,
              context,
            ),
          });
        }
      }
    };

    checkPartialPayload(payload, { type: 'object', isRequired: true, fields: metaData.schema.fields });

    await this.databaseClient.checkForeignIds(resource, foreignIds);
    return payload;
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
   * Resets the whole system, including database.
   */
  public async reset(...args: unknown[]): Promise<void> {
    this.logger.warn('[Engine][reset] 🕐 Resetting system in 5 seconds, it\'s still time to abort...');
    await new Promise<unknown>((resolve) => { setTimeout(() => { resolve(args.at(0)); }, 5000); });
    await this.databaseClient.reset();
  }

  /**
   * Generates full command context.
   *
   * @param userId Id of the user to populate context with.
   *
   * @param deviceId Device id to add to the context.
   *
   * @param userAgent User agent to add to the context.
   *
   * @returns Generated command context.
   *
   * @throws If user does not exist.
   */
  public async generateContext(
    userId: Id,
    deviceId?: string,
    userAgent?: string,
  ): Promise<CommandContext<DataModel>> {
    const user = await this.databaseClient.view('users', userId, {
      fields: new Set([
        'email',
        'roles',
        'roles.name',
        'roles.permissions',
        '_apiKeys',
        '_verifiedAt',
        '_devices._id',
        '_devices._userAgent',
        '_devices._expiration',
        '_devices._refreshToken',
      ]),
    });

    if (user === null) {
      throw new EngineError('NO_RESOURCE', { id: userId });
    }

    user._permissions = new Set((user.roles as DataModel['roles'][]).reduce<string[]>((permissions, role) => (
      permissions.concat(role.permissions)
    ), []));

    return { user, deviceId, userAgent };
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
    const newPayload = payload as unknown as Payload<DataModel[Resource]>;
    let fullPayload = await this.checkAndUpdatePayload(resource, null, newPayload, context);
    fullPayload = await this.withAutomaticFields(resource, null, fullPayload, context);
    await this.databaseClient.create(resource, fullPayload as DataModel[Resource]);
    return this.view(resource, (fullPayload as Ids)._id, { fields: parsedFields.fields }, context);
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
    const resourceFields = this.getResourceFields(resource);
    const currentResource = (resourceFields.size === 0)
      ? { _id: id } as DataModel[Resource]
      : await this.databaseClient.view(resource, id, { fields: resourceFields });

    if (currentResource === null) {
      throw new EngineError('NO_RESOURCE', { id });
    }

    const parsedFields = this.parseFields(resource, fields, options.maximumDepth);
    parsedFields.permissions.add(`UPDATE_${toSnakeCase(resource)}`);
    await this.rbac(parsedFields.permissions, currentResource, payload, context);
    if (Object.keys(payload).length > 0) {
      let newPayload = payload as unknown as Payload<DataModel[Resource]>;
      newPayload = await this.checkAndUpdatePayload(resource, currentResource, newPayload, context);
      newPayload = await this.withAutomaticFields(resource, currentResource, newPayload, context);
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
   * Fetches a paginated list of resources.
   *
   * @param resource Type of resources to fetch.
   *
   * @param options Command options.
   *
   * @param context Command context.
   *
   * @returns Paginated list of resources.
   */
  public async list<Resource extends keyof DataModel & string>(
    resource: Resource,
    options: ListCommandOptions,
    context: CommandContext<DataModel>,
  ): Promise<Results<DataModel[Resource]>> {
    const sortFields = Object.keys(options.sortBy ?? {});
    const fields = new Set([...options.fields ?? []].concat(sortFields));
    const parsedFields = this.parseFields(resource, fields, options.maximumDepth);
    parsedFields.permissions.add(`LIST_${toSnakeCase(resource)}`);
    await this.rbac(parsedFields.permissions, null, null, context);
    return this.databaseClient.list(resource, {
      fields: parsedFields.fields,
      maximumDepth: options.maximumDepth,
    });
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
  public async search<Resource extends keyof DataModel & string>(
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
    parsedFields.permissions.add(`SEARCH_${toSnakeCase(resource)}`);
    await this.rbac(parsedFields.permissions, null, null, context);
    return this.databaseClient.search(resource, searchBody, {
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
    const metaData = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;

    if (metaData.schema.enableDeletion) {
      resourceExists = await this.databaseClient.delete(resource, id);
    } else {
      const payload = await this.withAutomaticFields(
        resource,
        { _id: id } as DataModel[Resource],
        { _isDeleted: true } as Payload<DataModel[Resource]>,
        context,
      );
      resourceExists = await this.databaseClient.update(resource, id, payload);
    }

    if (!resourceExists) {
      throw new EngineError('NO_RESOURCE', { id });
    }
  }
}
