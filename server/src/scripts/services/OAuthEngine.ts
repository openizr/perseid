/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Engine from 'scripts/services/Engine';
import Logger from 'scripts/services/Logger';
import EngineError from 'scripts/errors/Engine';
import { randomBytes, createHash } from 'crypto';
import type BaseModel from 'scripts/common/Model';
import EmailClient from 'scripts/services/EmailClient';
import type CacheClient from 'scripts/services/CacheClient';
import type BaseDatabaseClient from 'scripts/services/DatabaseClient';
import { Id, type DataModel as DefaultTypes, type User } from '@perseid/core';

/**
 * Generated OAuth credentials.
 */
export interface Credentials {
  /** Id of the device for which these credentials are valid. */
  deviceId: string;

  /** Access token expiration period, in seconds. */
  expiresIn: number;

  /** Access token. */
  accessToken: string;

  /** Refresh token, used to refresh access token. */
  refreshToken: string;

  /** Refresh token expiration date. */
  refreshTokenExpiration: Date;
}

/**
 * OAuth engine settings.
 */
export interface OAuthEngineSettings {
  /** Application base URL. */
  baseUrl: string;

  /** OAuth configuration. */
  oAuth: {
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
 * Perseid engine extended with OAuth-related methods.
 */
export default class OAuthEngine<
  /** Data model types definitions. */
  Types extends DefaultTypes = DefaultTypes,

  /** Model class types definitions. */
  Model extends BaseModel<Types> = BaseModel<Types>,

  /** Database client types definition. */
  DatabaseClient extends BaseDatabaseClient<Types> = BaseDatabaseClient<Types>,
> extends Engine<Types, Model, DatabaseClient> {
  /** Default duration before a refresh token expires. */
  protected readonly REFRESH_TOKEN_DURATION = 30 * 24 * 3600 * 1000; // 30 days.

  /** Email client to use. */
  protected emailClient: EmailClient;

  /** Cache client to use. */
  protected cacheClient: CacheClient;

  /** OAuth engine settings. */
  protected settings: OAuthEngineSettings;

  /**
   * Generates new OAuth credentials (refresh/access tokens) for `userId` and `deviceId`.
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
      accessToken: jwt.sign({}, this.settings.oAuth.privateKey, {
        algorithm: 'RS256',
        expiresIn,
        subject: `${userId}_${deviceId}`,
        issuer: this.settings.oAuth.issuer,
        audience: this.settings.oAuth.clientId,
      }),
    };
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
    const updatedPayload = await super.checkAndUpdatePayload(
      command,
      collection,
      payload,
      context,
      resourceId,
    );

    if (collection === 'users') {
      const userPayload = updatedPayload as Types['users'];
      if (command === 'CREATE') {
        userPayload._apiKeys = [];
        userPayload._verifiedAt = null;
      }
      if (userPayload.password !== undefined) {
        return {
          ...updatedPayload,
          // Whenever users change their password, we automatically sign them out of all their
          // devices, as a security measure.
          _devices: [],
          password: await bcrypt.hash(userPayload.password, 10),
        };
      }
    }

    return updatedPayload;
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
    settings: OAuthEngineSettings,
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
  public async create<Collection extends keyof Types>(
    collection: Collection,
    payload: WithoutAutomaticFields<Types[Collection]>,
    options: CommandOptions,
    context: CommandContext,
  ): Promise<Types[Collection]> {
    const newResource = await super.create(collection, payload, options, context);

    if (collection === 'users') {
      // Sending invite...
      const { email } = newResource as Types['users'];
      const { password } = payload as WithoutAutomaticFields<Types['users']>;
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
   * @returns Id of the user related to the access token
   */
  public async verifyToken(
    accessToken: string,
    ignoreExpiration: boolean,
    context: CommandContext,
  ): Promise<Id> {
    let userId = '';

    const tokenInfo = jwt.verify(accessToken, this.settings.oAuth.publicKey, {
      ignoreExpiration,
      issuer: this.settings.oAuth.issuer,
      audience: this.settings.oAuth.clientId,
      algorithms: [this.settings.oAuth.algorithm],
    });
    const subject = (<{ sub: string; }>tokenInfo).sub.split('_');
    [userId] = subject;

    // Making sure that device ids from token and header match...
    if (subject[1] !== context.deviceId) {
      throw new EngineError('INVALID_DEVICE_ID');
    }

    return new Id(userId);
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
   */
  public async signUp(
    email: Types['users']['email'],
    password: Types['users']['password'],
    passwordConfirmation: Types['users']['password'],
    context: CommandContext,
  ): Promise<Credentials> {
    const payload = { password, email } as WithoutAutomaticFields<Types['users']>;

    if (passwordConfirmation !== password) {
      throw new EngineError('PASSWORDS_MISMATCH');
    }

    // Creating new user in database...
    const updatedPayload = await this.checkAndUpdatePayload('CREATE', 'users', payload, context);
    const credentials = this.generateCredentials(updatedPayload._id);
    await this.databaseClient.create('users', {
      ...updatedPayload,
      _verifiedAt: null,
      _apiKeys: [],
      _devices: [{
        id: credentials.deviceId,
        refreshToken: credentials.refreshToken,
        userAgent: context.userAgent ?? 'UNKNOWN',
        expiration: credentials.refreshTokenExpiration,
      }],
      roles: [],
      password: await bcrypt.hash(payload.password, 10),
    });

    // Sending verify email...
    const newVerifyToken = randomBytes(12).toString('hex');
    const cacheKey = createHash('sha1').update(`verify_${updatedPayload._id}`).digest('hex');
    const verificationUrl = `${this.settings.baseUrl}/verify-email?verifyToken=${newVerifyToken}`;
    await this.cacheClient.set(cacheKey, newVerifyToken, 3600 * 2); // In 2 hours.
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

    // Making sure user exists...
    if (results.length === 0) {
      throw new EngineError('NO_USER');
    }

    // Comparing passwords...
    const [user] = results;
    if (!await bcrypt.compare(password, user.password)) {
      throw new EngineError('INVALID_CREDENTIALS');
    }

    // Generating new access token...
    const credentials = this.generateCredentials(user._id, context.deviceId);

    // Updating user credentials...
    const deviceIndex = user._devices.findIndex((device) => device.id === context.deviceId);
    user._devices.splice(deviceIndex, deviceIndex >= 0 ? 1 : 0, {
      id: credentials.deviceId,
      refreshToken: credentials.refreshToken,
      expiration: credentials.refreshTokenExpiration,
      userAgent: context.userAgent ?? user._devices[deviceIndex]?.userAgent ?? 'UNKNOWN',
    });
    await this.databaseClient.update('users', user._id, {
      ...this.generateAutomaticFields(this.model.getCollection('users'), { ...context, user }),
      _devices: user._devices,
    } as Partial<Types['users']>);

    return credentials;
  }

  /**
   * Sends a new verification email to connected user.
   *
   * @param context Command context.
   */
  public async requestEmailVerification(context: CommandContext): Promise<void> {
    if (context.user._verifiedAt !== null) {
      throw new EngineError('EMAIL_ALREADY_VERIFIED');
    }

    // Sending verify email...
    const newVerifyToken = randomBytes(12).toString('hex');
    const cacheKey = createHash('sha1').update(`verify_${context.user._id}`).digest('hex');
    const verificationUrl = `${this.settings.baseUrl}/verify-email?verifyToken=${newVerifyToken}`;
    await this.cacheClient.set(cacheKey, newVerifyToken, 3600 * 2); // In 2 hours.
    await this.emailClient.sendVerificationEmail(context.user.email, verificationUrl);
  }

  /**
   * Verifies email of the connected user.
   *
   * @param token Verification token that was sent in the verification email.
   *
   * @param context Command context.
   */
  public async verifyEmail(verificationToken: string, context: CommandContext): Promise<void> {
    const cacheKey = createHash('sha1').update(`verify_${context.user._id}`).digest('hex');

    const storedVerificationToken = await this.cacheClient.get(cacheKey);
    if (storedVerificationToken !== verificationToken) {
      throw new EngineError('INVALID_VERIFY_TOKEN');
    }

    // Updating user credentials...
    await this.databaseClient.update('users', context.user._id, {
      ...this.generateAutomaticFields(this.model.getCollection('users'), context),
      _verifiedAt: new Date(),
    } as Partial<Types['users']>);
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
      const resetUrl = `${this.settings.baseUrl}/reset-password?email=${email}&resetToken=${newResetToken}`;
      const cacheKey = createHash('sha1').update(`reset_${email}`).digest('hex');
      await this.cacheClient.set(cacheKey, newResetToken, 3600 * 2); // In 2 hours.
      await this.emailClient.sendPasswordResetEmail(email, resetUrl);
    } else {
      // Delaying API response prevents giving any hint about whether user actually exists.
      await new Promise((resolve) => { setTimeout(resolve, 100); });
    }
  }

  /**
   * Resets password for user with email `email`.
   *
   * @param email Email of the user for which to reset password.
   *
   * @param password New password.
   *
   * @param passwordConfirmation New password confirmation.
   *
   * @param resetToken Reset token sent in the password reset email.
   */
  public async resetPassword(
    email: Types['users']['email'],
    password: Types['users']['password'],
    passwordConfirmation: Types['users']['password'],
    resetToken: string,
  ): Promise<void> {
    const cacheKey = createHash('sha1').update(`reset_${email}`).digest('hex');

    if (passwordConfirmation !== password) {
      throw new EngineError('PASSWORDS_MISMATCH');
    }

    const storedResetToken = await this.cacheClient.get(cacheKey);
    if (storedResetToken !== resetToken) {
      throw new EngineError('INVALID_RESET_TOKEN');
    }

    const users = await this.databaseClient.search('users', { filters: { email } }, {
      limit: 1,
      fields: ['_verifiedAt'],
    });
    if (users.total === 0) {
      throw new EngineError('NO_USER');
    }

    // Updating user credentials...
    const [user] = users.results;
    await this.databaseClient.update('users', user._id, {
      ...this.generateAutomaticFields(this.model.getCollection('users'), { user }),
      // Successfully resetting users password also means verifying their email at the same time.
      _verifiedAt: user._verifiedAt ?? new Date(),
      _devices: [] as Types['users']['_devices'],
      password: await bcrypt.hash(password, 10),
    } as Partial<Types['users']>);
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
   */
  public async refreshToken(refreshToken: string, context: CommandContext): Promise<Credentials> {
    const { user } = context;
    const deviceIndex = user._devices.findIndex((device) => device.id === context.deviceId);

    if (
      user._devices[deviceIndex]?.refreshToken !== refreshToken
      || user._devices[deviceIndex].expiration.getTime() <= Date.now()
    ) {
      throw new EngineError('INVALID_REFRESH_TOKEN');
    }

    // Generating new access token...
    const credentials = this.generateCredentials(user._id, context.deviceId);

    // Updating user credentials...
    user._devices.splice(deviceIndex, 1, {
      id: credentials.deviceId,
      refreshToken: credentials.refreshToken,
      expiration: credentials.refreshTokenExpiration,
      userAgent: context.userAgent ?? user._devices[deviceIndex]?.userAgent ?? 'UNKNOWN',
    });
    await this.databaseClient.update('users', user._id, {
      ...this.generateAutomaticFields(this.model.getCollection('users'), { user }),
      _devices: user._devices,
    } as Partial<Types['users']>);

    return credentials;
  }

  /**
   * Signs connected user out.
   *
   * @param context Command context.
   */
  public async signOut(context: CommandContext): Promise<void> {
    // Revoking user's device credentials...
    const { _id, _devices } = context.user;
    const deviceIndex = _devices.findIndex((device) => device.id === context.deviceId);

    if (deviceIndex >= 0) {
      _devices.splice(deviceIndex, 1);
      await this.databaseClient.update('users', _id, {
        ...this.generateAutomaticFields(this.model.getCollection('users'), context),
        _devices,
      } as Partial<Types['users']>);
    }
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

    this.logger.info('[OAuthEngine][reset] Creating root user...');
    await this.signUp(rootEmail, rootPassword, rootPassword, {} as unknown as CommandContext);

    this.logger.info('[OAuthEngine][reset] Creating root role...');
    const { results: [{ _id }] } = await this.databaseClient.list('users');
    const newRole = await this.create('roles', {
      name: 'ROOT',
      permissions: this.model.getCollections().reduce((permissions, collection) => (
        permissions.concat([
          `${(collection as string).toUpperCase()}_VIEW`,
          `${(collection as string).toUpperCase()}_LIST`,
          `${(collection as string).toUpperCase()}_SEARCH`,
          `${(collection as string).toUpperCase()}_CREATE`,
          `${(collection as string).toUpperCase()}_UPDATE`,
          `${(collection as string).toUpperCase()}_DELETE`,
        ])
      ), [
        'USERS_DETAILS_VIEW',
        'USERS_ROLES_UPDATE',
      ]),
    } as WithoutAutomaticFields<Types['roles']>, {}, { user: { _id } as unknown as User });

    this.logger.info('[OAuthEngine][reset] Updating root user...');
    await this.databaseClient.update('users', _id, {
      roles: [newRole._id],
    } as Partial<Types['users']>);
  }
}
