/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  type User,
  type Payload,
  toSnakeCase,
  type UpdatePayload,
  type DefaultDataModel,
} from '@perseid/core';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Engine from 'scripts/services/Engine';
import Logger from 'scripts/services/Logger';
import EngineError from 'scripts/errors/Engine';
import { randomBytes, createHash } from 'crypto';
import type BaseModel from 'scripts/services/Model';
import EmailClient from 'scripts/services/EmailClient';
import type CacheClient from 'scripts/services/CacheClient';
import type BaseDatabaseClient from 'scripts/services/DatabaseClient';

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
    const fullPayload = await super.checkAndUpdatePayload(collection, payload, context);

    if (collection === 'users') {
      const userPayload = fullPayload as Partial<DataModel['users']>;
      const { credentials, user, userAgent } = context as unknown as {
        user?: User;
        userAgent?: string;
        credentials?: Credentials | null;
      };
      if (userPayload.email !== undefined) {
        userPayload._verifiedAt = null;
      }
      // Whenever users change their password, we automatically sign them out of all their
      // devices, as a security measure. Successfully resetting users password also means verifying
      // their email at the same time.
      if (userPayload.password !== undefined) {
        userPayload._devices = [];
        userPayload.password = await bcrypt.hash(userPayload.password, 10);
        userPayload._verifiedAt = user?._verifiedAt ?? new Date();
      }
      if (context.mode === 'CREATE') {
        userPayload._apiKeys = [];
        userPayload._devices = [];
        userPayload.roles = userPayload.roles ?? [];
        userPayload._verifiedAt = (user !== undefined) ? new Date() : null;
      }
      // When credentials are passed in context, it means that we must either revoke or update them.
      if (credentials !== undefined) {
        const _devices = user?._devices ?? [];
        const deviceId = credentials?.deviceId ?? (context as { deviceId: string; }).deviceId;
        const deviceIndex = _devices.findIndex((device) => device.id === deviceId);
        const [device] = _devices.splice(deviceIndex, deviceIndex >= 0 ? 1 : 0);
        if (credentials !== null) {
          _devices.push({
            id: deviceId,
            refreshToken: credentials.refreshToken,
            expiration: credentials.refreshTokenExpiration,
            userAgent: userAgent ?? (device as undefined | { userAgent: string; })?.userAgent ?? 'UNKNOWN',
          });
        }
        userPayload._devices = _devices;
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
    const newResource = await super.create(collection, payload, options, context);

    if (collection === 'users') {
      // Sending invite...
      const { email } = newResource as DataModel['users'];
      const password = (payload as Payload<DataModel['users']>).password as string;
      await this.emailClient.sendInviteEmail(email, `${this.settings.baseUrl}/sign-in`, password);
    }

    return newResource;
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
    context: CommandContext,
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
    context: CommandContext,
  ): Promise<Credentials> {
    if (passwordConfirmation !== password) {
      throw new EngineError('PASSWORDS_MISMATCH');
    }

    const newId = new Id();
    const credentials = this.generateCredentials(newId);
    const payload = { email, password } as UpdatePayload<DataModel['users']>;
    const fullContext = { ...context, credentials, mode: 'CREATE' as const };
    const fullPayload = await this.checkAndUpdatePayload('users', payload, fullContext);
    await this.databaseClient.create('users', {
      ...fullPayload as DataModel['users'],
      _id: newId,
    });

    const newVerificationToken = randomBytes(12).toString('hex');
    const key = `verify_${String((fullPayload as DataModel['users'])._id)}`;
    const cacheKey = createHash('sha1').update(key).digest('hex');
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
    context: CommandContext,
  ): Promise<Credentials> {
    const { results } = await this.databaseClient.search('users', { filters: { email } }, {
      limit: 1,
      fields: ['_devices', 'password'],
    });

    if (results.length === 0) {
      throw new EngineError('NO_USER');
    }

    const [user] = results;
    if (!await bcrypt.compare(password, user.password)) {
      throw new EngineError('INVALID_CREDENTIALS');
    }

    const deviceId = /^[0-9a-fA-F]{24}$/.test(`${context.deviceId}`) ? context.deviceId : undefined;
    const credentials = this.generateCredentials(user._id, deviceId);
    const fullPayload = await this.checkAndUpdatePayload('users', {}, {
      ...context,
      user,
      credentials,
      mode: 'UPDATE',
    } as CommandContext & { mode: 'UPDATE' });
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
  public async requestEmailVerification(context: CommandContext): Promise<void> {
    if (context.user._verifiedAt !== null) {
      throw new EngineError('EMAIL_ALREADY_VERIFIED');
    }

    // Sending verify email...
    const newVerificationToken = randomBytes(12).toString('hex');
    const cacheKey = createHash('sha1').update(`verify_${String(context.user._id)}`).digest('hex');
    const verificationUrl = `${this.settings.baseUrl}/verify-email?verificationToken=${newVerificationToken}`;
    await this.cacheClient.set(cacheKey, newVerificationToken, 3600 * 2); // In 2 hours.
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
  public async verifyEmail(verificationToken: string, context: CommandContext): Promise<void> {
    const { user } = context;
    const cacheKey = createHash('sha1').update(`verify_${String(user._id)}`).digest('hex');
    const storedVerificationToken = await this.cacheClient.get(cacheKey);

    if (storedVerificationToken !== verificationToken) {
      throw new EngineError('INVALID_VERIFICATION_TOKEN');
    }

    // Updating user credentials...
    const payload = { _verifiedAt: new Date() };
    const fullContext = { ...context, mode: 'UPDATE' as const };
    const fullPayload = await this.checkAndUpdatePayload('users', payload, fullContext);
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
    const users = await this.databaseClient.search('users', { filters: { email } }, { limit: 1 });
    if (users.total > 0) {
      const newResetToken = randomBytes(12).toString('hex');
      const resetUrl = `${this.settings.baseUrl}/reset-password?resetToken=${newResetToken}`;
      const cacheKey = createHash('sha1').update(`reset_${newResetToken}`).digest('hex');
      await this.cacheClient.set(cacheKey, email, 3600 * 2); // In 2 hours.
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

    const cacheKey = createHash('sha1').update(`reset_${resetToken}`).digest('hex');
    const email = await this.cacheClient.get(cacheKey);
    const users = await this.databaseClient.search('users', { filters: { email } }, {
      limit: 1,
      fields: ['_verifiedAt'],
    });
    if (users.total === 0) {
      throw new EngineError('INVALID_RESET_TOKEN');
    }

    const [user] = users.results;
    const payload = { password };
    const fullPayload = await this.checkAndUpdatePayload('users', payload, { user, mode: 'UPDATE' });
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
  public async refreshToken(refreshToken: string, context: CommandContext): Promise<Credentials> {
    const { user } = context;
    const credentials = this.generateCredentials(user._id, context.deviceId);
    const deviceIndex = user._devices.findIndex((device) => device.id === context.deviceId);

    if (
      user._devices[deviceIndex]?.refreshToken !== refreshToken
      || user._devices[deviceIndex].expiration.getTime() <= Date.now()
    ) {
      throw new EngineError('INVALID_REFRESH_TOKEN');
    }

    const fullContext = { ...context, credentials, mode: 'UPDATE' as const };
    const fullPayload = await this.checkAndUpdatePayload('users', {}, fullContext);
    await this.databaseClient.update('users', user._id, fullPayload);
    return credentials;
  }

  /**
   * Signs connected user out.
   *
   * @param context Command context.
   */
  public async signOut(context: CommandContext): Promise<void> {
    const { user } = context;
    const fullContext = { ...context, credentials: null, mode: 'UPDATE' as const };
    const fullPayload = await this.checkAndUpdatePayload('users', {}, fullContext);
    await this.databaseClient.update('users', user._id, fullPayload);
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
    await this.signUp(rootEmail, rootPassword, rootPassword, {} as unknown as CommandContext);

    this.logger.info('[UsersEngine][reset] Creating root role...');
    const { results: [{ _id }] } = await this.databaseClient.list('users');
    const newRole = await this.create('roles', {
      name: 'ROOT',
      permissions: this.model.getCollections().reduce((permissions, collection) => (
        permissions.concat([
          `${toSnakeCase(collection as string)}_VIEW`,
          `${toSnakeCase(collection as string)}_LIST`,
          `${toSnakeCase(collection as string)}_SEARCH`,
          `${toSnakeCase(collection as string)}_CREATE`,
          `${toSnakeCase(collection as string)}_UPDATE`,
          `${toSnakeCase(collection as string)}_DELETE`,
        ])
      ), ['USERS_ROLES_VIEW', 'USERS_ROLES_UPDATE', 'USERS_AUTH_DETAILS_VIEW']),
    } as Payload<DataModel['roles']>, {}, { user: { _id } as unknown as User });

    this.logger.info('[UsersEngine][reset] Updating root user...');
    await this.databaseClient.update('users', _id, {
      roles: [newRole._id],
    } as Partial<DataModel['users']>);
  }
}
