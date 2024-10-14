/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  toSnakeCase,
  type DefaultDataModel,
} from '@perseid/core';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import Engine from 'scripts/core/services/Engine';
import Logger from 'scripts/core/services/Logger';
import BaseModel from 'scripts/core/services/Model';
import EngineError from 'scripts/core/errors/Engine';
import EmailClient from 'scripts/core/services/EmailClient';
import type CacheClient from 'scripts/core/services/CacheClient';
import type BaseDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';

/**
 * Generated credentials.
 */
export interface Credentials {
  /** Id of the device for which these credentials are valid. */
  deviceId: string;

  /** Access token expiration period, in seconds. */
  expiresIn: number;

  /** Access token. */
  accessToken: string;

  /** Refresh token, used to generate a new access token. */
  refreshToken: string;

  /** Refresh token expiration date. */
  refreshTokenExpiration: Date;
}

/**
 * Users engine settings.
 */
export interface UsersEngineSettings {
  /** Application base URL. */
  baseUrl: string;

  /** Auth configuration. */
  auth: {
    /** Access tokens issuer name (usually the companie's name). */
    issuer: string;

    /** Algorithm to use for access tokens generation. */
    algorithm: 'RS256';

    /** Client id to store in access tokens (usually the application's name). */
    clientId: string;

    /** Private key to use for access tokens generation. */
    privateKey: string;

    /** Public key to use for access tokens generation. */
    publicKey: string;
  };
}

/**
 * Perseid engine extended with auth-related methods.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/UsersEngine.ts
 */
