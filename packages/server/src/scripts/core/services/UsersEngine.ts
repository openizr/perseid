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
  type UsersDataModel,
} from '@perseid/core';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import Engine from 'scripts/core/services/Engine';
import EngineError from 'scripts/core/errors/Engine';
import DefaultModel from 'scripts/core/services/Model';
import Telemetry from 'scripts/core/services/Telemetry';
import type BaseCacheClient from 'scripts/core/services/CacheClient';
import type BaseEmailClient from 'scripts/core/services/EmailClient';
import type DefaultDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';

/**
 * Generated credentials.
 */
export interface Credentials {
  /**
   * Id of the device for which these credentials are valid.
   */
  deviceId: string;

  /**
   * Access token expiration period, in seconds.
   */
  expiresIn: number;

  /**
   * Access token.
   */
  accessToken: string;

  /**
   * Refresh token, used to generate a new access token.
   */
  refreshToken: string;

  /**
   * Refresh token expiration date.
   */
  refreshTokenExpiration: Date;
}

/**
 * Users engine settings.
 */
export interface UsersEngineSettings {
  /**
   * Application base URL.
   */
  baseUrl: string;

  /**
   * Auth configuration.
   */
  auth: {
    /**
     * Access tokens issuer name (usually the companie's name).
     */
    issuer: string;

    /**
     * Algorithm to use for access tokens generation.
     */
    algorithm: 'RS256';

    /**
     * Client id to store in access tokens (usually the application's name).
     */
    clientId: string;

    /**
     * Private key to use for access tokens generation.
     */
    privateKey: string;

    /**
     * Public key to use for access tokens generation.
     */
    publicKey: string;
  };
}

/**
 * Perseid engine extended with users-related methods.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/UsersEngine.ts
 */
export default class UsersEngine<
  /**
   * Data model type definition.
   */
  DataModel extends UsersDataModel = UsersDataModel,

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

  /**
   * Email client type definition.
   */
  EmailClient extends BaseEmailClient = BaseEmailClient,

  /**
   * Cache client type definition.
   */
  CacheClient extends BaseCacheClient = BaseCacheClient,
