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
import type Model from 'scripts/common/Model';
import EngineError from 'scripts/errors/Engine';
import { randomBytes, createHash } from 'crypto';
import EmailClient from 'scripts/services/EmailClient';
import { type DataModel, Id, User } from '@perseid/core';
import type CacheClient from 'scripts/services/CacheClient';
import type DatabaseClient from 'scripts/services/DatabaseClient';

interface Credentials {
  deviceId: string;
  expiresIn: number;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiration: Date;
}

interface EngineSettings {
  baseUrl: string;
  oAuth: OAuthConfiguration;
}

export default class OAuthEngine<
  T = DataModel,
  M extends Model<T> = Model<T>,
  D extends DatabaseClient<T> = DatabaseClient<T>,
> extends Engine<T, M, D> {
  protected settings: EngineSettings;

  protected emailClient: EmailClient;

  protected cacheClient: CacheClient;

  /**
   *
   * @param emailClient
   * @param databaseClient
   * @param settings
   */
  constructor(
    model: M,
    logger: Logger,
    emailClient: EmailClient,
    cacheClient: CacheClient,
    databaseClient: D,
    settings: EngineSettings,
  ) {
    super(model, logger, databaseClient);
    this.settings = settings;
    this.emailClient = emailClient;
    this.cacheClient = cacheClient;
  }

  /**
   *
   * @param resource
   * @param context
   * @returns
   */
  public async createUser(payload: User, context: Any): Promise<User> {
    const fullResource: User = {
      ...payload,
      _devices: {},
      _verifiedAt: new Date(),
      ...this.generateAutomaticFields('users' as keyof T, context),
      password: await bcrypt.hash(payload.password, 10),
    };

    await this.databaseClient.create('users' as keyof T, fullResource as any);
    const newUser = await this.databaseClient.view('users' as keyof T, fullResource._id, { fields: context.fields }) as unknown as User;

    // Sending verify email...
    const { email } = newUser;
    const signInUrl = `${this.settings.baseUrl}/sign-in`;
    await this.emailClient.sendInviteEmail({
      to: [email],
      variables: {
        signInUrl,
        password: fullResource.password,
      },
    });

    return newUser;
  }

  /**
   * Generates new OAuth credentials (refresh/access tokens) for `userId` and `deviceId`.
   *
   * @param userId Id of the user to generate credentials for.
   *
   * @param oAuthConfiguration OAuth configuration.
   *
   * @param deviceId Id of the device to generate credentials for. If not set, it will
   * generate a new device id.
   *
   * @returns New credentials.
   */
  public static generateCredentials(
    userId: Id,
    oAuthConfiguration: OAuthConfiguration,
    deviceId = randomBytes(12).toString('hex'),
  ): Credentials {
    const expiresIn = 20 * 60; // 20 minutes.
    const refreshTokenExpiration = new Date(Date.now() + 30 * 24 * 3600 * 1000); // In 30 days.
    return {
      deviceId,
      expiresIn,
      refreshTokenExpiration,
      refreshToken: randomBytes(12).toString('hex'),
      accessToken: jwt.sign({}, oAuthConfiguration.privateKey, {
        algorithm: 'RS256',
        expiresIn,
        subject: `${userId}_${deviceId}`,
        issuer: oAuthConfiguration.issuer,
        audience: oAuthConfiguration.clientId,
      }),
    };
  }

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public async verifyToken(context: any): Promise<string> {
    let userId = '';

    const tokenInfo = jwt.verify(context.accessToken, this.settings.oAuth.publicKey, {
      ignoreExpiration: context.ignoreExpiration,
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

    return userId;
  }

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public async refreshToken(
    refreshToken: string,
    context: Any,
  ): Promise<any> {
    const { _id: userId } = context.user;

    // Making sure that user exists...
    const users = await this.databaseClient.search('users' as keyof T, { filters: { _id: userId } }, {
      limit: 1,
      fields: ['_devices'],
    }) as unknown as Results<User>;
    if (users.total === 0) {
      throw new EngineError('INVALID_CREDENTIALS');
    }

    // Making sure that request's and device's refresh tokens match...
    const { _devices } = users.results[0];
    if (_devices[context.deviceId]?.refreshToken !== refreshToken) {
      throw new EngineError('INVALID_REFRESH_TOKEN');
    }

    // Generating new access token...
    const credentials = OAuthEngine.generateCredentials(
      userId,
      this.settings.oAuth,
      context.deviceId,
    );

    // Updating user credentials in database...
    const updatedUser = {
      _devices: {
        ..._devices,
        [credentials.deviceId]: {
          userAgent: context.userAgent,
          refreshToken: credentials.refreshToken,
          expiration: credentials.refreshTokenExpiration,
        },
      },
      ...this.generateAutomaticFields('users' as keyof T, context, true),
    };
    await this.databaseClient.update('users' as keyof T, userId, updatedUser as any);

    return credentials;
  }

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public async signIn(
    email: string,
    password: string,
    options: Any,
    context: Any,
  ): Promise<any> {
    // Making sure that user exists...
    const users = await this.databaseClient.search('users' as keyof T, { filters: { email } }, {
      limit: 1,
      fields: options.fields,
    }) as unknown as Results<User>;
    if (users.total === 0) {
      throw new EngineError('NO_O_AUTH_USER');
    }

    // Comparing passwords...
    const [user] = users.results;
    const doMatch = await bcrypt.compare(password, user.password);
    if (doMatch === false) {
      throw new EngineError('INVALID_CREDENTIALS');
    }

    // Generating new access token...
    const { _id, _devices } = user;
    const credentials = OAuthEngine.generateCredentials(_id, this.settings.oAuth, context.deviceId);

    // Updating user credentials in database...
    await this.update('users' as keyof T, _id, {
      _devices: {
        ..._devices,
        [credentials.deviceId]: {
          userAgent: context.userAgent,
          refreshToken: credentials.refreshToken,
          expiration: credentials.refreshTokenExpiration,
        },
      },
    } as unknown as Partial<WithoutAutomaticFields<T[keyof T]>>, options, { user });

    return credentials;
  }

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public async signOut({ userId, deviceId }: any): Promise<void> {
    // Making sure that user exists...
    const users = await this.databaseClient.search('users' as keyof T, { filters: { _id: userId } }, {
      limit: 1,
      fields: ['_devices'],
    }) as unknown as Results<User>;
    if (users.total === 0) {
      throw new EngineError('NO_USER');
    }

    // Revoking user's device credentials in database...
    const { _devices } = users.results[0];
    const updatedUser = {
      _devices: Object.keys(_devices)
        .filter((currentDeviceId) => currentDeviceId !== deviceId)
        .reduce((devices, currentDeviceId) => ({
          ...devices,
          [currentDeviceId]: _devices[currentDeviceId],
        }), {}),
      ...this.generateAutomaticFields('users' as keyof T, { user: { _id: userId } } as any, true),
    };

    await this.databaseClient.update('users' as keyof T, userId, updatedUser as any);
  }

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public async signUp(resource: any, context: any): Promise<any> {
    const { passwordConfirmation, ...rest } = resource;
    if (passwordConfirmation !== resource.password) {
      throw new EngineError('PASSWORDS_MISMATCH');
    }

    // Generating new access token...
    const newId = new Id();
    const credentials = OAuthEngine.generateCredentials(newId, this.settings.oAuth);

    // Creating new user in database...
    await this.databaseClient.create('users' as keyof T, {
      ...rest,
      roles: [],
      _verifiedAt: null,
      _devices: {
        [credentials.deviceId]: {
          userAgent: context.userAgent,
          refreshToken: credentials.refreshToken,
          expiration: credentials.refreshTokenExpiration,
        },
      },
      password: await bcrypt.hash(resource.password, 10),
      ...this.generateAutomaticFields('users' as keyof T, {
        _id: newId,
        user: { _id: newId } as any,
      }),
    });
    const newUser = await this.databaseClient.view('users' as keyof T, newId, { fields: ['email'] });

    // Sending verify email...
    const { _id, email } = newUser as unknown as User;
    const newVerifyToken = randomBytes(12).toString('hex');
    const cacheKey = createHash('sha1').update(`verify_${_id}`).digest('hex');
    const verificationUrl = `${this.settings.baseUrl}/verify-email?verifyToken=${newVerifyToken}`;
    await this.cacheClient.set(cacheKey, newVerifyToken, 3600 * 2); // In 2 hours.
    await this.emailClient.sendVerifyEmail({ to: [email], variables: { verificationUrl } });

    return credentials;
  }

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public async requestPasswordReset(email: string): Promise<void> {
    // Making sure that user exists...
    const users = await this.databaseClient.search('users' as keyof T, { filters: { email } }, {
      limit: 1,
    });
    if (users.total > 0) {
      const newResetToken = randomBytes(12).toString('hex');
      const resetUrl = `${this.settings.baseUrl}/reset-password?email=${email}&resetToken=${newResetToken}`;
      const cacheKey = createHash('sha1').update(`reset_${email}`).digest('hex');
      await this.cacheClient.set(cacheKey, newResetToken, 3600 * 2); // In 2 hours.
      await this.emailClient.sendVerifyEmail({ to: [email], variables: { resetUrl } });
    } else {
      // Delaying API response prevents giving any hint about whether user actually exists.
      await new Promise((resolve) => { setTimeout(resolve, 100); });
    }
  }

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public async resetPassword({
    email,
    password,
    resetToken,
    passwordConfirmation,
  }: any): Promise<void> {
    const cacheKey = createHash('sha1').update(`reset_${email}`).digest('hex');

    if (passwordConfirmation !== password) {
      throw new EngineError('PASSWORDS_MISMATCH');
    }

    const storedResetToken = await this.cacheClient.get(cacheKey);
    if (storedResetToken !== resetToken) {
      throw new EngineError('INVALID_RESET_TOKEN');
    }

    // Making sure that user exists...
    const users = await this.databaseClient.search('users' as keyof T, { filters: { email } }, {
      limit: 1,
    }) as unknown as Results<User>;
    if (users.total === 0) {
      throw new EngineError('NO_USER');
    }

    // Updating user credentials in database...
    const [user] = users.results;
    const updatedUser = {
      password: await bcrypt.hash(password, 10),
      // We also want to sign user out of all devices, as a security measure.
      _devices: {},
      // Successfully resetting one's password also means verifying his email at the same time.
      _verifiedAt: new Date(),
      ...this.generateAutomaticFields('users' as keyof T, { user }, true),
    };
    await this.databaseClient.update('users' as keyof T, user._id, updatedUser as any);
    await this.cacheClient.delete(cacheKey);
  }

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public async requestVerifyEmail(id: Id): Promise<void> {
    // Making sure that user exists and isn't already verified...
    const users = await this.databaseClient.search('users' as keyof T, { filters: { _id: id } }, {
      limit: 1,
      fields: ['_verifiedAt', 'email'],
    }) as unknown as Results<User>;

    if (users.total === 0) {
      throw new EngineError('INVALID_CREDENTIALS');
    }
    const { _verifiedAt, email } = users.results[0];
    if (_verifiedAt !== null) {
      throw new EngineError('EMAIL_VERIFIED');
    }

    // Sending verify email...
    const newVerifyToken = randomBytes(12).toString('hex');
    const cacheKey = createHash('sha1').update(`verify_${id}`).digest('hex');
    const verificationUrl = `${this.settings.baseUrl}/verify-email?verifyToken=${newVerifyToken}`;
    await this.cacheClient.set(cacheKey, newVerifyToken, 3600 * 2); // In 2 hours.
    await this.emailClient.sendVerifyEmail({ to: [email], variables: { verificationUrl } });
  }

  /**
   *
   * @param collection
   * @param resource
   * @param context
   * @returns
   */
  public async verifyEmail({ userId, verifyToken }: any): Promise<void> {
    const cacheKey = createHash('sha1').update(`verify_${userId}`).digest('hex');

    const storedVerifyToken = await this.cacheClient.get(cacheKey);
    if (storedVerifyToken !== verifyToken) {
      throw new EngineError('INVALID_VERIFY_TOKEN');
    }

    // Making sure that user exists...
    const users = await this.databaseClient.search('users' as keyof T, { filters: { _id: userId } }, {
      limit: 1,
    });
    if (users.total === 0) {
      throw new EngineError('NO_RESOURCE', { id: userId });
    }

    // Updating user credentials in database...
    await this.databaseClient.update('users' as keyof T, userId, {
      _verifiedAt: new Date(),
      ...this.generateAutomaticFields('users' as keyof T, { user: { _id: userId } } as any, true),
    } as any);
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
    const { results: [rootUser] } = await this.databaseClient.list('users' as keyof T);
    const rootUserId = (rootUser as { _id: Id })._id;
    const context: CommandContext = { user: { _id: rootUserId } as unknown as User };
    this.logger.info('[OAuthEngine][reset] Creating root role...');
    const newRole = await this.create('roles' as keyof T, {
      name: 'ROOT',
      permissions: this.model.getCollections().reduce((permissions, collection) => ({
        ...permissions,
        [`${collection.toUpperCase()}_VIEW`]: true,
        [`${collection.toUpperCase()}_LIST`]: true,
        [`${collection.toUpperCase()}_SEARCH`]: true,
        [`${collection.toUpperCase()}_CREATE`]: true,
        [`${collection.toUpperCase()}_UPDATE`]: true,
        [`${collection.toUpperCase()}_DELETE`]: true,
      }), {}),
    } as T[keyof T], {}, context);
    this.logger.info('[OAuthEngine][reset] Updating root user...');
    await this.databaseClient.update('users' as keyof T, rootUserId, {
      email: rootEmail,
      password: await bcrypt.hash(rootPassword, 10),
      roles: [(newRole as { _id: Id; })._id],
    } as T[keyof T]);
  }
}
