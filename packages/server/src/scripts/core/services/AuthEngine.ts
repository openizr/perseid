/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {
  Payload,
  CreatePayload,
  UserCommandContext,
  AnonymousCommandContext,
} from 'scripts/core/types';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import Engine from 'scripts/core/services/Engine';
import type Model from 'scripts/core/services/Model';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import EngineError from 'scripts/core/errors/Engine';
import type Telemetry from 'scripts/core/services/Telemetry';
import { Id, type Ids, type UserDataModel } from '@perseid/core';
import BaseEmailClient from 'scripts/core/services/EmailClient';
import BaseCacheClient from 'scripts/core/services/CacheClient';
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
 * Perseid engine extended with authentication-related methods.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/services/UsersEngine.ts
 */
export default class AuthEngine<
  /**
   * Data model type definition.
   */
  DataModel extends UserDataModel = UserDataModel,

  /**
   * Query results type definition.
   */
  QueryResults extends Record<string, Ids> = Record<string, Ids>,

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
> extends Engine<DataModel, QueryResults, DatabaseClient> {
  /**
   * Default duration before an access token expires.
   */
  protected readonly ACCESS_TOKEN_DURATION: number;

  /**
   * Default duration before a refresh token expires.
   */
  protected readonly REFRESH_TOKEN_DURATION: number;

  /**
   * Default fields to fetch in `viewMe` method.
   */
  protected readonly USER_FIELDS_TO_FETCH: string[];

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
    const expiresIn = this.ACCESS_TOKEN_DURATION;
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
    model: Model<DataModel>,
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
    this.USER_FIELDS_TO_FETCH = [
      '_id',
      'email',
      '_createdAt',
      '_updatedAt',
      'roles.name',
      '_verifiedAt',
      'roles.permissions',
    ];
  }

  /**
   * Fetches information about current user.
   *
   * @param context Command context.
   *
   * @returns User information.
   *
   * @throws If user does not exist.
   */
  public async viewMe<Key extends keyof QueryResults>(
    context: UserCommandContext<DataModel>,
  ): Promise<Key extends keyof QueryResults ? QueryResults[Key] : Ids> {
    const user = await this.databaseClient.view<Key>('users', context.session.user._id, {
      fields: this.USER_FIELDS_TO_FETCH,
    });

    if (user === null) {
      throw new EngineError('NO_RESOURCE', { id: context.session.user._id });
    }

    return user;
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
    context: AnonymousCommandContext<DataModel>,
  ): Promise<Id> {
    let userId = '';

    const tokenInfo = jwt.verify(accessToken, this.settings.auth.publicKey, {
      ignoreExpiration,
      issuer: this.settings.auth.issuer,
      audience: this.settings.auth.clientId,
      algorithms: [this.settings.auth.algorithm],
    }) as JwtPayload;
    const subject = String(tokenInfo.sub).split('_');
    [userId] = subject;

    // Making sure that device ids from token and header match...
    if (subject[1] !== context.session.deviceId) {
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
    context: UserCommandContext<DataModel>,
  ): Promise<Credentials> {
    if (passwordConfirmation !== password) {
      throw new EngineError('PASSWORDS_MISMATCH');
    }

    // Preparing payload...
    const payload: CreatePayload<UserDataModel['users']> = { email, password, roles: [] };
    const fullPayload = await this.prepareCreatePayload('users', payload, context);
    const credentials = this.generateCredentials(fullPayload._id);
    fullPayload._createdBy = fullPayload._id;
    fullPayload._devices.push({
      _id: credentials.deviceId,
      _refreshToken: credentials.refreshToken,
      _userAgent: context.session.userAgent ?? 'UNKNOWN',
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
   * @param deviceId ID of the device to sign in from.
   *
   * @param userAgent User agent of the device to sign in from. Defaults to `UNKNOWN`.
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
    deviceId?: string,
    userAgent = 'UNKNOWN',
  ): Promise<Credentials> {
    const user = {} as UserDataModel['users'] & { _permissions: Set<string> };
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
    user._permissions = new Set();
    const credentials = this.generateCredentials(user._id, deviceId);
    const fullPayload = await this.prepareUpdatePayload('users', {}, {
      session: {
        user: user as unknown as UserCommandContext<DataModel>['session']['user'],
        deviceId,
        userAgent,
      },
    });
    const newDevices = [{
      _userAgent: userAgent,
      _id: credentials.deviceId,
      _refreshToken: credentials.refreshToken,
      _expiration: credentials.refreshTokenExpiration,
    }];

    user._devices.forEach((device, index) => {
      const expiration = device._expiration.getTime();
      if (device._id !== deviceId && expiration > now) {
        newDevices.push(user._devices[index]);
      }
    });

    (fullPayload as Payload<UserDataModel['users']>)._devices = newDevices;
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
  public async requestEmailVerification(context: UserCommandContext<DataModel>): Promise<void> {
    if (context.session.user._verifiedAt !== null) {
      throw new EngineError('EMAIL_ALREADY_VERIFIED');
    }

    // Sending verify email...
    const key = `verify_${String(context.session.user._id)}`;
    const newVerificationToken = randomBytes(12).toString('hex');
    const verificationUrl = `${this.settings.baseUrl}/verify-email?verificationToken=${newVerificationToken}`;
    await this.cacheClient.set(key, newVerificationToken, 3600 * 2); // In 2 hours.
    await this.emailClient.sendVerificationEmail(context.session.user.email, verificationUrl);
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
    context: UserCommandContext<DataModel>,
  ): Promise<void> {
    const { session } = context;
    const cacheKey = `verify_${String(session.user._id)}`;
    const storedVerificationToken = await this.cacheClient.get(cacheKey);

    if (storedVerificationToken !== verificationToken) {
      throw new EngineError('INVALID_VERIFICATION_TOKEN');
    }

    // Updating user credentials...
    const fullPayload = await this.prepareUpdatePayload('users', {}, context);
    (fullPayload as Payload<UserDataModel['users']>)._verifiedAt = new Date();
    await this.databaseClient.update('users', session.user._id, fullPayload);
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
    const context = {} as UserCommandContext<DataModel>;

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
    Object.assign(payload, { password });
    Object.assign(context, { session: { user } });
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
    context: UserCommandContext<DataModel>,
  ): Promise<Credentials> {
    const deviceIndex = 0;
    const now = Date.now();
    const { session } = context;
    const newDevices: UserDataModel['users']['_devices'] = [];
    const credentials = this.generateCredentials(session.user._id, session.deviceId);

    session.user._devices.forEach((device, index) => {
      const expiration = device._expiration.getTime();
      if (device._id !== session.deviceId && expiration > now) {
        newDevices.push(session.user._devices[index]);
      } else if (device._id === session.deviceId) {
        if (session.user._devices[index]?._refreshToken !== refreshToken || expiration <= now) {
          throw new EngineError('INVALID_REFRESH_TOKEN');
        }
        newDevices.push({
          _id: session.user._devices[deviceIndex]._id,
          _refreshToken: credentials.refreshToken,
          _expiration: credentials.refreshTokenExpiration,
          _userAgent: session.userAgent ?? session.user._devices[deviceIndex]._userAgent,
        });
      }
    });

    const fullPayload = await this.prepareUpdatePayload('users', {}, context);
    (fullPayload as Payload<UserDataModel['users']>)._devices = newDevices;
    await this.databaseClient.update('users', session.user._id, fullPayload);
    return credentials;
  }

  /**
   * Signs connected user out.
   *
   * @param context Command context.
   */
  public async signOut(context: UserCommandContext<DataModel>): Promise<void> {
    const now = Date.now();
    const { session, queryOptions } = context;
    const newDevices: UserDataModel['users']['_devices'] = [];

    session.user._devices.forEach((device, index) => {
      const expiration = device._expiration.getTime();
      if (device._id !== session.deviceId && expiration > now) {
        newDevices.push(session.user._devices[index]);
      }
    });

    const fullPayload = await this.prepareUpdatePayload('users', {}, context);
    (fullPayload as Payload<UserDataModel['users']>)._devices = newDevices;
    await this.databaseClient.update('users', session.user._id, fullPayload, queryOptions);
  }
}
