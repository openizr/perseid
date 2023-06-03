/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/services/Model';
import Logger from 'scripts/services/Logger';
import { DataModel, Id } from '@perseid/core';
import EngineError from 'scripts/errors/Engine';
import OAuthEngine from 'scripts/services/OAuthEngine';
import CacheClient from 'scripts/services/CacheClient';
import EmailClient from 'scripts/services/EmailClient';
import DatabaseClient from 'scripts/services/DatabaseClient';

type TestOAuthEngine = OAuthEngine<DataModel> & {
  checkAndUpdatePayload: <Collection extends keyof DataModel>(
    command: 'create' | 'update' | 'delete',
    collection: Collection,
    payload: WithoutAutomaticFields<DataModel[Collection]>,
    context: CommandContext,
    resourceId?: Id,
  ) => Promise<DataModel[Collection]>
};

describe('services/OAuthEngine', () => {
  vi.mock('bcrypt');
  vi.mock('crypto');
  vi.mock('jsonwebtoken');
  vi.mock('@perseid/core');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/Engine');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/EmailClient');
  vi.mock('scripts/services/DatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  let engine: TestOAuthEngine;
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const emailClient = new EmailClient(logger);
  const cacheClient = new CacheClient({ cachePath: '/var/www/html/node_modules/.cache' });
  const model = new Model<DataModel>({} as Record<keyof DataModel, CollectionDataModel<DataModel>>);
  const databaseClient = new DatabaseClient<DataModel>(model, logger, cacheClient, {
    cacheDuration: 0,
    connectionLimit: 0,
    connectTimeout: 0,
    database: '',
    host: '',
    maxPoolSize: 0,
    password: '',
    port: 0,
    protocol: '',
    queueLimit: 0,
    user: '',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NO_RESULT;
    delete process.env.PASSWORDS_MISMATCH;
    engine = new OAuthEngine<DataModel>(model, logger, databaseClient, emailClient, cacheClient, {
      baseUrl: 'https://test.com',
      oAuth: {
        algorithm: 'RS256',
        clientId: 'test',
        issuer: 'test',
        privateKey: '',
        publicKey: '',
      },
    }) as TestOAuthEngine;
  });

  test('[checkAndUpdatePayload] users collection', async () => {
    const context = {} as unknown as CommandContext;
    const payload = { password: 'test' } as unknown as DataModel['users'];
    const newPayload = await engine.checkAndUpdatePayload('create', 'users', payload, context);
    expect(newPayload).toEqual({
      _devices: [],
      password: 'HASHED_TEXT_test',
      _updatedAt: new Date('2023-01-01'),
    });
  });

  test('[checkAndUpdatePayload] other collection', async () => {
    const context = {} as unknown as CommandContext;
    const payload = {} as unknown as DataModel['roles'];
    const newPayload = await engine.checkAndUpdatePayload('create', 'roles', payload, context);
    expect(newPayload).toEqual({ _updatedAt: new Date('2023-01-01') });
  });

  test('[verifyToken] invalid device id', async () => {
    const context = { deviceId: 'other' } as unknown as CommandContext;
    await expect(async () => {
      await engine.verifyToken('invalid', true, context);
    }).rejects.toThrow(new Error('INVALID_DEVICE_ID'));
  });

  test('[verifyToken] valid device id', async () => {
    const context = { deviceId: 'test' } as unknown as CommandContext;
    expect(await engine.verifyToken('invalid', true, context)).toEqual(new Id('64723318e84f943f1ad6578b'));
  });

  test('[create] users collection', async () => {
    const context = {} as unknown as CommandContext;
    const payload = { email: 'test@test.io', password: 'test' } as unknown as DataModel['users'];
    const resource = await engine.create('users', payload, {}, context);
    expect(resource).toEqual({
      _id: new Id('64723318e84f943f1ad6578b'),
      password: 'test',
      email: 'test@test.io',
      _updatedAt: new Date('2023-01-01'),
    });
    expect(emailClient.sendInviteEmail).toHaveBeenCalledTimes(1);
    expect(emailClient.sendInviteEmail).toHaveBeenCalledWith(
      'test@test.io',
      'https://test.com/sign-in',
      'test',
    );
  });

  test('[create] other collection', async () => {
    const context = {} as unknown as CommandContext;
    const payload = {} as unknown as DataModel['roles'];
    const resource = await engine.create('roles', payload, {}, context);
    expect(resource).toEqual({
      _id: new Id('64723318e84f943f1ad6578b'),
      _updatedAt: new Date('2023-01-01'),
    });
    expect(emailClient.sendInviteEmail).not.toHaveBeenCalled();
  });

  test('[signUp] passwords mismatch', async () => {
    const context = {} as unknown as CommandContext;
    expect(async () => {
      await engine.signUp('test@test.io', 'test', 'invalid', context);
    }).rejects.toThrow(new EngineError('PASSWORDS_MISMATCH'));
  });

  test('[signUp] passwords match', async () => {
    const context = {} as unknown as CommandContext;
    const credentials = await engine.signUp('test@test.io', 'test', 'test', context);
    expect(credentials).toEqual({
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      deviceId: '12345azerty',
      expiresIn: 1200,
      refreshToken: '12345azerty',
      refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
    });
    expect(databaseClient.create).toHaveBeenCalledTimes(1);
    expect(databaseClient.create).toHaveBeenCalledWith('users', {
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      _verifiedAt: null,
      _apiKeys: [],
      _devices: [{
        expiration: new Date('2023-01-31T00:00:00.000Z'),
        id: '12345azerty',
        refreshToken: '12345azerty',
        userAgent: 'UNKNOWN',
      }],
      email: 'test@test.io',
      password: 'HASHED_TEXT_test',
      roles: [],
    });
    expect(emailClient.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
      'test@test.io',
      'https://test.com/verify-email?verifyToken=12345azerty',
    );
    expect(cacheClient.set).toHaveBeenCalledTimes(1);
    expect(cacheClient.set).toHaveBeenCalledWith('abcde8997', '12345azerty', 7200);
  });

  test('[signIn] no user', async () => {
    process.env.NO_RESULT = 'true';
    const context = {} as unknown as CommandContext;
    expect(async () => {
      await engine.signIn('test@test.io', 'test', context);
    }).rejects.toThrow(new EngineError('NO_USER'));
  });

  test('[signIn] invalid credentials', async () => {
    process.env.PASSWORDS_MISMATCH = 'true';
    const context = {} as unknown as CommandContext;
    expect(async () => {
      await engine.signIn('test@test.io', 'test', context);
    }).rejects.toThrow(new EngineError('INVALID_CREDENTIALS'));
  });

  test('[signIn] valid credentials, existing device', async () => {
    const context = { deviceId: 'test' } as unknown as CommandContext;
    const credentials = await engine.signIn('test@test.io', 'test', context);
    expect(credentials).toEqual({
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      deviceId: 'test',
      expiresIn: 1200,
      refreshToken: '12345azerty',
      refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
    });
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('64723318e84f943f1ad6578b'), {
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      _devices: [{
        id: 'test',
        userAgent: 'UNKNOWN',
        refreshToken: '12345azerty',
        expiration: new Date('2023-01-31T00:00:00.000Z'),
      }],
    });
  });

  test('[signIn] valid credentials, new device', async () => {
    const context = {} as unknown as CommandContext;
    const credentials = await engine.signIn('test@test.io', 'test', context);
    expect(credentials).toEqual({
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      deviceId: '12345azerty',
      expiresIn: 1200,
      refreshToken: '12345azerty',
      refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
    });
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('64723318e84f943f1ad6578b'), {
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      _devices: [{
        expiration: new Date('2023-01-31T00:00:00.000Z'),
        id: '12345azerty',
        refreshToken: '12345azerty',
        userAgent: 'UNKNOWN',
      }, {
        id: 'test',
      }],
    });
  });

  test('[requestEmailVerification] email already verified', async () => {
    const context = { user: { _verifiedAt: new Date() } } as unknown as CommandContext;
    expect(async () => {
      await engine.requestEmailVerification(context);
    }).rejects.toThrow(new EngineError('EMAIL_ALREADY_VERIFIED'));
  });

  test('[requestEmailVerification] email not verified', async () => {
    const context = { user: { _verifiedAt: null, email: 'test@test.io' } } as unknown as CommandContext;
    await engine.requestEmailVerification(context);
    expect(cacheClient.set).toHaveBeenCalledTimes(1);
    expect(cacheClient.set).toHaveBeenCalledWith('abcde8997', '12345azerty', 7200);
    expect(emailClient.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
      'test@test.io',
      'https://test.com/verify-email?verifyToken=12345azerty',
    );
  });

  test('[verifyEmail] invalid verify token', async () => {
    const context = { user: {} } as unknown as CommandContext;
    expect(async () => {
      await engine.verifyEmail('invalid', context);
    }).rejects.toThrow(new EngineError('INVALID_VERIFY_TOKEN'));
  });

  test('[verifyEmail] invalid verify token', async () => {
    const context = { user: { _id: new Id('64723318e84f943f1ad6578b') } } as unknown as CommandContext;
    await engine.verifyEmail('test', context);
    expect(cacheClient.delete).toHaveBeenCalledTimes(1);
    expect(cacheClient.delete).toHaveBeenCalledWith('abcde8997');
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('64723318e84f943f1ad6578b'), {
      _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    });
  });

  test('[requestPasswordReset] user does not exist', async () => {
    process.env.NO_RESULT = 'true';
    await engine.requestPasswordReset('test@test.io');
    expect(emailClient.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('[requestPasswordReset] user exists', async () => {
    await engine.requestPasswordReset('test@test.io');
    expect(cacheClient.set).toHaveBeenCalledTimes(1);
    expect(cacheClient.set).toHaveBeenCalledWith('abcde8997', '12345azerty', 7200);
    expect(emailClient.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(emailClient.sendPasswordResetEmail).toHaveBeenCalledWith(
      'test@test.io',
      'https://test.com/reset-password?email=test@test.io&resetToken=12345azerty',
    );
  });

  test('[resetPassword] passwords mismatch', async () => {
    expect(async () => {
      await engine.resetPassword('test@test.io', 'test', 'invalid', 'token');
    }).rejects.toThrow(new EngineError('PASSWORDS_MISMATCH'));
  });

  test('[resetPassword] invalid reset token', async () => {
    expect(async () => {
      await engine.resetPassword('test@test.io', 'test', 'test', 'token');
    }).rejects.toThrow(new EngineError('INVALID_RESET_TOKEN'));
  });

  test('[resetPassword] no user', async () => {
    process.env.NO_RESULT = 'true';
    expect(async () => {
      await engine.resetPassword('test@test.io', 'test', 'test', 'test');
    }).rejects.toThrow(new EngineError('NO_USER'));
  });

  test('[resetPassword] invalid verify token', async () => {
    await engine.resetPassword('test@test.io', 'test', 'test', 'test');
    expect(cacheClient.delete).toHaveBeenCalledTimes(1);
    expect(cacheClient.delete).toHaveBeenCalledWith('abcde8997');
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('64723318e84f943f1ad6578b'), {
      _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      password: 'HASHED_TEXT_test',
      _devices: [],
    });
  });

  test('[refreshToken] no user', async () => {
    const context = {
      user: {
        _id: new Id('64723318e84f943f1ad6578b'),
        _devices: [],
      },
    } as unknown as CommandContext;
    expect(async () => {
      await engine.refreshToken('token', context);
    }).rejects.toThrow(new EngineError('INVALID_REFRESH_TOKEN'));
  });

  test('[refreshToken] valid verify token, existing device', async () => {
    const context = {
      user: {
        _id: new Id('64723318e84f943f1ad6578b'),
        _devices: [{
          id: 'test',
          refreshToken: 'token',
          expiration: new Date('2024-01-01'),
        }],
      },
      deviceId: 'test',
    } as unknown as CommandContext;
    const credentials = await engine.refreshToken('token', context);
    expect(credentials).toEqual({
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      deviceId: 'test',
      expiresIn: 1200,
      refreshToken: '12345azerty',
      refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
    });
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('64723318e84f943f1ad6578b'), {
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      _devices: [{
        id: 'test',
        userAgent: 'UNKNOWN',
        refreshToken: '12345azerty',
        expiration: new Date('2023-01-31T00:00:00.000Z'),
      }],
    });
  });

  test('[signOut]', async () => {
    const context = {
      user: {
        _id: new Id('64723318e84f943f1ad6578b'),
        _devices: [{
          id: 'test',
          refreshToken: 'token',
          expiration: new Date('2024-01-01'),
        }],
      },
      deviceId: 'test',
    } as unknown as CommandContext;
    await engine.signOut(context);
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('64723318e84f943f1ad6578b'), {
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      _devices: [],
    });
  });

  test('[reset]', async () => {
    await engine.reset('test@test.io', 'test');
    expect(logger.info).toHaveBeenCalledTimes(3);
    expect(logger.info).toHaveBeenCalledWith('[OAuthEngine][reset] Creating root user...');
    expect(logger.info).toHaveBeenCalledWith('[OAuthEngine][reset] Creating root role...');
    expect(logger.info).toHaveBeenCalledWith('[OAuthEngine][reset] Updating root user...');
    expect(databaseClient.create).toHaveBeenCalledTimes(2);
    expect(databaseClient.create).toHaveBeenCalledWith('users', {
      _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      _verifiedAt: null,
      _apiKeys: [],
      _devices: [{
        expiration: new Date('2023-01-31T00:00:00.000Z'),
        id: '12345azerty',
        refreshToken: '12345azerty',
        userAgent: 'UNKNOWN',
      }],
      email: 'test@test.io',
      password: 'HASHED_TEXT_test',
      roles: [],
    });
    expect(databaseClient.create).toHaveBeenCalledWith('roles', {
      name: 'ROOT',
      permissions: [
        'USERS_DETAILS_VIEW',
        'USERS_ROLES_UPDATE',
        'USERS_VIEW',
        'USERS_LIST',
        'USERS_SEARCH',
        'USERS_CREATE',
        'USERS_UPDATE',
        'USERS_DELETE',
        'ROLES_VIEW',
        'ROLES_LIST',
        'ROLES_SEARCH',
        'ROLES_CREATE',
        'ROLES_UPDATE',
        'ROLES_DELETE',
      ],
    });
    expect(databaseClient.update).toHaveBeenCalledTimes(1);
    expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('64723318e84f943f1ad6578b'), {
      roles: [new Id('64723318e84f943f1ad6578b')],
    });
  });
});