export default class UsersEngine<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  DatabaseClient extends BaseDatabaseClient<DataModel> = BaseDatabaseClient<DataModel>,
> extends Engine<DataModel, Model, DatabaseClient> {
  /** Default duration before a refresh token expires. */
  protected readonly REFRESH_TOKEN_DURATION = 30 * 24 * 3600 * 1000; // 30 days.

  /** Email client to use. */
  protected emailClient: EmailClient;

  /** Cache client to use. */
  protected cacheClient: CacheClient;

  /** Auth engine settings. */
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
    const { user, credentials, userAgent } = context as Partial<CommandContext<DataModel> & {
      credentials: Credentials | null;
    }>;
    const fullPayload = await super.withAutomaticFields(
      resource,
      existingResource,
      payload,
      context,
    );

    if (resource === 'users') {
      const userPayload = fullPayload as Partial<DataModel['users']>;

      if (userPayload.email !== undefined) {
        userPayload._verifiedAt = null;
      }

      // Whenever users change their password, we automatically sign them out of all their
      // devices, as a security measure. Successfully resetting users password also means verifying
      // their email at the same time.
      if (userPayload.password !== undefined) {
        userPayload._devices = [];
        userPayload._verifiedAt = user?._verifiedAt ?? new Date();
      }

      if (existingResource === null) {
        userPayload._apiKeys = [];
        userPayload._devices = [];
        userPayload._verifiedAt = (user !== undefined) ? new Date() : null;
      }

      // When credentials are passed in context, it means that we must either revoke or update them.
      if (credentials !== undefined) {
        const _devices = user?._devices ?? [];
        const deviceId = credentials?.deviceId ?? (context as { deviceId: string; }).deviceId;
        const deviceIndex = _devices.findIndex((device) => device._id === deviceId);
        const [device] = _devices.splice(deviceIndex, deviceIndex >= 0 ? 1 : 0);
        if (credentials !== null) {
          _devices.push({
            _id: deviceId,
            _refreshToken: credentials.refreshToken,
            _expiration: credentials.refreshTokenExpiration,
            _userAgent: userAgent ?? (device as undefined | { _userAgent: string; })?._userAgent ?? 'UNKNOWN',
          });
        }
        userPayload._devices = _devices;
      }
    }

    return fullPayload;
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
    const fullPayload = await super.checkAndUpdatePayload(
      resource,
      existingResource,
      payload,
      context,
    );

    if (resource === 'users') {
      const userPayload = fullPayload as Partial<DataModel['users']>;
      if (userPayload.password !== undefined) {
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
    logger: Logger,
    databaseClient: DatabaseClient,
    emailClient: EmailClient,
    cacheClient: CacheClient,
    settings: UsersEngineSettings,
  ) {
    super(model, logger, databaseClient);
    this.settings = settings;
    this.emailClient = emailClient;
    this.cacheClient = cacheClient;
  }

  /**
   * Resets the whole system, including database, and re-creates root role and user.
   *
   * @param rootEmail Email to use for root user.
   *
   * @param rootPassword Password to use for root user.
   */
  public async reset(rootEmail: string, rootPassword: string): Promise<void> {
    await super.reset();

    this.logger.info('[UsersEngine][reset] Creating root user...');
    await this.signUp(rootEmail, rootPassword, rootPassword, {} as CommandContext<DataModel>);

    this.logger.info('[UsersEngine][reset] Creating root role...');
    const { results: [{ _id }] } = await this.databaseClient.list('users', { limit: 1 });
    const newRole = await this.create('roles', {
      name: 'ROOT',
      permissions: this.model.getResources().reduce<string[]>((permissions, resource) => (
        permissions.concat([
          `VIEW_${toSnakeCase(resource)}`,
          `LIST_${toSnakeCase(resource)}`,
          `SEARCH_${toSnakeCase(resource)}`,
          `CREATE_${toSnakeCase(resource)}`,
          `UPDATE_${toSnakeCase(resource)}`,
          `DELETE_${toSnakeCase(resource)}`,
        ])
      ), ['VIEW_USERS_ROLES', 'UPDATE_USERS_ROLES', 'VIEW_USERS_AUTH_DETAILS']),
    } as CreatePayload<DataModel['roles']>, {}, {
      user: { _id, _permissions: new Set(['CREATE_ROLES', 'VIEW_ROLES']) },
    } as CommandContext<DataModel>);

    this.logger.info('[UsersEngine][reset] Updating root user...');
    await this.databaseClient.update('users', _id, {
      roles: [newRole._id],
      _verifiedAt: new Date(),
    } as Payload<DataModel['users']>);
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
    const newResource = await super.create(resource, payload, options, context);

    if (resource === 'users') {
      // Sending invite...
      const { email, password } = payload as DataModel['users'];
      await this.emailClient.sendInviteEmail(email, `${this.settings.baseUrl}/sign-in`, password);
    }

    return newResource;
  }

  /**
   * Fetches information about current user.
   *
   * @param context Command context.
   *
   * @returns User information.
   */
  public async viewMe(context: CommandContext<DataModel>): Promise<DataModel['users']> {
    return (await this.databaseClient.view('users', context.user._id, {
      maximumDepth: 2,
      fields: new Set([
        '_id',
        'email',
        '_createdAt',
        '_updatedAt',
        'roles.name',
        '_verifiedAt',
        'roles.permissions',
      ]),
    })) as unknown as DataModel['users'];
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
    const subject = (tokenInfo as { sub: string; }).sub.split('_');
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

    const newId = new Id();
    const credentials = this.generateCredentials(newId);
    const fullContext = { ...context, credentials };
    let fullPayload = { email, password, roles: [] } as Payload<DataModel['users']>;
    fullPayload = await this.checkAndUpdatePayload('users', null, fullPayload, fullContext);
    fullPayload = await this.withAutomaticFields('users', null, fullPayload, fullContext);
    (fullPayload as DataModel['users'])._id = newId;
    await this.databaseClient.create('users', fullPayload as DataModel['users']);

    const newVerificationToken = randomBytes(12).toString('hex');
    const cacheKey = `verify_${String(newId)}`;
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
    const searchBody = { filters: { email }, query: null };
    const commandOptions = {
      limit: 1,
      fields: new Set([
        'password',
        '_devices._id',
        '_devices._userAgent',
        '_devices._expiration',
        '_devices._refreshToken',
      ]),
    };
    const { results, total } = await this.databaseClient.search('users', searchBody, commandOptions);

    if (total === 0) {
      throw new EngineError('NO_USER');
    }

    const [user] = results;
    if (!await bcrypt.compare(password, user.password)) {
      throw new EngineError('INVALID_CREDENTIALS');
    }

    const deviceId = /^[0-9a-fA-F]{24}$/.test(String(context.deviceId)) ? context.deviceId : undefined;
    const credentials = this.generateCredentials(user._id, deviceId);
    const fullContext = { ...context, user, credentials };
    const fullPayload = await this.withAutomaticFields('users', user, {}, fullContext);
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
    const payload = { _verifiedAt: new Date() } as Payload<DataModel['users']>;
    const fullPayload = await this.withAutomaticFields('users', user, payload, context);
    await this.databaseClient.update('users', user._id, fullPayload);
    await this.cacheClient.delete(cacheKey);
  }

  /**
   * Sends a new password reset email to user with email `email`.
   *
   * @param email Email of the user to whom to send password reset email.
   *
   * @param context
   */
  public async requestPasswordReset(email: string): Promise<void> {
    const searchBody = { filters: { email }, query: null };
    const { total } = await this.databaseClient.search('users', searchBody, { limit: 1 });
    if (total > 0) {
      const newResetToken = randomBytes(12).toString('hex');
      const resetUrl = `${this.settings.baseUrl}/reset-password?resetToken=${newResetToken}`;
      await this.cacheClient.set(`reset_${newResetToken}`, email, 3600 * 2); // In 2 hours.
      await this.emailClient.sendPasswordResetEmail(email, resetUrl);
    } else {
      // Delaying API response prevents giving any hint about whether user actually exists.
      this.logger.info(`User with email "${email}" does not exist, skipping email sending...`);
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
    if (passwordConfirmation !== password) {
      throw new EngineError('PASSWORDS_MISMATCH');
    }

    const cacheKey = `reset_${resetToken}`;
    const email = await this.cacheClient.get(cacheKey);
    const searchBody = { filters: { email }, query: null };
    const commandOptions = { limit: 1, fields: new Set(['_verifiedAt']) };
    const response = await this.databaseClient.search('users', searchBody, commandOptions);

    if (response.total === 0) {
      throw new EngineError('INVALID_RESET_TOKEN');
    }

    const [user] = response.results;
    const payload = { password } as Payload<DataModel['users']>;
    let fullPayload = await this.checkAndUpdatePayload('users', user, payload, { user });
    fullPayload = await this.withAutomaticFields('users', user, fullPayload, { user });
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
    const { user } = context;
    const credentials = this.generateCredentials(user._id, context.deviceId);
    const deviceIndex = user._devices.findIndex((device) => device._id === context.deviceId);

    if (
      user._devices[deviceIndex]?._refreshToken !== refreshToken
      || user._devices[deviceIndex]._expiration.getTime() <= Date.now()
    ) {
      throw new EngineError('INVALID_REFRESH_TOKEN');
    }

    const fullContext = { ...context, credentials };
    const fullPayload = await this.withAutomaticFields('users', user, {}, fullContext);
    await this.databaseClient.update('users', user._id, fullPayload);
    return credentials;
  }

  /**
   * Signs connected user out.
   *
   * @param context Command context.
   */
  public async signOut(context: CommandContext<DataModel>): Promise<void> {
    const { user } = context;
    const fullContext = { ...context, credentials: null };
    const fullPayload = await this.withAutomaticFields('users', user, {}, fullContext);
    await this.databaseClient.update('users', user._id, fullPayload);
  }
}