> extends Engine<DataModel, QueryResults, Model, DatabaseClient> {
  /**
   * Default duration before an access token expires.
   */
  protected readonly ACCESS_TOKEN_DURATION: number;

  /**
   * Default duration before a refresh token expires.
   */
  protected readonly REFRESH_TOKEN_DURATION: number;

  /**
   * Email client to use.
   */
  protected emailClient: EmailClient;

  /**
   * Cache client to use.
   */
  protected cacheClient: CacheClient;

  /**
   * Auth engine settings.
   */
  protected settings: UsersEngineSettings;

  /**
   * Generates new credentials (refresh/access tokens) for `userId` and `deviceId`.
   *
   * @param userId Id of the user to generate credentials for.
   *
   * @param deviceId Id of the device to generate credentials for.
   * If not set, a new id will be created.
   *
   * @returns Generated credentials.
   */
  protected generateCredentials(
    userId: Id,
    deviceId = randomBytes(12).toString('hex'),
  ): Credentials {
    const expiresIn = 20 * 60; // 20 minutes.
    const refreshTokenExpiration = new Date(Date.now() + this.REFRESH_TOKEN_DURATION);
    return {
      deviceId,
      expiresIn,
      refreshTokenExpiration,
      refreshToken: randomBytes(12).toString('hex'),
      accessToken: jwt.sign({}, this.settings.auth.privateKey, {
        algorithm: 'RS256',
        expiresIn,
        subject: `${String(userId)}_${deviceId}`,
        issuer: this.settings.auth.issuer,
        audience: this.settings.auth.clientId,
      }),
    };
  }

  /**
   * Verifies that user has the right permissions to perform `operation` on `resource`, using given
   * payload and options. This method should return any additional information that is relevant
   * to perform the operation in granted scope, such as filtered options, updated payload,
   * sub-resources for narrowing down the scope, etc.
   *
   * @param resource Type of resource for which to check permissions.
   *
   * @param operation Type of operation to perform.
   *
   * @param payload Operation payload.
   *
   * @param options Command options.
   *
   * @param context Command context. If not provided, RBAC checks will not be performed.
   *
   * @returns Additional information that is relevant to perform the operation in granted scope.
   *
   * @throws If field path does not exist in data model.
   *
   * @throws If maximum level of resources depth is exceeded.
   *
   * @throws If user does not have sufficient permissions to perform the operation.
   */
  protected async checkUserPermissions<Resource extends keyof DataModel>(
    resource: Resource,
    _operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LIST',
    _payload: UpdatePayload<DataModel[Resource]> | CreatePayload<DataModel[Resource]> | SearchBody,
    options: CommandOptions,
    context?: CommandContext<DataModel>,
  ): Promise<{ fields: string[]; }> {
    const allFields = [...options.fields ?? []].concat(['_id']);

    // If no context is provided, we don't even make sure that all fields exist, as the database
    // client will take care of that.
    if (context === undefined) {
      return Promise.resolve({ fields: allFields });
    }

    const filteredFields = new Set<string>();
    const metaData = this.model.get(resource);
    const permissions = context.user._permissions;
    const requestedFields = new Set(allFields);

    while (allFields.length > 0) {
      const path = String(allFields.shift());
      const isWildcard = path.at(-1) === '*';
      const pathWithoutWildcard = isWildcard ? path.slice(0, -2) : path;
      const getFullPath = (field: string): string => `${pathWithoutWildcard}.${field}`;

      if (path === '*') {
        allFields.push(...Object.keys(metaData.schema.fields));
      } else {
        const fieldMetaData = this.model.get(`${String(resource)}.${pathWithoutWildcard}`);

        if (fieldMetaData === null) {
          throw new EngineError('UNKNOWN_FIELD', { path });
        }

        if (fieldMetaData.depth > (options.maximumDepth ?? 3)) {
          throw new EngineError('MAXIMUM_DEPTH_EXCEEDED', { path });
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
          const missingPermission = fieldMetaData.permissions.find((p) => !permissions.has(p));
          if (missingPermission === undefined) {
            filteredFields.add(path);
          } else if (requestedFields.has(path)) {
            throw new EngineError('MISSING_PERMISSION', { permission: missingPermission });
          }
        }
      }
    }

    return Promise.resolve({ fields: [...filteredFields] });
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
    const fullPayload = await super.prepareCreatePayload(resource, payload, context);
    const userPayload = this.defineCreatePayload<UsersDataModel['users']>(fullPayload);

    if (metaData.schema.enableAuthors) {
      userPayload._updatedBy = null;
      userPayload._createdBy = context.user._id;
    }

    if (resource === 'users') {
      userPayload._devices = [];
      userPayload._verifiedAt = new Date();
      userPayload.password = await bcrypt.hash(userPayload.password, 10);
    }

    return fullPayload;
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
    const fullPayload = await super.prepareUpdatePayload(resource, payload, context);

    if (metaData.schema.enableAuthors) {
      const authorsPayload = this.defineUpdatePayload<UsersDataModel['users']>(fullPayload);
      authorsPayload._updatedBy = context.user._id;
    }

    if (resource === 'users') {
      const userPayload = this.defineUpdatePayload<UsersDataModel['users']>(fullPayload);

      if (userPayload.email !== undefined) {
        userPayload._verifiedAt = null;
      }

      // Whenever users change their password, we automatically sign them out of all their
      // devices, as a security measure. Successfully resetting users password also means verifying
      // their email at the same time.
      if (userPayload.password !== undefined) {
        userPayload._devices = [];
        userPayload._verifiedAt = context.user._verifiedAt ?? new Date();
        userPayload.password = await bcrypt.hash(userPayload.password, 10);
      }
    }

    return fullPayload;
  }

  /**
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param logger Logging system to use.
   *
   * @param databaseClient Database client to use.
   *
   * @param emailClient Email client to use.
   *
   * @param cacheClient Cache client to use.
   *
   * @param settings Engine settings.
   */
  constructor(
    model: Model,
    logger: Telemetry,
    databaseClient: DatabaseClient,
    emailClient: EmailClient,
    cacheClient: CacheClient,
    settings: UsersEngineSettings,
  ) {
    super(model, logger, databaseClient);
    this.settings = settings;
    this.emailClient = emailClient;
    this.cacheClient = cacheClient;
    this.ACCESS_TOKEN_DURATION = 20 * 60; // 20 minutes.
    this.REFRESH_TOKEN_DURATION = 30 * 24 * 3600 * 1000; // 30 days.
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
  public async create<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptions<Key>,
    context: CommandContext<DataModel>,
  ): Promise<QueryResults[Key]>;

  public async create<Resource extends keyof DataModel>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptionsWithoutKey,
    context: CommandContext<DataModel>,
  ): Promise<Ids>;

  public async create<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    options: ViewCommandOptionsWithoutKey | ViewCommandOptions<Key>,
    context: CommandContext<DataModel>,
  ): Promise<QueryResults[Key] | Ids> {
    const { fields } = await this.checkUserPermissions(resource, 'CREATE', payload, options, context);
    const result = await super.create(resource, payload, { ...options, fields }, context);

    if (resource === 'users') {
      const { email, password } = this.defineCreatePayload<UsersDataModel['users']>(payload);
      await this.emailClient.sendInviteEmail(email, `${this.settings.baseUrl}/sign-in`, password);
    }

    return result;
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
   * @throws If resource does not exist or does not match criteria.
   */
  public async update<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    options: ViewCommandOptions<Key>,
    context: CommandContext<DataModel>,
  ): Promise<QueryResults[Key]>;

  public async update<Resource extends keyof DataModel>(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    options: ViewCommandOptionsWithoutKey,
    context: CommandContext<DataModel>,
  ): Promise<Ids>;

  public async update<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    id: Id,
    payload: UpdatePayload<DataModel[Resource]>,
    options: ViewCommandOptionsWithoutKey | ViewCommandOptions<Key>,
    context: CommandContext<DataModel>,
  ): Promise<QueryResults[Key] | Ids> {
    const { fields } = await this.checkUserPermissions(resource, 'UPDATE', payload, options, context);
    return super.update(resource, id, payload, { ...options, fields }, context);
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
   * @param context Command context. If not provided, no RBAC nor options checks will be performed.
   * This can be especially useful when calling `view` methods from other methods like `create` or
   * `update`, to improve performance by avoiding duplicated checks.
   *
   * @returns Resource, if it exists.
   *
   * @throws If resource does not exist or does not match criteria.
   */
  public async view<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptions<Key>,
    context?: CommandContext<DataModel>,
  ): Promise<QueryResults[Key]>;

  public async view<Resource extends keyof DataModel>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptionsWithoutKey,
    context?: CommandContext<DataModel>,
  ): Promise<Ids>;

  public async view<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    id: Id,
    options: ViewCommandOptionsWithoutKey | ViewCommandOptions<Key>,
    context?: CommandContext<DataModel>,
  ): Promise<QueryResults[Key] | Ids> {
    const { fields } = await this.checkUserPermissions(resource, 'VIEW', {}, options, context);
    return super.view(resource, id, { ...options, fields });
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
  public async list<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    searchBody: SearchBody,
    options: ListCommandOptions<Key>,
    context: CommandContext<DataModel>,
  ): Promise<Results<QueryResults[Key]>>;

  public async list<Resource extends keyof DataModel>(
    resource: Resource,
    searchBody: SearchBody,
    options: ListCommandOptionsWithoutKey,
    context: CommandContext<DataModel>,
  ): Promise<Results<Ids>>;

  public async list<Resource extends keyof DataModel, Key extends keyof QueryResults>(
    resource: Resource,
    searchBody: SearchBody,
    options: ListCommandOptionsWithoutKey | ListCommandOptions<Key>,
    context: CommandContext<DataModel>,
  ): Promise<Results<QueryResults[Key] | Ids>> {
    const { fields } = await this.checkUserPermissions(resource, 'LIST', searchBody, options, context);
    return super.list(resource, searchBody, { ...options, fields });
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
    context?: CommandContext<DataModel>,
  ): Promise<void> {
    await this.checkUserPermissions(resource, 'DELETE', {}, {}, context);
    return super.delete(resource, id);
  }

  /**
   * Fetches information about current user.
   *
   * @param context Command context.
   *
   * @returns User information.
   */
  public async viewMe(context: CommandContext<DataModel>): Promise<DataModel['users']> {
    const user = await this.databaseClient.view('users', context.user._id, {
      maximumDepth: 2,
      fields: [
        '_id',
        'email',
        '_createdAt',
        '_updatedAt',
        'roles.name',
        '_verifiedAt',
        'roles.permissions',
      ],
    });
    return this.defineCreatePayload<DataModel['users']>(user);
  }

  /**
   * Verifies `accessToken` validity.
   *
   * @param accessToken Access token to verify.
   *
   * @param ignoreExpiration Whether to ignore access token expiration.
   *
   * @param context Command context.
   *
   * @returns Id of the user related to the access token.
   *
   * @throws If device id is not valid.
   */
  public async verifyToken(
    accessToken: string,
    ignoreExpiration: boolean,
    context: CommandContext<DataModel>,
  ): Promise<Id> {
    let userId = '';

    const tokenInfo = jwt.verify(accessToken, this.settings.auth.publicKey, {
      ignoreExpiration,
      issuer: this.settings.auth.issuer,
      audience: this.settings.auth.clientId,
      algorithms: [this.settings.auth.algorithm],
    });
    const subject = String(tokenInfo.sub).split('_');
    [userId] = subject;

    // Making sure that device ids from token and header match...
    if (subject[1] !== context.deviceId) {
      throw new EngineError('INVALID_DEVICE_ID');
    }

    return Promise.resolve(new Id(userId));
  }

  /**
   * Signs a new user up in the system.
   *
   * @param email User email.
   *
   * @param password User password.
   *
   * @param passwordConfirmation User password confirmation.
   *
   * @param context Command context.
   *
   * @returns New credentials.
   *
   * @throws If password and confirmation mismatch.
   */
  public async signUp(
    email: DataModel['users']['email'],
    password: DataModel['users']['password'],
    passwordConfirmation: DataModel['users']['password'],
    context: CommandContext<DataModel>,
  ): Promise<Credentials> {
    if (passwordConfirmation !== password) {
      throw new EngineError('PASSWORDS_MISMATCH');
    }

    // Preparing payload...
    const payload: CreatePayload<UsersDataModel['users']> = { email, password, roles: [] };
    const fullPayload = await this.prepareCreatePayload('users', payload, context);
    const credentials = this.generateCredentials(fullPayload._id);
    fullPayload._createdBy = fullPayload._id;
    fullPayload._devices.push({
      _id: credentials.deviceId,
      _refreshToken: credentials.refreshToken,
      _userAgent: context.userAgent ?? 'UNKNOWN',
      _expiration: credentials.refreshTokenExpiration,
    });

    // Creating user...
    await this.databaseClient.create('users', fullPayload);

    // Sending verification email...
    const newVerificationToken = randomBytes(12).toString('hex');
    const cacheKey = `verify_${String(fullPayload._id)}`;
    const verificationUrl = `${this.settings.baseUrl}/verify-email?verificationToken=${newVerificationToken}`;
    await this.cacheClient.set(cacheKey, newVerificationToken, 3600 * 2); // In 2 hours.
    await this.emailClient.sendVerificationEmail(email, verificationUrl);

    return credentials;
  }

  /**
   * Signs an existing user in.
   *
   * @param email User email.
   *
   * @param password User password.
   *
   * @param context Command context.
   *
   * @returns New credentials.
   *
   * @throws If user with email `email` does not exist.
   *
   * @throws If `password` does not match user password.
   */
  public async signIn(
    email: string,
    password: string,
    context: Omit<CommandContext<DataModel>, 'user'>,
  ): Promise<Credentials> {
    const user = this.defineCreatePayload<UsersDataModel['users']>({});
    const searchBody = { filters: { email }, query: null };
    const { results, total } = await this.databaseClient.list('users', searchBody, {
      limit: 1,
      fields: [
        'password',
        '_devices._id',
        '_devices._userAgent',
        '_devices._expiration',
        '_devices._refreshToken',
      ],
    });

    if (total === 0) {
      throw new EngineError('NO_USER');
    }

    Object.assign(user, { ...results[0] });
    if (!await bcrypt.compare(password, user.password)) {
      throw new EngineError('INVALID_CREDENTIALS');
    }

    const now = Date.now();
    const fullContext = { ...context, user };
    const deviceId = /^[0-9a-fA-F]{24}$/.test(String(context.deviceId)) ? context.deviceId : undefined;
    const credentials = this.generateCredentials(user._id, deviceId);
    const fullPayload = await this.prepareUpdatePayload('users', {}, fullContext);
    const newDevices = [{
      _id: credentials.deviceId,
      _refreshToken: credentials.refreshToken,
      _userAgent: context.userAgent ?? 'UNKNOWN',
      _expiration: credentials.refreshTokenExpiration,
    }];

    user._devices.forEach((device, index) => {
      const expiration = device._expiration.getTime();
      if (device._id !== context.deviceId && expiration > now) {
        newDevices.push(user._devices[index]);
      }
    });

    this.defineCreatePayload<UsersDataModel['users']>(fullPayload)._devices = newDevices;
    await this.databaseClient.update('users', user._id, fullPayload);

    return credentials;
  }

  /**
   * Sends a new verification email to connected user.
   *
   * @param context Command context.
   *
   * @throws If user email is already verified.
   */
  public async requestEmailVerification(context: CommandContext<DataModel>): Promise<void> {
    if (context.user._verifiedAt !== null) {
      throw new EngineError('EMAIL_ALREADY_VERIFIED');
    }

    // Sending verify email...
    const key = `verify_${String(context.user._id)}`;
    const newVerificationToken = randomBytes(12).toString('hex');
    const verificationUrl = `${this.settings.baseUrl}/verify-email?verificationToken=${newVerificationToken}`;
    await this.cacheClient.set(key, newVerificationToken, 3600 * 2); // In 2 hours.
    await this.emailClient.sendVerificationEmail(context.user.email, verificationUrl);
  }

  /**
   * Verifies email of the connected user.
   *
   * @param token Verification token that was sent in the verification email.
   *
   * @param context Command context.
   *
   * @throws If verification token is not valid.
   */
  public async verifyEmail(
    verificationToken: string,
    context: CommandContext<DataModel>,
  ): Promise<void> {
    const { user } = context;
    const cacheKey = `verify_${String(user._id)}`;
    const storedVerificationToken = await this.cacheClient.get(cacheKey);

    if (storedVerificationToken !== verificationToken) {
      throw new EngineError('INVALID_VERIFICATION_TOKEN');
    }

    // Updating user credentials...
    const fullPayload = await this.prepareUpdatePayload('users', {}, context);
    this.defineUpdatePayload<UsersDataModel['users']>(fullPayload)._verifiedAt = new Date();
    await this.databaseClient.update('users', user._id, fullPayload);
    await this.cacheClient.delete(cacheKey);
  }

  /**
   * Sends a new password reset email to user with email `email`.
   *
   * @param email Email of the user to whom to send password reset email.
   */
  public async requestPasswordReset(email: string): Promise<void> {
    const searchBody = { filters: { email }, query: null };
    const { total } = await this.databaseClient.list('users', searchBody, { limit: 1 });
    if (total > 0) {
      const newResetToken = randomBytes(12).toString('hex');
      const resetUrl = `${this.settings.baseUrl}/reset-password?resetToken=${newResetToken}`;
      await this.cacheClient.set(`reset_${newResetToken}`, email, 3600 * 2); // In 2 hours.
      await this.emailClient.sendPasswordResetEmail(email, resetUrl);
    } else {
      // Delaying API response prevents giving any hint about whether user actually exists.
      this.telemetry.info(`User with email "${email}" does not exist, skipping email sending...`);
      await new Promise((resolve) => { setTimeout(resolve, 100); });
    }
  }

  /**
   * Resets password for user with email `email`.
   *
   * @param password New password.
   *
   * @param passwordConfirmation New password confirmation.
   *
   * @param resetToken Reset token sent in the password reset email.
   *
   * @throws If password and confirmation mismatch.
   *
   * @throws If reset token is not valid.
   */
  public async resetPassword(
    password: DataModel['users']['password'],
    passwordConfirmation: DataModel['users']['password'],
    resetToken: string,
  ): Promise<void> {
    const payload = {};
    const context = {} as CommandContext<DataModel>;

    if (passwordConfirmation !== password) {
      throw new EngineError('PASSWORDS_MISMATCH');
    }

    const cacheKey = `reset_${resetToken}`;
    const email = await this.cacheClient.get(cacheKey);
    const searchBody = { filters: { email }, query: null };
    const response = await this.databaseClient.list('users', searchBody, {
      limit: 1,
      fields: ['_verifiedAt'],
    });

    if (response.total === 0) {
      throw new EngineError('INVALID_RESET_TOKEN');
    }

    const [user] = response.results;
    Object.assign(context, { user });
    Object.assign(payload, { password });
    const fullPayload = await this.prepareUpdatePayload('users', payload, context);
    await this.databaseClient.update('users', user._id, fullPayload);
    await this.cacheClient.delete(cacheKey);
  }

  /**
   * Refreshes access token for connected user.
   *
   * @param refreshToken Refresh token to use to refresh access token.
   *
   * @param context Command context.
   *
   * @returns New credentials.
   *
   * @throws If refresh token is invalid.
   */
  public async refreshToken(
    refreshToken: string,
    context: CommandContext<DataModel>,
  ): Promise<Credentials> {
    const deviceIndex = 0;
    const now = Date.now();
    const newDevices: UsersDataModel['users']['_devices'] = [];
    const credentials = this.generateCredentials(context.user._id, context.deviceId);

    context.user._devices.forEach((device, index) => {
      const expiration = device._expiration.getTime();
      if (device._id !== context.deviceId && expiration > now) {
        newDevices.push(context.user._devices[index]);
      } else if (device._id === context.deviceId) {
        if (context.user._devices[index]?._refreshToken !== refreshToken || expiration <= now) {
          throw new EngineError('INVALID_REFRESH_TOKEN');
        }
        newDevices.push({
          _id: context.user._devices[deviceIndex]._id,
          _refreshToken: credentials.refreshToken,
          _expiration: credentials.refreshTokenExpiration,
          _userAgent: context.userAgent ?? context.user._devices[deviceIndex]._userAgent,
        });
      }
    });

    const fullPayload = await this.prepareUpdatePayload('users', {}, context);
    this.defineUpdatePayload<UsersDataModel['users']>(fullPayload)._devices = newDevices;
    await this.databaseClient.update('users', context.user._id, fullPayload);
    return credentials;
  }

  /**
   * Signs connected user out.
   *
   * @param context Command context.
   */
  public async signOut(context: CommandContext<DataModel>): Promise<void> {
    const now = Date.now();
    const newDevices: UsersDataModel['users']['_devices'] = [];

    context.user._devices.forEach((device, index) => {
      const expiration = device._expiration.getTime();
      if (device._id !== context.deviceId && expiration > now) {
        newDevices.push(context.user._devices[index]);
      }
    });

    const fullPayload = await this.prepareUpdatePayload('users', {}, context);
    this.defineUpdatePayload<UsersDataModel['users']>(fullPayload)._devices = newDevices;
    await this.databaseClient.update('users', context.user._id, fullPayload);
  }
}
